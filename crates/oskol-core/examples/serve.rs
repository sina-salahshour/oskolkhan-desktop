//! Browser mode: run the real SvelteKit UI in a normal browser (Chrome/Chromium)
//! against the LIVE Rust core. The WebKitGTK webview Tauri uses is laggy; Chrome is
//! smooth. This example boots `Core` exactly like `examples/smoke.rs` and then serves
//! the built SPA plus a tiny JSON-RPC bridge from a fixed local port.
//!
//! Run (from the repo root, after building the SPA with `VITE_BROWSER=1 vite build`):
//!   cargo run -q -p oskol-core --example serve
//! then open the printed `OPEN:` URL in Chrome. See `docs/browser-mode.md`.
//!
//! Env:
//!   OSKOL_BROWSER_PORT       fixed port (default 8899)
//!   OSKOL_BROWSER_TOKEN      path/url token (default: random 24-byte hex, printed)
//!   OSKOL_BROWSER_BUILD_DIR  SPA build dir (default: `build`, falling back to
//!                            `<crate>/../../build`)
//!   OSKOL_DATA_DIR           core data dir (default: <tmp>/oskol-browser)
//!   OSKOL_BIND_INTERFACE     honoured by net.rs (e.g. wlan0 for the Iran uplink)
//!
//! Error convention (must match src/lib/api/http.ts):
//!   - success   -> HTTP 200, body is the method's JSON (`null` for unit / `None`)
//!   - CoreError -> HTTP 400, body is the CoreError JSON `{ "code", "message" }`
//!   - bad token -> HTTP 404 (empty body)

use axum::body::{Body, Bytes};
use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, Response, StatusCode};
use axum::routing::{get, post};
use axum::Router;
use oskol_core::{Core, CoreConfig, CoreError};
use serde_json::{json, Value};
use std::path::{Path as FsPath, PathBuf};
use std::sync::Arc;

#[derive(Clone)]
struct AppState {
    token: Arc<str>,
    core: Arc<Core>,
    build_dir: Arc<PathBuf>,
}

#[tokio::main]
async fn main() {
    // Boot the core exactly like examples/smoke.rs: honour env (incl.
    // OSKOL_BIND_INTERFACE, which net.rs reads) and start bootstrapping in the
    // background. We do NOT block on Ready — the frontend polls core_status and
    // shows the splash, just like under Tauri.
    let data_dir = std::env::var_os("OSKOL_DATA_DIR")
        .map(PathBuf::from)
        .or_else(|| std::env::args().nth(1).map(PathBuf::from))
        .unwrap_or_else(|| std::env::temp_dir().join("oskol-browser"));
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

    let build_dir = resolve_build_dir();
    if !build_dir.join("index.html").is_file() {
        eprintln!(
            "WARNING: {} has no index.html — build the SPA first with `VITE_BROWSER=1 vite build` (or `pnpm browser`).",
            build_dir.display()
        );
    }

    let state = AppState { token: token.clone(), core, build_dir: Arc::new(build_dir) };
    // Serve the SPA at the SITE ROOT (the build uses `base: ""`, so every link and
    // asset resolves correctly with no path rewriting). The token guards only `/rpc`,
    // carried in the `x-oskol-token` header and injected into index.html for the frontend.
    let app = Router::new()
        .route("/rpc", post(rpc))
        .route("/", get(index))
        .route("/{*path}", get(spa))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port)).await.expect("bind");
    let addr = listener.local_addr().expect("local_addr");
    println!();
    println!("OskolKhan browser mode — live backend, served for Chrome/Chromium.");
    println!("OPEN: http://127.0.0.1:{}/", addr.port());
    let _ = &token; // token is injected into index.html and checked on /rpc
    println!();
    axum::serve(listener, app).await.expect("serve");
}

// ----- RPC bridge ------------------------------------------------------------

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

