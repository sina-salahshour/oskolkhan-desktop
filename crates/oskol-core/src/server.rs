//! Local media/image server: `http://127.0.0.1:<port>/<token>/<backend path>`.
//!
//! The token (24 random bytes, hex) is in the path because `<img>` and media players
//! cannot add headers. Requests are proxied through the routing layer (with failover).
//!
//! `GET`/`HEAD /<token>/stream?urn=<urn>&id=<fileId>` is the media stream-proxy. It
//! reproduces what the Android app's native proxy (`libexo.so`) does with the in-app
//! player's URL (`NativePipeDataSource` → `http://127.0.0.1:<port>/<urn>`,
//! native-protocol §13): the urn's first path segment is a `.`-separated list of base-62
//! **route-group ids** (the media-CDN server groups mirroring the file); the rest of the
//! urn is the upstream path, forwarded unchanged. We resolve those groups against the live
//! routing table and do a pinned Range GET (SNI = Host = route host, SPKI pin, egress on
//! `OSKOL_BIND_INTERFACE`, mobile UA), failing over across the groups' endpoints, then
//! stream back `200`/`206`.

use crate::backend::{Backend, BackendRequest};
use crate::media;
use crate::routing::Route;
use crate::transcode::{self, HlsSession};
use axum::body::Body;
use axum::extract::{Path, RawQuery, State};
use axum::http::{header, HeaderMap, HeaderValue, Method, Response, StatusCode};
use axum::routing::get;
use axum::Router;
use futures::StreamExt;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
struct ServerState {
    token: Arc<str>,
    backend: Arc<Backend>,
    /// Mobile UA the media CDN is gated on (`CoreConfig.fallback_user_agent`).
    user_agent: Arc<str>,
    /// This server's own loopback base, `http://127.0.0.1:<port>/<token>`, so the
    /// HLS transcoder can point ffmpeg at the local `/stream` endpoint.
    base: Arc<str>,
    /// Live HLS transcode sessions, keyed by urn session id. Dropping an entry
    /// kills its ffmpeg and removes the temp dir.
    sessions: Arc<Mutex<HashMap<String, HlsSession>>>,
}

pub struct AssetServer {
    pub addr: SocketAddr,
    pub token: String,
    _task: tokio::task::JoinHandle<()>,
}

impl AssetServer {
    pub fn base(&self) -> String {
        format!("http://{}/{}", self.addr, self.token)
    }

    /// Start the asset server. `user_agent` is the mobile UA the media CDN gates on; the
    /// media stream resolves routes through `backend` (pinned + wlan0-bound per route).
    pub async fn start(backend: Arc<Backend>, user_agent: String) -> std::io::Result<Self> {
        let token = hex::encode(rand::random::<[u8; 24]>());
        // Sweep any HLS temp dirs left by a previous (crashed) run.
        let _ = std::fs::remove_dir_all(std::env::temp_dir().join("oskol-hls"));
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0)).await?;
        let addr = listener.local_addr()?;
        let state = ServerState {
            token: token.clone().into(),
            backend,
            user_agent: user_agent.into(),
            base: format!("http://{addr}/{token}").into(),
            sessions: Arc::new(Mutex::new(HashMap::new())),
        };
        let app = Router::new()
            // Matched before the catch-all: matchit gives the static segments
            // priority over `{*path}`.
            .route("/{token}/stream", get(stream).head(stream))
            .route("/{token}/hls/open", get(hls_open))
            .route("/{token}/hls/{sid}/{file}", get(hls_file).head(hls_file))
            .route("/{token}/{*path}", get(proxy).head(proxy))
            .with_state(state);
        let task = tokio::spawn(async move {
            if let Err(e) = axum::serve(listener, app).await {
                tracing::error!(error = %e, "asset server stopped");
            }
        });
        tracing::info!(%addr, "asset server listening");
        Ok(Self { addr, token, _task: task })
    }
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

const FORWARD_RESPONSE_HEADERS: &[header::HeaderName] = &[
    header::CONTENT_TYPE,
    header::CONTENT_LENGTH,
    header::CONTENT_RANGE,
    header::ACCEPT_RANGES,
    header::CACHE_CONTROL,
    header::ETAG,
    header::LAST_MODIFIED,
];

