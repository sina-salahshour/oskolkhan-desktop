# App build notes (Electron + React scaffold — Worker A)

Companion to `docs/react-rewrite.md` (the fixed design). This documents only the
build/run mechanics of the `app/` project and the core sidecar.

## Layout produced
- `crates/oskol-core/src/bin/oskol-serve.rs` — core sidecar binary (`POST /rpc` only).
- `app/` — electron-vite project: `electron/{main,preload}`, `src/` renderer, `index.html` at the app root, `resources/` for packaging.
- `Makefile` (repo root) — AppImage build + `.desktop` generation + lib-folder install.

## Prerequisites / gotchas
- `app` is a pnpm **workspace member** (`pnpm-workspace.yaml` → `packages: [app]`), so
  `pnpm --dir app <script>` and `pnpm --filter app <script>` both work.
- A **minimum-release-age** gate is active; all pinned versions are ≥ 2 weeks old.
- pnpm blocks dependency build scripts by default. `pnpm-workspace.yaml` → `allowBuilds`
  enables Electron's postinstall (downloads the platform binary, needed for `dev`). If a
  fresh clone's `pnpm install` leaves `node_modules/.../electron/dist` empty, run
  `pnpm approve-builds` (or re-run Electron's `install.js`).

## Run (dev — the user runs this, not CI)
```
OSKOL_DATA_DIR=$HOME/.local/share/com.oskolkhan.desktop \
OSKOL_BIND_INTERFACE=wlan0 \
pnpm --dir app dev
```
Main picks a free port + random token, spawns `cargo run -q -p oskol-core --bin oskol-serve`
with those env vars (forwarding `OSKOL_BIND_INTERFACE`), waits for `POST /rpc core_status`,
then opens the window. Prod (`app.isPackaged`) runs the bundled `resources/oskol-serve` binary.

## Verify (no GUI)
```
pnpm --dir app install
pnpm --dir app typecheck
pnpm --dir app build
cargo build -p oskol-core --bin oskol-serve
```

## Package (Linux AppImage)
```
make appimage     # release sidecar -> app/resources/oskol-serve, then electron-builder
make install      # + copy AppImage into ~/.local/lib/oskolkhan and write a .desktop
```
`make install PREFIX=/opt` to relocate. The `.desktop` `Exec` passes `--ozone-platform-hint=auto`.
