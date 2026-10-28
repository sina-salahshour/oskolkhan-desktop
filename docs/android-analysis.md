# OskolKhan Android 2.0.44 (versionCode 79): analysis for the desktop client

Source: jadx decompile of `apk/OskolKhan-2.0.44.apk` (kept outside the repo, in the session scratchpad).
Obfuscated with R8: app logic lives in `sources/p000/*`, models in `sources/PModel/*` (Wire protobuf).

## 1. Architecture (the important part)

```
UI (Java/Kotlin) --HTTP--> 127.0.0.1:<port>  (local proxy inside native libexo.so) --TLS/DoH/pinning--> real backend
   header x-oskol-pt: <per-process random 24-byte hex>
```

- The Java side never talks to the backend directly. Retrofit uses base URL `http://127.0.0.1:<port>/`.
  The port comes from `Interfaces.init()` (default 8080).
- `libexo.so` (13 MB: BoringSSL, curl/Beast, nghttp2, quiche, DoH, brotli, zstd, anti-Frida) does the following:
  routing, TLS and pinning, the outgoing UA and headers, auth context, stream handling ("DRM" proxy), thumbnails, and chunked downloads.
- JNI surface: `com.oskolkhan.app.services.Interfaces`. Entry points:
  - `init`, `setPath`
  - `postInit(userId, contentType, plan, 79)`
  - `setProxyToken`, `setVIP`, `setVIPlevel`, `setHash`, `setTimeStamp`
  - `initenv`, `initns`, `initZero(hosts[], pins[])`, `initStack`, `processItemGroup`
  - `spike(t1, t2)`, `noteIssuedHost`, `SuperLoader(Bytes)`
  - `startNativeStream`, `readNativeStream`, `getDrmIdleMs`, `getDrmOpenStreams`
- **Not recoverable from Java:** the native headers and User-Agent sent to the backend, request signing, the `spike` token format, the `SuperLoaderBytes` decryption, and stream decryption.
- Native strings seen: `User-Agent: %s`, `Accept-Encoding: deflate, gzip, br, zstd`, `Authorization`, `referer`, `x-forwarded-for`, `PalangOskol`, `free.shecan.ir`, `cloudflare-dns.com`.
- The UA template is probably `PreLoad.Envs` → `initenv`. Java replaces `$osVersion` and `$deviceName` in it.

## 2. Route bootstrap ("kickstart")

Sources are tried at splash (`p000/nl7.java:17`):
- `https://raw.githubusercontent.com/HansXmp/kickstarter/main/README.md`
- `https://github.com/HansXmp/kickstarter/blob/main/README.md?plain=1`
  - UA `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0`
  - payload is in the `react-app.embeddedData` script tag
- `https://admin.blogfa.com` with `Host: minax.blogfa.com` and a Chrome 120 UA
  - payload is the `<meta google-site-verification content>` value
- `https://www.aparat.com/api/fa/v1/user/user/about/username/u_15041158`
  - payload is in `meta.data.description`
- DNS TXT records, queried at specific resolvers:
  - `tasnimnews.com@216.218.132.2`
  - `tabnak.com@216.218.131.2`
  - `5.gamezula.co.uk@178.22.122.100`
  - `5.gamezula.sbs` (system resolver)
  - `filimo.com@216.218.131.2`
  - `mysharebarekat.cf@216.218.130.2`
  - `gdfsjcjlifzpk4ypvupbwnf3sb.cf@216.218.132.2`
  - `gdfsjcjiifzpk4ypvupbwnf3sb.cf@216.218.131.2`
  - `sharingbox.ml@216.218.130.2`
  - `marzfundata.ml@216.218.131.2`
- FCM topic `okx1`: chunked data messages (keys `i d k c t f a h v x e`; gzip/brotli; at most 1 MiB).
- Manual import of a `.osbin`, `.bin` or `.okx` file (mime `application/x-osbin`). This file may be wrapped by native `SuperLoaderBytes`.
- The bootstrap HTTP client uses DoH `https://cloudflare-dns.com/dns-query`, bootstrap IPs 1.1.1.1, 8.8.8.8 and 178.22.122.100.

Decoding the payload (`p000/su9.java:78-98`):
1. Strip spaces and `/`, then base64 decode.
2. Brotli decompress.
3. Parse protobuf `hellix{repeated hellx items=1}`, where `hellx{bytes hell=1; packed int32 x=2}`.
4. The bytes of `hell` at the indices in `x` are the key. Remove them, then XOR the rest cyclically with that key.
5. Parse the result as protobuf `hell{string h=1; bool v=2; bytes e=3 (IPv4); bool iss=4; bool isp=5; string ish=6; int32 z=7; int32 p=8}`.

