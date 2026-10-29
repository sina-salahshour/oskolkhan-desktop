//! `oskol-serve` — the OskolKhan desktop **core sidecar**.
//!
//! This is the real-binary promotion of `examples/serve.rs`. The Electron app
//! (see `app/electron/main/core.ts`) spawns this process, hands it a port and a
//! token via the environment, waits until `POST /rpc {command:"core_status"}`
//! answers, and then opens its window. Unlike `examples/serve.rs` this binary
//! does **not** serve the SPA — Electron loads the React build itself. We only
//! expose the JSON-RPC bridge on `POST /rpc`.
//!
//! Env (all optional; Electron always sets the first three):
//!   OSKOL_BROWSER_PORT    fixed port to bind (default: random 8899 fallback)
//!   OSKOL_BROWSER_TOKEN   `x-oskol-token` secret (default: random 24-byte hex, printed)
//!   OSKOL_DATA_DIR        core data dir (default: <tmp>/oskol-serve)
//!   OSKOL_BIND_INTERFACE  honoured by net.rs (e.g. wlan0 for the Iran uplink)
//!
//! On a successful bind it prints exactly one line to stdout:
//!   LISTENING <port>
//!
//! Error convention (must match the renderer's `lib/api/client.ts`):
//!   - success   -> HTTP 200, body is the method's JSON (`null` for unit / `None`)
//!   - CoreError -> HTTP 400, body is the CoreError JSON `{ "code", "message" }`
//!   - bad token -> HTTP 404 (empty body)
//! CORS `*` is set on every response and OPTIONS /rpc is answered for the
//! browser preflight (the Electron renderer is a cross-origin to 127.0.0.1:P).

use axum::body::{Body, Bytes};
use axum::extract::State;
use axum::http::{header, HeaderMap, Response, StatusCode};
use axum::routing::post;
use axum::Router;
use oskol_core::{Core, CoreConfig, CoreError};
use serde_json::{json, Value};
use std::path::{Path as FsPath, PathBuf};
use std::sync::Arc;

#[derive(Clone)]
struct AppState {
    token: Arc<str>,
    core: Arc<Core>,
}

#[tokio::main]
async fn main() {
    // `--version` / `--help`: cheap, no core boot.
    if let Some(flag) = std::env::args().nth(1) {
        match flag.as_str() {
            "--version" | "-V" => {
                println!("oskol-serve {}", env!("CARGO_PKG_VERSION"));
                return;
            }
            "--help" | "-h" => {
                println!(
                    "oskol-serve — OskolKhan core sidecar (POST /rpc only).\n\
                     Env: OSKOL_BROWSER_PORT OSKOL_BROWSER_TOKEN OSKOL_DATA_DIR OSKOL_BIND_INTERFACE\n\
                     Prints `LISTENING <port>` on stdout once bound."
                );
                return;
            }
            _ => {}
        }
    }

    // Boot the core like examples/serve.rs: honour env (incl. OSKOL_BIND_INTERFACE,
    // read by net.rs) and start bootstrapping in the background. We do NOT block on
    // Ready — Electron polls core_status and shows the splash.
    let data_dir = std::env::var_os("OSKOL_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::temp_dir().join("oskol-serve"));
    let core = Core::start(CoreConfig::new(data_dir)).await.expect("core start");

    let token: Arc<str> = std::env::var("OSKOL_BROWSER_TOKEN")
        .ok()
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| hex::encode(rand::random::<[u8; 24]>()))
        .into();

    let port: u16 = std::env::var("OSKOL_BROWSER_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8899);

    let state = AppState { token, core };
    let app = Router::new()
        .route("/rpc", post(rpc).options(preflight))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port))
        .await
        .expect("bind 127.0.0.1");
    let bound = listener.local_addr().expect("local_addr").port();
    // The single machine-readable readiness line Electron waits for.
    println!("LISTENING {bound}");
    use std::io::Write as _;
    let _ = std::io::stdout().flush();

    axum::serve(listener, app).await.expect("serve");
}

