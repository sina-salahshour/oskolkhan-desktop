//! OskolKhan desktop core (no Tauri dependency).

pub mod api;
pub mod auth;
pub mod backend;
pub mod core;
pub mod error;
pub mod identity;
pub mod json;
pub mod kickstart;
pub mod media;
pub mod net;
pub mod protocol;
pub mod proto;
pub mod routing;
pub mod server;
pub mod session;
pub mod superloader;
pub mod tls;

pub use crate::core::{Core, CoreConfig, CoreStatus, Phase};
pub use crate::error::{CoreError, ErrorCode, Result};
pub use crate::session::Session;
