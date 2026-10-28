//! Backend HTTP over the routing table: per-route clients (connect IP, SNI/Host = route
//! host, optional pin), protocol decoration, and failover.

use crate::error::{CoreError, Result};
use crate::protocol::{BackendProtocol, ProtocolContext};
use crate::routing::{Route, RoutingTable};
use futures::stream::{FuturesUnordered, StreamExt};
use prost::Message;
use reqwest::{Method, StatusCode};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::time::Duration;

pub const HEALTH_PATH: &str = "/Ca8d5/Test/Hi";

#[derive(Debug, Clone)]
pub struct BackendRequest {
    pub method: Method,
    /// Path (and query) starting with `/`.
    pub path: String,
    pub form: Option<Vec<(String, String)>>,
    pub headers: Vec<(String, String)>,
    pub timeout: Option<Duration>,
}

impl BackendRequest {
    pub fn get(path: impl Into<String>) -> Self {
        Self { method: Method::GET, path: path.into(), form: None, headers: Vec::new(), timeout: None }
    }
    pub fn post(path: impl Into<String>, form: Vec<(String, String)>) -> Self {
        Self { method: Method::POST, path: path.into(), form: Some(form), headers: Vec::new(), timeout: None }
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
        let url = format!("https://{}{}", route.host, req.path);
        let mut rb = client.request(req.method.clone(), &url);
        if let Some(form) = &req.form {
            rb = rb.form(form);
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
    pub async fn send(&self, req: BackendRequest) -> Result<reqwest::Response> {
        let table = self.table();
        let n = table.routes.len();
        if n == 0 {
            return Err(CoreError::not_ready("no routes"));
        }
        let start = self.active.load(Ordering::SeqCst) % n;
        let mut last_err = None;
        for i in 0..n {
            let idx = (start + i) % n;
            let route = &table.routes[idx];
            match self.send_on(route, &req).await {
                Ok(resp) if resp.status().is_server_error() || resp.status() == StatusCode::BAD_GATEWAY => {
                    last_err = Some(CoreError::server(format!("{} from {}", resp.status(), route.host)));
                }
                Ok(resp) => {
                    if i != 0 {
                        tracing::info!(host = %route.host, ip = %route.ip, "failed over to route");
                    }
                    self.active.store(idx, Ordering::SeqCst);
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
    // NATIVE-TLS-SEAM (native-protocol §3 — gated, DO NOT change without sign-off):
    // reqwest derives SNI and the Host header from the request URL authority (`route.host`),
    // and connects to `route.ip:route.port` via `.resolve()`. The native client instead
    // appears to present a decoy / `ish` SNI (driven by the route `iSS`/`isp`/`ish` flags,
    // see `route.front_host`) while keeping `Host = route.host`, with pin-only TLS. Swapping
    // to that (set SNI independently of Host, disable CA/hostname checks, keep the pin) is
    // the approved-only change; until then we keep SNI = Host = route host with CA checks on.
    let tls = match &route.pin {
        Some(pin) => crate::tls::pinned_config(pin.clone()),
        None => crate::tls::default_config(),
    };
    reqwest::Client::builder()
        .use_preconfigured_tls(tls)
        .resolve(&route.host, SocketAddr::new(route.ip, route.port))
        .connect_timeout(Duration::from_secs(8))
        .read_timeout(Duration::from_secs(30))
        .no_proxy()
        .build()
        .expect("route client")
}