async fn proxy(
    State(st): State<ServerState>,
    Path((token, path)): Path<(String, String)>,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
) -> Response<Body> {
    if !constant_time_eq(token.as_bytes(), st.token.as_bytes()) {
        return status(StatusCode::NOT_FOUND);
    }
    let mut full = format!("/{path}");
    if let Some(q) = query {
        full.push('?');
        full.push_str(&q);
    }
    let mut req = BackendRequest::get(full);
    for name in [header::RANGE, header::IF_NONE_MATCH, header::IF_MODIFIED_SINCE] {
        if let Some(v) = headers.get(&name).and_then(|v| v.to_str().ok()) {
            req = req.header(name.as_str(), v);
        }
    }
    let upstream = match st.backend.send(req).await {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!(error = %e, "asset proxy failed");
            return status(StatusCode::BAD_GATEWAY);
        }
    };
    let mut builder = Response::builder().status(upstream.status().as_u16());
    for name in FORWARD_RESPONSE_HEADERS {
        if let Some(v) = upstream.headers().get(name.as_str()) {
            if let Ok(v) = HeaderValue::from_bytes(v.as_bytes()) {
                builder = builder.header(name, v);
            }
        }
    }
    builder = builder.header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*");
    let stream = upstream.bytes_stream().map(|r| r.map_err(std::io::Error::other));
    builder.body(Body::from_stream(stream)).unwrap_or_else(|_| status(StatusCode::BAD_GATEWAY))
}

/// `urn` (url-encoded) + optional `id` from the query string. `None` if no `urn`.
fn parse_stream_query(query: Option<&str>) -> Option<(String, i64)> {
    let q = query?;
    let mut urn = None;
    let mut id = 0i64;
    for (k, v) in url::form_urlencoded::parse(q.as_bytes()) {
        match k.as_ref() {
            "urn" => urn = Some(v.into_owned()),
            "id" => id = v.parse().unwrap_or(0),
            _ => {}
        }
    }
    urn.map(|u| (u, id))
}

/// Media-CDN candidate endpoints for a urn, in the order to try them: the urn's decoded
/// route groups (native-protocol §13) in decoded order, each group's endpoints in table
/// order, de-duplicated by route key. Empty if the table has no matching group.
fn media_candidates(table: &crate::routing::RoutingTable, groups: &[i64]) -> Vec<Route> {
    let mut out: Vec<Route> = Vec::new();
    for g in groups {
        for r in &table.routes {
            if i64::from(r.group) == *g && !out.iter().any(|o| o.key() == r.key()) {
                out.push(r.clone());
            }
        }
    }
    out
}

