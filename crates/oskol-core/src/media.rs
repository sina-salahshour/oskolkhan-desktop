//! External play / download URL builder.
//!
//! Reproduces exactly the URL the Android app builds for "open in external
//! player" / "copy link" (`sources/p000/ge.java` case 4), so a desktop user can
//! paste the link into mpv/VLC or a downloader. Verified against `libexo.so`
//! (`Interfaces.spike` @ `0x4cd408` → core `FUN_004ba97c`, charset init
//! `_INIT_22` @ `0x4bc0cc`) and the Java helpers (`nf2`, `g41`, `ls7`, `r96`).
//! See `docs/native-protocol.md` §11 for the full write-up.
//!
//! Shape:
//! ```text
//! http://<rand60>.<rand40>.<saltDomain>:<port>/<spikeA>/<spikeB>[/<fileIdEnc>-<filename>]
//! ```
//! * `saltDomain` = `PreLoad.Salt` XOR 0x45 (deterministic; the `.fun` wildcard).
//! * the two leading labels are random per request (non-reproducible noise that
//!   also seeds the spike key); the proxy reads them back from the URL authority.
//! * `spikeA = spike("/" + clean(urn), host)`, `spikeB = spike("PalangOskol" +
//!   rand(200) + "PalangOskol", host)`.
//! * the trailing `/<fileIdEnc>-<filename>` is appended only when the urn's last
//!   path segment carries a file extension.

use rand::Rng;

/// Custom base-62 alphabet used by `spike`'s big-number encoder.
/// From `_INIT_22` (`DAT_00dca950`, len 0x3e): the std::string loaded verbatim.
pub const SPIKE_ALPHABET: &[u8; 62] =
    b"YHDWmMCJcvwEA5oxtjIB3UbK1lP6QqupTXnd8Fi7Rkrs2G0aNe4gVhOfyz9LZS";

/// Custom base-64 alphabet for `g41.m46609b` (file-id encoder, VERIFIED from
/// `g41.f59073a`). Note: not standard base64 — bespoke digit order incl. `.` `_`.
pub const FILEID_ALPHABET: &[u8; 64] =
    b"5EA6FLYQdNOKT2bMXeolv1k.IzRPw3s_a9DVqhgW0rU7cGumZJxi4C8nSypBfjHt";

/// Salt → `.fun` domain transform (`nf2.m53478l(salt, 69)`): byte-wise XOR 0x45.
pub const SALT_XOR: u8 = 0x45;

/// Local proxy port the external URL targets. Android reads it from the native
/// `init` return (`r96.f80991g`, default 1000); the captured sample used 1221.
/// It is the port whatever proxy serves these links must listen on.
pub const DEFAULT_PORT: u16 = 1221;

/// `nf2.m53478l(salt, 69)`: decode the `.fun` base domain from `PreLoad.Salt`.
pub fn salt_domain(salt: &[u8]) -> String {
    String::from_utf8_lossy(&salt.iter().map(|b| b ^ SALT_XOR).collect::<Vec<u8>>()).into_owned()
}

/// `Interfaces.spike(t1, t2)` (VERIFIED, `FUN_004ba97c`).
///
/// 1. repeating-key XOR: `x[i] = t1[i] ^ t2[i % t2.len()]` (key = `t2`),
/// 2. interpret `x` as a big-endian base-256 integer and emit its base-62 digits
///    **least-significant first** (no final reverse), mapped through
///    [`SPIKE_ALPHABET`]. Leading zero bytes drop out of the long division, as in
///    the native code. Empty input → empty string.
pub fn spike(t1: &[u8], t2: &[u8]) -> String {
    if t1.is_empty() || t2.is_empty() {
        return String::new();
    }
    // repeating-key XOR
    let mut num: Vec<u8> = (0..t1.len()).map(|i| t1[i] ^ t2[i % t2.len()]).collect();

    // big-endian base-256 -> base-62, LSD first, via in-place long division.
    let mut out = Vec::new();
    loop {
        let mut rem: u32 = 0;
        let mut quotient: Vec<u8> = Vec::with_capacity(num.len());
        for &b in &num {
            let cur = (rem << 8) | u32::from(b);
            let q = cur / 62;
            rem = cur % 62;
            // suppress leading-zero quotient digits (as the native code does)
            if !(quotient.is_empty() && q == 0) {
                quotient.push(q as u8);
            }
        }
        out.push(SPIKE_ALPHABET[rem as usize]);
        num = quotient;
        if num.is_empty() {
            break;
        }
    }
    // SAFETY: every byte is an ASCII alphabet char.
    String::from_utf8(out).unwrap()
}