Each entry becomes a native `Item(ep=e, iSS=iss, isp=isp, epv=v, …)` with `initZero([h, ish], [])`, so there is no pinning at bootstrap. The app then does `GET /Ca8d5/Test/Hi`, which must return `true`.

Live decode on 2026-10-28 gave 7 entries (host → connect IP):
- edge05.556512.ir.cdn.ir → 193.151.157.135
- gworker.sbs → 185.143.233.235
- www.bultanews.com → 172.67.135.195
- api.upera.tv → 185.187.101.223
- b1.0cd.ir → 5.160.47.202
- 7jp.ir → 185.187.101.124

Next comes `GET /Ca8d5/init/Peak/{MMddHH}X`, which returns `interfacess`:
- `key`=1: a single-byte XOR key.
- `items`=2: interfaces of `interfacex`.
- `HsN`=3: host names, XOR-encoded.
- `Stack`=4.
- `Cpis`=5: pins, XOR-encoded and then base64-encoded.
- `hash`=10, `TimeStamp`=11, `interupt`=12 (the refresh interval).

`interfacex` fields:
- 1 `id`
- 2 `Endpoint` (raw IP bytes)
- 3 `v4`
- 4 `HostName` (an index into HsN)
- 5 `cp`, 6 `r`, 7 `p`, 8 `m`, 9 `u`: XOR-encoded strings
- 10 `cpi` (an index into Cpis)
- 11 `stk`, 12 `fr`, 13 `isC`, 14 `H`, 15 `dp`, 16 `iSS`, 17 `isp`

The table is cached in ObjectBox `BinKeyValue` id 4.

## 3. Endpoints (paths as seen by the local proxy)

Requests are form-urlencoded. Responses are Wire protobuf (`PModel.*`) unless noted.

| Method | Path | Params → Response |
|---|---|---|
| GET | /Ca8d5/Test/Hi | → "true" |
| GET | /Ca8d5/init/PreLoad | → PreLoad |
| GET | /Ca8d5/init/Peak/{MMddHH}X | → interfacess |
| POST | /Ca8d5/init/eauth | UserName, Password, DeviceId, DeviceName, Model, AndroidVersion, FCM → OAuth |
| POST | /Ca8d5/init/gauth | Token (Google ID token), DeviceId, DeviceName, Model, AndroidVersion, FCM → OAuth |
| POST | /Ca8d5/init/GCredentialAuth | same as gauth → OAuth |
| POST | /Ca8d5/init/tauth | DeviceId, DeviceName, Model, AndroidVersion, FCM → OAuth (poll every 5 s after opening `BotUrl?start=register-<DeviceId>`) |
| POST | /Ca8d5/init/GSTAuth | _plh=834729 → OAuth (guest login, if `PreLoad.EnableGuestLogin`) |
| POST | /Ca8d5/init/Auth | id, carry, DeviceId → OAuth (session revalidation at start) |
| POST | /Ca8d5/init/logout | DeviceId → string |
| POST | /Ca8d5/init/setBirth | value, carry, id → OAuth |
| POST | /Ca8d5/init/SetContentTypes | id, carry, value → OAuth |
| POST | /Ca8d5/init/GetContentTypes | id, carry → Ctype |
| GET | /Ca8d5/data/home/{page} | → Home |
| POST | /Ca8d5/data/getmore/{endpoint}/{page} | _plh → GetMore |
| GET | /Ca8d5/data/item/{id} | → GenericTitle |
| GET | /Ca8d5/data/itemdetail/{id} | → ItemDetail |
| GET | /Ca8d5/data/faq | → Faq |
| POST | /Ca8d5/operator/Search | Phrase, Type, IgnoreTypes, Page → ISearch |
| POST | /Ca8d5/operator/like | category, item, on, status |
| POST | /Ca8d5/operator/watch | fid, tid, length, last, on |
| POST | /Ca8d5/operator/SyncStuff | multipart file → SyncStuff |
| POST | /Ca8d5/operator/SyncStatistics | _plh → CheckSum |
| GET | /Ca8d5/r/{I}[/{S}/{E}]?C= | → SubTitleParent |
| GET | /Ca8d5/srt/{Path} | → SRT text |
| GET | /{LSI}/trailer/{urn} | → trailer URL |
| GET | /Ca8d5/UserStuff/GetFilesV2/{id} (also V1) | → TitleFilesV2 |
| POST | /Ca8d5/UserStuff/GetWatches/{page}, GetLikes/{page} | type → GetMore |
| POST | /Ca8d5/UserStuff/RemoveWatch | tid |
| GET | /Ca8d5/UserStuff/adProfile, GetBirth, GetContentType | |
| POST | /Ca8d5/UserStuff/Syncad | a..h (ad revenue, Android only) |

