//! Backend HTTP over the routing table: per-route clients (connect IP, SNI/Host = route
//! host, optional pin), protocol decoration, and failover.

use crate::error::{CoreError, Result};
use crate::protocol::{BackendProtocol, ProtocolContext};
use crate::routing::{is_cf_fallback, Route, RoutingTable, API_GROUP, API_GROUP_SECONDARY};
use futures::stream::{FuturesUnordered, StreamExt};
use prost::Message;
use reqwest::{Method, StatusCode};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::time::Duration;

pub const HEALTH_PATH: &str = "/Ca8d5/Test/Hi";

/// Strip the leading `/Ca8d5` (data/auth) or `/Ca8dA` (images) **local route-selector**
/// segment before a request goes upstream (native-protocol §11, LIVE-VERIFIED 2026-10-29).
///
/// The selector is a LOCAL proxy hint only: Java/Retrofit and the UI↔core contract speak
/// `/Ca8d5/...`/`/Ca8dA/...`, but `libexo.so` forwards the SAME path WITHOUT the selector,
/// and the backend serves it there (`/Ca8d5/*` → 404 upstream, the stripped path → 200). We
/// keep the selector everywhere inside the core (so the contract and the asset server are
/// unchanged) and drop it only here, at the single point where a request hits the network.
///
/// Only a whole first segment that is exactly `Ca8d5` or `Ca8dA` is removed; any other path
/// (e.g. the `trailer` `/{lsi}/trailer/{urn}`) is forwarded unchanged.
pub fn strip_selector(path: &str) -> &str {
    for sel in ["/Ca8d5", "/Ca8dA"] {
        if let Some(rest) = path.strip_prefix(sel) {
            if rest.is_empty() || rest.starts_with('/') || rest.starts_with('?') {
                return if rest.is_empty() { "/" } else { rest };
            }
        }
    }
    path
}

#[derive(Debug, Clone)]
pub struct BackendRequest {
    pub method: Method,
    /// Path (and query) starting with `/`.
    pub path: String,
    pub form: Option<Vec<(String, String)>>,
    /// Raw request body as (content-type, bytes) — e.g. a protobuf payload.
    pub body: Option<(String, Vec<u8>)>,
    pub headers: Vec<(String, String)>,
    pub timeout: Option<Duration>,
}

impl BackendRequest {
    pub fn get(path: impl Into<String>) -> Self {
        Self { method: Method::GET, path: path.into(), form: None, body: None, headers: Vec::new(), timeout: None }
    }
    pub fn post(path: impl Into<String>, form: Vec<(String, String)>) -> Self {
        Self { method: Method::POST, path: path.into(), form: Some(form), body: None, headers: Vec::new(), timeout: None }
    }
    /// POST with a raw body (content-type + bytes) instead of a form.
    pub fn post_body(path: impl Into<String>, content_type: impl Into<String>, bytes: Vec<u8>) -> Self {
        Self {
            method: Method::POST,
            path: path.into(),
            form: None,
            body: Some((content_type.into(), bytes)),
            headers: Vec::new(),
            timeout: None,
        }
    }
    pub fn header(mut self, k: impl Into<String>, v: impl Into<String>) -> Self {
        self.headers.push((k.into(), v.into()));
        self
    }
}

pub struct Backend {
    table: RwLock<Arc<RoutingTable>>,
    active: AtomicUsize,
    clients: Mutex<HashMap<String, reqwest::Client>>,
    protocol: Arc<dyn BackendProtocol>,
    ctx: RwLock<ProtocolContext>,
}

impl Backend {
    pub fn new(protocol: Arc<dyn BackendProtocol>, ctx: ProtocolContext) -> Self {
        Self {
            table: RwLock::new(Arc::new(RoutingTable::default())),
            active: AtomicUsize::new(0),
            clients: Mutex::new(HashMap::new()),
            protocol,
            ctx: RwLock::new(ctx),
        }
    }

    pub fn protocol(&self) -> &Arc<dyn BackendProtocol> {
        &self.protocol
    }

    pub fn table(&self) -> Arc<RoutingTable> {
        self.table.read().unwrap().clone()
    }

    /// Install a table; `preferred` (a route key) becomes active if present.
    pub fn set_table(&self, table: RoutingTable, preferred: Option<&str>) {
        let idx = preferred
            .and_then(|k| table.routes.iter().position(|r| r.key() == k))
            .unwrap_or(0);
        *self.table.write().unwrap() = Arc::new(table);
        self.active.store(idx, Ordering::SeqCst);
    }

    pub fn active_route(&self) -> Option<Route> {
        let t = self.table();
        t.routes.get(self.active.load(Ordering::SeqCst) % t.routes.len().max(1)).cloned()
    }

    pub fn set_context(&self, ctx: ProtocolContext) {
        *self.ctx.write().unwrap() = ctx;
    }

