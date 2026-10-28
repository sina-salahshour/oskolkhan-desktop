//! Route bootstrap ("kickstart"): payload decoding and the public sources.
//!
//! Decoding mirrors `p000/su9.java`:
//! trim → base64 → brotli → `hellix` → per item: split key bytes at `x`, XOR the rest
//! cyclically → `hell`.

use crate::error::{CoreError, Result};
use crate::proto::pmodel::{Hell, Hellix};
use base64::Engine;
use prost::Message;
use regex::Regex;
use std::io::Read;
use std::net::IpAddr;
use std::sync::LazyLock;

/// Decode a kickstart text payload into its `hell` entries.
pub fn decode_payload(payload: &str) -> Result<Vec<Hell>> {
    let cleaned: String = payload.chars().filter(|c| !c.is_whitespace()).collect();
    if cleaned.is_empty() {
        return Err(CoreError::decode("empty kickstart payload"));
    }
    let raw = decode_base64(&cleaned)?;
    decode_compressed(&raw)
}

/// Decode brotli-compressed `hellix` bytes.
pub fn decode_compressed(raw: &[u8]) -> Result<Vec<Hell>> {
    let mut decompressed = Vec::new();
    brotli::Decompressor::new(raw, 4096)
        .read_to_end(&mut decompressed)
        .map_err(|e| CoreError::decode(format!("brotli: {e}")))?;
    let hellix = Hellix::decode(decompressed.as_slice())?;
    let mut out = Vec::with_capacity(hellix.items.len());
    for item in &hellix.items {
        let (key, rest) = split_key(&item.hell, &item.x)?;
        let plain = xor_cyclic(&rest, &key);
        out.push(Hell::decode(plain.as_slice())?);
    }
    if out.is_empty() {
        return Err(CoreError::decode("kickstart payload has no entries"));
    }
    Ok(out)
}

fn decode_base64(s: &str) -> Result<Vec<u8>> {
    use base64::engine::general_purpose::{STANDARD, STANDARD_NO_PAD, URL_SAFE, URL_SAFE_NO_PAD};
    for engine in [&STANDARD, &STANDARD_NO_PAD, &URL_SAFE, &URL_SAFE_NO_PAD] {
        if let Ok(v) = engine.decode(s) {
            return Ok(v);
        }
    }
    Err(CoreError::decode("kickstart payload is not base64"))
}

/// `nf2.m53467a`: bytes at the indices form the key; the remaining bytes (in order) are data.
pub fn split_key(bytes: &[u8], idx: &[i32]) -> Result<(Vec<u8>, Vec<u8>)> {
    let mut key = Vec::with_capacity(idx.len());
    for &i in idx {
        let b = usize::try_from(i)
            .ok()
            .and_then(|i| bytes.get(i))
            .ok_or_else(|| CoreError::decode("kickstart key index out of range"))?;
        key.push(*b);
    }
    let rest = bytes
        .iter()
        .enumerate()
        .filter(|(i, _)| !idx.contains(&(*i as i32)))
        .map(|(_, b)| *b)
        .collect();
    Ok((key, rest))
}

pub fn xor_cyclic(data: &[u8], key: &[u8]) -> Vec<u8> {
    if key.is_empty() {
        return data.to_vec();
    }
    data.iter().enumerate().map(|(i, b)| b ^ key[i % key.len()]).collect()
}

// ---------------------------------------------------------------------------
// Sources (p000/nl7.java)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Extractor {
    RawText,
    Github,
    Blogfa,
    Aparat,
}

#[derive(Debug, Clone)]
pub enum Source {
    Http {
        name: &'static str,
        url: &'static str,
        headers: &'static [(&'static str, &'static str)],
        extractor: Extractor,
    },
    /// DNS TXT record of `domain`, asked at `resolver` (or the system resolver).
    Txt { name: &'static str, domain: &'static str, resolver: Option<&'static str> },
}

impl Source {
    pub fn name(&self) -> &'static str {
        match self {
            Source::Http { name, .. } | Source::Txt { name, .. } => name,
        }
    }
    pub fn resolver_ip(&self) -> Option<IpAddr> {
        match self {
            Source::Txt { resolver: Some(r), .. } => r.parse().ok(),
            _ => None,
        }
    }
}

