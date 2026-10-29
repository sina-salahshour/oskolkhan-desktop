# Browser mode

Run the **real** OskolKhan desktop UI in a normal browser (Chrome/Chromium) against the
**live** Rust core.

Tauri renders the UI in a WebKitGTK webview, which is noticeably laggy on this Linux
desktop. Browser mode serves the exact same SvelteKit build to Chrome/Chromium instead —
same screens, same live backend, but smooth. It is a development tool, not a shipping
target.

## Run it

```sh
pnpm browser
```

That script does two things:

1. `VITE_BROWSER=1 vite build` — builds the SPA into `build/` with the browser-mode
   client wired in (the API layer picks `http.ts` instead of the Tauri client).
2. `OSKOL_BIND_INTERFACE=wlan0 cargo run -q -p oskol-core --example serve` — boots the
   live `Core` (same as `examples/smoke.rs`) and serves the SPA + an RPC bridge.

On startup the server prints a line like:

```
OPEN: http://127.0.0.1:8899/<token>/
```

Open that URL in Chrome/Chromium. The `<token>` is a random hex secret in the path
(the same pattern the asset server uses) so other local processes can't reach the
bridge; keep it. Everything — the SPA, client-side routes, and the RPC endpoint — lives
under `/<token>/`.

## Live backend

This talks to the **real** backend, so it needs the user's Iran network path. On this
machine that means the `wlan0` uplink, which is why the script sets
`OSKOL_BIND_INTERFACE=wlan0` (read by the core's `net.rs`). Images and media are served
by the core's own asset server on its separate `127.0.0.1` port (`core_status.assetBase`)
and the browser reaches it directly — browser mode does not proxy them.

If the core can't reach the backend you'll see the usual splash / offline / retry states,
exactly as under Tauri.

## Configuration (env)

| Variable | Default | Meaning |
| --- | --- | --- |
| `OSKOL_BROWSER_PORT` | `8899` | Fixed local port for the server. |
| `OSKOL_BROWSER_TOKEN` | random 24-byte hex | Path token; set it to get a stable URL. |
| `OSKOL_BROWSER_BUILD_DIR` | `build` | Where the built SPA is read from. |
| `OSKOL_DATA_DIR` | `<tmp>/oskol-browser` | Core data dir (routing cache, session). |
| `OSKOL_BIND_INTERFACE` | (unset) | Network interface the core binds to (`wlan0` here). |

## How it works

- `crates/oskol-core/examples/serve.rs` runs an axum server on `127.0.0.1:<port>`.
  - `POST /<token>/rpc` with `{ "command": string, "args": object }` dispatches to the
    matching public `Core` method — the same table the Tauri glue exposes
    (`core_status`, `api`, `auth_email`, `auth_guest`, `auth_google`,
    `auth_telegram_start`, `auth_telegram_poll`, `session`, `logout`,
    `import_kickstart`).
  - `GET /<token>/` and `GET /<token>/<*path>` serve the SPA from `build/`, falling back
    to `index.html` for client-side routes. `index.html` is rewritten on the fly so the
    root-absolute asset paths and the SvelteKit `base` sit under `/<token>` (the build is
    produced with `base: ""`).
- `src/lib/api/http.ts` is the `OskolApi` implementation that POSTs to `…/<token>/rpc`.
  It derives the base from `window.location` (origin + first path segment) and polls
  `core_status` every ~1.5s for status updates (there is no server push).

### RPC error convention

- **Success** → HTTP `200`, body is the method's JSON (`null` for unit results / `None`).
- **`CoreError`** → HTTP `400`, body is the error JSON `{ "code", "message" }`.
  `http.ts` rejects the promise with that object, so screens' `isApiError()` handling
  works unchanged.
- **Bad token** → HTTP `404`, empty body.
