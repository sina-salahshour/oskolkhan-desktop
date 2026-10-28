//! Session and device identity.
//!
//! `OAuth` (contains the opaque `carry`) lives in the OS keyring under service
//! `oskolkhan-desktop`; non-secret state is a JSON file in the app data dir.

use crate::error::{CoreError, Result};
use crate::proto::pmodel::OAuth;
use crate::identity::{self, MobileIdentity};
use crate::protocol::UserContext;
use base64::Engine;
use prost::Message;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub const KEYRING_SERVICE: &str = "oskolkhan-desktop";
const KEYRING_USER: &str = "oauth";

/// UI-facing session (contract type `Session`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: i32,
    pub name: String,
    pub family: String,
    pub vip: bool,
    pub vip_level: i32,
    pub plan: i32,
    pub content_type: i32,
    pub needs_birth: bool,
    pub needs_content_type: bool,
}

impl From<&OAuth> for Session {
    fn from(o: &OAuth) -> Self {
        Self {
            id: o.id,
            name: o.name.clone(),
            family: o.family.clone(),
            vip: o.vip,
            vip_level: o.vip_level,
            plan: o.plan,
            content_type: o.content_type,
            // AuthActivity.m38794h: ask for birth when `!birth`, content type when 0.
            needs_birth: !o.birth,
            needs_content_type: o.content_type == 0,
        }
    }
}

pub fn user_context(o: &OAuth) -> UserContext {
    UserContext {
        id: o.id,
        carry: o.carry.clone(),
        content_type: o.content_type,
        plan: o.plan,
        vip: o.vip,
        vip_level: o.vip_level,
    }
}

/// A successful auth response: `status` set and a user id.
pub fn oauth_ok(o: &OAuth) -> bool {
    o.status && o.id != 0
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct StateFile {
    device_id: Option<String>,
    /// Non-secret copy of the last session, for display while offline.
    last_session: Option<Session>,
    /// Set when the keyring is unavailable: the session cannot persist across runs.
    #[serde(default)]
    keyring_unavailable: bool,
}

pub struct SessionStore {
    state_path: PathBuf,
    state: Mutex<StateFile>,
    oauth: Mutex<Option<OAuth>>,
    pub device: MobileIdentity,
}

impl SessionStore {
    pub fn open(data_dir: &Path) -> Result<Self> {
        std::fs::create_dir_all(data_dir)?;
        let state_path = data_dir.join("state.json");
        let mut state: StateFile = std::fs::read(&state_path)
            .ok()
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or_default();
        let device_id = match &state.device_id {
            Some(id) if identity::is_device_id(id) => id.clone(),
            _ => {
                let id = identity::new_device_id();
                state.device_id = Some(id.clone());
                id
            }
        };
        let device = MobileIdentity::with_device_id(device_id);
        let oauth = load_keyring();
        let store = Self { state_path, state: Mutex::new(state), oauth: Mutex::new(oauth), device };
        store.save_state()?;
        Ok(store)
    }

    fn save_state(&self) -> Result<()> {
        let state = self.state.lock().unwrap();
        let tmp = self.state_path.with_extension("json.tmp");
        std::fs::write(&tmp, serde_json::to_vec_pretty(&*state)?)?;
        std::fs::rename(&tmp, &self.state_path)?;
        Ok(())
    }

    pub fn oauth(&self) -> Option<OAuth> {
        self.oauth.lock().unwrap().clone()
    }

    pub fn session(&self) -> Option<Session> {
        self.oauth().as_ref().map(Session::from)
    }

    pub fn set(&self, o: OAuth) -> Result<Session> {
        let session = Session::from(&o);
        let stored = store_keyring(&o);
        {
            let mut st = self.state.lock().unwrap();
            st.last_session = Some(session.clone());
            st.keyring_unavailable = !stored;
        }
        *self.oauth.lock().unwrap() = Some(o);
        self.save_state()?;
        Ok(session)
    }

    pub fn clear(&self) -> Result<()> {
        *self.oauth.lock().unwrap() = None;
        if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER) {
            let _ = entry.delete_credential();
        }
        self.state.lock().unwrap().last_session = None;
        self.save_state()
    }

    /// `id`, `carry` of the current session, or an auth error.
    pub fn credentials(&self) -> Result<(i32, String)> {
        self.oauth()
            .map(|o| (o.id, o.carry))
            .ok_or_else(|| CoreError::auth("not logged in"))
    }
}

fn load_keyring() -> Option<OAuth> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).ok()?;
    let secret = match entry.get_password() {
        Ok(s) => s,
        Err(keyring::Error::NoEntry) => return None,
        Err(e) => {
            tracing::warn!(error = %e, "keyring read failed");
            return None;
        }
    };
    let bytes = base64::engine::general_purpose::STANDARD.decode(secret).ok()?;
    OAuth::decode(bytes.as_slice()).ok()
}

fn store_keyring(o: &OAuth) -> bool {
    let secret = base64::engine::general_purpose::STANDARD.encode(o.encode_to_vec());
    match keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).and_then(|e| e.set_password(&secret)) {
        Ok(()) => true,
        Err(e) => {
            // Never fall back to plaintext on disk; the session stays in memory only.
            tracing::warn!(error = %e, "keyring write failed; session will not persist");
            false
        }
    }
}