/// `GET`/`HEAD /<token>/stream?urn=<urn>&id=<fileId>`: resolve the urn's leading route
/// selector to media-CDN endpoints and stream the real file back (Range-aware), fetched
/// over the bound uplink with pin-only TLS and the mobile UA (native-protocol §13). `id` is
/// accepted for contract parity with the external-link builder but is not needed here.
async fn stream(
    State(st): State<ServerState>,
    Path(token): Path<String>,
    RawQuery(query): RawQuery,
    method: Method,
    headers: HeaderMap,
) -> Response<Body> {
    if !constant_time_eq(token.as_bytes(), st.token.as_bytes()) {
        return status(StatusCode::NOT_FOUND);
    }
    let Some((urn, _id)) = parse_stream_query(query.as_deref()) else {
        return status(StatusCode::BAD_REQUEST);
    };

    // Reverse the in-app player's urn: first segment = base-62 route groups, rest = path.
    let (groups, path) = media::urn_route(&urn);
    let table = st.backend.table();
    if table.routes.is_empty() {
        // Routing not bootstrapped yet — the player should retry.
        return status(StatusCode::SERVICE_UNAVAILABLE);
    }
    let candidates = media_candidates(&table, &groups);
    if candidates.is_empty() {
        tracing::debug!(?groups, "media urn resolved to no known route group");
        return status(StatusCode::BAD_GATEWAY);
    }

    let range = headers.get(header::RANGE).and_then(|v| v.to_str().ok()).map(str::to_owned);
    // Try each mirror; a real media hit is 2xx/206 (or 416/304). Mirrors that lack the file
    // answer 404/502/5xx — fail over to the next endpoint (verified live: s2/s3 → 502, while
    // sx2 → 206 for the same path).
    let mut last = StatusCode::BAD_GATEWAY;
    for route in &candidates {
        let client = st.backend.client_for_route(route);
        let url = format!("https://{}{}", route.host, path);
        let mut rb = client.request(method.clone(), &url).header(header::USER_AGENT, st.user_agent.as_ref());
        if let Some(r) = &range {
            rb = rb.header(header::RANGE, r);
        }
        match rb.send().await {
            Ok(resp) => {
                let code = resp.status();
                let ok = code.is_success()
                    || code == StatusCode::RANGE_NOT_SATISFIABLE
                    || code == StatusCode::NOT_MODIFIED;
                if ok {
                    return forward(resp, &method);
                }
                tracing::debug!(host = %route.host, ip = %route.ip, %code, "media mirror miss");
                last = StatusCode::from_u16(code.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
            }
            Err(e) => tracing::debug!(host = %route.host, ip = %route.ip, error = %e, "media fetch failed"),
        }
    }
    status(last)
}

/// Forward an upstream media response (status + the whitelisted headers), streaming the
/// body for `GET` and dropping it for `HEAD`.
fn forward(upstream: reqwest::Response, method: &Method) -> Response<Body> {
    let mut builder = Response::builder().status(upstream.status().as_u16());
    for name in FORWARD_RESPONSE_HEADERS {
        if let Some(v) = upstream.headers().get(name.as_str()) {
            if let Ok(v) = HeaderValue::from_bytes(v.as_bytes()) {
                builder = builder.header(name, v);
            }
        }
    }
    builder = builder.header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*");
    if method == Method::HEAD {
        return builder.body(Body::empty()).unwrap_or_else(|_| status(StatusCode::BAD_GATEWAY));
    }
    let stream = upstream.bytes_stream().map(|r| r.map_err(std::io::Error::other));
    builder.body(Body::from_stream(stream)).unwrap_or_else(|_| status(StatusCode::BAD_GATEWAY))
}

fn status(code: StatusCode) -> Response<Body> {
    Response::builder().status(code).body(Body::empty()).unwrap()
}

fn json_response(code: StatusCode, body: String) -> Response<Body> {
    Response::builder()
        .status(code)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::CACHE_CONTROL, "no-store")
        .body(Body::from(body))
        .unwrap_or_else(|_| status(StatusCode::INTERNAL_SERVER_ERROR))
}

fn audio_label(a: &transcode::AudioInfo, pos: usize) -> String {
    a.title
        .clone()
        .or_else(|| a.lang.clone())
        .unwrap_or_else(|| format!("Audio {}", pos + 1))
}

fn sub_label(s: &transcode::SubInfo, pos: usize) -> String {
    s.title
        .clone()
        .or_else(|| s.lang.clone())
        .unwrap_or_else(|| format!("Subtitle {}", pos + 1))
}