    pub fn context(&self) -> ProtocolContext {
        self.ctx.read().unwrap().clone()
    }

    /// A ready HTTPS client for `route` (connect IP = `route.ip`, SNI = Host = `route.host`,
    /// pin-only TLS keyed on `route.pin`, egress bound to `OSKOL_BIND_INTERFACE`). Cached per
    /// route. Used by the media stream proxy to fetch a real media URL the same way the
    /// backend reaches the API (pinned, wlan0-bound), but without the API path/selector/
    /// protocol decoration — the caller sets the absolute URL, UA and Range itself.
    pub fn client_for_route(&self, route: &Route) -> reqwest::Client {
        self.client_for(route)
    }

    fn client_for(&self, route: &Route) -> reqwest::Client {
        let key = format!("{}#{}", route.key(), route.pin.as_ref().map(hex::encode).unwrap_or_default());
        let mut clients = self.clients.lock().unwrap();
        clients
            .entry(key)
            .or_insert_with(|| build_route_client(route))
            .clone()
    }

    /// Send on one specific route.
    pub async fn send_on(&self, route: &Route, req: &BackendRequest) -> Result<reqwest::Response> {
        let client = self.client_for(route);
        // Scheme is always https here: every API/data/image route in the live tables carries
        // `iSS=1`. The selector segment is dropped on the way upstream (native-protocol §11).
        let url = format!("https://{}{}", route.host, strip_selector(&req.path));
        let mut rb = client.request(req.method.clone(), &url);
        if let Some(form) = &req.form {
            rb = rb.form(form);
        }
        if let Some((ct, bytes)) = &req.body {
            rb = rb.header("content-type", ct.as_str()).body(bytes.clone());
        }
        for (k, v) in &req.headers {
            rb = rb.header(k.as_str(), v.as_str());
        }
        if let Some(t) = req.timeout {
            rb = rb.timeout(t);
        }
        let ctx = self.context();
        rb = self.protocol.decorate(rb, route, &ctx);
        Ok(rb.send().await?)
    }

    /// Send with failover: starts at the active route; transport errors and 5xx move on.
    ///
    /// API requests only ever travel the API-group rows (99999999 / 99999998) plus the
    /// Cloudflare fallbacks — NEVER the media/other-group rows. Those rows 404 every API
    /// path, and because a 404 is a successful HTTP response (not a 5xx), the old code
    /// would latch `active` onto such a row the moment one API call failed over into it,
    /// poisoning every later call (home/files/itemDetail would then 404 forever). Keeping
    /// the candidate set to API + CF rows means `active` can only ever point at a row that
    /// actually serves API paths, and a stale/poisoned `active` self-heals to the first one.
    pub async fn send(&self, req: BackendRequest) -> Result<reqwest::Response> {
        let table = self.table();
        let n = table.routes.len();
        if n == 0 {
            return Err(CoreError::not_ready("no routes"));
        }
        // Candidate row indices (into the priority-sorted table) this request may use.
        let candidates: Vec<usize> = (0..n)
            .filter(|&i| {
                let r = &table.routes[i];
                is_cf_fallback(r.group, &r.ip) || r.group == API_GROUP || r.group == API_GROUP_SECONDARY
            })
            .collect();
        // No dedicated API group in this table → fall back to trying every row.
        let candidates = if candidates.is_empty() { (0..n).collect::<Vec<_>>() } else { candidates };
        let m = candidates.len();

        // Resume at the active row if it is still a candidate, else the first candidate.
        let active_idx = self.active.load(Ordering::SeqCst) % n;
        let start = candidates.iter().position(|&i| i == active_idx).unwrap_or(0);
        let mut last_err = None;
        for k in 0..m {
            let idx = candidates[(start + k) % m];
            let route = &table.routes[idx];
            match self.send_on(route, &req).await {
                Ok(resp) if resp.status().is_server_error() || resp.status() == StatusCode::BAD_GATEWAY => {
                    last_err = Some(CoreError::server(format!("{} from {}", resp.status(), route.host)));
                }
                Ok(resp) => {
                    // Only latch `active` onto a row that actually served the request (2xx).
                    // A 404/4xx is returned to the caller but must NOT make the row sticky:
                    // otherwise one bad-path request (e.g. a wrong getMore URL that 5xx's on
                    // the real hosts and 404s on the CF fallback) would pin every later call
                    // to a row that 404s all API paths.
                    if resp.status().is_success() {
                        if k != 0 {
                            tracing::info!(host = %route.host, ip = %route.ip, "failed over to route");
                        }
                        self.active.store(idx, Ordering::SeqCst);
                    }
                    return Ok(resp);
                }
                Err(e) => {
                    tracing::debug!(host = %route.host, ip = %route.ip, error = %e, "route failed");
                    last_err = Some(e);
                }
            }
        }
        Err(last_err.unwrap_or_else(|| CoreError::network("all routes failed")))
    }

