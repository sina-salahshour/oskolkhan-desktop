//! Error type shared with the UI contract:
//! `{code: "notReady" | "network" | "auth" | "server" | "decode" | "unimplemented", message}`.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ErrorCode {
    NotReady,
    Network,
    Auth,
    Server,
    Decode,
    Unimplemented,
}

#[derive(Debug, Clone, Serialize, Deserialize, thiserror::Error)]
#[error("{code:?}: {message}")]
pub struct CoreError {
    pub code: ErrorCode,
    pub message: String,
}

impl CoreError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self { code, message: message.into() }
    }
    pub fn not_ready(m: impl Into<String>) -> Self {
        Self::new(ErrorCode::NotReady, m)
    }
    pub fn network(m: impl Into<String>) -> Self {
        Self::new(ErrorCode::Network, m)
    }
    pub fn auth(m: impl Into<String>) -> Self {
        Self::new(ErrorCode::Auth, m)
    }
    pub fn server(m: impl Into<String>) -> Self {
        Self::new(ErrorCode::Server, m)
    }
    pub fn decode(m: impl Into<String>) -> Self {
        Self::new(ErrorCode::Decode, m)
    }
    pub fn unimplemented(m: impl Into<String>) -> Self {
        Self::new(ErrorCode::Unimplemented, m)
    }
}

impl From<reqwest::Error> for CoreError {
    fn from(e: reqwest::Error) -> Self {
        if e.is_decode() {
            Self::decode(e.to_string())
        } else {
            Self::network(e.to_string())
        }
    }
}

impl From<prost::DecodeError> for CoreError {
    fn from(e: prost::DecodeError) -> Self {
        Self::decode(e.to_string())
    }
}

impl From<std::io::Error> for CoreError {
    fn from(e: std::io::Error) -> Self {
        Self::server(format!("io: {e}"))
    }
}

impl From<serde_json::Error> for CoreError {
    fn from(e: serde_json::Error) -> Self {
        Self::decode(e.to_string())
    }
}

pub type Result<T, E = CoreError> = std::result::Result<T, E>;
