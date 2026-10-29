//! `Core`: owns routing, backend, session and the asset server; runs bootstrap and the
//! routing refresh loop; publishes `CoreStatus`.

use crate::backend::{Backend, BackendRequest};
use crate::error::{CoreError, ErrorCode, Result};
use crate::kickstart::{self, Source};
use crate::net::{self, DohResolver};
use crate::proto::pmodel::{Hell, Interfacess, OAuth, PreLoad};
use crate::protocol::{BackendProtocol, ProtocolContext, V0Protocol};
use crate::routing::{self, RoutingCache, RoutingTable};
use crate::server::AssetServer;
use crate::session::{self, Session, SessionStore};
use crate::superloader;
use futures::stream::{FuturesUnordered, StreamExt};
use prost::Message;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::{watch, Mutex as AsyncMutex};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Phase {
    Starting,
    Bootstrapping,
    Ready,
    Offline,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoreStatus {
    pub phase: Phase,
    pub message: Option<String>,
    pub active_host: Option<String>,
    pub routes: usize,
    pub asset_base: String,
    pub logged_in: bool,
}

#[derive(Debug, Clone)]
pub struct CoreConfig {
    pub data_dir: PathBuf,
    /// Mobile UA used until `PreLoad.Envs` provides one (see `identity`).
    /// TODO(native-protocol).
    pub fallback_user_agent: String,
    /// Google OAuth desktop client (the Android client id cannot be reused).
    pub google_client_id: Option<String>,
    pub google_client_secret: Option<String>,
}

impl CoreConfig {
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            data_dir,
            fallback_user_agent: crate::identity::FALLBACK_USER_AGENT.to_owned(),
            google_client_id: std::env::var("OSKOL_GOOGLE_CLIENT_ID").ok().filter(|s| !s.is_empty()),
            google_client_secret: std::env::var("OSKOL_GOOGLE_CLIENT_SECRET").ok().filter(|s| !s.is_empty()),
        }
    }
}

/// Max size of a manual `.osbin` (splash `f45140u`).
pub const MAX_OSBIN: usize = 1 << 20;
// The SuperLoader-wrapped file magic lives in `superloader::WRAPPED_MAGIC`.

pub struct Core {
    pub config: CoreConfig,
    pub backend: Arc<Backend>,
    pub sessions: SessionStore,
    pub(crate) public_http: reqwest::Client,
    cache: RoutingCache,
    server: AssetServer,
    status_tx: watch::Sender<CoreStatus>,
    /// Live PreLoad. Shared (as an `Arc`) with the asset server so its media stream
    /// handler can read the current `Salt` on every request.
    preload: Arc<Mutex<Option<PreLoad>>>,
    bootstrap_lock: AsyncMutex<()>,
}

impl Core {
    /// Create the core and start bootstrapping in the background.
    pub async fn start(config: CoreConfig) -> Result<Arc<Self>> {
        let sessions = SessionStore::open(&config.data_dir)?;
        let protocol: Arc<dyn BackendProtocol> =
            Arc::new(V0Protocol::new(sessions.device.clone(), config.fallback_user_agent.clone()));
        let backend = Arc::new(Backend::new(protocol, ProtocolContext::default()));
        // `fallback_user_agent` is the mobile UA the media CDN is gated on; the asset
        // server's media stream resolves routes through `backend` (pinned + wlan0-bound).
        let preload: Arc<Mutex<Option<PreLoad>>> = Arc::new(Mutex::new(None));
        let server =
            AssetServer::start(backend.clone(), config.fallback_user_agent.clone()).await?;
        let resolver = DohResolver::new();
        let public_http = net::bootstrap_client(&resolver);
        let status = CoreStatus {
            phase: Phase::Starting,
            message: None,
            active_host: None,
            routes: 0,
            asset_base: server.base(),
            logged_in: sessions.oauth().is_some(),
        };
        let (status_tx, _) = watch::channel(status);
        let core = Arc::new(Self {
            cache: RoutingCache::new(&config.data_dir),
            config,
            backend,
            sessions,
            public_http,
            server,
            status_tx,
            preload,
            bootstrap_lock: AsyncMutex::new(()),
        });
        core.sync_context();
        let c = core.clone();
        tokio::spawn(async move { c.run().await });
        Ok(core)
    }

