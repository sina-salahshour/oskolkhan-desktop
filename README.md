# OskolKhan Desktop

A cross-platform (Linux-first) desktop client for the **OskolKhan** media service
— an Electron + React UI backed by a Rust core sidecar that speaks the service's
native protocol. It talks to the **unchanged** OskolKhan backend and mirrors the
Android app's behaviour.

> The backend is Iran-only and reached over a pinned, non-standard transport. The
> sidecar does all of that; the UI only ever talks to `127.0.0.1`. See
> **[docs/backend-architecture.md](docs/backend-architecture.md)** for the full
> picture.

---

## Highlights

- **In-app playback** of arbitrary containers/codecs (MKV, HEVC, AC3/DTS…) via an
  on-demand HLS transcode (ffmpeg + NVENC), with storyboard scrub previews, audio
  track switching, and real subtitle rendering (embedded text subs → WebVTT).
- **Open in external player** (mpv, VLC, Celluloid, …) — detected at launch.
- **Downloads** with toast + progress ring + cancel, and configurable groups.
- Home, advanced browse, search, title pages, likes & history, Telegram login.
- Persian-first UI (RTL), gamified micro-interactions, light/dark.

## Architecture at a glance

```
React renderer ──loopback HTTP──> oskol-core sidecar ──pinned HTTPS (wlan0)──> OskolKhan backend
  (Electron)                      (Rust, oskol-serve)
```

The sidecar exposes two loopback surfaces — a `POST /rpc` bridge for data/API ops
and a token-in-path asset server for media/images — and handles routing, pin-only
TLS (`SNI = Host`), zstd+protobuf, failover, and the `/stream` media
reverse-proxy. Full details: **[docs/backend-architecture.md](docs/backend-architecture.md)**.

## Repo layout

```
app/                 Electron + React app (electron-vite)
  electron/          main + preload (sidecar spawn, downloads, external players)
  src/               React renderer (features, lib, i18n, components)
  resources/         app icon (+ staged release sidecar, gitignored)
crates/oskol-core/   Rust core sidecar: protocol, routing, session, asset server
docs/                architecture + native-protocol + RE notes + milestones
PKGBUILD             Arch package (installs to /opt with a wlan0-binding launcher)
Makefile             build / install / package targets
scripts/release.sh   version bump + build + GitHub release
```

## Prerequisites

- **Node** + **pnpm** (via corepack) and **Rust** (via rustup) on `PATH`
- **ffmpeg** (runtime, for in-app HLS playback) — NVENC for hardware transcode
- Linux desktop libraries bundled Electron links against (see `PKGBUILD` `depends`)
- For releases: **gh** (authenticated); for Arch packaging: **makepkg**

## Develop

```bash
pnpm --dir app install          # first time

# Dev (renderer HMR + sidecar). The env vars matter when a VPN owns the default
# route: bind the sidecar's upstream to the physical uplink, and pin the data dir.
OSKOL_BIND_INTERFACE=wlan0 \
OSKOL_DATA_DIR="$HOME/.local/share/com.oskolkhan.desktop" \
  pnpm dev
```

Useful: `pnpm typecheck`, `pnpm lint`, `pnpm build` (bundle only).

## Build & install

**Arch (pacman-tracked, recommended):**

```bash
make pkg                 # build + install the .pkg.tar.zst (uses makepkg -d -i -f)
# or build only, then install yourself:
makepkg -d -f && sudo pacman -U oskolkhan-*-x86_64.pkg.tar.zst
```

Installs to `/opt/oskolkhan` with a `/usr/bin/oskolkhan` launcher that sets
`OSKOL_BIND_INTERFACE=wlan0` automatically. Change it at build time with
`make pkg BIND_IFACE=eth0`, or at run time with `OSKOL_BIND_INTERFACE=… oskolkhan`.
Uninstall with `pacman -R oskolkhan`.

**AppImage (any distro):**

```bash
make appimage            # build the AppImage into app/dist/
make install             # + copy into ~/.local and write a .desktop entry
make uninstall
```

## Release

```bash
scripts/release.sh patch        # 0.1.0 -> 0.1.1
scripts/release.sh minor --draft
scripts/release.sh 1.0.0 --no-build -y
```

Bumps the version in lockstep across `package.json`, `app/package.json`,
`Cargo.toml` (`[workspace.package]`) and `PKGBUILD`, builds the package, then
commits, tags, pushes `main`, and cuts a `gh release` with the `.pkg.tar.zst`
attached. Reverts the bump if the build fails. `scripts/release.sh --help` for
all options.

## Operational notes

- **The backend is never modified** — the client replicates the Android app's
  wire behaviour (including its mobile User-Agent).
- **VPN coexistence:** `OSKOL_BIND_INTERFACE=wlan0` binds only the sidecar's
  *upstream* clients to the physical uplink; loopback (UI ↔ sidecar) is untouched.
  Don't route the backend through a packet-capture/VPN app — the backend detects
  capture.

## License

Private / UNLICENSED. Not for redistribution.
