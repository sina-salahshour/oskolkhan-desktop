//! Bootstrap networking: a DoH-backed resolver for reqwest and DNS TXT lookups at
//! specific resolvers.
//!
//! DoH servers (android-analysis §2): cloudflare `1.1.1.1`, `8.8.8.8`, and
//! `178.22.122.100` (shecan, plain DNS). IP-literal DoH endpoints avoid a DNS
//! chicken-and-egg problem.

use crate::error::{CoreError, Result};
use hickory_resolver::config::{NameServerConfig, Protocol, ResolverConfig, ResolverOpts};
use hickory_resolver::TokioAsyncResolver;
use reqwest::dns::{Addrs, Name, Resolve, Resolving};
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;

const DOH_ENDPOINTS: &[&str] = &[
    "https://1.1.1.1/dns-query",
    "https://8.8.8.8/resolve",
];
const PLAIN_FALLBACK: &str = "178.22.122.100";

#[derive(Clone)]
pub struct DohResolver {
    http: reqwest::Client,
}

impl DohResolver {
    pub fn new() -> Self {
        let http = maybe_bind_interface(reqwest::Client::builder())
            .use_preconfigured_tls(crate::tls::default_config())
            .timeout(Duration::from_secs(6))
            .no_proxy()
            .build()
            .expect("doh client");
        Self { http }
    }

    async fn doh(&self, endpoint: &str, name: &str, rtype: &str) -> Result<Vec<IpAddr>> {
        let resp = self
            .http
            .get(endpoint)
            .query(&[("name", name), ("type", rtype)])
            .header("Accept", "application/dns-json")
            .send()
            .await?
            .error_for_status()?;
        let v: serde_json::Value = resp.json().await?;
        let ips = v
            .get("Answer")
            .and_then(|a| a.as_array())
            .map(|a| {
                a.iter()
                    .filter(|r| matches!(r.get("type").and_then(|t| t.as_u64()), Some(1) | Some(28)))
                    .filter_map(|r| r.get("data")?.as_str()?.parse::<IpAddr>().ok())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        if ips.is_empty() {
            return Err(CoreError::network(format!("doh: no answer for {name}")));
        }
        Ok(ips)
    }

    pub async fn lookup(&self, name: &str) -> Result<Vec<IpAddr>> {
        if let Ok(ip) = name.parse::<IpAddr>() {
            return Ok(vec![ip]);
        }
        for ep in DOH_ENDPOINTS {
            match self.doh(ep, name, "A").await {
                Ok(ips) => return Ok(ips),
                Err(e) => tracing::debug!(%ep, %name, error = %e, "doh lookup failed"),
            }
        }
        let fallback: IpAddr = PLAIN_FALLBACK.parse().unwrap();
        if let Ok(ips) = plain_resolver(Some(fallback)).lookup_ip(name).await {
            let v: Vec<IpAddr> = ips.iter().collect();
            if !v.is_empty() {
                return Ok(v);
            }
        }
        let sys = tokio::net::lookup_host((name, 0)).await?;
        Ok(sys.map(|s| s.ip()).collect())
    }
}

impl Default for DohResolver {
    fn default() -> Self {
        Self::new()
    }
}

impl Resolve for DohResolver {
    fn resolve(&self, name: Name) -> Resolving {
        let this = self.clone();
        Box::pin(async move {
            let ips = this
                .lookup(name.as_str())
                .await
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
            let addrs: Addrs = Box::new(ips.into_iter().map(|ip| SocketAddr::new(ip, 0)));
            Ok(addrs)
        })
    }
}

/// Dev/testing escape hatch: when `OSKOL_BIND_INTERFACE` is set (e.g. `wlan0`), bind every
/// HTTP client to that network interface (SO_BINDTODEVICE). On a machine whose default route
/// is a full-tunnel VPN (tun0) that exits outside Iran, this lets the app reach the Iran-only
/// backend through the physical uplink, bypassing the tunnel. Unset in normal use → no-op.
pub(crate) fn maybe_bind_interface(builder: reqwest::ClientBuilder) -> reqwest::ClientBuilder {
    match std::env::var("OSKOL_BIND_INTERFACE") {
        Ok(iface) if !iface.trim().is_empty() => {
            let iface = iface.trim().to_string();
            tracing::info!("OSKOL_BIND_INTERFACE set: binding HTTP clients to {iface}");
            builder.interface(&iface)
        }
        _ => builder,
    }
}

/// HTTP client for kickstart sources and other public endpoints (DoH resolution).
pub fn bootstrap_client(resolver: &DohResolver) -> reqwest::Client {
    maybe_bind_interface(reqwest::Client::builder())
        .use_preconfigured_tls(crate::tls::default_config())
        .dns_resolver(Arc::new(resolver.clone()))
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(15))
        .build()
        .expect("bootstrap client")
}

fn plain_resolver(server: Option<IpAddr>) -> TokioAsyncResolver {
    let mut opts = ResolverOpts::default();
    opts.timeout = Duration::from_secs(4);
    opts.attempts = 2;
    match server {
        Some(ip) => {
            let mut cfg = ResolverConfig::new();
            cfg.add_name_server(NameServerConfig::new(SocketAddr::new(ip, 53), Protocol::Udp));
            cfg.add_name_server(NameServerConfig::new(SocketAddr::new(ip, 53), Protocol::Tcp));
            TokioAsyncResolver::tokio(cfg, opts)
        }
        None => TokioAsyncResolver::tokio_from_system_conf()
            .unwrap_or_else(|_| TokioAsyncResolver::tokio(ResolverConfig::cloudflare(), opts)),
    }
}

/// TXT records of `domain` at `server` (or the system resolver). Each record's strings
/// are concatenated.
pub async fn txt_records(domain: &str, server: Option<IpAddr>) -> Result<Vec<String>> {
    let resolver = plain_resolver(server);
    let lookup = resolver
        .txt_lookup(domain)
        .await
        .map_err(|e| CoreError::network(format!("txt {domain}: {e}")))?;
    Ok(lookup
        .iter()
        .map(|txt| txt.txt_data().iter().map(|d| String::from_utf8_lossy(d).into_owned()).collect())
        .collect())
}