    // ----- status -------------------------------------------------------------

    pub fn status(&self) -> CoreStatus {
        self.status_tx.borrow().clone()
    }

    pub fn subscribe(&self) -> watch::Receiver<CoreStatus> {
        self.status_tx.subscribe()
    }

    pub fn asset_base(&self) -> String {
        self.server.base()
    }

    fn set_phase(&self, phase: Phase, message: Option<String>) {
        let table = self.backend.table();
        let active = self.backend.active_route().map(|r| r.host);
        let logged_in = self.sessions.oauth().is_some();
        self.status_tx.send_if_modified(|s| {
            let next = CoreStatus {
                phase,
                message: message.clone(),
                active_host: if table.routes.is_empty() { None } else { active.clone() },
                routes: table.routes.len(),
                asset_base: s.asset_base.clone(),
                logged_in,
            };
            if *s != next {
                *s = next;
                true
            } else {
                false
            }
        });
    }

    /// Re-publish status with the current phase (after route/session changes).
    pub(crate) fn touch_status(&self) {
        let s = self.status();
        self.set_phase(s.phase, s.message);
    }

    pub(crate) fn require_ready(&self) -> Result<()> {
        match self.status().phase {
            Phase::Ready => Ok(()),
            _ if !self.backend.table().routes.is_empty() => Ok(()),
            _ => Err(CoreError::not_ready("core is not ready")),
        }
    }

    pub(crate) fn sync_context(&self) {
        let ctx = ProtocolContext {
            device_id: self.sessions.device.device_id.clone(),
            user: self.sessions.oauth().as_ref().map(session::user_context),
        };
        self.backend.set_context(ctx);
    }

    pub fn preload_cached(&self) -> Option<PreLoad> {
        self.preload.lock().unwrap().clone()
    }

    // ----- lifecycle ----------------------------------------------------------

    async fn run(self: Arc<Self>) {
        let mut backoff = 15u64;
        loop {
            match self.bootstrap().await {
                Ok(()) => break,
                Err(e) => {
                    let phase = if e.code == ErrorCode::Network || e.code == ErrorCode::NotReady {
                        Phase::Offline
                    } else {
                        Phase::Error
                    };
                    tracing::warn!(error = %e, "bootstrap failed");
                    self.set_phase(phase, Some(e.message.clone()));
                    tokio::time::sleep(Duration::from_secs(backoff)).await;
                    backoff = (backoff * 2).min(300);
                    if self.status().phase == Phase::Ready {
                        break; // a manual import succeeded meanwhile
                    }
                }
            }
        }
        self.after_ready().await;
        self.refresh_loop().await;
    }

    /// Cached table → health check; otherwise kickstart sources → health → Peak.
    async fn bootstrap(&self) -> Result<()> {
        let _guard = self.bootstrap_lock.lock().await;
        self.set_phase(Phase::Bootstrapping, Some("checking cached routes".into()));
        if let Some(cached) = self.cache.load() {
            if let Some(ok) = self.backend.first_healthy(&cached.routes).await {
                tracing::info!(host = %ok.host, "cached route healthy");
                self.backend.set_table(cached, Some(&ok.key()));
                self.set_phase(Phase::Ready, None);
                return Ok(());
            }
        }
        self.set_phase(Phase::Bootstrapping, Some("fetching kickstart".into()));
        let mut pending: FuturesUnordered<_> =
            kickstart::SOURCES.iter().map(|s| async move { (s.name(), self.fetch_source(s).await) }).collect();
        let mut last_err = CoreError::network("no kickstart source reachable");
        while let Some((name, result)) = pending.next().await {
            match result {
                Ok(hells) => {
                    tracing::info!(source = name, entries = hells.len(), "kickstart decoded");
                    match self.adopt_hells(&hells).await {
                        Ok(()) => return Ok(()),
                        Err(e) => last_err = e,
                    }
                }
                Err(e) => {
                    tracing::debug!(source = name, error = %e, "kickstart source failed");
                }
            }
        }
        Err(last_err)
    }

