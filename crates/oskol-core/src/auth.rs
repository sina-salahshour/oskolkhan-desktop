//! Auth commands: email, guest, Google (loopback + PKCE), Telegram bot, logout.

use crate::api::PLH;
use crate::backend::BackendRequest;
use crate::core::Core;
use crate::error::{CoreError, Result};
use crate::proto::pmodel::OAuth;
use crate::session::{oauth_ok, Session};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TelegramStart {
    pub bot_url: String,
}

const GOOGLE_AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";

impl Core {
    async fn auth_request(&self, path: &str, form: Vec<(String, String)>) -> Result<OAuth> {
        self.require_ready()?;
        self.backend.proto::<OAuth>(BackendRequest::post(path, form)).await
    }

    fn accept_login(&self, o: OAuth) -> Result<Session> {
        if !oauth_ok(&o) {
            return Err(CoreError::auth("login rejected by server"));
        }
        self.store_oauth(o)
    }

    pub async fn auth_email(&self, user_name: &str, password: &str) -> Result<Session> {
        let mut form = vec![("UserName".to_owned(), user_name.to_owned()), ("Password".to_owned(), password.to_owned())];
        // eauth sends the composed settings DeviceName (APK field `f44790j`).
        form.extend(self.sessions.device.form());
        let o = self.auth_request("/Ca8d5/init/eauth", form).await?;
        self.accept_login(o)
    }

    pub async fn auth_guest(&self) -> Result<Session> {
        if let Some(p) = self.preload_cached() {
            if !p.enable_guest_login {
                return Err(CoreError::auth("guest login is disabled"));
            }
        }
        let o = self.auth_request("/Ca8d5/init/GSTAuth", vec![("_plh".into(), PLH.into())]).await?;
        self.accept_login(o)
    }

    /// `tauth` once (registers this DeviceId), then hand back the bot deep link.
    pub async fn auth_telegram_start(&self) -> Result<TelegramStart> {
        let preload = match self.preload_cached() {
            Some(p) => p,
            None => self.load_preload().await?,
        };
        if preload.bot_url.is_empty() {
            return Err(CoreError::server("server did not provide a Telegram bot URL"));
        }
        let o = self.auth_request("/Ca8d5/init/tauth", self.sessions.device.form_raw_manufacturer()).await?;
        if oauth_ok(&o) {
            // Already linked: the next poll returns it.
            self.store_oauth(o)?;
        }
        let sep = if preload.bot_url.contains('?') { '&' } else { '?' };
        Ok(TelegramStart {
            bot_url: format!("{}{sep}start=register-{}", preload.bot_url, self.sessions.device.device_id),
        })
    }

    /// One poll (the UI calls this every 5 s).
    pub async fn auth_telegram_poll(&self) -> Result<Option<Session>> {
        let o = self.auth_request("/Ca8d5/init/tauth", self.sessions.device.form_raw_manufacturer()).await?;
        if oauth_ok(&o) {
            return self.store_oauth(o).map(Some);
        }
        Ok(None)
    }