/// `GET /<token>/hls/open?urn=<urn>&id=<fileId>[&audio=<pos>]`: probe the media and
/// create (or reuse) an on-demand transcode session, returning `{ playlist, duration,
/// audioTracks, subtitleTracks, … }` as JSON. No transcoding happens here — segments
/// are produced lazily as hls.js requests them — so this returns as soon as ffprobe
/// finishes. The renderer feeds `playlist` to hls.js.
async fn hls_open(
    State(st): State<ServerState>,
    Path(token): Path<String>,
    RawQuery(query): RawQuery,
) -> Response<Body> {
    if !constant_time_eq(token.as_bytes(), st.token.as_bytes()) {
        return status(StatusCode::NOT_FOUND);
    }
    let Some((urn, id)) = parse_stream_query(query.as_deref()) else {
        return json_response(StatusCode::BAD_REQUEST, r#"{"error":"missing urn"}"#.into());
    };
    let audio_pos = query
        .as_deref()
        .and_then(|q| {
            url::form_urlencoded::parse(q.as_bytes())
                .find(|(k, _)| k == "audio")
                .and_then(|(_, v)| v.parse::<usize>().ok())
        })
        .unwrap_or(0);

    // ffmpeg reads the core's own /stream endpoint (reusing the pinned/wlan0 egress).
    let local_url = {
        let mut s = format!("{}/stream?", st.base);
        s.push_str(
            &url::form_urlencoded::Serializer::new(String::new())
                .append_pair("urn", &urn)
                .append_pair("id", &id.to_string())
                .finish(),
        );
        s
    };

    let sid = transcode::session_id(&urn, audio_pos);
    let has = st.sessions.lock().unwrap().contains_key(&sid);
    if !has {
        let urn2 = urn.clone();
        let local2 = local_url.clone();
        let started = tokio::task::spawn_blocking(move || HlsSession::start(&urn2, &local2, audio_pos)).await;
        match started {
            Ok(Ok(session)) => {
                let jobs = session.storyboard_jobs();
                let dir = session.dir.clone();
                {
                    let mut reg = st.sessions.lock().unwrap();
                    // Keep only the current session: dropping the others removes their
                    // cached-segment temp dirs (frees the previous movie's disk).
                    reg.retain(|k, _| k == &sid);
                    reg.insert(sid.clone(), session);
                }
                // Pre-generate the storyboard in the background, one frame at a time
                // (throttled so it doesn't starve playback). Stops if the session's
                // dir is removed (user switched titles).
                tokio::spawn(async move {
                    // Let playback get a head start before we compete for bandwidth.
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                    for job in jobs {
                        if !dir.exists() {
                            break;
                        }
                        let _ = tokio::task::spawn_blocking(move || job.run()).await;
                        tokio::time::sleep(std::time::Duration::from_millis(150)).await;
                    }
                });
            }
            Ok(Err(e)) => {
                tracing::warn!(error = %e, "hls session start failed");
                return json_response(StatusCode::BAD_GATEWAY, serde_json::json!({ "error": e.to_string() }).to_string());
            }
            Err(e) => return json_response(StatusCode::INTERNAL_SERVER_ERROR, serde_json::json!({ "error": e.to_string() }).to_string()),
        }
    }

    let reg = st.sessions.lock().unwrap();
    let Some(session) = reg.get(&sid) else {
        return json_response(StatusCode::BAD_GATEWAY, r#"{"error":"session lost"}"#.into());
    };
    let plan = &session.plan;
    let audio_tracks: Vec<_> = plan
        .audios
        .iter()
        .enumerate()
        .map(|(i, a)| serde_json::json!({ "id": format!("a{i}"), "label": audio_label(a, i), "lang": a.lang }))
        .collect();
    let sub_tracks: Vec<_> = plan
        .subs
        .iter()
        .enumerate()
        .map(|(i, s)| serde_json::json!({ "id": format!("s{i}"), "label": sub_label(s, i), "lang": s.lang, "source": "server", "text": s.text }))
        .collect();
    let body = serde_json::json!({
        "playlist": format!("/{}/hls/{}/index.m3u8", token, sid),
        "duration": plan.duration,
        "width": plan.width,
        "height": plan.height,
        "videoCodec": plan.video_codec,
        "transcoding": !plan.video_copy,
        "audioTracks": audio_tracks,
        "subtitleTracks": sub_tracks,
        "storyboardCount": session.storyboard_count(),
        "storyboardInterval": session.storyboard_interval(),
    });
    json_response(StatusCode::OK, body.to_string())
}

/// `GET /<token>/hls/<sid>/<file>`: serve the VOD playlist (`index.m3u8`) or a TS
/// segment (`segNNNNN.ts`). Segments are produced on demand (ffmpeg seek+encode)
/// and cached. The filename is whitelisted to prevent path traversal.
async fn hls_file(
    State(st): State<ServerState>,
    Path((token, sid, file)): Path<(String, String, String)>,
    method: Method,
) -> Response<Body> {
    if !constant_time_eq(token.as_bytes(), st.token.as_bytes()) {
        return status(StatusCode::NOT_FOUND);
    }

    // The playlist is generated from the session plan (not a file on disk).
    if file == "index.m3u8" {
        let reg = st.sessions.lock().unwrap();
        let Some(session) = reg.get(&sid) else {
            return status(StatusCode::NOT_FOUND);
        };
        let body = transcode::build_vod_playlist(&session.plan);
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .header(header::CACHE_CONTROL, "no-store")
            .body(Body::from(body))
            .unwrap_or_else(|_| status(StatusCode::INTERNAL_SERVER_ERROR));
    }

    // Otherwise it must be segNNNNN.ts (a TS segment) or thumbNNNNN.jpg (a preview).
    enum Kind {
        Seg(usize),
        Thumb(usize),
    }
    let parse_n = |s: &str, pre: &str, suf: &str| -> Option<usize> {
        s.strip_prefix(pre)
            .and_then(|x| x.strip_suffix(suf))
            .filter(|d| !d.is_empty() && d.chars().all(|c| c.is_ascii_digit()))
            .and_then(|d| d.parse::<usize>().ok())
    };
    let (kind, content_type, cacheable) = if let Some(i) = parse_n(&file, "seg", ".ts") {
        (Kind::Seg(i), "video/mp2t", "no-store")
    } else if let Some(n) = parse_n(&file, "sb", ".jpg") {
        (Kind::Thumb(n), "image/jpeg", "public, max-age=86400")
    } else {
        return status(StatusCode::NOT_FOUND);
    };

    // Fast path: already cached on disk.
    let cached = transcode::session_dir(&sid).join(&file);
    let path = if tokio::fs::metadata(&cached).await.map(|m| m.len() > 0).unwrap_or(false) {
        cached
    } else {
        // Build the ffmpeg job under the lock (bounds-checked), run it off-lock.
        let job = {
            let reg = st.sessions.lock().unwrap();
            let Some(session) = reg.get(&sid) else {
                return status(StatusCode::NOT_FOUND);
            };
            match kind {
                Kind::Seg(i) => {
                    if i >= session.plan.segment_count() {
                        return status(StatusCode::NOT_FOUND);
                    }
                    session.segment_job(i)
                }
                Kind::Thumb(n) => {
                    if n >= session.storyboard_count() {
                        return status(StatusCode::NOT_FOUND);
                    }
                    session.sb_job(n)
                }
            }
        };
        match tokio::task::spawn_blocking(move || job.run()).await {
            Ok(Ok(p)) => p,
            Ok(Err(e)) => {
                tracing::warn!(sid = %sid, file = %file, error = %e, "hls artifact produce failed");
                return status(StatusCode::BAD_GATEWAY);
            }
            Err(_) => return status(StatusCode::INTERNAL_SERVER_ERROR),
        }
    };

    match tokio::fs::read(&path).await {
        Ok(bytes) => {
            let mut b = Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, content_type)
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .header(header::CACHE_CONTROL, cacheable);
            if method == Method::HEAD {
                return b.body(Body::empty()).unwrap_or_else(|_| status(StatusCode::INTERNAL_SERVER_ERROR));
            }
            b = b.header(header::CONTENT_LENGTH, bytes.len());
            b.body(Body::from(bytes)).unwrap_or_else(|_| status(StatusCode::INTERNAL_SERVER_ERROR))
        }
        Err(_) => status(StatusCode::NOT_FOUND),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_stream_query_decodes_urn_and_id() {
        assert_eq!(
            parse_stream_query(Some("urn=stream%2Fxyz%2FThe.Salesman.2016.mp4&id=12345")),
            Some(("stream/xyz/The.Salesman.2016.mp4".to_string(), 12345)),
        );
        // id defaults to 0 when absent or unparseable.
        assert_eq!(parse_stream_query(Some("urn=a%2Fb.mp4")), Some(("a/b.mp4".to_string(), 0)));
        assert_eq!(parse_stream_query(Some("urn=x&id=notnum")), Some(("x".to_string(), 0)));
        // no urn -> None.
        assert_eq!(parse_stream_query(Some("id=5")), None);
        assert_eq!(parse_stream_query(None), None);
    }
}