    async fn fetch_source(&self, source: &Source) -> Result<Vec<Hell>> {
        match source {
            Source::Http { url, headers, extractor, .. } => {
                let mut rb = self.public_http.get(*url);
                for (k, v) in headers.iter() {
                    rb = rb.header(*k, *v);
                }
                let body = rb.send().await?.error_for_status()?.text().await?;
                let payload = kickstart::extract(*extractor, &body)
                    .ok_or_else(|| CoreError::decode("no payload in page"))?;
                kickstart::decode_payload(&payload)
            }
            Source::Txt { domain, .. } => {
                let records = net::txt_records(domain, source.resolver_ip()).await?;
                let mut err = CoreError::decode("no decodable TXT record");
                for r in records {
                    match kickstart::decode_payload(&r) {
                        Ok(h) => return Ok(h),
                        Err(e) => err = e,
                    }
                }
                Err(err)
            }
        }
    }

    /// Health-check kickstart routes, then try Peak on the healthy one.
    async fn adopt_hells(&self, hells: &[Hell]) -> Result<()> {
        let table = RoutingTable::from_hells(hells);
        if table.routes.is_empty() {
            return Err(CoreError::decode("kickstart has no usable routes"));
        }
        let healthy = self
            .backend
            .first_healthy(&table.routes)
            .await
            .ok_or_else(|| CoreError::network("no kickstart route passed the health check"))?;
        tracing::info!(host = %healthy.host, ip = %healthy.ip, "kickstart route healthy");
        self.backend.set_table(table.clone(), Some(&healthy.key()));
        match self.fetch_peak().await {
            Ok(t) => self.install_interfacess(t).await,
            Err(e) => {
                tracing::warn!(error = %e, "Peak failed; using kickstart routes");
                let _ = self.cache.save(&table);
            }
        }
        self.set_phase(Phase::Ready, None);
        Ok(())
    }

    async fn fetch_peak(&self) -> Result<Interfacess> {
        let seed = routing::peak_seed(chrono::Local::now());
        let t: Interfacess = self.backend.proto(BackendRequest::get(format!("/Ca8d5/init/Peak/{seed}X"))).await?;
        if !routing::interfacess_is_valid(&t) {
            return Err(CoreError::decode("Peak returned an empty routing table"));
        }
        Ok(t)
    }

    /// Install a Peak table; keeps the current route active if it is still listed.
    async fn install_interfacess(&self, t: Interfacess) {
        let table = RoutingTable::from_interfacess(t);
        if table.routes.is_empty() {
            tracing::warn!("interfacess produced no routes; keeping current table");
            return;
        }
        // Keep the current route active if it is still a listed primary API route; otherwise
        // pick a healthy group-99999999 route (native-protocol §11), so API calls start on
        // the API group rather than a media/content row.
        let primary = table.primary_routes();
        let current = self.backend.active_route().map(|r| r.key());
        let preferred = match current.filter(|k| primary.iter().any(|r| &r.key() == k)) {
            Some(k) => Some(k),
            None => self.backend.first_healthy(&primary).await.map(|r| r.key()),
        };
        if let Err(e) = self.cache.save(&table) {
            tracing::warn!(error = %e, "could not cache routing table");
        }
        tracing::info!(routes = table.routes.len(), hash = table.hash, "routing table installed");
        self.backend.set_table(table, preferred.as_deref());
        self.touch_status();
    }

    async fn after_ready(&self) {
        // Pick up a fresh Peak table right away (the cached one may be stale).
        match self.fetch_peak().await {
            Ok(t) if self.backend.table().same_version(&t) => {}
            Ok(t) => self.install_interfacess(t).await,
            Err(e) => tracing::debug!(error = %e, "initial Peak refresh failed"),
        }
        if let Err(e) = self.load_preload().await {
            tracing::warn!(error = %e, "PreLoad failed");
        }
        if let Err(e) = self.revalidate_session().await {
            tracing::warn!(error = %e, "session revalidation failed");
        }
        self.touch_status();
    }

    async fn refresh_loop(&self) {
        loop {
            let secs = self.backend.table().refresh_secs();
            tokio::time::sleep(Duration::from_secs(secs)).await;
            match self.fetch_peak().await {
                Ok(t) if self.backend.table().same_version(&t) => {
                    tracing::debug!("routing table unchanged");
                }
                Ok(t) => self.install_interfacess(t).await,
                Err(e) => tracing::warn!(error = %e, "routing refresh failed"),
            }
        }
    }