    /// System browser, loopback redirect, PKCE; the ID token goes to `gauth`.
    ///
    /// TODO: needs a desktop Google OAuth client (`OSKOL_GOOGLE_CLIENT_ID`, and
    /// `OSKOL_GOOGLE_CLIENT_SECRET` for "Desktop app" clients). The backend must also
    /// accept ID tokens minted for that client.
    pub async fn auth_google(&self) -> Result<Session> {
        self.require_ready()?;
        let client_id = self
            .config
            .google_client_id
            .clone()
            .ok_or_else(|| CoreError::unimplemented("Google sign-in needs a desktop OAuth client id"))?;
        let verifier = URL_SAFE_NO_PAD.encode(rand::random::<[u8; 32]>());
        let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
        let state = hex::encode(rand::random::<[u8; 16]>());
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0)).await?;
        let redirect = format!("http://127.0.0.1:{}", listener.local_addr()?.port());
        let mut url = url::Url::parse(GOOGLE_AUTH_URL).expect("static url");
        url.query_pairs_mut()
            .append_pair("client_id", &client_id)
            .append_pair("redirect_uri", &redirect)
            .append_pair("response_type", "code")
            .append_pair("scope", "openid email profile")
            .append_pair("code_challenge", &challenge)
            .append_pair("code_challenge_method", "S256")
            .append_pair("state", &state)
            .append_pair("prompt", "select_account");
        open::that_detached(url.as_str()).map_err(|e| CoreError::unimplemented(format!("cannot open browser: {e}")))?;

        let code = tokio::time::timeout(Duration::from_secs(300), wait_for_code(&listener, &state))
            .await
            .map_err(|_| CoreError::auth("Google sign-in timed out"))??;

        let mut form = vec![
            ("code", code),
            ("client_id", client_id),
            ("code_verifier", verifier),
            ("grant_type", "authorization_code".to_owned()),
            ("redirect_uri", redirect),
        ];
        if let Some(secret) = &self.config.google_client_secret {
            form.push(("client_secret", secret.clone()));
        }
        let resp: serde_json::Value = self
            .public_http
            .post(GOOGLE_TOKEN_URL)
            .form(&form)
            .send()
            .await?
            .json()
            .await?;
        let id_token = resp
            .get("id_token")
            .and_then(|v| v.as_str())
            .ok_or_else(|| CoreError::auth(format!("Google token exchange failed: {resp}")))?
            .to_owned();

        let mut form = vec![("Token".to_owned(), id_token)];
        // gauth sends raw Build.MANUFACTURER as DeviceName (APK field `f44792l`).
        form.extend(self.sessions.device.form_raw_manufacturer());
        let o = self.auth_request("/Ca8d5/init/gauth", form).await?;
        self.accept_login(o)
    }

    pub async fn logout(&self) -> Result<()> {
        if self.sessions.oauth().is_some() && self.require_ready().is_ok() {
            let form = vec![("DeviceId".to_owned(), self.sessions.device.device_id.clone())];
            if let Err(e) = self.backend.bytes(BackendRequest::post("/Ca8d5/init/logout", form)).await {
                tracing::warn!(error = %e, "server logout failed; clearing local session anyway");
            }
        }
        self.sessions.clear()?;
        self.sync_context();
        self.touch_status();
        Ok(())
    }

    pub fn session(&self) -> Option<Session> {
        self.sessions.session()
    }
}

/// Accept loopback requests until one carries `code` + matching `state`.
async fn wait_for_code(listener: &tokio::net::TcpListener, state: &str) -> Result<String> {
    loop {
        let (mut sock, _) = listener.accept().await?;
        let mut buf = vec![0u8; 8192];
        let mut n = 0;
        while n < buf.len() {
            let r = sock.read(&mut buf[n..]).await?;
            if r == 0 {
                break;
            }
            n += r;
            if buf[..n].windows(4).any(|w| w == b"\r\n\r\n") {
                break;
            }
        }
        let head = String::from_utf8_lossy(&buf[..n]);
        let target = head.lines().next().and_then(|l| l.split_whitespace().nth(1)).unwrap_or("/");
        let parsed = url::Url::parse(&format!("http://127.0.0.1{target}")).ok();
        let q: std::collections::HashMap<String, String> =
            parsed.map(|u| u.query_pairs().into_owned().collect()).unwrap_or_default();
        let (ok, body) = match (q.get("code"), q.get("state"), q.get("error")) {
            (Some(code), Some(s), _) if s == state => (Some(code.clone()), "Signed in. You can close this tab and return to OskolKhan."),
            (_, _, Some(_)) => (None, "Sign-in was cancelled. You can close this tab."),
            _ => (None, ""),
        };
        if body.is_empty() {
            let _ = sock.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await;
            continue;
        }
        let html = format!("<!doctype html><meta charset=utf-8><title>OskolKhan</title><p style=\"font:16px sans-serif\">{body}</p>");
        let resp = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{html}",
            html.len()
        );
        let _ = sock.write_all(resp.as_bytes()).await;
        return ok.ok_or_else(|| CoreError::auth("Google sign-in was cancelled"));
    }
}
