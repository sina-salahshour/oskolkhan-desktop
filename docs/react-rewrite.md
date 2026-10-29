# OskolKhan desktop — Electron + React rewrite (fixed design)

Complete rewrite of the frontend as an **Electron + React** app. The Rust core
(`crates/oskol-core`) is unchanged and runs as a **sidecar** over the existing HTTP-RPC
bridge. The SvelteKit `src/` and `src-tauri/` are dropped.

## Stack (decided)
- **Electron** (Wayland default), **electron-vite** build, **React 18 + TypeScript**.
- **Tailwind CSS v4** (CSS-variable theming, dark + light). **NOT gradient-heavy** — flat
  cinematic surfaces, subtle borders/elevation, one refined accent; depth via shadow/scale, not gradients.
- **TanStack Router** (type-safe routes, real history/back). **TanStack Query** (RPC data) + **Zustand** (UI/player/download state).
- **Radix UI** primitives (a11y), styled with Tailwind + **motion/react** micro-interactions.
- **@lucide/react** icons (one set, no emoji).
- Accessibility first: focus-visible, keyboard nav, ARIA via Radix, `prefers-reduced-motion`, RTL.

## Repo layout
```
oskolkhan-desktop/
  crates/oskol-core/          # UNCHANGED core + a new sidecar binary (below)
  app/                        # the Electron + React app (NEW)
    package.json              # electron, electron-vite, react, deps, scripts
    electron.vite.config.ts
    electron/
      main/index.ts           # spawn core sidecar, window, Wayland flags, menu, lifecycle
      preload/index.ts        # contextBridge: coreEndpoint {port, token}, native actions, logger
      main/core.ts            # sidecar manager (free port, token, env, readiness, kill-on-quit)
    src/                      # React renderer
      main.tsx
      app/                    # router tree, providers, AppShell (sidebar/topbar/palette), nav
      features/<feature>/     # feature-based: home, explore, search, title, player, downloads, library, settings, account, auth
      lib/                    # api (RPC client), types, query hooks, logger, i18n, utils
      components/ui/          # design system (Radix+Tailwind+motion primitives)
      styles/                 # tailwind.css, tokens, themes
    resources/                # bundled core binary (per-arch) for packaging
  Makefile                    # AppImage build + .desktop generation + lib-folder install
  docs/
```
Remove after the rewrite lands: root `src/`, `src-tauri/`, root `package.json`/`vite.config.ts`/`svelte.config.js`/`.svelte-kit`/`build` (the SvelteKit app). Keep `pnpm browser` note only if still wanted; otherwise drop.

