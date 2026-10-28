//! Offline tests against REAL live captures from the user's Iran device (2026-10-29).
//!
//! - `peak.bin`  — a decompressed live `interfacess` routing table (`init/Peak`, key 163).
//! - `home.zst`  — zstd of the `data/home/0` protobuf (`PModel.Home`).
//!
//! These do NOT make network calls; they verify the core parses exactly what the backend
//! serves. The transport (SNI=Host=route host, selector-strip, SPKI pinning) is in the crate
//! source and exercised live by the user from the phone (see the report).

use base64::Engine;
use oskol_core::proto::pmodel::{Home, Interfacess};
use oskol_core::routing::{self, RoutingTable, API_GROUP};
use prost::Message;

/// (a) parse `peak.bin` → routing table with group-99999999 rows whose hosts include the
/// known API hosts and whose pins base64-decode to 32 bytes.
#[test]
fn peak_bin_parses_api_routing_table() {
    let raw = include_bytes!("fixtures/peak.bin");
    let t = Interfacess::decode(raw.as_slice()).expect("peak.bin decodes as interfacess");
    // Live capture: single-byte XOR key 163, 21 route groups, hosts + pins present.
    assert_eq!(t.key, 163, "live Peak key");
    assert!(routing::interfacess_is_valid(&t), "table must pass the Android validity gate");
    assert_ne!(t.hash, 0);

    let table = RoutingTable::from_interfacess(t);
    assert!(!table.routes.is_empty());

    // Group-99999999 rows are the primary API endpoints.
    let api: Vec<_> = table.routes.iter().filter(|r| r.group == API_GROUP).collect();
    assert!(!api.is_empty(), "no group-99999999 API routes decoded");

    // The known live API hosts must all be present in the API group.
    for host in ["api.g00gleapi.sbs", "api.gamezula.sbs", "edge05.556512.ir.cdn.ir"] {
        assert!(
            api.iter().any(|r| r.host == host),
            "group-99999999 hosts must include {host}; got {:?}",
            api.iter().map(|r| r.host.as_str()).collect::<Vec<_>>()
        );
    }

    // Every pinned API row's pin is a raw 32-byte SHA-256(SPKI); base64 round-trips to 32 B.
    let pinned: Vec<_> = api.iter().filter(|r| r.pin.is_some()).collect();
    assert!(!pinned.is_empty(), "expected pinned API rows");
    for r in &pinned {
        let pin = r.pin.as_ref().unwrap();
        assert_eq!(pin.len(), 32, "pin for {} is not 32 bytes", r.host);
        let b64 = base64::engine::general_purpose::STANDARD.encode(pin);
        let back = base64::engine::general_purpose::STANDARD.decode(&b64).unwrap();
        assert_eq!(back.len(), 32, "base64 pin for {} must decode to 32 bytes", r.host);
    }

    // The primary-route helper selects the API group and the sort puts it first.
    assert_eq!(table.routes[0].group, API_GROUP, "group-99999999 must sort first");
    assert!(table.primary_routes().iter().all(|r| r.group == API_GROUP || r.group == 99999998));

    // The specific IP↔host↔pin pairings the user confirmed live (native-protocol §10.7/§11).
    let pin_b64 = |host: &str| {
        api.iter()
            .find(|r| r.host == host && r.pin.is_some())
            .map(|r| base64::engine::general_purpose::STANDARD.encode(r.pin.as_ref().unwrap()))
    };
    // The exact SPKI pin this live capture carries for api.g00gleapi.sbs (guards against
    // decoder/fixture drift). Pins rotate on the backend, so this is the 2026-10-29 value,
    // not the older STATIC golden table's.
    assert_eq!(
        pin_b64("api.g00gleapi.sbs").as_deref(),
        Some("cvVE1gf7uJRRLkLdDr7z3gW+qQ+PruxrIdsiShhVl5Y="),
        "api.g00gleapi.sbs SPKI pin drifted from the live capture"
    );
}

/// (b) zstd-decompress `home.zst` and prost-decode as `Home` with non-empty sections and a
/// real Persian title.
#[test]
fn home_zst_decodes_as_home_with_persian() {
    let zst = include_bytes!("fixtures/home.zst");
    let body = zstd::stream::decode_all(zst.as_slice()).expect("home.zst decompresses");
    let home = Home::decode(body.as_slice()).expect("decodes as PModel.Home");

    assert!(!home.sections.is_empty(), "Home must have sections");
    let has_titles = home.sections.iter().any(|s| !s.recently.is_empty());
    assert!(has_titles, "at least one section must carry titles");

    // The capture contains the film "مرد عنکبوتی" (Spider-Man) as a Persian title.
    let found = home
        .sections
        .iter()
        .flat_map(|s| s.recently.iter())
        .any(|t| t.persian.contains("مرد عنکبوتی") || t.titles.iter().any(|x| x.contains("مرد عنکبوتی")));
    assert!(found, "expected the Persian title «مرد عنکبوتی» in the live Home capture");
}