const FIREFOX_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0";
const CHROME_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/// Same order as the Android list.
pub static SOURCES: &[Source] = &[
    Source::Http {
        name: "githubusercontent",
        url: "https://raw.githubusercontent.com/HansXmp/kickstarter/main/README.md",
        headers: &[],
        extractor: Extractor::RawText,
    },
    Source::Http {
        name: "github-page",
        url: "https://github.com/HansXmp/kickstarter/blob/main/README.md?plain=1",
        headers: &[
            ("User-Agent", FIREFOX_UA),
            ("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"),
        ],
        extractor: Extractor::Github,
    },
    Source::Txt { name: "tasnimnews.com", domain: "tasnimnews.com", resolver: Some("216.218.132.2") },
    Source::Txt { name: "tabnak.com", domain: "tabnak.com", resolver: Some("216.218.131.2") },
    Source::Http {
        name: "blogfa",
        url: "https://admin.blogfa.com",
        headers: &[
            ("Host", "minax.blogfa.com"),
            ("User-Agent", CHROME_UA),
            ("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"),
            ("Accept-Language", "en-US,en;q=0.9"),
            ("Upgrade-Insecure-Requests", "1"),
        ],
        extractor: Extractor::Blogfa,
    },
    Source::Http {
        name: "aparat",
        url: "https://www.aparat.com/api/fa/v1/user/user/about/username/u_15041158",
        headers: &[
            ("User-Agent", CHROME_UA),
            ("Accept", "application/json, text/plain, */*"),
            ("Accept-Language", "en-US,en;q=0.9,fa;q=0.8"),
            ("Referer", "https://www.aparat.com/"),
            ("Origin", "https://www.aparat.com"),
        ],
        extractor: Extractor::Aparat,
    },
    Source::Txt { name: "5.gamezula.co.uk", domain: "5.gamezula.co.uk", resolver: Some("178.22.122.100") },
    Source::Txt { name: "5.gamezula.sbs", domain: "5.gamezula.sbs", resolver: None },
    Source::Txt { name: "filimo.com", domain: "filimo.com", resolver: Some("216.218.131.2") },
    Source::Txt { name: "mysharebarekat.cf", domain: "mysharebarekat.cf", resolver: Some("216.218.130.2") },
    Source::Txt {
        name: "gdfsjcjlifzpk4ypvupbwnf3sb.cf",
        domain: "gdfsjcjlifzpk4ypvupbwnf3sb.cf",
        resolver: Some("216.218.132.2"),
    },
    Source::Txt {
        name: "gdfsjcjiifzpk4ypvupbwnf3sb.cf",
        domain: "gdfsjcjiifzpk4ypvupbwnf3sb.cf",
        resolver: Some("216.218.131.2"),
    },
    Source::Txt { name: "sharingbox.ml", domain: "sharingbox.ml", resolver: Some("216.218.130.2") },
    Source::Txt { name: "marzfundata.ml", domain: "marzfundata.ml", resolver: Some("216.218.131.2") },
];

// --- extractors -------------------------------------------------------------

pub fn extract(extractor: Extractor, body: &str) -> Option<String> {
    match extractor {
        Extractor::RawText => first_non_blank_line(body),
        Extractor::Github => extract_github(body),
        Extractor::Blogfa => extract_blogfa(body),
        Extractor::Aparat => extract_aparat(body),
    }
}

/// `nl7.m53544b`
fn first_non_blank_line(s: &str) -> Option<String> {
    s.trim().lines().map(str::trim).find(|l| !l.is_empty()).map(str::to_owned)
}

/// `nl7.m53545c`: strip tags and unescape the few entities GitHub emits.
fn strip_html(s: &str) -> String {
    static TAG: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"<[^>]+>").unwrap());
    TAG.replace_all(s, "")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&#x27;", "'")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

/// `nl7.m53543a`: find the first non-empty `rawLines` array and join its trimmed lines.
fn find_raw_lines(v: &serde_json::Value) -> Option<String> {
    match v {
        serde_json::Value::Object(map) => {
            if let Some(serde_json::Value::Array(lines)) = map.get("rawLines") {
                if !lines.is_empty() {
                    let joined: String =
                        lines.iter().filter_map(|l| l.as_str()).map(str::trim).collect();
                    return (!joined.is_empty()).then_some(joined);
                }
            }
            map.values().find_map(find_raw_lines)
        }
        serde_json::Value::Array(items) => items.iter().find_map(find_raw_lines),
        _ => None,
    }
}

