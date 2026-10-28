//! Live smoke test: `cargo run -p oskol-core --example smoke [data_dir]`.
//! Boots the core against the real network, prints status changes, then calls `preload`
//! and `home`.

use oskol_core::{Core, CoreConfig, Phase};
use std::time::Duration;

#[tokio::main]
async fn main() {
    let dir = std::env::args().nth(1).map(Into::into).unwrap_or_else(|| std::env::temp_dir().join("oskol-smoke"));
    let core = Core::start(CoreConfig::new(dir)).await.expect("start");
    let mut rx = core.subscribe();
    let deadline = tokio::time::Instant::now() + Duration::from_secs(90);
    loop {
        let s = rx.borrow_and_update().clone();
        println!("status: {}", serde_json::to_string(&s).unwrap());
        if s.phase == Phase::Ready {
            break;
        }
        if tokio::time::timeout_at(deadline, rx.changed()).await.is_err() {
            println!("timed out");
            return;
        }
    }
    tokio::time::sleep(Duration::from_secs(3)).await;
    println!("routes: {}", core.backend.table().routes.len());
    for op in ["preload", "home"] {
        match core.api(op, serde_json::json!({"page": 0})).await {
            Ok(v) => {
                let s = v.to_string();
                let mut end = s.len().min(400);
                while !s.is_char_boundary(end) {
                    end -= 1;
                }
                println!("{op}: ok {} bytes: {}", s.len(), &s[..end]);
            }
            Err(e) => println!("{op}: error {}", serde_json::to_string(&e).unwrap()),
        }
    }
}
