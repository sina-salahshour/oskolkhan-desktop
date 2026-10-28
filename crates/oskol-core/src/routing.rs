//! Routing table: hostname + connect IP (+ optional SPKI pin), built from the kickstart
//! `hell` entries or from `interfacess` (`Interfaces.Process`), with an on-disk cache.

use crate::error::{CoreError, Result};
use crate::proto::pmodel::{Hell, Interfacess};
use base64::Engine;
use prost::Message;
use serde::{Deserialize, Serialize};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::path::{Path, PathBuf};

/// Default port. TODO(native-protocol): native routing may use other ports (`hell.p`?).
pub const HTTPS_PORT: u16 = 443;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Route {
    /// SNI and Host.
    pub host: String,
    pub ip: IpAddr,
    pub port: u16,
    /// Raw pin bytes (XOR-decoded `Cpis` entry), if the route is pinned.
    #[serde(default, with = "opt_b64")]
    pub pin: Option<Vec<u8>>,
    /// `ItemGroup` id the route came from.
    pub group: i32,
    /// Native `Item` flags kept for later protocol work.
    /// TODO(native-protocol): meaning of iSS/isp/fr/isC/stk/dp/H is unknown; with `isp`
    /// the bootstrap passes host index 1 (`ish`), which hints at domain fronting
    /// (`front_host` would then be the real Host header).
    pub iss: bool,
    pub isp: bool,
    #[serde(default)]
    pub front_host: Option<String>,
}

impl Route {
    pub fn key(&self) -> String {
        format!("{}@{}:{}", self.host, self.ip, self.port)
    }
}

mod opt_b64 {
    use base64::Engine;
    use serde::{Deserialize, Deserializer, Serializer};
    pub fn serialize<S: Serializer>(v: &Option<Vec<u8>>, s: S) -> Result<S::Ok, S::Error> {
        match v {
            Some(b) => s.serialize_some(&base64::engine::general_purpose::STANDARD.encode(b)),
            None => s.serialize_none(),
        }
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<Option<Vec<u8>>, D::Error> {
        let o: Option<String> = Option::deserialize(d)?;
        o.map(|s| base64::engine::general_purpose::STANDARD.decode(s).map_err(serde::de::Error::custom))
            .transpose()
    }
}

pub fn ip_from_bytes(b: &[u8]) -> Option<IpAddr> {
    match b.len() {
        4 => Some(IpAddr::V4(Ipv4Addr::new(b[0], b[1], b[2], b[3]))),
        16 => {
            let arr: [u8; 16] = b.try_into().ok()?;
            Some(IpAddr::V6(Ipv6Addr::from(arr)))
        }
        _ => None,
    }
}

fn xor1(data: &[u8], key: i32) -> Vec<u8> {
    let k = key as u8;
    data.iter().map(|b| b ^ k).collect()
}

/// Routes from kickstart entries (`dj9` default branch): hosts = [h, ish], host index =
/// `isp ? 1 : 0`, no pins.
pub fn routes_from_hells(hells: &[Hell]) -> Vec<Route> {
    let mut out: Vec<Route> = Vec::new();
    for h in hells {
        let Some(ip) = ip_from_bytes(&h.e) else { continue };
        let (host, front) = if h.isp && !h.ish.is_empty() {
            (h.ish.clone(), Some(h.h.clone()))
        } else {
            (h.h.clone(), None)
        };
        if host.is_empty() {
            continue;
        }
        let r = Route {
            host,
            ip,
            port: HTTPS_PORT,
            pin: None,
            group: 99999999,
            iss: h.iss,
            isp: h.isp,
            front_host: front,
        };
        if !out.iter().any(|o| o.key() == r.key()) {
            out.push(r);
        }
    }
    out
}

/// Decoded `interfacess`: hosts and pins are XOR'd with the single-byte `key`.
pub fn routes_from_interfacess(t: &Interfacess) -> Vec<Route> {
    let hosts: Vec<String> =
        t.hs_n.iter().map(|b| String::from_utf8_lossy(&xor1(b, t.key)).into_owned()).collect();
    let pins: Vec<Vec<u8>> = t.cpis.iter().map(|b| xor1(b, t.key)).collect();
    let mut out: Vec<Route> = Vec::new();
    for group in &t.items {
        for x in &group.items {
            let Some(ip) = ip_from_bytes(&x.endpoint) else { continue };
            let Some(host) = usize::try_from(x.host_name).ok().and_then(|i| hosts.get(i)) else {
                continue;
            };
            if host.is_empty() {
                continue;
            }
            let pin = usize::try_from(x.cpi).ok().and_then(|i| pins.get(i)).filter(|p| !p.is_empty()).cloned();
            let front = if x.isp {
                usize::try_from(x.h).ok().and_then(|i| hosts.get(i)).filter(|h| *h != host).cloned()
            } else {
                None
            };
            let r = Route {
                host: host.clone(),
                ip,
                port: HTTPS_PORT,
                pin,
                group: group.id,
                iss: x.i_ss,
                isp: x.isp,
                front_host: front,
            };
            if !out.iter().any(|o| o.key() == r.key()) {
                out.push(r);
            }
        }
    }
    out
}

/// Android rejects a table with `hash == 0`, no items, or no host names (`z54`).
pub fn interfacess_is_valid(t: &Interfacess) -> bool {
    t.hash != 0 && !t.items.is_empty() && !t.hs_n.is_empty()
}

/// `{MMddHH}` in local time (`Interfaces.generateTimestamp`).
pub fn peak_seed(now: chrono::DateTime<chrono::Local>) -> String {
    now.format("%m%d%H").to_string()
}

#[derive(Debug, Clone, Default)]
pub struct RoutingTable {
    pub routes: Vec<Route>,
    pub hash: i64,
    pub timestamp: i64,
    /// Refresh interval in seconds (`interupt`).
    pub interupt: i32,
    /// Source `interfacess` (None for kickstart-only tables).
    pub source: Option<Interfacess>,
}

impl RoutingTable {
    pub fn from_interfacess(t: Interfacess) -> Self {
        Self {
            routes: routes_from_interfacess(&t),
            hash: t.hash,
            timestamp: t.time_stamp,
            interupt: t.interupt,
            source: Some(t),
        }
    }
    pub fn from_hells(hells: &[Hell]) -> Self {
        Self { routes: routes_from_hells(hells), ..Default::default() }
    }
    pub fn same_version(&self, t: &Interfacess) -> bool {
        self.hash != 0 && self.hash == t.hash && self.timestamp == t.time_stamp
    }
    /// Refresh interval, clamped to something sane.
    pub fn refresh_secs(&self) -> u64 {
        match self.interupt {
            n if n >= 60 => n as u64,
            _ => 1800,
        }
    }
}

#[derive(Serialize, Deserialize)]
struct CacheFile {
    /// base64 of encoded `interfacess`, when the table came from Peak.
    interfacess: Option<String>,
    /// Kickstart-only routes.
    routes: Vec<Route>,
    saved_at: i64,
}

pub struct RoutingCache {
    path: PathBuf,
}

impl RoutingCache {
    pub fn new(data_dir: &Path) -> Self {
        Self { path: data_dir.join("routing.json") }
    }

