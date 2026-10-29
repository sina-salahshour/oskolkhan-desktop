# Backend architecture & reverse-proxy

How the OskolKhan **desktop** client talks to the OskolKhan backend — the same
backend the Android app uses, **unchanged**. This is the readable overview; the
byte-level protocol spec lives in [`native-protocol.md`](./native-protocol.md)
and the Android reverse-engineering notes in [`android-analysis.md`](./android-analysis.md).

---

## 1. The problem this architecture solves

The backend is not a normal public REST API:

- **It's reachable only from inside Iran.** The CDN/API edges answer only over an
  Iranian uplink. On this dev machine the default route is a full-tunnel VPN
  (`tun0`) that exits outside Iran, so upstream traffic must be pinned to the
  physical interface (`wlan0`) — see [§7](#7-network-egress--wlan0-binding).
- **The transport is non-standard.** Routes are IP+host+SPKI-pin rows delivered
  in an obfuscated table; TLS is **pin-only** (no CA/hostname validation), the
  response bodies are **zstd-compressed protobuf**, and the `/Ca8d5` path prefix
  the app uses is a *local* route selector that is **stripped before the upstream
  request**.
- **The Android app never speaks this protocol from Java.** A native library
  (`libexo.so`) runs an in-process proxy that holds the auth context and does all
  routing, pinning and media fetching. The browser/player just hits
  `http://127.0.0.1:<port>/…`.

The desktop client reproduces that native proxy in a **Rust core sidecar**
(`oskol-core`, binary `oskol-serve`). The Electron/React UI never talks to the
backend directly — it talks only to the local sidecar, exactly like the Android
UI talks only to `libexo`.

---

## 2. Component map

```
┌─────────────────────────────────────────────┐
│  Electron app                                │
│                                              │
│  ┌───────────────┐      ┌──────────────────┐ │
│  │ Renderer       │      │ Main process     │ │
│  │ (React UI)     │      │ (electron/main)  │ │
│  │                │      │  - spawns sidecar│ │
│  │  TanStack      │      │  - downloads     │ │
│  │  Query/Router  │      │  - external      │ │
│  └───────┬────────┘      │    players       │ │
│          │               └─────────┬────────┘ │
│          │ HTTP (loopback)         │ spawn     │
└──────────┼─────────────────────────┼──────────┘
           │                         │
           ▼                         ▼
   ┌──────────────────────────────────────────┐
   │  oskol-core sidecar  (Rust, oskol-serve)  │
   │                                           │
   │  (a) RPC bridge     POST /rpc  (header    │
   │      data/API ops         x-oskol-token)  │
   │                                           │
   │  (b) Asset server   http://127.0.0.1:P/   │
   │      media + images       <token>/…       │
   │      (token in PATH)                      │
   │                                           │
   │  ── routing + transport ───────────────   │
   │  interfacess table → endpoint rows        │
   │  pin-only TLS · SNI=Host · zstd+protobuf  │
   │  egress bound to OSKOL_BIND_INTERFACE     │
   └───────────────────┬───────────────────────┘
                       │ HTTPS (pinned), bound to wlan0
                       ▼
   ┌──────────────────────────────────────────┐
   │  OskolKhan backend (Iran-only)            │
   │  API groups 99999999 / 99999998           │
   │  media-CDN groups (per-file mirrors)      │
   │  Cloudflare fallback edges                │
   └──────────────────────────────────────────┘
```

The sidecar exposes **two local HTTP surfaces** on loopback, and both egress to
the backend through the same routing+transport layer.

---

## 3. The two local surfaces

### (a) RPC bridge — `POST /rpc`

The renderer's API client (`app/src/lib/api`) calls the sidecar with a JSON
envelope and an `x-oskol-token` header (a per-launch secret the main process
passes to both sides):

```jsonc
// request
{ "command": "api", "args": { "op": "home", "args": { "page": 0 } } }
// also: { "command": "core_status" }  → { loggedIn, phase, routes, assetBase, … }
```

`command: "api"` dispatches to one op per backend endpoint
(`crates/oskol-core/src/api.rs`): `home`, `getMore`, `item`, `itemDetail`,
`files`, `search`, `likes`, `watches`, `like`, `watch`, `faq`, `subtitles`,
`srt`, `playUrl`, … Each op builds a `BackendRequest`, sends it through the
routing layer, and decodes the zstd+protobuf response into JSON for the UI.

Headers can be set on this surface, so the token travels in a header.

### (b) Asset server — `http://127.0.0.1:<port>/<token>/…`

Images and media players (`<img>`, `<video>`, mpv/VLC) **cannot add headers**,
so this surface puts the token **in the path** instead
(`crates/oskol-core/src/server.rs`). Its routes:

| Route | Purpose |
|---|---|
| `GET/HEAD /<token>/stream?urn=&id=` | media stream reverse-proxy (urn → CDN, Range) — [§5](#5-media-reverse-proxy-stream) |
| `GET /<token>/hls/open?urn=&id=&audio=` | start/reuse an on-demand HLS transcode session |
| `GET /<token>/hls/<sid>/<file>` | HLS playlist / `segNNNNN.ts` / `sbNNNNN.jpg` storyboard / `subNNNNN.vtt` subtitle |
| `GET/HEAD /<token>/{*path}` | catch-all proxy for any other backend `GET` path (images `/Ca8dA/images300…`, etc.) |

`core_status.assetBase` gives the renderer this surface's base URL (port + token)
so it can build `<img>`/player URLs.

---

## 4. Routing & transport (the reverse-proxy core)

Every upstream request — whether from an RPC op or an asset route — goes through
the same routing layer (`crates/oskol-core/src/{backend,routing,media}.rs`).

**The routing table (`interfacess`).** `GET /init/Peak/<MMddHH>X` returns a
zstd'd `interfacess` protobuf that is de-obfuscated by XOR with `key & 0xff`. It
lists **server groups**, each with **endpoint rows** carrying:

- **connect IP** (`Endpoint.f2`),
- **host** (`HsN[HostName]`, e.g. `api.gamezula.sbs`, `sx2.gamezula.sbs`),
- **SPKI pin** (`Cpis[cpi]`, SHA-256 of the cert public key).

Group **99999999** = init/data API endpoints, **99999998** = secondary, numbered
groups = media CDNs, and negative-sentinel / no-host rows = **Cloudflare
fallback** edges.

**Selecting a route.** For an API call, control traffic resolves to the API group
(99999999). For media, the **urn's first path segment** is a `.`-separated list of
base-62 **route-group ids** (e.g. `WNJh.WNJV` → groups `899983`, `899982`), each a
media-CDN group mirroring that file.

**The upstream request (verified live).**

- Connect to the row's **IP:443**, HTTPS.
- **SNI = Host = the row's hostname** — there is *no* decoy SNI.
- **Pin-only TLS**: validate the server cert's SPKI against the row's pin; **no CA
  or hostname check** (this is why an ordinary client can't reach these edges).
- **Path**: the `/Ca8d5` (API) or `/Ca8dA` (images) selector segment is a local
  hint and is **stripped** before sending; the rest is forwarded unchanged. For
  media, only the urn's first (route-selector) segment is removed.
- **Headers**: the mobile User-Agent the CDN gates on
  (`Dalvik/2.1.0 (Linux; U; Android 16; …)`), `Accept: */*`,
  `Accept-Encoding: deflate, gzip, br, zstd`. **No token, no signing upstream** —
  the session/VIP context is held by the sidecar, not sent per-request.
- **Response**: zstd (or br/gzip) → decompress → protobuf (`PModel.*`).

**Failover (`backend.rs::send`).** API calls fail over only among API-group rows
(99999999/99999998) + Cloudflare fallbacks, and latch the sticky `active` row
**only on a 2xx** — otherwise one wrong-path 404 would pin a row that 404s
everything. Media (`/stream`) tries each endpoint of each decoded group until a
`2xx/206`.

**Bootstrap & DNS (`net.rs`, `kickstart.rs`).** A shipped starter table (or a
fresh `/init/Peak` from any live group-99999999 host) seeds the routing table.
The *bootstrap* client resolves hostnames over **DoH** (`1.1.1.1`, `8.8.8.8`,
with a plain-DNS `178.22.122.100` fallback); per-route requests need no DNS — the
rows already carry IPs.

---

## 5. Media reverse-proxy (`/stream`)

Reproduces the Android native proxy's in-app-player path
(`NativePipeDataSource` → `http://127.0.0.1:<port>/<urn>`), verified end-to-end
over `wlan0`:

1. Renderer `<video>`/external player requests
   `GET /<token>/stream?urn=<urn>&id=<fileId>` with a `Range` header.
2. `media::urn_route(urn)` decodes the first segment into group ids and keeps the
   rest as the upstream path.
3. For each endpoint of each group, do a **pinned Range GET**
   `https://{host}{path}` (SNI=Host, SPKI pin, wlan0 egress, mobile UA, the
   incoming `Range` passed through).
4. The first `206/200/416/304` is streamed back with its `Content-Type` /
   `Content-Range` / `Accept-Ranges` headers (empty body for `HEAD`). All mirrors
   failing → `502`; table not ready → `503`; bad token → `404`.

External players get the raw `/stream` URL and play all codecs natively; the
in-app player optionally goes through the on-demand **HLS transcode** layer
(`/hls/*`, `transcode.rs`) for containers/codecs the browser can't play — that's
our own addition, not backend protocol.

---

## 6. Auth & session

There is **no user token header** toward the backend. Login (`/init/tauth` via
Telegram, `/init/Auth` revalidation, etc.) returns an `OAuth` the sidecar stores;
the sidecar holds the `(id, carry)` credentials and VIP context in memory
(`session.rs`) and attaches them only where the specific endpoint's form body
requires them (e.g. `GetContentTypes`, `setBirth`). The per-request upstream
traffic is otherwise anonymous — the edges gate on the mobile UA + pin + reachability.

---

## 7. Network egress & wlan0 binding

Because the machine's default route is a VPN that exits outside Iran, the sidecar
binds **every upstream HTTP client** to a chosen interface when
`OSKOL_BIND_INTERFACE` is set (`net.rs::maybe_bind_interface` →
`SO_BINDTODEVICE`). The installed launcher and dev command set
`OSKOL_BIND_INTERFACE=wlan0`, so:

- **Loopback** (renderer ↔ sidecar, `127.0.0.1`) is untouched and always works.
- **Upstream** (sidecar → Iran CDN) goes out `wlan0`, bypassing the tunnel.

The packaged `/usr/bin/oskolkhan` launcher (see `PKGBUILD`) sets this
automatically; override with `BIND_IFACE=… make pkg` at build time or
`OSKOL_BIND_INTERFACE=… oskolkhan` at run time. Unset → no binding (normal use on
an Iranian network).

> Do **not** route the backend through a packet-capture/VPN-capture app: the app
> detects capture. The `SO_BINDTODEVICE` approach needs none.

---

## 8. Security notes

- **Loopback only.** Both local surfaces bind `127.0.0.1`; nothing listens on a
  routable address.
- **Per-launch token.** A fresh 24-byte hex token gates both surfaces (header on
  `/rpc`, path segment on the asset server, compared in constant time).
- **Pin-only upstream TLS.** Matches the native client; the sidecar is the only
  component that performs it, and only toward the backend's own edges.
- **Backend is never modified.** The desktop client only *replicates* the Android
  app's wire behaviour.

---

## 9. Where to look in the code

| Concern | File |
|---|---|
| RPC bridge / dispatch | `crates/oskol-core/src/bin/oskol-serve.rs` |
| API ops (endpoint → proto) | `crates/oskol-core/src/api.rs` |
| Routing table, endpoint rows | `crates/oskol-core/src/routing.rs` |
| Send + failover + pinned client | `crates/oskol-core/src/backend.rs` |
| Asset server (`/stream`, `/hls`, images) | `crates/oskol-core/src/server.rs` |
| urn → group ids / play-URL builder | `crates/oskol-core/src/media.rs` |
| Interface binding + DoH | `crates/oskol-core/src/net.rs` |
| On-demand HLS transcode | `crates/oskol-core/src/transcode.rs` |
| Session / OAuth | `crates/oskol-core/src/session.rs` |
| Byte-level protocol spec | `docs/native-protocol.md` |
| Android RE notes | `docs/android-analysis.md` |
