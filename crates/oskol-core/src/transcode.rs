//! On-demand HLS transcoding/remuxing with ffmpeg, for in-app playback of
//! containers/codecs bundled Chromium cannot play (MKV, HEVC, AC3/EAC3/DTS).
//!
//! Strategy (native-protocol §14): the full timeline is declared up front as a
//! **VOD playlist** of fixed-length MPEG-TS segments; each segment is produced
//! **on demand** when hls.js requests it, by seeking ffmpeg to that timestamp:
//!
//!   ffmpeg -copyts -ss {t} -i {local /stream url} -to {t+seg} \
//!          -c:v copy|h264_nvenc -c:a copy|aac -f mpegts seg{n}.ts
//!
//! `-copyts` keeps the absolute input timestamps, so every independently-produced
//! segment carries the right PTS and hls.js stitches them on the timeline — which
//! fMP4 fragments cannot do without rewriting their base-decode-time. ffmpeg reads
//! the core's OWN `/stream` URL, inheriting the pinned-TLS / SNI / wlan0 / Range
//! egress for free. This gives **instant seeking to any point** (produce the one
//! segment) with no whole-file transcode and no /tmp blow-up.
//!
//! Codecs are decided per-stream by ffprobe: H.264 video + AAC audio are remuxed
//! (`-c copy`), everything else is transcoded (HEVC→h264_nvenc, AC3/DTS/…→AAC).

use crate::error::{CoreError, Result};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::process::{Command, Stdio};

/// One decoded audio stream, as reported by ffprobe.
#[derive(Debug, Clone)]
pub struct AudioInfo {
    pub index: i64,
    pub codec: String,
    pub lang: Option<String>,
    pub title: Option<String>,
    pub channels: i64,
    pub copy: bool,
}

/// One subtitle stream (listed for the UI; extraction is a later phase).
#[derive(Debug, Clone)]
pub struct SubInfo {
    pub index: i64,
    pub codec: String,
    pub lang: Option<String>,
    pub title: Option<String>,
    /// text-based (can become WebVTT) vs image-based (PGS/VOBSUB).
    pub text: bool,
}

/// The playback plan for a file: what ffmpeg must do per stream.
#[derive(Debug, Clone)]
pub struct MediaPlan {
    pub duration: f64,
    pub video_codec: String,
    pub video_copy: bool,
    pub width: i64,
    pub height: i64,
    pub audios: Vec<AudioInfo>,
    pub subs: Vec<SubInfo>,
    /// HLS target segment length, seconds.
    pub seg_secs: f64,
}

const SEG_SECS: f64 = 6.0;
/// Target number of storyboard (scrub-preview) frames across the whole video.
/// They are pre-generated in the background so any hover is instant.
const STORYBOARD_FRAMES: usize = 100;
/// But never denser than one frame per this many seconds (short clips).
const STORYBOARD_MIN_INTERVAL: f64 = 2.0;
/// Storyboard frame width in px (height keeps aspect).
const THUMB_WIDTH: i64 = 240;

impl MediaPlan {
    /// Number of segments across the whole timeline.
    pub fn segment_count(&self) -> usize {
        if self.duration <= 0.0 {
            return 0;
        }
        (self.duration / self.seg_secs).ceil() as usize
    }

    /// Duration of segment `i` (the last one is the remainder).
    fn segment_duration(&self, i: usize) -> f64 {
        let start = i as f64 * self.seg_secs;
        (self.duration - start).min(self.seg_secs).max(0.0)
    }
}

