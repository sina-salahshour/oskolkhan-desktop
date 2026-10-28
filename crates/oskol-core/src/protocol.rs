//! The native-added parts of a backend request (UA, headers, session attachment).
//!
//! On Android these are added by `libexo.so`, which is not readable from Java. The v0
//! implementation is a best guess; it is replaced once `docs/native-protocol.md` is done.

use crate::routing::Route;
use reqwest::RequestBuilder;
use std::sync::RwLock;

pub use crate::identity::APP_VERSION_CODE as VERSION_CODE;
use crate::identity::MobileIdentity;

#[derive(Debug, Clone, Default)]
pub struct UserContext {
    pub id: i32,
    pub carry: String,
    pub content_type: i32,
    pub plan: i32,
    pub vip: bool,
    pub vip_level: i32,
}

#[derive(Debug, Clone, Default)]
pub struct ProtocolContext {
    pub device_id: String,
    /// What Android hands to native via `postInit(userId, contentType, plan, 79)`,
    /// `setVIP`, `setVIPlevel`.
    pub user: Option<UserContext>,
}

pub trait BackendProtocol: Send + Sync {
    /// Add native-equivalent headers to a request bound for `route`.
    fn decorate(&self, req: RequestBuilder, route: &Route, ctx: &ProtocolContext) -> RequestBuilder;
    /// `PreLoad.Envs` arrived (Android: `initenv` after `$osVersion`/`$deviceName`
    /// substitution).
    fn set_envs(&self, envs: &str);
    /// `PreLoad.ns` arrived (Android: `initns`, when longer than 6 chars).
    fn set_ns(&self, _ns: &str) {}
    fn user_agent(&self) -> String;
}

pub struct V0Protocol {
    identity: MobileIdentity,
    fallback_ua: String,
    ua: RwLock<Option<String>>,
}

impl V0Protocol {
    /// `fallback_ua` must be mobile/Android-style (design §4).
    pub fn new(identity: MobileIdentity, fallback_ua: String) -> Self {
        Self { identity, fallback_ua, ua: RwLock::new(None) }
    }
}

impl BackendProtocol for V0Protocol {
    fn decorate(&self, req: RequestBuilder, route: &Route, _ctx: &ProtocolContext) -> RequestBuilder {
        // RESOLVED (native-protocol §4, Ghidra): the upstream request is plain mobile
        // libcurl. The ONLY app-controlled outbound header is the mobile User-Agent; there
        // is no request signing and no session/VIP/hash in headers (auth travels in the
        // form body). `PalangOskol`/`x-oskol-pt` are the LOCAL proxy-auth header, never sent
        // upstream — so this path adds none of that. `Accept: */*` and `Accept-Encoding:
        // gzip, br, zstd, deflate` are added by reqwest itself (and reqwest decompresses the
        // reply), matching libcurl's defaults, so we set neither here.
        //
        // The Host header is `route.host` (set by reqwest from the request URL). The one
        // open item is the SNI/Host/path split for `isp`/`iSS` routes — that lives in the
        // TLS/connect seam, not here (see `routing::Route`/`tls`), and does not change the
        // HTTP headers.
        let _ = route;
        req.header(reqwest::header::USER_AGENT, self.user_agent())
    }

    fn set_envs(&self, envs: &str) {
        let envs = envs.trim();
        let ua = (!envs.is_empty()).then(|| self.identity.fill_envs(envs));
        // TODO(native-protocol): Envs may be more than a UA template (it is handed to native
        // `initenv` whole). Only a single-line value is used as a UA.
        let ua = ua.filter(|s| !s.contains('\n'));
        *self.ua.write().unwrap() = ua;
    }

    fn user_agent(&self) -> String {
        self.ua.read().unwrap().clone().unwrap_or_else(|| self.fallback_ua.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn envs_template() {
        let id = MobileIdentity::with_device_id("0123456789abcdef".into());
        let p = V0Protocol::new(id, crate::identity::FALLBACK_USER_AGENT.into());
        assert_eq!(p.user_agent(), crate::identity::FALLBACK_USER_AGENT);
        p.set_envs("App/1 ($osVersion; $deviceName)");
        assert_eq!(p.user_agent(), "App/1 (16; 23113RKC6G)");
    }
}