/// Mirror of the Tauri command table in `src-tauri/src/lib.rs`: each arm is a thin
/// wrapper over a public `Core` method. Ok values are serialized to JSON; unit and
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
            let path =
                str_arg("path").ok_or_else(|| CoreError::decode("import_kickstart: missing path"))?;
            Ok(serde_json::to_value(core.import_kickstart(FsPath::new(&path)).await?)?)
        }
        other => Err(CoreError::unimplemented(format!("unknown command: {other}"))),
    }
}

// ----- static SPA ------------------------------------------------------------

async fn index(State(st): State<AppState>) -> Response<Body> {
    serve_index(&st.build_dir, &st.token).await
}

async fn spa(State(st): State<AppState>, Path(path): Path<String>) -> Response<Body> {
    // Reject traversal; the build dir is the only thing we ever read.
    if path.split('/').any(|seg| seg == ".." || seg == ".") {
        return empty(StatusCode::NOT_FOUND);
    }
    let candidate = st.build_dir.join(&path);
    match tokio::fs::read(&candidate).await {
        Ok(bytes) if candidate.is_file() => file_response(StatusCode::OK, content_type(&path), bytes),
        // Missing file (or a directory) -> client-side route: serve the SPA shell.
        _ => serve_index(&st.build_dir, &st.token).await,
    }
}

/// Serve `index.html` from the site root. The build uses `base: ""` with root-absolute
/// asset paths (`/_app/...`), which are correct as-is at the root — NO path rewriting,
/// so SvelteKit's runtime link/asset resolution is never confused. We only inject the
/// bridge token as a global so the frontend can authenticate `/rpc`.
async fn serve_index(build_dir: &FsPath, token: &str) -> Response<Body> {
    let html = match tokio::fs::read_to_string(build_dir.join("index.html")).await {
        Ok(s) => s,
        Err(_) => {
            return json_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                &json!({ "code": "server", "message": "build/index.html not found — build the SPA first" }),
            )
        }
    };
    let inject = format!("<script>window.__OSKOL_BRIDGE_TOKEN__={};</script>", json!(token));
    let rewritten = match html.find("</head>") {
        Some(pos) => {
            let mut s = String::with_capacity(html.len() + inject.len());
            s.push_str(&html[..pos]);
            s.push_str(&inject);
            s.push_str(&html[pos..]);
            s
        }
        None => format!("{inject}{html}"),
    };
    file_response(StatusCode::OK, "text/html; charset=utf-8", rewritten.into_bytes())
}

fn resolve_build_dir() -> PathBuf {
    if let Some(d) = std::env::var_os("OSKOL_BROWSER_BUILD_DIR") {
        let p = PathBuf::from(d);
        if !p.as_os_str().is_empty() {
            return p;
        }
    }
    let cwd = PathBuf::from("build");
    if cwd.is_dir() {
        return cwd;
    }
    // Fallback: resolve relative to this crate (crates/oskol-core) -> repo/build.
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../build")
}

fn content_type(path: &str) -> &'static str {
    match path.rsplit('.').next().unwrap_or("") {
        "html" | "htm" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" | "map" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        "png" => "image/png",
        "webp" => "image/webp",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "ico" => "image/x-icon",
        "txt" => "text/plain; charset=utf-8",
        "wasm" => "application/wasm",
        _ => "application/octet-stream",
    }
}

fn file_response(status: StatusCode, content_type: &str, bytes: Vec<u8>) -> Response<Body> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, "no-store")
        .body(Body::from(bytes))
        .unwrap_or_else(|_| empty(StatusCode::INTERNAL_SERVER_ERROR))
}

fn json_response(status: StatusCode, value: &Value) -> Response<Body> {
    let bytes = serde_json::to_vec(value).unwrap_or_default();
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Body::from(bytes))
        .unwrap_or_else(|_| empty(StatusCode::INTERNAL_SERVER_ERROR))
}

fn empty(code: StatusCode) -> Response<Body> {
    Response::builder().status(code).body(Body::empty()).unwrap()
}

/// Same constant-time comparison the asset server (`server.rs`) uses for its token.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}
