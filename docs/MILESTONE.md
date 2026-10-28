# Milestone M1 — scaffold + offline-complete, pending live backend confirmation

Date: 2026-10-29. Checkpoint commit on branch `main` (initial commit).

## State: GREEN
- `cargo test -p oskol-core` → 13 passed.
- `cargo build --workspace` (incl. Tauri app) → ok.
- `pnpm check` → 496 files, 0 errors, 0 warnings. `pnpm lint` clean. `pnpm build` → SPA in `build/`.
- UI fully browsable on mocks at `pnpm dev` (http://127.0.0.1:1420/, auto mock mode in a browser).

## What exists
- **Analysis**: `docs/android-analysis.md` (protocol, endpoints, models, features) and `docs/native-protocol.md` (libexo.so RE: SuperLoaderBytes = zstd(XOR 0x33), interfacess schema, plain-libcurl upstream, pin-only TLS, UA from PreLoad.Envs). Golden-vector oracle + decoded routing in session scratchpad `re/`.
- **Core** (`crates/oskol-core`): protobuf models (all PModel + bootstrap + interfacess), kickstart decode (14 sources, verified on live GitHub), SuperLoaderBytes + `.osbin` import (golden-vector tested), routing, session (keyring), local asset server, every Tauri command in the contract. Mobile identity = **Poco F6 Pro / Android 16** constants in `src/identity.rs`.
- **Tauri** (`src-tauri`): all contract commands + `core://status` event, config, capabilities, icons.
- **UI** (`src/`): SvelteKit (Svelte 5), all screens (home, auth, explore/filter, search, title/[id], player, downloads, likes, history, settings, account), Splash overlay, sidebar + Ctrl/⌘+K palette, mock layer with fa/en fixtures, design tokens, RTL, Vazirmatn/Estedad/Inter.

## Key findings locked in
- Backend host = **`instantgame.ir`** (ArvanCloud-fronted; cert CN=instantgame.ir; app's cleartext whitelist). The old starter file's hosts had rotated.
- Live API IP seen from the phone during boot: `185.143.234.238:443`; media edge `185.229.134.55`.
- From outside Iran (the Claude-VPN exit), `instantgame.ir` doesn't resolve and ArvanCloud rejects foreign SNI — so live testing must be done from the user's normal Iran network (VPN off). **OskolKhan does NOT need a VPN.**
- Upstream is plain libcurl (no custom headers/signing); only the mobile User-Agent matters; auth rides in the form body. So the desktop client is very likely a **plain HTTPS client to instantgame.ir** — no SNI games, no fingerprint hacks, no embedded proxy. The bootstrap/fronting/pin machinery stays only as a censorship fallback.
- Device identity confirmed from the user's real phone: model `23113RKC6G`, Android `16`.

## NEXT (resume plan)
1. **User runs the probe** with the Claude-VPN OFF, then re-enables it:
   ```
   cd /home/drhe/oskolkhan && bash probe-backend.sh   # writes probe-out/
   ```
   The decisive result: does `instantgame.ir/Ca8d5/Test/Hi` return body `true` at HTTP 200?
   Also captures a real `PreLoad` (the true `Envs` UA template + config) and a `Peak` routing table.
2. **Wire the confirmed transport into the core** based on `probe-out/`:
   - If plain HTTPS works: set the primary backend to `https://instantgame.ir`, standard TLS, mobile UA from the captured `Envs`. Swap the `NATIVE-TLS-SEAM` in `tls.rs`/`backend.rs` accordingly; keep bootstrap/Peak/pin path as fallback (gate behind reachability).
   - Fold the captured `PreLoad.Envs` UA template + real config defaults into `identity.rs` / preload handling.
3. **UI polish pass (binding — see `docs/design.md` "UI direction")**: relaunch a UI worker to apply Lucide icons (`@lucide/svelte`), Melt UI primitives (`melt`), micro-interactions, and gamification across all existing screens. (Captured; not yet applied — current UI uses its own Icon component + hand-rolled primitives.)
4. **Core worker's open items for the contract** (from its report):
   - add a `retry_boot` Tauri command (Splash retry calls it; `// TODO(core)` in `src/lib/api/client.ts`).
   - `import_kickstart(path)` needs a Tauri file-dialog (@tauri-apps/plugin-dialog) to supply a real path from the webview.
   - confirm `setContentTypes`/`setBirth` return the projected `Session` shape.
   - `auth_google` still needs a desktop Google OAuth client ID.
   - player/download op names + `PlaybackSource` wiring are phase 2 (depend on media RE; stream decryption is still unanalyzed/out of scope).

## How to resume this session
- Re-read `docs/design.md`, `docs/android-analysis.md`, `docs/native-protocol.md`, this file, and `probe-out/summary.txt`.
- Restart preview if needed: `cd oskolkhan-desktop && pnpm dev` (→ :1420).
- Scratchpad `re/` (oracle, decoded routes, Ghidra project) is session-temporary and may be gone on resume; the durable facts are in the docs above.