    pub(crate) async fn load_preload(&self) -> Result<PreLoad> {
        let p: PreLoad = self.backend.proto(BackendRequest::get("/Ca8d5/init/PreLoad")).await?;
        self.backend.protocol().set_envs(&p.envs);
        if p.ns.len() > 6 {
            self.backend.protocol().set_ns(&p.ns);
        }
        *self.preload.lock().unwrap() = Some(p.clone());
        Ok(p)
    }

    /// `init/Auth` at startup: refresh the stored OAuth, or drop it when rejected.
    async fn revalidate_session(&self) -> Result<()> {
        let Some(o) = self.sessions.oauth() else { return Ok(()) };
        let form = vec![
            ("id".into(), o.id.to_string()),
            ("carry".into(), o.carry.clone()),
            ("DeviceId".into(), self.sessions.device.device_id.clone()),
        ];
        match self.backend.proto::<OAuth>(BackendRequest::post("/Ca8d5/init/Auth", form)).await {
            Ok(fresh) if session::oauth_ok(&fresh) => {
                self.store_oauth(fresh)?;
            }
            Ok(_) => {
                tracing::info!("stored session rejected; logging out");
                self.sessions.clear()?;
                self.sync_context();
            }
            Err(e) if e.code == ErrorCode::Auth => {
                self.sessions.clear()?;
                self.sync_context();
            }
            Err(e) => return Err(e),
        }
        Ok(())
    }

    pub(crate) fn store_oauth(&self, mut o: OAuth) -> Result<Session> {
        // Some endpoints may omit `carry`; keep the one we have.
        if o.carry.is_empty() {
            if let Some(prev) = self.sessions.oauth() {
                o.carry = prev.carry;
            }
        }
        let s = self.sessions.set(o)?;
        self.sync_context();
        self.touch_status();
        Ok(s)
    }

    // ----- manual import ------------------------------------------------------

    /// Manual `.osbin`/`.bin`/`.okx` import.
    pub async fn import_kickstart(&self, path: &std::path::Path) -> Result<CoreStatus> {
        let bytes = tokio::fs::read(path).await?;
        if bytes.len() > MAX_OSBIN {
            return Err(CoreError::decode("file is larger than 1 MiB"));
        }
        // 1) SuperLoader-wrapped blob (`1B 86 1C CE`): XOR 0x33 then zstd → `interfacess`
        //    (native-protocol §1). This is the common `.osbin`/`.okx` case.
        if superloader::is_wrapped(&bytes) {
            let plain = superloader::super_loader_bytes(&bytes)?;
            let t = Interfacess::decode(plain.as_slice())
                .map_err(|e| CoreError::decode(format!("SuperLoader output is not an interfacess: {e}")))?;
            if self.adopt_interfacess(t).await? {
                self.post_import().await;
                return Ok(self.status());
            }
            return Err(CoreError::decode("SuperLoader file has no usable routes"));
        }
        // 2) a raw (unwrapped) `interfacess` protobuf
        if let Ok(t) = Interfacess::decode(bytes.as_slice()) {
            if (!t.items.is_empty() || !t.stack.is_empty()) && self.adopt_interfacess(t).await? {
                self.post_import().await;
                return Ok(self.status());
            }
        }
        // 3) a kickstart text payload or its brotli bytes
        let hells = match std::str::from_utf8(&bytes).ok().map(kickstart::decode_payload) {
            Some(Ok(h)) => h,
            _ => kickstart::decode_compressed(&bytes)
                .map_err(|_| CoreError::decode("not a recognised kickstart file"))?,
        };
        self.adopt_hells(&hells).await?;
        self.post_import().await;
        Ok(self.status())
    }

    /// Install an imported `interfacess` table. Returns `false` when it yields no routes.
    async fn adopt_interfacess(&self, t: Interfacess) -> Result<bool> {
        let table = RoutingTable::from_interfacess(t.clone());
        if table.routes.is_empty() {
            return Ok(false);
        }
        let healthy = self.backend.first_healthy(&table.primary_routes()).await;
        self.install_interfacess(t).await;
        if let Some(h) = healthy {
            self.backend.set_table(self.backend.table().as_ref().clone(), Some(&h.key()));
        }
        self.set_phase(Phase::Ready, None);
        Ok(true)
    }

    async fn post_import(&self) {
        if self.preload_cached().is_none() {
            let _ = self.load_preload().await;
        }
    }
}