fn extract_github(body: &str) -> Option<String> {
    static EMBEDDED: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r#"(?is)<script[^>]*data-target=["']react-app\.embeddedData["'][^>]*>(.*?)</script>"#)
            .unwrap()
    });
    static LC: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r#"(?is)<div[^>]*\bid=["']LC\d+["'][^>]*>(.*?)</div>"#).unwrap()
    });
    let body = body.trim();
    if body.is_empty() {
        return None;
    }
    for cap in EMBEDDED.captures_iter(body) {
        let inner = strip_html(cap.get(1).map_or("", |m| m.as_str()));
        let inner = inner.trim();
        if inner.starts_with('{') {
            if let Some(found) =
                serde_json::from_str::<serde_json::Value>(inner).ok().as_ref().and_then(find_raw_lines)
            {
                return Some(found);
            }
        }
    }
    let lines: String = LC
        .captures_iter(body)
        .map(|c| strip_html(c.get(1).map_or("", |m| m.as_str())).trim().to_owned())
        .filter(|s| !s.is_empty())
        .collect();
    let lines = lines.trim();
    if !lines.is_empty() {
        return Some(lines.to_owned());
    }
    if !body.starts_with('{') && !body.starts_with('<') {
        return first_non_blank_line(body);
    }
    if body.starts_with('{') {
        return serde_json::from_str::<serde_json::Value>(body).ok().as_ref().and_then(find_raw_lines);
    }
    None
}

fn extract_blogfa(body: &str) -> Option<String> {
    static META: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r#"(?i)<meta\s+property=["']google-site-verification["']\s+content=["']([^"']+)["']"#)
            .unwrap()
    });
    META.captures(body)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_owned())
        .filter(|s| !s.is_empty())
}

fn extract_aparat(body: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(body).ok()?;
    v.get("meta")?
        .get("data")?
        .get("description")?
        .as_str()
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;

    fn encode_payload(hells: &[Hell]) -> String {
        let mut items = Vec::new();
        for (n, h) in hells.iter().enumerate() {
            let plain = h.encode_to_vec();
            let key = vec![0x5a ^ n as u8, 0x13, 0xc7];
            let enc = xor_cyclic(&plain, &key);
            // interleave key bytes at positions 0, 2, 5
            let positions = [0usize, 2, 5];
            let mut out = enc.clone();
            for (k, &p) in key.iter().zip(positions.iter()) {
                out.insert(p, *k);
            }
            items.push(crate::proto::pmodel::Hellx {
                hell: out,
                x: positions.iter().map(|p| *p as i32).collect(),
            });
        }
        let hellix = Hellix { items }.encode_to_vec();
        let mut compressed = Vec::new();
        {
            let mut w = brotli::CompressorWriter::new(&mut compressed, 4096, 9, 22);
            std::io::Write::write_all(&mut w, &hellix).unwrap();
        }
        base64::engine::general_purpose::STANDARD.encode(compressed)
    }

    #[test]
    fn roundtrip() {
        let h = Hell {
            h: "edge05.example.ir".into(),
            v: true,
            e: vec![193, 151, 157, 135],
            ish: "alt.example".into(),
            z: 3,
            ..Default::default()
        };
        let payload = format!("  {}\n", encode_payload(&[h.clone(), h.clone()]));
        let out = decode_payload(&payload).unwrap();
        assert_eq!(out, vec![h.clone(), h]);
    }

    #[test]
    fn extractors() {
        assert_eq!(first_non_blank_line("\n\n  abc \nxyz").as_deref(), Some("abc"));
        let gh = r#"<script type="application/json" data-target="react-app.embeddedData">{"payload":{"blob":{"rawLines":[" AAA ","BBB"]}}}</script>"#;
        assert_eq!(extract_github(gh).as_deref(), Some("AAABBB"));
        let bf = r#"<meta property="google-site-verification" content="PAYLOAD123">"#;
        assert_eq!(extract_blogfa(bf).as_deref(), Some("PAYLOAD123"));
        let ap = r#"{"meta":{"data":{"description":"XYZ"}}}"#;
        assert_eq!(extract_aparat(ap).as_deref(), Some("XYZ"));
    }
}