    pub fn load(&self) -> Option<RoutingTable> {
        let text = std::fs::read_to_string(&self.path).ok()?;
        let f: CacheFile = serde_json::from_str(&text).ok()?;
        if let Some(b64) = f.interfacess {
            let bytes = base64::engine::general_purpose::STANDARD.decode(b64).ok()?;
            let t = Interfacess::decode(bytes.as_slice()).ok()?;
            let table = RoutingTable::from_interfacess(t);
            return (!table.routes.is_empty()).then_some(table);
        }
        (!f.routes.is_empty()).then(|| RoutingTable { routes: f.routes, ..Default::default() })
    }

    pub fn save(&self, table: &RoutingTable) -> Result<()> {
        let f = CacheFile {
            interfacess: table
                .source
                .as_ref()
                .map(|t| base64::engine::general_purpose::STANDARD.encode(t.encode_to_vec())),
            routes: if table.source.is_some() { Vec::new() } else { table.routes.clone() },
            saved_at: chrono::Utc::now().timestamp(),
        };
        if let Some(dir) = self.path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        let tmp = self.path.with_extension("json.tmp");
        std::fs::write(&tmp, serde_json::to_vec_pretty(&f)?)?;
        std::fs::rename(&tmp, &self.path).map_err(CoreError::from)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::proto::pmodel::{Interfaces, Interfacex};

    #[test]
    fn interfacess_decoding() {
        let key = 0x2a;
        let x = |s: &[u8]| s.iter().map(|b| b ^ key as u8).collect::<Vec<u8>>();
        let t = Interfacess {
            key,
            hs_n: vec![x(b"api.example.com"), x(b"img.example.com")],
            cpis: vec![x(&[9u8; 32])],
            items: vec![Interfaces {
                id: 7,
                items: vec![
                    Interfacex { endpoint: vec![10, 0, 0, 1], host_name: 1, cpi: 0, ..Default::default() },
                    Interfacex { endpoint: vec![10, 0, 0, 2], host_name: 0, cpi: -1, ..Default::default() },
                    Interfacex { endpoint: vec![1, 2, 3], host_name: 0, ..Default::default() },
                ],
            }],
            hash: 5,
            ..Default::default()
        };
        let r = routes_from_interfacess(&t);
        assert_eq!(r.len(), 2);
        assert_eq!(r[0].host, "img.example.com");
        assert_eq!(r[0].pin.as_deref(), Some(&[9u8; 32][..]));
        assert_eq!(r[1].host, "api.example.com");
        assert_eq!(r[1].pin, None);
        assert_eq!(r[0].group, 7);
        assert!(interfacess_is_valid(&t));
    }

    #[test]
    fn seed_format() {
        use chrono::TimeZone;
        let t = chrono::Local.with_ymd_and_hms(2026, 3, 7, 9, 5, 0).unwrap();
        assert_eq!(peak_seed(t), "030709");
    }

    #[test]
    fn cache_roundtrip() {
        let dir = std::env::temp_dir().join(format!("oskol-test-{}", rand::random::<u64>()));
        let c = RoutingCache::new(&dir);
        let table = RoutingTable::from_hells(&[Hell { h: "a.b".into(), e: vec![1, 2, 3, 4], ..Default::default() }]);
        c.save(&table).unwrap();
        let back = c.load().unwrap();
        assert_eq!(back.routes, table.routes);
        let _ = std::fs::remove_dir_all(dir);
    }
}