    /// Send and return the body, mapping HTTP errors.
    pub async fn bytes(&self, req: BackendRequest) -> Result<bytes::Bytes> {
        let resp = self.send(req).await?;
        let status = resp.status();
        if status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN {
            return Err(CoreError::auth(format!("HTTP {status}")));
        }
        if !status.is_success() {
            return Err(CoreError::server(format!("HTTP {status}")));
        }
        Ok(resp.bytes().await?)
    }

    pub async fn proto<M: Message + Default>(&self, req: BackendRequest) -> Result<M> {
        let body = self.bytes(req).await?;
        Ok(M::decode(body)?)
    }

    pub async fn text(&self, req: BackendRequest) -> Result<String> {
        let body = self.bytes(req).await?;
        Ok(String::from_utf8_lossy(&body).into_owned())
    }

    /// `GET /Ca8d5/Test/Hi` on one route must return `true`.
    pub async fn health(&self, route: &Route) -> bool {
        let mut req = BackendRequest::get(HEALTH_PATH);
        req.timeout = Some(Duration::from_secs(8));
        match self.send_on(route, &req).await {
            Ok(resp) if resp.status().is_success() => resp
                .text()
                .await
                .map(|t| t.trim().trim_matches('"').eq_ignore_ascii_case("true"))
                .unwrap_or(false),
            Ok(resp) => {
                tracing::debug!(host = %route.host, status = %resp.status(), "health check failed");
                false
            }
            Err(e) => {
                tracing::debug!(host = %route.host, ip = %route.ip, error = %e, "health check error");
                false
            }
        }
    }

    /// Health-check routes in parallel; first healthy wins.
    pub async fn first_healthy(&self, routes: &[Route]) -> Option<Route> {
        let mut pending: FuturesUnordered<_> = routes
            .iter()
            .cloned()
            .map(|r| async move {
                let ok = self.health(&r).await;
                (r, ok)
            })
            .collect();
        while let Some((r, ok)) = pending.next().await {
            if ok {
                return Some(r);
            }
        }
        None
    }
}

fn build_route_client(route: &Route) -> reqwest::Client {
    // NATIVE-TLS-SEAM (native-protocol §10/§11 — RESOLVED, LIVE-VERIFIED 2026-10-29):
    // the upstream path is a plain forwarding HTTPS client with **SNI = Host = the route's
    // own hostname** (no decoy SNI). reqwest derives both SNI and the Host header from the
    // request URL authority (`route.host`) and connects to `route.ip:route.port` via
    // `.resolve()`, which reproduces that exactly.
    //
    // TLS is the app's own **certificate-pinning** scheme, keyed off this route's pin
    // (`tls::route_config`): the cert CN is a camouflage hostname that will not chain to a
    // public CA for the route host, so we do NOT use WebPKI/hostname validation; a pinned
    // route is accepted iff the leaf SPKI SHA-256 equals the row's `Cpis` pin (a strictly
    // stronger check than CA for these routes), and an unpinned bootstrap/`hell` row is
    // accepted with any cert (the app's `initZero` passes no pins there). Handshake
    // signatures are always verified by rustls.
    let tls = crate::tls::route_config(route.pin.clone());
    crate::net::maybe_bind_interface(reqwest::Client::builder())
        .use_preconfigured_tls(tls)
        .resolve(&route.host, SocketAddr::new(route.ip, route.port))
        .connect_timeout(Duration::from_secs(8))
        .read_timeout(Duration::from_secs(30))
        .no_proxy()
        .build()
        .expect("route client")
}

#[cfg(test)]
mod tests {
    use super::strip_selector;

    #[test]
    fn selector_stripped_upstream() {
        // native-protocol §11: the local selector segment is dropped before going upstream.
        assert_eq!(strip_selector("/Ca8d5/data/home/0"), "/data/home/0");
        assert_eq!(strip_selector("/Ca8d5/init/PreLoad"), "/init/PreLoad");
        assert_eq!(strip_selector("/Ca8d5/Test/Hi"), "/Test/Hi");
        assert_eq!(strip_selector("/Ca8d5/init/Peak/093017X"), "/init/Peak/093017X");
        assert_eq!(strip_selector("/Ca8dA/images300x.jpg"), "/images300x.jpg");
        assert_eq!(strip_selector("/Ca8d5/r/5?C=1"), "/r/5?C=1");
        // Non-selector paths (and look-alikes without a segment boundary) are untouched.
        assert_eq!(strip_selector("/1234/trailer/abc"), "/1234/trailer/abc");
        assert_eq!(strip_selector("/Ca8d5img/x"), "/Ca8d5img/x");
    }
}
