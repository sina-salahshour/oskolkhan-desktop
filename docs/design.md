# OskolKhan Desktop: fixed design (v0)

Goal: a Linux-first desktop client, with Windows and macOS later, that has feature parity with Android 2.0.44.
It talks to the **unchanged** backend exactly as the Android app does. The UI is a new, refined, desktop-first design rather than an Android copy.

Out of scope for now: ads, DRM/stream decryption, FCM push, Cast, TV mode, widgets.

## Stack
- Tauri 2, with a SvelteKit UI (Svelte 5 runes, TypeScript, `adapter-static`, SPA mode, `ssr = false`).
- pnpm.
- The Rust core is in `crates/oskol-core`, a pure library with no Tauri dependency, so it can be tested on its own.
  The Tauri crate is `src-tauri`, a thin layer of commands and state.
- Cargo workspace root is `Cargo.toml`, with members `src-tauri` and `crates/oskol-core`.

## Repository layout and ownership
```
oskolkhan-desktop/
  Cargo.toml                 workspace           (core worker)
  crates/oskol-core/         Rust core + proto/  (core worker)
  src-tauri/                 Tauri app crate     (core worker)
  package.json, svelte.config.js, vite.config.ts, tsconfig.json, src/, static/   (UI worker)
  docs/android-analysis.md   findings (read-only for workers)
  docs/native-protocol.md    native RE findings  (RE worker)
```
- `tauri.conf.json` settings: `build.devUrl = http://localhost:1420`, `build.frontendDist = ../build`, `beforeDevCommand = pnpm dev`, `beforeBuildCommand = pnpm build`.
- Vite serves on port 1420, with `strictPort`.

## Core architecture (mirrors the Android design)
The core reproduces what `libexo.so` does:
1. **Bootstrap.**
   - Use the kickstart sources from `android-analysis.md` §2, tried in parallel and first success wins. They are GitHub raw, GitHub blob, blogfa, aparat and DNS TXT at a given resolver.
   - Plus a manual `.osbin` file import.
   - Decode as base64, then brotli, then `hellix`, then positional XOR, then `hell`.
   - The bootstrap client uses DoH (cloudflare 1.1.1.1/8.8.8.8/178.22.122.100) and the exact UAs from §2.
2. **Routing.**
   - A route is a hostname plus a connect IP. The core connects to the IP with SNI and Host set to the hostname.
   - Pins are SPKI pins from `Cpis` where present. Bootstrap has no pins.
   - Health check: `GET /Ca8d5/Test/Hi` must return `true`.
   - Then `GET /Ca8d5/init/Peak/{MMddHH}X` (local time) gives `interfacess`, which is decoded per §2.
   - Cache the routing table on disk. Refresh it every `interupt` seconds, or skip if hash and TimeStamp are unchanged.
   - Fail over to the next route on error.
3. **Backend protocol.** Requests are form-urlencoded and responses are protobuf, as in the §3 table.
   - The native-added parts (UA, headers, session attachment) live behind a `BackendProtocol` trait.
   - The v0 implementation is a best-guess plain HTTPS request with the same path and form body. The UA comes from the `PreLoad.Envs` template if present, otherwise from a config value.
   - The trait is replaced once `docs/native-protocol.md` is complete.
   - Every guess carries a `// TODO(native-protocol)` comment.