## Core sidecar (new binary)
Promote `crates/oskol-core/examples/serve.rs` to a real binary **`oskol-serve`**
(`crates/oskol-core/src/bin/oskol-serve.rs`, `[[bin]]` in Cargo.toml). It:
- Boots `Core` (honors env: `OSKOL_BROWSER_PORT`, `OSKOL_BROWSER_TOKEN`, `OSKOL_DATA_DIR`, `OSKOL_BIND_INTERFACE`).
- Serves **only** `POST /rpc` (token in `x-oskol-token` header; CORS `*` for localhost). It does **not** need to serve the SPA — Electron loads the React build itself. (The core's own asset server on its separate 127.0.0.1 port still serves images/media; the renderer uses `assetBase` from `core_status`.)
- Prints `LISTENING <port>` on stdout when bound (Electron can also just poll).
Keep `examples/serve.rs` (for `pnpm browser`) OR delete — architect's call at integration.

## Electron main
- Before `whenReady`: `app.commandLine.appendSwitch('ozone-platform-hint','auto')` + `appendSwitch('enable-features','WaylandWindowDecorations')`.
- On launch: pick a free port `P`, random token `T`; `data_dir = process.env.OSKOL_DATA_DIR ?? <userData>/core`; spawn the sidecar with `OSKOL_BROWSER_PORT=P OSKOL_BROWSER_TOKEN=T OSKOL_DATA_DIR=... ` and **forward `OSKOL_BIND_INTERFACE`** if set (dev on this machine needs `wlan0`). Wait until `/rpc core_status` responds, then create the `BrowserWindow`.
- Window: 1360×860, min 960×600, dark background, title "OskolKhan", frameless-or-native (native for now).
- **Native menu + nav**: app menu with Back/Forward (⌘/Alt+←/→) that the renderer router listens to; standard edit/view menus.
- Kill the sidecar on `window-all-closed`/`before-quit`.
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` where possible.

## Preload (contextBridge → `window.oskol`)
- `coreEndpoint(): { port: number; token: string }`
- `openExternal(url)`, `clipboardWrite(text)`, `saveFile(name, data)` / `pickFile()` (for `.osbin` import + downloads later)
- `log(entry)` → Electron appends to `<userData>/logs/app.log` (local error log)
- `onNav(cb)` (menu Back/Forward) — renderer wires to router history
- `platform` / `appVersion`

## Renderer ↔ core contract (direct fetch)
- `lib/api/client.ts`: base = `http://127.0.0.1:${port}`; every call `POST /rpc` with header `x-oskol-token: ${token}` and body `{ command, args }`. 200 → JSON; non-2xx → reject with `{code,message}`.
- Commands (mirror the current bridge, DO NOT change): `core_status`, `api` (with `{op, args}`), `auth_email {userName,password}`, `auth_guest`, `auth_google`, `auth_telegram_start`, `auth_telegram_poll`, `session`, `logout`, `import_kickstart {path}`.
- `api` ops (via `{command:"api", args:{op, args}}`): `preload, home {page}, getMore {endpoint,page|...}, item {id}, itemDetail {id}, files {id}, faq, search {phrase,type,ignoreTypes:number,page}, likes {type,page}, watches {type,page}, removeWatch {tid}, like {...}, watch {...}, subtitles {...}, srt {path}, trailer {lsi,urn}, playUrl {urn,id?,vurn?,download?} → {url,filename}, adProfile, getContentTypes, setContentTypes {value}, setBirth {value}`.
- `core_status` → `{ phase: 'starting'|'bootstrapping'|'ready'|'offline'|'error', message, activeHost, routes, assetBase, loggedIn }`. No push events over RPC → **poll** `core_status` (~1.5s) until ready, then slower.
- Errors `{code,message}` with codes `notReady|network|auth|server|decode|unimplemented`.
- **Types**: port `../src/lib/api/types.ts` (405 lines; proto field names verbatim) into `app/src/lib/api/types.ts` unchanged.
- **Images**: `imageUrl(status.assetBase, img, size)` → `${assetBase}/Ca8dA/images300<img>.jpg` / `...images800<img>_bg.jpg` / `...images1500/<img>_bg.jpg` / `.../images{100,300}/{names,titles}/<x>.jpg` (patterns from `src/lib/util/images.ts`).
- **i18n**: port `src/lib/i18n/strings.ts` (fa + en flat keys); Persian-first, RTL, toggle.

## Error policy (required)
- A single API client is the only place that talks to `/rpc`. All errors become `{code,message}`.
- TanStack Query `onError` (global `QueryCache`/`MutationCache`) → show a **toast** AND call `window.oskol.log({level:'error', scope, code, message, ts})` so it's written to the local log file; also `console.error`. Never show `[object Object]`.
- Unhandled render errors → an ErrorBoundary that logs locally + offers retry.

## Screens (feature parity, feature-based dirs)
home, explore (advanced filter: genres/countries/sort/rating-ranges/content-warnings/year + relaxation hints, grid/list, pagination), search (titles/people/keywords, debounced), title/[id] (ratings, cast, recommendations, synopsis, GroupInfoV2 file tree with 4K/HDR/DV/DTS/x265/dub/sub badges, Play/Download/Like/Share, **copy-link** per file via `playUrl`), player (full chrome: seekbar+thumbs, speed incl hold-2x, audio/subtitle menus, subtitle style+sync, next-episode, PiP/fullscreen — stub source now, real libmpv/`<video>` later), downloads (queue multi-select, groups, offline library — mock state now), likes + history (multi-delete), settings (view modes, buffer profiles, title language, subtitle defaults, device/UA, theme+language), account (VIP/coins/daily-reward/rewardloop gamification — but NOT gradient-heavy; restrained), auth (email/Google/Telegram-QR+poll/guest, gated by PreLoad flags). Splash/boot overlay driven by `core_status` (starting/bootstrapping/offline/error + retry + import-kickstart).

## Design direction (binding — replaces the SvelteKit look)
- Flat, cinematic, **not gradient-heavy**. Clean surfaces, hairline borders, one refined accent (amber/gold), restrained elevation. Beautiful in **both dark and light**.
- Heavy, tasteful **motion/react**: page transitions, shared-layout where it helps, hover/press, staggered lists, skeletons, animated counters — all honoring `prefers-reduced-motion`.
- Navigation that makes sense: a persistent back/forward affordance wired to router history + the native menu; breadcrumb-ish context on deep pages; Ctrl/⌘+K command palette.
- Full RTL + Persian typography (Vazirmatn/Estedad via @fontsource, OFL; never the APK's IRANSans). Inter for Latin.

## Dev run (this machine)
`OSKOL_DATA_DIR=$HOME/.local/share/com.oskolkhan.desktop OSKOL_BIND_INTERFACE=wlan0 pnpm --filter app dev` (reuse the logged-in session + cached routes + the VPN-bypass uplink). Prod: neither env var set.
