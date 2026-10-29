# Next phases — backlog (after core features work)

Core/playback is the current focus. Once real video playback works (the media-proxy
RE in progress), move to the **Polish** phase below. Each item has enough context to pick up cold.

## Phase P — UI/UX polish (queued by the user)

1. **Account FAQ accordion — render rich text, not escaped HTML.**
   - FAQ answers (`Faq.items[].title2` / the answer field) contain **HTML**; the account page currently shows it as escaped text. Render it as rich text safely (sanitize, e.g. a tiny allowlist sanitizer or `dompurify`, then `dangerouslySetInnerHTML`) — don't ship raw unsanitized HTML.
   - File: `app/src/features/account/Accordion.tsx` (+ where the FAQ answer is rendered in `app/src/features/account/index.tsx`).

2. **Accordion — independent toggle (bug).**
   - Opening one accordion item currently opens **all** of them (shared/global open state). Make each item toggle independently (Radix Accordion `type="multiple"` or per-item state keyed by id).
   - Same files as #1. Check any other accordion usages (there's a Radix accordion dep; the library list in `components/ui` may also have one).

3. **App-wide cursor audit.**
   - Go through the whole app and set correct cursors: `cursor-pointer` on all clickable/interactive elements (buttons, cards, links, menu items, tabs, chips, icon-buttons), `cursor-text` on inputs, `cursor-not-allowed` on disabled, `cursor-grab`/resize where relevant. Many custom `div`/`li` click targets likely lack `cursor-pointer`.
   - Sweep `app/src/components/ui/**` (fix at the primitive level where possible) and `app/src/features/**`.

4. **Jittered-backoff retry on frontend requests.**
   - Configure TanStack Query global `retry` + `retryDelay` to use **exponential backoff with jitter** (e.g. `retryDelay: (n) => Math.min(1000 * 2 ** n, 30000) * (0.5 + Math.random() * 0.5)`), with a sane `retry` count and NO retry on 4xx-style `{code}` (notReady is fine to retry, auth/decode/unimplemented are not).
   - File: `app/src/app/providers.tsx` (the QueryClient config). Keep the existing global error→toast+log policy.

5. **Player — replace the stale "real playback next phase" message.**
   - The player shows "پخش واقعی در فاز بعدی فعال می‌شود (وابسته به هسته بومی)". Once real playback works, remove/replace it with an accurate state (playing / or the "format not supported, open externally" panel for MKV/HEVC).
   - File: `app/src/features/player/index.tsx` (+ store strings).

## Phase M — media/playback follow-ups (depends on the media-proxy RE landing)

- **libmpv for MKV/HEVC/x265/DTS.** Chromium `<video>` only decodes H.264/AAC MP4. Implement an `MpvPlaybackSource` behind the existing `PlaybackSource` seam (`app/src/features/player/lib/playback.ts`) for the rest. The core `/stream` proxy is codec-agnostic, so the same stream URL feeds mpv.
- **Real download engine.** Wire the downloads feature to a real multi-chunk downloader through the core (reuse the media-fetch + Range), replacing the mock queue/ticker. Groups/schedule already modeled in the UI.
- **External copy-link.** The `playUrl` spike URL only works against the native proxy; for desktop, expose the core's `/stream` URL (local, works with mpv/VLC pointed at 127.0.0.1) as the "copy link" target instead.
- **Watch sync / resume.** Real continue-watching progress from `useWatches` (currently mock), and watch-outbox on play.
- **Initial Like state.** No API to read current like state → title like toggle currently starts "not liked" each visit; wire real state when available.

## Phase R — packaging/distribution polish
- `make install` AppImage + `.desktop` tested end to end; icon set; auto-update (electron-updater) when wanted.
- Remove the old SvelteKit `src/` + Tauri `src-tauri/` (superseded by `app/`).