// ----- RPC bridge ------------------------------------------------------------

async fn preflight() -> Response<Body> {
    Response::builder()
        .status(StatusCode::NO_CONTENT)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "POST, OPTIONS")
        .header(
            header::ACCESS_CONTROL_ALLOW_HEADERS,
            "content-type, x-oskol-token",
        )
        .header(header::ACCESS_CONTROL_MAX_AGE, "86400")
        .body(Body::empty())
        .unwrap_or_else(|_| empty(StatusCode::INTERNAL_SERVER_ERROR))
}

async fn rpc(State(st): State<AppState>, headers: HeaderMap, body: Bytes) -> Response<Body> {
    let tok = headers
        .get("x-oskol-token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !constant_time_eq(tok.as_bytes(), st.token.as_bytes()) {
        return empty(StatusCode::NOT_FOUND);
    }
    let req: Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(e) => {
            return json_response(
                StatusCode::BAD_REQUEST,
                &json!({ "code": "decode", "message": format!("bad json body: {e}") }),
            )
        }
    };
    let command = req.get("command").and_then(Value::as_str).unwrap_or("");
    let args = req.get("args").cloned().unwrap_or(Value::Null);
    match dispatch(&st.core, command, args).await {
        Ok(v) => json_response(StatusCode::OK, &v),
        Err(e) => {
            let body = serde_json::to_value(&e)
                .unwrap_or_else(|_| json!({ "code": "server", "message": e.message }));
            json_response(StatusCode::BAD_REQUEST, &body)
        }
    }
}

/// Mirror of the Tauri command table (and `examples/serve.rs`): each arm is a thin
/// wrapper over a public `Core` method. Ok values serialize to JSON; unit and
/// `None` become JSON `null`.
async fn dispatch(core: &Core, command: &str, args: Value) -> Result<Value, CoreError> {
    let str_arg = |key: &str| args.get(key).and_then(Value::as_str).map(str::to_owned);
    match command {
        "core_status" => Ok(serde_json::to_value(core.status())?),
        "api" => {
            let op = args
                .get("op")
                .and_then(Value::as_str)
                .ok_or_else(|| CoreError::decode("api: missing op"))?;
            let inner = args.get("args").cloned().unwrap_or(Value::Null);
            core.api(op, inner).await
        }
        "auth_email" => {
            let user = str_arg("userName").unwrap_or_default();
            let pass = str_arg("password").unwrap_or_default();
            Ok(serde_json::to_value(core.auth_email(&user, &pass).await?)?)
        }
        "auth_guest" => Ok(serde_json::to_value(core.auth_guest().await?)?),
        "auth_google" => Ok(serde_json::to_value(core.auth_google().await?)?),
        "auth_telegram_start" => Ok(serde_json::to_value(core.auth_telegram_start().await?)?),
        "auth_telegram_poll" => Ok(serde_json::to_value(core.auth_telegram_poll().await?)?),
        "session" => Ok(serde_json::to_value(core.session())?),
        "logout" => {
            core.logout().await?;
            Ok(Value::Null)
        }
        "import_kickstart" => {
            let path = str_arg("path")
                .ok_or_else(|| CoreError::decode("import_kickstart: missing path"))?;
            Ok(serde_json::to_value(core.import_kickstart(FsPath::new(&path)).await?)?)
        }
        other => Err(CoreError::unimplemented(format!("unknown command: {other}"))),
    }
}

// ----- helpers ---------------------------------------------------------------

fn json_response(status: StatusCode, value: &Value) -> Response<Body> {
    let bytes = serde_json::to_vec(value).unwrap_or_default();
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::CACHE_CONTROL, "no-store")
        .body(Body::from(bytes))
        .unwrap_or_else(|_| empty(StatusCode::INTERNAL_SERVER_ERROR))
}

fn empty(code: StatusCode) -> Response<Body> {
    Response::builder()
        .status(code)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Body::empty())
        .unwrap()
}

/// Same constant-time comparison the asset server (`server.rs`) uses for its token.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}