fn tag(stream: &Value, key: &str) -> Option<String> {
    stream
        .get("tags")
        .and_then(|t| t.get(key))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

/// 8-bit 4:2:0 pixel formats Chromium's H.264 decoder accepts for a `copy`.
fn is_browser_pix_fmt(p: &str) -> bool {
    matches!(p, "yuv420p" | "yuvj420p" | "nv12")
}

fn is_text_sub(codec: &str) -> bool {
    matches!(codec, "subrip" | "srt" | "ass" | "ssa" | "webvtt" | "mov_text" | "text")
}

/// Run `ffprobe` on a (local) URL and build a [`MediaPlan`].
pub fn probe(local_url: &str) -> Result<MediaPlan> {
    let out = Command::new("ffprobe")
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            "-user_agent", "oskol-core",
            local_url,
        ])
        .output()
        .map_err(|e| CoreError::unimplemented(format!("ffprobe not runnable: {e}")))?;
    if !out.status.success() {
        return Err(CoreError::server(format!(
            "ffprobe failed ({}): {}",
            out.status,
            String::from_utf8_lossy(&out.stderr).trim()
        )));
    }
    let v: Value = serde_json::from_slice(&out.stdout)
        .map_err(|e| CoreError::decode(format!("ffprobe json: {e}")))?;

    let duration = v
        .get("format")
        .and_then(|f| f.get("duration"))
        .and_then(|d| d.as_str())
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    let empty = Vec::new();
    let streams = v.get("streams").and_then(|s| s.as_array()).unwrap_or(&empty);

    let mut video_codec = String::new();
    let mut video_copy = false;
    let mut width = 0;
    let mut height = 0;
    let mut audios = Vec::new();
    let mut subs = Vec::new();

    for s in streams {
        let codec = s.get("codec_name").and_then(|c| c.as_str()).unwrap_or("").to_string();
        match s.get("codec_type").and_then(|c| c.as_str()) {
            Some("video") => {
                // Skip attached cover art / thumbnails.
                if s.get("disposition").and_then(|d| d.get("attached_pic")).and_then(|a| a.as_i64()) == Some(1) {
                    continue;
                }
                if !video_codec.is_empty() {
                    continue; // first real video stream only
                }
                let pix = s.get("pix_fmt").and_then(|p| p.as_str()).unwrap_or("");
                width = s.get("width").and_then(|w| w.as_i64()).unwrap_or(0);
                height = s.get("height").and_then(|h| h.as_i64()).unwrap_or(0);
                video_copy = codec == "h264" && is_browser_pix_fmt(pix);
                video_codec = codec;
            }
            Some("audio") => {
                let index = s.get("index").and_then(|i| i.as_i64()).unwrap_or(0);
                audios.push(AudioInfo {
                    index,
                    copy: codec == "aac",
                    channels: s.get("channels").and_then(|c| c.as_i64()).unwrap_or(2),
                    lang: tag(s, "language"),
                    title: tag(s, "title"),
                    codec,
                });
            }
            Some("subtitle") => {
                let index = s.get("index").and_then(|i| i.as_i64()).unwrap_or(0);
                subs.push(SubInfo {
                    index,
                    text: is_text_sub(&codec),
                    lang: tag(s, "language"),
                    title: tag(s, "title"),
                    codec,
                });
            }
            _ => {}
        }
    }

    if video_codec.is_empty() {
        return Err(CoreError::decode("no video stream in media".to_string()));
    }

    Ok(MediaPlan {
        duration,
        video_codec,
        video_copy,
        width,
        height,
        audios,
        subs,
        seg_secs: SEG_SECS,
    })
}

/// Stable per-(urn, audio) session id (namespaces the temp dir + the HLS URL path).
pub fn session_id(urn: &str, audio_pos: usize) -> String {
    let mut h = Sha256::new();
    h.update(urn.as_bytes());
    h.update([b'#', audio_pos as u8]);
    hex::encode(&h.finalize()[..12])
}

/// The per-session temp directory under the system temp dir.
pub fn session_dir(sid: &str) -> PathBuf {
    std::env::temp_dir().join("oskol-hls").join(sid)
}

