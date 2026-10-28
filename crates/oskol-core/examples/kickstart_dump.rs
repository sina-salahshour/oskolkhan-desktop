//! Fetch the GitHub raw kickstart and print decoded `hell` entries as contract JSON.
use oskol_core::{json::to_json, kickstart, net};

#[tokio::main]
async fn main() {
    let client = net::bootstrap_client(&net::DohResolver::new());
    let body = client
        .get("https://raw.githubusercontent.com/HansXmp/kickstarter/main/README.md")
        .send().await.expect("fetch").text().await.expect("body");
    let payload = kickstart::extract(kickstart::Extractor::RawText, &body).expect("payload");
    for h in kickstart::decode_payload(&payload).expect("decode") {
        println!("{}", to_json(&h));
    }
}