Images are at `<proxy>/Ca8dA/images300<img>.jpg`, `/images800<img>_bg.jpg`, `/images1500/<img>_bg.jpg` and `/images{100,300}/{names,titles}/<x>.jpg`.

Streams use `<proxy>/<FileV2.urn>` through native `NativePipeDataSource`. Thumbnail sprites use `<proxy>/<FileV2.vurn>` (VTT plus sprite).

Downloads use `http://127.0.0.1/<path>` with native chunking (1-8 chunks), `.part` files and HTTP Range resume.

There is no user token header from Java. The proxy holds the auth context via `postInit` and `setVIP`.

## 4. Auth and identity

- `OAuth` fields: 1 status, 2 birth, 3 contentType, 4 id, 5 plan, 6 carry (an opaque session string), 7 Name, 8 Family, 9 IsGetter, 10 IsWacher, 11 Age, 12 Vip, 13 VipLevel.
  It is stored encoded in ObjectBox `BinKeyValue` id 1.
- DeviceId is ANDROID_ID. DeviceName is Manufacturer + Model. Model is Build.MODEL. AndroidVersion is Build.VERSION.RELEASE. FCM is the FCM token or an empty string.
- Google: `default_web_client_id` = `853070906281-662g6ir7rfn38p0lddgq22idjn6tuse9.apps.googleusercontent.com`.
- Firebase:
  - project `oskolkhan-45db9`
  - api key `AIzaSyBSOY3DZVWEJ7Le2rz1TUxBYvkTyfcdNmE`
  - app id `1:853070906281:android:cd35cecdabfde67ef1fab8`
  - sender id `853070906281`
- FCM topics are `all`, `g1`..`g5` (cumulative by contentType) and `okx1`. There is no Remote Config; `PreLoad` plays that role.
- There are no payments. VIP comes from the server (`OAuth.Vip`/`VipLevel`, `adProfile`), and is earned through rewarded ads.
- Root check (RootBeer) blocks init on phones only. No Play Integrity or app-signature checks were found in Java.
- Signing cert is Play App Signing. SHA-256 `45193b155406d8918e920fc40728da871011c18405b038a6bf1b2c506ff8ea7f`, SHA-1 `3c0b190f81c27ef97e54efa0b9a1d955ab741b9a`.
- Stamp cert SHA-256 is `3257d599…bd6d`.

## 5. TLS and certs

- There is no Java-level pinning. `res/xml/network.xml` only allows cleartext to 127.0.0.1 and instantgame.ir.
- Backend pins come from `interfacess.Cpis` and are enforced in native code.
- The bundled `assets/cacert.pem` (Mozilla) and `assets/certs/Amazon*`/`SFSRootCAG2` are not used by app code. They belong to ad SDKs.

## 6. Features to carry over (no ads, no DRM for now)

- **Auth:** email/password, Google, Telegram bot, guest. Splash and bootstrap with recovery. Manual `.osbin` import.
- **Browsing:** home rows (hero carousel, continue watching), see-more lists (grid/list).
- **Filter:** the advanced filter (`AdvanceFiler`: genres, countries, sort, IMDb/Meta/RT/MDL/MAL/Dizi ranges, content warnings, year) with relaxation hints.
- **Search:** titles, people and keywords.
- **Title page:**
  - ratings
  - cast
  - recommendations
  - a file tree (`GroupInfoV2`: season, quality and dub/sub groups with 4K/HDR/DV/DTS/x265 badges)
  - like, share, and open in an external player
- **Player:**
  - resume and server watch sync
  - next-episode countdown
  - speed, including hold-to-2x
  - audio tracks and an external audio file
  - audio delay
  - seek thumbnails
- **Subtitles:**
  - sources: embedded, server finder, local SRT/VTT/ASS/SSA, and LAN upload by QR code
  - full styling: font, size, position, edge and background
  - custom fonts
  - sync by delay, fps, or multiple points
- **Downloads:**
  - download groups with folder, chunk count, auto-start and a schedule
  - queue with multi-select
  - resume
  - offline library
- **Likes and watched:** lists with multi-delete. Watched sync goes through an outbox.
- **Settings:**
  - movie and series view modes
  - buffer profiles
  - title language (Persian or original)
  - clear cache
- **Account:** VIP, coins and FAQ. A notifications substitute is still needed (FCM).
- **Design cues:** dark UI with a yellow accent (#ffff00, TV #ffd600). Fonts are IRANSans, Vazir and Estedad. The desktop UI should be a fresh, refined, desktop-first design, not a copy of the Android look.