/// The VOD media playlist: the whole timeline declared up front as N TS segments.
pub fn build_vod_playlist(plan: &MediaPlan) -> String {
    let n = plan.segment_count();
    let target = plan.seg_secs.ceil() as i64 + 1;
    let mut s = String::new();
    s.push_str("#EXTM3U\n#EXT-X-VERSION:3\n");
    s.push_str(&format!("#EXT-X-TARGETDURATION:{target}\n"));
    s.push_str("#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:VOD\n");
    for i in 0..n {
        s.push_str(&format!("#EXTINF:{:.3},\n", plan.segment_duration(i)));
        s.push_str(&format!("seg{i:05}.ts\n"));
    }
    s.push_str("#EXT-X-ENDLIST\n");
    s
}

/// A transcode session: owns a temp dir of cached segments + the info needed to
/// produce more on demand. The temp dir is removed on drop.
pub struct HlsSession {
    pub sid: String,
    pub dir: PathBuf,
    pub plan: MediaPlan,
    local_url: String,
    audio_pos: usize,
}

impl HlsSession {
    /// Probe `local_url` and create the (empty) session. Cheap — no transcoding
    /// happens until a segment is requested.
    pub fn start(urn: &str, local_url: &str, audio_pos: usize) -> Result<Self> {
        let plan = probe(local_url)?;
        let sid = session_id(urn, audio_pos);
        let dir = session_dir(&sid);
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir)
            .map_err(|e| CoreError::unimplemented(format!("hls tmp dir: {e}")))?;
        Ok(Self { sid, dir, plan, local_url: local_url.to_string(), audio_pos })
    }

    fn segment_path(&self, i: usize) -> PathBuf {
        self.dir.join(format!("seg{i:05}.ts"))
    }

    /// Build a self-contained, `Send` job that produces segment `i`. The caller runs
    /// `job.run()` on a blocking thread (so the session lock isn't held across ffmpeg).
    pub fn segment_job(&self, i: usize) -> SegmentJob {
        let start = i as f64 * self.plan.seg_secs;
        let end = start + self.plan.seg_secs;
        let out_path = self.segment_path(i);
        let args = self.segment_args(start, end, &out_path);
        SegmentJob { index: i, out_path, args }
    }

    /// Seconds between storyboard frames.
    pub fn storyboard_interval(&self) -> f64 {
        if self.plan.duration <= 0.0 {
            return STORYBOARD_MIN_INTERVAL;
        }
        (self.plan.duration / STORYBOARD_FRAMES as f64).max(STORYBOARD_MIN_INTERVAL)
    }

    /// How many storyboard frames span the timeline.
    pub fn storyboard_count(&self) -> usize {
        if self.plan.duration <= 0.0 {
            return 0;
        }
        (self.plan.duration / self.storyboard_interval()).ceil() as usize + 1
    }

    /// Build a job that extracts one scaled JPEG storyboard frame at index `n`.
    pub fn sb_job(&self, n: usize) -> SegmentJob {
        let t = n as f64 * self.storyboard_interval();
        let out_path = self.dir.join(format!("sb{n:05}.jpg"));
        let mut a: Vec<String> = Vec::new();
        for s in [
            "-y", "-nostdin", "-hide_banner", "-loglevel", "error", "-rw_timeout", "30000000",
            "-user_agent", "oskol-core",
        ] {
            a.push(s.to_string());
        }
        a.push("-ss".into());
        a.push(format!("{t:.3}"));
        a.push("-i".into());
        a.push(self.local_url.clone());
        a.push("-frames:v".into());
        a.push("1".into());
        a.push("-vf".into());
        a.push(format!("scale={THUMB_WIDTH}:-2"));
        a.push("-q:v".into());
        a.push("5".into());
        a.push("-f".into());
        a.push("image2".into());
        a.push("-update".into());
        a.push("1".into());
        a.push(out_path.to_string_lossy().to_string());
        SegmentJob { index: n, out_path, args: a }
    }

    /// All storyboard jobs, in order — run sequentially in the background so hovers
    /// hit pre-generated frames. Self-contained (`Send`), so no session lock is held.
    pub fn storyboard_jobs(&self) -> Vec<SegmentJob> {
        (0..self.storyboard_count()).map(|n| self.sb_job(n)).collect()
    }

    fn segment_args(&self, start: f64, end: f64, out_path: &std::path::Path) -> Vec<String> {
        let p = &self.plan;
        let mut a: Vec<String> = Vec::new();
        let push = |a: &mut Vec<String>, s: &str| a.push(s.to_string());
        push(&mut a, "-y");
        push(&mut a, "-nostdin");
        push(&mut a, "-hide_banner");
        push(&mut a, "-loglevel");
        push(&mut a, "error");
        push(&mut a, "-rw_timeout");
        push(&mut a, "30000000");
        push(&mut a, "-user_agent");
        push(&mut a, "oskol-core");
        if !p.video_copy {
            push(&mut a, "-hwaccel");
            push(&mut a, "cuda");
        }
        // Keep absolute timestamps so the independently-produced segment lands at
        // the right place on the hls.js timeline. Input-seek (before -i) is fast.
        push(&mut a, "-copyts");
        push(&mut a, "-ss");
        push(&mut a, &format!("{start:.3}"));
        push(&mut a, "-i");
        push(&mut a, &self.local_url);
        push(&mut a, "-to");
        push(&mut a, &format!("{end:.3}"));

        // video
        push(&mut a, "-map");
        push(&mut a, "0:v:0");
        if p.video_copy {
            push(&mut a, "-c:v");
            push(&mut a, "copy");
        } else {
            push(&mut a, "-c:v");
            push(&mut a, "h264_nvenc");
            push(&mut a, "-preset");
            push(&mut a, "p4");
            push(&mut a, "-rc");
            push(&mut a, "vbr");
            push(&mut a, "-cq");
            push(&mut a, "24");
            push(&mut a, "-b:v");
            push(&mut a, "0");
            push(&mut a, "-maxrate");
            push(&mut a, "12M");
            push(&mut a, "-bufsize");
            push(&mut a, "24M");
            push(&mut a, "-pix_fmt");
            push(&mut a, "yuv420p");
        }

        // audio (one track; `audio_pos` selects which by plan position)
        if let Some(au) = p.audios.get(self.audio_pos) {
            push(&mut a, "-map");
            push(&mut a, &format!("0:{}", au.index));
            if au.copy {
                push(&mut a, "-c:a");
                push(&mut a, "copy");
            } else {
                push(&mut a, "-c:a");
                push(&mut a, "aac");
                push(&mut a, "-ac");
                push(&mut a, "2");
                push(&mut a, "-b:a");
                push(&mut a, "192k");
            }
        }

        push(&mut a, "-muxdelay");
        push(&mut a, "0");
        push(&mut a, "-f");
        push(&mut a, "mpegts");
        push(&mut a, &out_path.to_string_lossy());
        a
    }
}

impl Drop for HlsSession {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

/// A single on-demand segment production, detached from the session so it can run
/// on a blocking thread without holding the session registry lock.
pub struct SegmentJob {
    index: usize,
    out_path: PathBuf,
    args: Vec<String>,
}

impl SegmentJob {
    /// Run ffmpeg (if the segment isn't already cached) and return the file path.
    pub fn run(self) -> Result<PathBuf> {
        if std::fs::metadata(&self.out_path).map(|m| m.len() > 0).unwrap_or(false) {
            return Ok(self.out_path);
        }
        let out = Command::new("ffmpeg")
            .args(&self.args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .output()
            .map_err(|e| CoreError::unimplemented(format!("ffmpeg not runnable: {e}")))?;
        let ok = out.status.success()
            && std::fs::metadata(&self.out_path).map(|m| m.len() > 0).unwrap_or(false);
        if !ok {
            let err = String::from_utf8_lossy(&out.stderr);
            let tail: String = err
                .lines()
                .rev()
                .take(4)
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect::<Vec<_>>()
                .join(" | ");
            return Err(CoreError::server(format!("segment {} failed: {tail}", self.index)));
        }
        Ok(self.out_path)
    }
}
