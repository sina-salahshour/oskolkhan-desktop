//! Local media/image server: `http://127.0.0.1:<port>/<token>/<backend path>`.
//!
//! The token (24 random bytes, hex) is in the path because `<img>` and media players
//! cannot add headers. Requests are proxied through the routing layer (with failover).
//! Phase 2 adds streams, downloads and thumbnails here.

use crate::backend::{Backend, BackendRequest};
use axum::body::Body;
use axum::extract::{Path, RawQuery, State};
use axum::http::{header, HeaderMap, HeaderValue, Response, StatusCode};
use axum::routing::get;
use axum::Router;
use futures::StreamExt;
use std::net::SocketAddr;
use std::sync::Arc;

#[derive(Clone)]
struct ServerState {
    token: Arc<str>,
    backend: Arc<Backend>,
}

pub struct AssetServer {
    pub addr: SocketAddr,
    pub token: String,
    _task: tokio::task::JoinHandle<()>,
}

impl AssetServer {
    pub fn base(&self) -> String {
        format!("http://{}/{}", self.addr, self.token)
    }

    pub async fn start(backend: Arc<Backend>) -> std::io::Result<Self> {
        let token = hex::encode(rand::random::<[u8; 24]>());
        let state = ServerState { token: token.clone().into(), backend };
        let app = Router::new()
            .route("/{token}/{*path}", get(proxy).head(proxy))
            .with_state(state);
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0)).await?;
        let addr = listener.local_addr()?;
        let task = tokio::spawn(async move {
            if let Err(e) = axum::serve(listener, app).await {
                tracing::error!(error = %e, "asset server stopped");
            }
        });
        tracing::info!(%addr, "asset server listening");
        Ok(Self { addr, token, _task: task })
    }
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

const FORWARD_RESPONSE_HEADERS: &[header::HeaderName] = &[
    header::CONTENT_TYPE,
    header::CONTENT_LENGTH,
    header::CONTENT_RANGE,
    header::ACCEPT_RANGES,
    header::CACHE_CONTROL,
    header::ETAG,
    header::LAST_MODIFIED,
];

async fn proxy(
    State(st): State<ServerState>,
    Path((token, path)): Path<(String, String)>,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
) -> Response<Body> {
    if !constant_time_eq(token.as_bytes(), st.token.as_bytes()) {
        return status(StatusCode::NOT_FOUND);
    }
    let mut full = format!("/{path}");
    if let Some(q) = query {
        full.push('?');
        full.push_str(&q);
    }
    let mut req = BackendRequest::get(full);
    for name in [header::RANGE, header::IF_NONE_MATCH, header::IF_MODIFIED_SINCE] {
        if let Some(v) = headers.get(&name).and_then(|v| v.to_str().ok()) {
            req = req.header(name.as_str(), v);
        }
    }
    let upstream = match st.backend.send(req).await {
        Ok(r) => r,
        Err(e) => {
            tracing::debug!(error = %e, "asset proxy failed");
            return status(StatusCode::BAD_GATEWAY);
        }
    };
    let mut builder = Response::builder().status(upstream.status().as_u16());
    for name in FORWARD_RESPONSE_HEADERS {
        if let Some(v) = upstream.headers().get(name.as_str()) {
            if let Ok(v) = HeaderValue::from_bytes(v.as_bytes()) {
                builder = builder.header(name, v);
            }
        }
    }
    builder = builder.header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*");
    let stream = upstream.bytes_stream().map(|r| r.map_err(std::io::Error::other));
    builder.body(Body::from_stream(stream)).unwrap_or_else(|_| status(StatusCode::BAD_GATEWAY))
}

fn status(code: StatusCode) -> Response<Body> {
    Response::builder().status(code).body(Body::empty()).unwrap()
}