4. **Session.**
   - `OAuth` (`id`, `carry`, ...) is persisted in the OS keyring (`keyring` crate) under service `oskolkhan-desktop`. Non-secret state goes in a JSON file in the app data dir.
   - **Mobile-identity rule.** To behave like the old app, the client must present a MOBILE identity to the backend, not a desktop one. The backend likely gates on the User-Agent and device fields, so sending a desktop UA risks rejection.
     - DeviceId is a stable random 16-hex id, generated once (same shape as ANDROID_ID).
     - DeviceName, Model and AndroidVersion impersonate a **Poco F6 Pro on Android 16**, as named constants in one config module:
       - `MANUFACTURER = "Xiaomi"`, `BRAND = "POCO"`
       - `MODEL = "23113RKC6G"` (Poco F6 Pro; codename `vermeer`)
       - `ANDROID_VERSION = "16"` (RELEASE), `SDK_INT = 36`
       - `DeviceName = "Xiaomi 23113RKC6G"` (Android rule: capitalize(MANUFACTURER) + " " + MODEL when MODEL doesn't start with MANUFACTURER)
       - `BUILD_ID`/fingerprint placeholder e.g. `BP2A.250605.031` (adjust if the RE spec shows the real one is sent)
     - The upstream User-Agent is whatever `libexo.so` sends (recovered in `native-protocol.md`): the `PreLoad.Envs` template with `$osVersion`/`$deviceName` filled by the values above (so `$osVersion`→`16`, `$deviceName`→`23113RKC6G`). Until recovered, use an Android 16 / Poco F6 Pro placeholder — e.g. `Dalvik/2.1.0 (Linux; U; Android 16; 23113RKC6G Build/BP2A.250605.031)` — never a desktop browser UA.
   - FCM = "".
   - Revalidate with `init/Auth` at startup.
5. **Local media/image server.**
   - The core serves `http://127.0.0.1:<random port>/<token>/...` (axum or hyper). It proxies images (`Ca8dA/images...`) and, later, streams, downloads and thumbnails through the routing layer.
   - The token is 24 random bytes, hex-encoded, and travels in the path because `<img>` and players cannot add headers.

## UI ↔ core contract (Tauri commands; JSON)
JSON rules:
- Protobuf messages are serialized to JSON with the **proto field names verbatim** (the Wire names, e.g. `persian`, `Year`, `orgtitles`).
- Defaults are emitted: absent scalars appear as `0`/`""`/`false`, absent repeated fields as `[]`, absent messages as `null`.
- Ints are JSON numbers and bytes are base64 strings.

Commands:
- `core_status() -> CoreStatus`. The core also emits the event `core://status` with the same payload on every change.
  ```ts
  type CoreStatus = {
    phase: "starting" | "bootstrapping" | "ready" | "offline" | "error";
    message: string | null;
    activeHost: string | null;
    routes: number;
    assetBase: string; // e.g. "http://127.0.0.1:43123/<token>"
    loggedIn: boolean;
  };
  ```
- `api(op: string, args: object) -> any`. Each `op` maps to one backend endpoint:

  | op | args | returns (proto message) |
  |---|---|---|
  | preload | {} | PreLoad |
  | home | {page} | Home |
  | getMore | {endpoint, page} | GetMore |
  | item | {id} | GenericTitle |
  | itemDetail | {id} | ItemDetail |
  | files | {id} | TitleFilesV2 |
  | faq | {} | Faq |
  | search | {phrase, type, ignoreTypes, page} | ISearch |
  | likes / watches | {type, page} | GetMore |
  | removeWatch | {tid} | null |
  | like | {category, item, on, status} | null |
  | watch | {fid, tid, length, last, on} | null |
  | subtitles | {i, s?, e?, c} | SubTitleParent |
  | srt | {path} | string |
  | trailer | {lsi, urn} | string |
  | adProfile | {} | adProfile |
  | getContentTypes | {} | Ctype |
  | setContentTypes | {value} | OAuth |
  | setBirth | {value} | OAuth |

- Auth commands, which return `Session` or an error. The core stores the session.
  - `auth_email({userName, password})`
  - `auth_guest()`
  - `auth_google()`: system browser, loopback plus PKCE, sends the ID token to `gauth`. The OAuth client is a TODO, because the desktop needs its own Google client ID.
  - `auth_telegram_start() -> {botUrl}`: calls `tauth`, then returns `BotUrl?start=register-<DeviceId>`.
  - `auth_telegram_poll() -> Session | null`
  - `session() -> Session | null`
  - `logout()`

  ```ts
  type Session = {
    id: number;
    name: string;
    family: string;
    vip: boolean;
    vipLevel: number;
    plan: number;
    contentType: number;
    needsBirth: boolean;
    needsContentType: boolean;
  };
  ```
- `import_kickstart(path: string) -> CoreStatus`: manual `.osbin` import.
- Errors are a rejected promise with `{code: "notReady" | "network" | "auth" | "server" | "decode" | "unimplemented", message: string}`.
- Image URL = `${assetBase}/Ca8dA/images300${img}.jpg` etc. (patterns in android-analysis §3).
- Media playback and downloads are phase 2 and depend on the native RE. The UI ships the player and download screens wired to mock data behind `op` names that are still to be decided.

## UI direction

**This section is binding and always applies. Every screen, component and new feature must follow it; no plain/unstyled placeholders in shipped UI.**

- Desktop-first layout: a sidebar (Home, Explore/Filter, Search, Likes, History, Downloads, Settings), keyboard-first navigation, Ctrl/⌘+K search, and hover previews.
- Visual style: dark and cinematic. The accent is a refined amber/gold (not #ffff00 neon). Glass and blur are used sparingly and purposefully.
- RTL-correct Persian typography with Vazirmatn/Estedad (OFL, from npm; **do not** ship IRANSans from the APK, as it is a commercial font). Latin text uses Inter.
- Mock layer: when not running inside Tauri, or when `VITE_MOCK=1`, the API client uses `src/lib/api/mock.ts` with realistic fixtures shaped exactly like the contract above.

### Mandatory design stack & quality bar
- **Icons: a real, consistent icon pack — Lucide (`@lucide/svelte`).** Never use emoji, ad-hoc SVG, or mixed icon sets as UI icons. One pack everywhere, consistent stroke/size. (Brand marks like IMDb/Rotten Tomatoes may stay as their own logos.)
- **Headless primitives: Melt UI (the Svelte-5 runes build, `melt`).** Use it for every interactive primitive that needs accessibility/behavior — menus, dropdowns, dialogs/modals, popovers, tooltips, tabs, sliders (player seek/volume, subtitle size/position/delay), toggles, select, accordion, progress. We own the visual styling; Melt owns behavior + a11y + keyboard. Don't hand-roll these.
- **Motion & micro-interactions everywhere (tasteful, fast, interruptible).** Use `svelte/transition`, `svelte/motion` (spring/tween) and `svelte/easing`. Required patterns:
  - Hover/press feedback on every interactive element (scale/elevation/color), focus-visible rings, and smooth 150–250ms transitions.
  - Card hover: lift + poster zoom + reveal actions. Page/route transitions. Staggered list/grid entrance.
  - Skeleton shimmer for all loading states; animated number counts; animated progress rings/bars; optimistic UI on like/watch.
  - Respect `prefers-reduced-motion`: degrade to instant/opacity-only.
- **Gamification (lean into the app's own VIP/coins/rewards model — see `adProfile`, daily rewards, VIP levels).**
  - Coins/XP with animated counters and a "+N" fly-up on earn; daily-streak tracker; progress toward next VIP level as a ring/bar.
  - Achievement/reward toasts with a celebratory moment (e.g. a restrained confetti/burst on level-up or reward claim — keep it classy, not noisy).
  - Badges on titles/files (4K, HDR, DV, DTS, x265, dub, VIP) as polished pills; "continue watching" progress; watched/liked states feel rewarding.
  - The "watch ad for coins" flow and VIP card are first-class, delightful surfaces (even while ads themselves are out of scope — show the reward loop).
- **Component system:** centralize tokens (color, radius, spacing, shadow, motion durations/easings) as CSS custom properties; build a small set of styled primitives (Button, IconButton, Card, Pill/Badge, Progress, Toast, Dialog, Tooltip, Slider, Tabs) on top of Melt + Lucide and reuse them. Light/dark via tokens (dark default).
- **Verification:** `pnpm check`, `pnpm lint`, `pnpm build` must pass; run components through the Svelte MCP autofixer. Keep everything browsable on mocks.