/// `g41.m46609b(id)`: bespoke base-64 encode of a (file) id, MSB-first.
pub fn encode_file_id(id: i64) -> String {
    if id == 0 {
        return (FILEID_ALPHABET[0] as char).to_string();
    }
    let neg = id < 0;
    let mut u = id.unsigned_abs();
    let mut digits = Vec::new();
    while u > 0 {
        digits.push(FILEID_ALPHABET[(u % 64) as usize]);
        u /= 64;
    }
    if neg {
        digits.push(b'-');
    }
    digits.reverse();
    String::from_utf8(digits).unwrap()
}

/// `nf2.m53477k(urn)`: normalize the urn's path(+query) and strip the leading
/// `/`, by parsing it under a dummy authority (OkHttp `HttpUrl` on Android).
pub fn clean_urn(urn: &str) -> String {
    let joined = format!("http://1.2.3.4/{}", urn);
    match url::Url::parse(&joined) {
        Ok(u) => {
            let mut s = u.path().to_string();
            if let Some(q) = u.query() {
                if !q.is_empty() {
                    s.push('?');
                    s.push_str(q);
                }
            }
            s.strip_prefix('/').unwrap_or(&s).to_string()
        }
        // On parse failure Android falls back to empty path parts; mirror loosely.
        Err(_) => urn.trim_start_matches('/').to_string(),
    }
}

/// `nf2.m53473g(n)`: `n` random chars from `[a-z0-9]` (a..z then 0..9).
fn random_chars(n: usize) -> String {
    const POOL: &[u8; 36] = b"abcdefghijklmnopqrstuvwxyz0123456789";
    let mut rng = rand::rng();
    (0..n).map(|_| POOL[rng.random_range(0..POOL.len())] as char).collect()
}

/// Build the random host prefix: 100 random `[a-z0-9]` chars, chunked into
/// 60-char labels joined with `.` (`ls7.m52581H(60, …)` + `ns0.D0(…, ".")`).
fn random_host_prefix() -> String {
    let s = random_chars(100);
    s.as_bytes()
        .chunks(60)
        .map(|c| std::str::from_utf8(c).unwrap())
        .collect::<Vec<_>>()
        .join(".")
}

/// The last path segment of the urn (`ls7.o0('/', urn, urn)` = substringAfterLast).
fn last_segment(urn: &str) -> &str {
    match urn.rsplit_once('/') {
        Some((_, tail)) => tail,
        None => urn,
    }
}

/// Whether the last segment has a non-empty file extension
/// (`contains('.') && substringAfterLast('.').len() > 0`).
fn has_extension(seg: &str) -> bool {
    match seg.rsplit_once('.') {
        Some((_, ext)) => !ext.is_empty(),
        None => false,
    }
}

/// Human-readable filename for the result JSON: the last path segment, before
/// any query, percent-decoded.
pub fn urn_filename(urn: &str) -> String {
    let seg = last_segment(urn);
    let seg = seg.split('?').next().unwrap_or(seg);
    percent_decode(seg)
}

fn percent_decode(s: &str) -> String {
    url::form_urlencoded::parse(format!("x={}", s.replace('+', "%2B")).as_bytes())
        .next()
        .map(|(_, v)| v.into_owned())
        .unwrap_or_else(|| s.to_string())
}

/// Inputs to [`build_play_url`] beyond the salt.
pub struct PlayUrlParams<'a> {
    /// `FileV2.urn`.
    pub urn: &'a str,
    /// `FileV2.id`, for the trailing `<fileIdEnc>-<filename>` segment. 0 if unknown.
    pub file_id: i64,
    /// Local proxy port ([`DEFAULT_PORT`] if the caller has none).
    pub port: u16,
}

/// Build the external play/download URL exactly as `ge.java` case 4 does.
///
/// `salt` is the live `PreLoad.Salt` bytes. The two leading host labels are
/// random each call (as on Android); everything else is deterministic.
pub fn build_play_url(salt: &[u8], params: &PlayUrlParams<'_>) -> String {
    let host = format!("{}.{}", random_host_prefix(), salt_domain(salt));

    let clean = clean_urn(params.urn);
    let spike_a = spike(format!("/{}", clean).as_bytes(), host.as_bytes());

    let pad_input = format!("PalangOskol{}PalangOskol", random_chars(200));
    let spike_b = spike(pad_input.as_bytes(), host.as_bytes());

    let mut url = format!("http://{host}:{}/{spike_a}/{spike_b}", params.port);

    let seg = last_segment(params.urn);
    if has_extension(seg) {
        let file_id_enc = encode_file_id(params.file_id);
        // str_t0 = substringBefore('?', clean(lastSegment))
        let clean_seg = clean_urn(seg);
        let str_t0 = clean_seg.split('?').next().unwrap_or(&clean_seg);
        url = format!("{url}/{file_id_enc}-{str_t0}");
    }
    url
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_SALT_DOMAIN: &str = "d4k4pp4hei8et7qi73n09h3vgfc.fun";

    /// The live `PreLoad.Salt` bytes (sample vault): `.fun` domain XOR 0x45.
    fn sample_salt() -> Vec<u8> {
        SAMPLE_SALT_DOMAIN.bytes().map(|b| b ^ SALT_XOR).collect()
    }

    #[test]
    fn salt_domain_matches_sample() {
        assert_eq!(salt_domain(&sample_salt()), SAMPLE_SALT_DOMAIN);
    }

    #[test]
    fn spike_golden_tiny() {
        // "AB" ^ "xy" = 0x39,0x3b = 0x393b; base62(LSD-first, custom alphabet).
        assert_eq!(spike(b"AB", b"xy"), "B4W");
    }

    #[test]
    fn spike_golden_fixed_host() {
        // Fixed (urn-path, host) -> exact spike output (regression lock).
        let host = b"abc.def.d4k4pp4hei8et7qi73n09h3vgfc.fun";
        let got = spike(b"/the.salesman.2016.mp4", host);
        // all chars from the custom alphabet, deterministic for this fixed input
        assert!(got.bytes().all(|c| SPIKE_ALPHABET.contains(&c)));
        assert_eq!(got, "ptFykGlIbMeqyd1TdfV9AlfzQRmLWW");
    }

    #[test]
    fn spike_is_alphabet_only() {
        let host = b"abc.d4k4pp4hei8et7qi73n09h3vgfc.fun";
        let s = spike(b"PalangOskolxyzPalangOskol", host);
        assert!(!s.is_empty());
        assert!(s.bytes().all(|c| SPIKE_ALPHABET.contains(&c)));
    }

    #[test]
    fn file_id_encode_known() {
        assert_eq!(encode_file_id(0), (FILEID_ALPHABET[0] as char).to_string());
        // base-64 (custom), MSB-first; 64 -> "1,0" digits -> alphabet[1],alphabet[0]
        assert_eq!(encode_file_id(64), format!("{}{}", FILEID_ALPHABET[1] as char, FILEID_ALPHABET[0] as char));
    }

    #[test]
    fn clean_urn_strips_leading_slash() {
        assert_eq!(clean_urn("stream/a/b.mp4"), "stream/a/b.mp4");
        // A urn with its own leading '/' becomes '//…' under the dummy authority;
        // Android strips exactly one slash (`ts7.m59387C`), so one remains.
        assert_eq!(clean_urn("/stream/a/b.mp4"), "/stream/a/b.mp4");
        // query is preserved and joined with '?'
        assert_eq!(clean_urn("r/file.mp4?x=1"), "r/file.mp4?x=1");
    }

    #[test]
    fn built_url_has_expected_shape() {
        let salt = sample_salt();
        let url = build_play_url(
            &salt,
            &PlayUrlParams { urn: "stream/xyz/The.Salesman.2016.mp4", file_id: 12345, port: 1221 },
        );
        // http://<rand>.<rand>.<saltDomain>:<port>/<spikeA>/<spikeB>/<fileIdEnc>-<filename>
        let rest = url.strip_prefix("http://").expect("scheme");
        let (authority, path) = rest.split_once('/').expect("path");
        let (host, port) = authority.rsplit_once(':').expect("port");
        assert_eq!(port, "1221");
        assert!(host.ends_with(&format!(".{SAMPLE_SALT_DOMAIN}")), "host={host}");
        // exactly: <rand60>.<rand40>.<27char>.fun  => salt domain contributes the last two labels
        let labels: Vec<&str> = host.split('.').collect();
        assert!(labels.len() >= 4, "labels={labels:?}");
        let segs: Vec<&str> = path.split('/').collect();
        assert_eq!(segs.len(), 3, "segs={segs:?}");
        assert!(segs[0].bytes().all(|c| SPIKE_ALPHABET.contains(&c)));
        assert!(segs[1].bytes().all(|c| SPIKE_ALPHABET.contains(&c)));
        assert!(segs[2].ends_with("-The.Salesman.2016.mp4"), "tail={}", segs[2]);
    }

    #[test]
    fn no_extension_skips_tail_segment() {
        let salt = sample_salt();
        let url = build_play_url(&salt, &PlayUrlParams { urn: "stream/xyz/novext", file_id: 1, port: 1000 });
        let path = url.strip_prefix("http://").unwrap().split_once('/').unwrap().1;
        assert_eq!(path.split('/').count(), 2, "url={url}");
    }

    #[test]
    fn filename_parsed_from_tail() {
        assert_eq!(urn_filename("a/b/The.Salesman.2016.mp4"), "The.Salesman.2016.mp4");
        assert_eq!(urn_filename("a/b/The%20Movie.mp4?x=1"), "The Movie.mp4");
    }
}
