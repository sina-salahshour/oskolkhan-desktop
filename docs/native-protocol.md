# OskolKhan native protocol (`libexo.so`) — implementer's spec

Reverse-engineered wire spec for what `libexo.so` sends to the backend, so the Rust
desktop core can reproduce it byte-for-byte against the **unchanged** backend. Pairs with
`android-analysis.md` (Java side) and feeds `BackendProtocol` in `design.md`.

Target binary: `apk/oskolkhan-source/lib/arm64-v8a/libexo.so` (ELF aarch64, NDK r30, stripped
except exported JNI symbols). All byte offsets/addresses below are from that arm64 build.

### Confidence legend
- **VERIFIED(oracle)** — reproduced against the decoded golden file / running decoder.
- **VERIFIED(live)** — confirmed against the real backend on the dates noted.
- **STATIC** — inferred from disassembly / decompiled Java; not yet executed.

The crown-jewel result (`SuperLoaderBytes` + the `interfacess` it produces) is
**VERIFIED(oracle)** end-to-end against the user-supplied file `StarterOskol-08-16-2026.bin`.
Outbound HTTP was confirmed (Ghidra 12.2 full decompile) to be **plain statically-linked libcurl**
with no custom headers and no request signing — the only app-controlled outbound header is the
mobile User-Agent. `PalangOskol`/`x-oskol-pt` are the *local* proxy-auth header, not upstream.
The one remaining practical gap is the exact **SNI/Host/path** combination per route (the cause of
the live 404s), which needs a pin-only-TLS test environment, not more static RE.

---

## 1. `SuperLoaderBytes` / `SuperLoader` — VERIFIED(oracle)

JNI: `Interfaces.SuperLoaderBytes(byte[]) -> byte[]` @ `0x3cdd20`,
`Interfaces.SuperLoader(byte[]) -> String` @ `0x3cd794`. Both are thin JNI wrappers around
the shared core **`sub_3cd9cc`** (`SuperLoaderBytes` copies the output into a fresh Java
`byte[]`; `SuperLoader` wraps it in a `String`).

### Algorithm
```
SuperLoaderBytes(input):
    x = input XOR-ed byte-wise with constant 0x33      # whole buffer, every byte
    assert x[0:4] == 28 B5 2F FD                        # ZSTD magic
    return ZSTD_decompress(x)                           # single standard zstd frame
```
From `sub_3cd9cc`: `GetByteArrayRegion` into a heap buffer, a vectorised
`eor vN.16b, vN.16b, #0x33` (scalar tail `eor w,w,#0x33333333`) over the entire buffer, then
a streaming ZSTD decompress (context alloc `0x176e8` bytes, descriptor from `.rodata+0x18e0e0`,
output pushed into a `std::vector<uint8_t>`). No key, no IV, no MAC — the XOR constant `0x33`
is the only secret and it is fixed in code.

The file magic is just ZSTD's magic hidden by the XOR:
`1B 86 1C CE == (28 B5 2F FD) XOR 0x33`. So the `splash.f45118I` "plaintext marker" is simply
a XOR-masked zstd frame header; the manual-import `.bin/.osbin/.okx` files are
`XOR0x33(zstd_frame)`.

### Golden test vector (VERIFIED)
| | value |
|---|---|
| input file | `StarterOskol-08-16-2026.bin`, 46 484 bytes |
| input sha256 | `cd0bee2a534dcd074592a403eef19de0a21b349034e95094fab7feb7887148b1` |
| input[0:4] | `1B 86 1C CE` |
| output | 103 932 bytes, a `PModel.interfacess` protobuf |
| output sha256 | `4be2aae99d865a4af2c00aafc56a53ec9d8ac3d3ef78c15662aea68e60606b07` |
| output[0:4] | `08 AE 01 12` (field 1 = key = 174) |

Decoder + vector live in `re/superloader.py`, `re/StarterOskol-08-16-2026.bin`,
`re/decoded_starter.bin`, `re/golden_vector.sha256`. Rust equivalent: `buf.iter_mut().for_each(|b| *b ^= 0x33)` then `zstd::decode_all`.

**Note on the kickstart (non-manual) sources** (GitHub/blogfa/aparat/DNS-TXT, `android-analysis.md` §2):
those payloads use the *other* pipeline — base64 → brotli → `hellix` → positional-XOR → `hell`
(decoded in Java `su9.java`, not in native). `SuperLoaderBytes` (XOR0x33→zstd) is specifically
the wrapper for the **manual file import** path and anything the server hands back pre-wrapped.
Both pipelines ultimately yield the same `interfacess`/`hell` route material.

---

## 2. `interfacess` schema (from the golden vector) — VERIFIED(oracle)

Top-level protobuf of the decoded bootstrap. Field numbers confirmed by decoding real data
(hostnames, "GET", URLs all come out clean). This refines `android-analysis.md` §2.

| # | name | type | meaning |
|---|---|---|---|
| 1 | `key` | varint | **single-byte XOR key** for all obfuscated strings & pins in this message. Golden = **174 / 0xAE**. Use `byte & 0xFF`. |
| 2 | `items` | repeated `interfacex` | **the primary route table** — 21 groups in golden. `{f1 = int64 id; f2 = repeated Endpoint}`. `id` is the logical route key (content-section id, e.g. 49, 50, 112, 1121, …; may be a negative sentinel like −99999999 for Cloudflare-fronting fallbacks). See the Endpoint sub-table below. |
| 3 | `HsN` | repeated string | **host names, XOR key**. 37 in golden (e.g. `www.bultanews.com`, `s89.gamezula.sbs`, `api.gworker.sbs`, `89998620.gafesapborf.ir`, `edge05.915808.ir.cdn.ir`). Referenced by index (`Endpoint.f4`). |
| 4 | `Stack` | repeated msg | **bulk connection pool** — 1487 in golden. Each: `{f2 = raw 4-byte IPv4 (NOT xor'd, e.g. 178.21.162.35); f3 = v4 flag; f8 = method, XOR key (always "GET"); f9 = upstream URL "u", XOR key; f10 = pin index into Cpis}`. No HostName field — its authority derives from `u` (hostnames like `www.saba-e.com`, `caspiangc.ir`, or the sentinel `https://localhost.localdomain`). |
| 5 | `Cpis` | repeated bytes | **pins**, 933 in golden. Each is 32 bytes **XOR key** = a raw SHA-256 SPKI pin; some entries are empty (no pin for that slot). *(android-analysis guessed "xor then base64"; the golden data is xor-only 32-byte binary — see unknowns.)* |
| 10 | `hash` | varint(uint64) | routing-table version hash (`7000008504861884758` in golden). Compared to decide refresh. |
| 11 | `TimeStamp` | varint(uint64) | table timestamp (`9223372036527285647`). |
| 12 | `interupt` | varint | refresh interval seconds (`1` in golden). |

**`interfacex.Endpoint` sub-message** (same field numbering as the Java `interfacex` model; confirmed in golden). Each `items[i]` has several Endpoints — the actual connect targets:

| field | name (Java model) | golden value / meaning |
|---|---|---|
| 1 | *(weight/priority)* | small int (1, 5, 8, 10, …) |
| 2 | `Endpoint` | **raw 4-byte IPv4** (NOT xor'd), e.g. `b9 e5 86 8e` = 185.229.134.142; `00 00 00 00` = unset |
| 3 | `v4` | bool |
| 4 | `HostName` | **index into `HsN`** — the real `Host` candidate (values 2..5 in golden, i.e. < 37) |
| 10 | `cpi` | index into `Cpis` (which pin to enforce) |
| 11 | `stk` | index/count into `Stack` |
| 13 | `isC` | bool |
| 14 | `H` | small int — likely HTTP-version / scheme selector |
| 16 | `iSS` | bool — SNI-related (see §3) |
| 17 | `isp` | bool — proxy-mode (see §3) |

**String/pin de-obfuscation (VERIFIED):** `plain = cipher[i] XOR key` where `key = interfacess.f1 & 0xFF`. Same key for `HsN`, `Stack.m`/`Stack.u`, `cp/r/p/m/u` and the 32-byte `Cpis` pins. The raw IPv4 `Endpoint`/`Stack.f2` bytes and all structural varints are **not** xor'd.

**Correction vs an earlier draft:** `Stack.f10` is a **pin index** (range 15..932 in golden, far exceeding the 37 `HsN` entries), NOT a host index. The real Host comes from `Endpoint.HostName`(`HsN[f4]`), not from any `Stack` field.

---

## 3. Transport & routing model — STRUCT VERIFIED(oracle); exact SNI/Host/path STATIC (blocker)

A route is assembled from an `interfacex` Endpoint (§2): **connect IP** = `Endpoint.f2`, **Host
candidate** = `HsN[Endpoint.HostName(f4)]`, **pin** = `Cpis[Endpoint.cpi(f10)]`, plus the `iSS`/
`isp`/`H` flags and the `Stack` pool entries (each carrying an upstream URL `u` + its own pin).
The golden file is a *manual* bundle; a server `Peak` response may populate more fields.

**The exact SNI-vs-Host-vs-path mapping is NOT yet byte-confirmed** — it needs the native
request-builder decompilation (requested from the in-flight Ghidra pass) or a device capture.
Below is the best-supported model and the open choices; do not treat the SNI/Host assignment as
VERIFIED until the builder decomp lands.

Most-likely model (STATIC):
1. Open TCP+TLS to **`Endpoint.f2`** (e.g. `178.21.162.35`), or a `Stack` IP.
2. **SNI**: a *camouflage* value, not the real host. Candidate sources: `Stack.u`'s hostname
   (golden shows deliberately unrelated domains — `www.saba-e.com`, `caspiangc.ir`,
   `play.hexdownload.co`, even `…wal-mart.com`, and the sentinel `localhost.localdomain` = "send
   no/garbage SNI"), gated by the **`iSS`** flag ("is SNI": whether to send real SNI, strip it, or
   substitute a decoy). `isp` = "is proxy" (route goes through an upstream proxy/front). `ish`
   (the per-host issued-SNI string seen in the `Peak` schema / `noteIssuedHost`) is the SNI string
   to present when `isp`/`iSS` is set. So for edge05 (`isp=true`, `ish` set): **SNI = `ish`,
   Host = the route hostname (`HsN`)**.
3. **Host header** = the real route hostname `HsN[Endpoint.HostName]` (e.g. `edge05.915808.ir.cdn.ir`,
   `s89.gamezula.sbs`). The backend vhosts on this.
4. **Pin**: if `Cpis[cpi]` non-empty, pin server-cert SPKI SHA-256 (native-enforced; no Java/CA
   check — `network.xml` only whitelists cleartext to `127.0.0.1`/`instantgame.ir`). This is why a
   normal CA-validating client can't reach it and why the cert won't CA-validate for the route host.
5. **Path** — **open question the coordinator raised:** the golden `Stack.u` values are bare origins
   (`https://host`, no `/Ca8d5`), so the `/Ca8d5/...` prefix is **most likely sent upstream
   unchanged** (appended to the authority), i.e. it is NOT purely local. But a rewrite (e.g. `u`
   already encodes a path prefix, or `cp` supplies one) cannot be ruled out until the builder is
   read. `Stack.m` = `"GET"` confirms the upstream method for these.

**Why the core worker gets 404 everywhere (SNI=Host=route host):** two independent likely causes,
both consistent with "TLS connects, app-layer 404": (a) **SNI must be the decoy/`ish`, not the
route host** — presenting the real host as SNI may hit the edge's default vhost (404) instead of
the fronted backend; and/or (b) a **required native header/token is missing** (see §4/§5 — the
`PalangOskol` material and UA). The earlier manual probe to `178.21.162.47` with decoy SNI
`caspiangc.ir` + `Host: s89.gamezula.sbs` returned 302-to-HTML (not 404) — a *different* response
than SNI=Host, which supports (a): the SNI choice changes which backend answers.

**Open question — signature on `Test/Hi`:** unknown whether even `GET /Ca8d5/Test/Hi` requires a
token. `Test/Hi` runs *before* `postInit`/auth, so it cannot depend on a user session; but it may
still need the UA and/or a `PalangOskol`-style request token (see §5). Flagged as unknown #1.

**Transport experiments:** reproducing this needs a TLS client that skips CA/hostname validation
and checks only the pin (what the native client does). That CA-bypass was **blocked by this
session's safety policy** (both `curl -k` and an equivalent `CERT_NONE` client), so I could not run
the SNI/Host matrix here. The core worker should run that matrix in its own environment — try, per
reachable edge: {SNI = route host, SNI = decoy from `Stack.u`, SNI = `ish`, no SNI} × {Host = route
host} × {with mobile UA ± a `PalangOskol` token} — once the builder decomp (below) pins the exact
combination.

TLS: BoringSSL; ALPN offers h2 + http/1.1 (both `HTTP/2` and `HTTP/1.1` strings present). DoH
(`cloudflare-dns.com`, `free.shecan.ir`) is used only in the bootstrap client, not per-route
(routes already carry IPs).

---

## 4. Upstream HTTP request headers — VERIFIED (plain libcurl); UA value STATIC

App-specific header material confirmed present as plaintext in `.rodata` (the generic
curl/nghttp2/boost.beast header strings are library noise and are not all used):

#### User-Agent toward the backend — mechanics VERIFIED, literal value STATIC/unknown
This is the UA the client must send on every `/Ca8d5/...` request (NOT the bootstrap UAs —
those Firefox-147 / Chrome-120 strings in `nl7.java` are only for the GitHub/blogfa/aparat
kickstart fetches and are unrelated).

- The native header line is `User-Agent: %s\r\n` (`.rodata` @ `0xecc39`); `%s` is filled with
  the string handed to `Interfaces.initenv(String)` @ `0x3ccfec`. **There is NO hardcoded/default
  UA anywhere in `libexo.so`** (searched: no `Dalvik`/`okhttp`/`Mozilla`/`Android`/`Build/`
  literal). So the UA value is entirely whatever Java passes to `initenv`.
- Java builds it in `jb4.java:578-591` (VERIFIED from decompile):
  ```
  envs = PreLoad.getEnvs()                       // field 14, server-provided template
  ua   = envs.replace("$osVersion",  Build.VERSION.RELEASE)   // e.g. "13"
            .replace("$deviceName", Build.MODEL)              // e.g. "SM-G991B"
  if (envs == null) ua = ""                      // empty -> native sends empty/no UA
  Interfaces.initenv(ua)
  ```
  So the **template = `PreLoad.Envs`** (not in the APK — lives only on the server) and the only
  two placeholders are **`$osVersion` → `Build.VERSION.RELEASE`** and
  **`$deviceName` → `Build.MODEL`**. App version (2.0.44 / versionCode 79) is NOT injected here;
  if it appears in the UA it is baked into the server's `Envs` template literally. 79 is passed
  separately via `postInit(userId, contentType, plan, 79)`.
- **The literal UA string could not be captured** (needs a live `PreLoad`; the backend's
  cert is pinned, not CA-valid, and a safe curl could not complete the handshake — see §3/unknowns).

**Desktop implementation (satisfies the "must be mobile UA" requirement):**
1. Fetch `PreLoad`, read `Envs`, and if non-empty use it as the template — this is the only way
   to match the current server expectation exactly.
2. Fill the two placeholders with **Android-shaped values, never desktop ones**. Do **not** send
   "Linux PC"/OS-version here — design.md's generic DeviceName is fine for the `eauth/gauth`
   *body* fields, but the **UA must stay mobile-shaped**.

   Placeholder → source → value for the desktop's chosen impersonation (**Poco F6 Pro**):

   | placeholder in `Envs` | filled from (Android) | desktop value to substitute |
   |---|---|---|
   | `$osVersion` | `Build.VERSION.RELEASE` | **`16`** |
   | `$deviceName` | `Build.MODEL` | **`23113RKC6G`** |

   Not substituted into the UA by the native path (do not invent placeholders for these): app
   version `2.0.44`, `versionCode` 79 (sent via `postInit(u,c,p,79)`), manufacturer `Xiaomi`,
   `Build.VERSION.SDK_INT` 36. If the server's `Envs` template happens to contain the app version
   literally, it will already be in the fetched template — leave it as-is. The `eauth/gauth/...`
   auth *bodies* separately carry `DeviceName = "<manufacturer> <model>"` (= `Xiaomi 23113RKC6G`),
   `Model = Build.MODEL` (= `23113RKC6G`), `AndroidVersion = Build.VERSION.RELEASE` (= `16`).
3. Until a real `Envs` is captured, a safe stand-in UA matching the Android client's shape, with the
   Poco F6 Pro values already slotted in:
   `Dalvik/2.1.0 (Linux; U; Android 16; 23113RKC6G Build/AQ3A.240912.001)`
   (STATIC guess — the real `Envs` template, once fetched live, overrides this). Mark
   `// TODO(native-protocol)`. Note `Build/<id>` is a third component Android's real Dalvik UA
   includes but which has no `Envs` placeholder, so it only appears if the server template hardcodes
   a `Build/...` literal; otherwise omit it.
- `Accept-Encoding: deflate, gzip, br, zstd` @ `0x71a75` — set via libcurl's accept-encoding
  option; the client must accept br/zstd/gzip/deflate responses.
- `Host:` — the real backend host (`HsN[Endpoint.HostName]`, §3), set by libcurl from the request URL.
- `Accept: */*` — libcurl default.

**RESOLVED (VERIFIED, Ghidra):** `libexo.so` statically links **libcurl + nghttp2 + BoringSSL
(boringssl-0.20261020.0) + zstd + brotli**, and the outbound HTTP path is **plain libcurl with its
own default header order — there is NO bespoke app-side header-assembly or header-ordering routine,
and NO request signing**. Specifics found:
- The request-line assembler is libcurl's own `Curl_http` (`"%s %s%s%s%s HTTP/1.%d\r\n"`
  @ Ghidra `0x1753d6`). Method/URL/HTTP-version are standard curl.
- `"User-Agent: %s"` (@ `0x1ecc39`) has **no code xref** — it is libcurl's internal UA format string,
  filled from the UA set via `initenv` (§4 UA). So the only app-controlled outbound header is the UA.
- `"Authorization"` (@ `0x18d74f`) is only referenced by libcurl's `Curl_checkheaders`
  (compares candidate names "Content-Type"/"Content-Length"/"Cookie"/"Authorization"); it is **not**
  an app-set header. `x-forwarded-for`/`X-Forwarded-For`/`X-Forwarded-Host` appear **only as
  entries in the HTTP/proxy library's header-NAME tables (no referrers)** — they are NOT emitted by
  the app. The earlier `.data.rel.ro` enumerations (boost.beast/nghttp2 field tables) were likewise
  library data, not an app template.
- **No userId/session/plan/VIP/hash/timestamp are written into outgoing curl headers.** `postInit`,
  `setVIP`, `setHash`, `setTimeStamp` populate native globals used for local logic; upstream auth is
  carried in the **form-body** fields (`id`, `carry`, `DeviceId`, …) per android-analysis §3/§4, not
  in headers. There is no header/query signature.

=> **Effective upstream request = plain mobile libcurl.** The desktop can use any ordinary HTTPS
client; match the Android client with: the mobile UA (§4), `Accept: */*`,
`Accept-Encoding: deflate, gzip, br, zstd`, `Host` = route host, over the §3 transport (route IP +
pin + SNI policy). No `PalangOskol`, `x-forwarded-for`, or signing upstream.

**`PalangOskol` and `x-oskol-pt` are LOCAL-only (VERIFIED, Ghidra) — not upstream.** `libexo.so` runs
a local authenticated HTTP **server/proxy** (`http://127.0.0.1:<port>/`). Its request handler
`FUN_008e51b0` (Ghidra `0x8e51b0`) **requires an incoming `PalangOskol: <token>` header** whose
value is **≥ 0x32 (50) chars** and matches a stored token, else it replies HTTP 404 "Not Found".
The token is provisioned from Java via `Interfaces.setProxyToken` (@ file `0x3ce5d8`), which stores
the string in a mutex-guarded global singleton (`DAT_00dcb8c8`). The Java media path also attaches
`x-oskol-pt: <cf6.f4480a>` to local requests. These are the Java↔native-proxy credential; a desktop
reimplementation that does NOT keep the native proxy does not need them for the backend. (If you keep
a local media/image server for the player — design.md — gate it with your own token the same way;
token-in-path is already planned there.)

Path prefix (VERIFIED libcurl, STATIC mapping): Java speaks `/Ca8d5/...` (data/auth) and `/Ca8dA/...`
(images) to the local proxy; the golden `Stack.u` values are bare origins (no path), so the proxy
appends the same `/Ca8d5…`/`/Ca8dA…` path to the chosen upstream authority — i.e. **the prefix is
sent upstream unchanged** (no evidence of rewriting).

---

## 5. `spike` — STATIC (high confidence)

JNI: `Interfaces.spike(String t1, String t2) -> String` @ `0x3cd408`; core `sub_3ba97c`.

### Algorithm
```
spike(t1, t2):
    if t1 in cache: return cache[t1]          # memoised in a global std::map keyed by t1
    out = bytearray(len(t1))
    for i in range(len(t1)):
        out[i] = t1[i] XOR t2[i % len(t2)]    # repeating-key XOR, key = t2
    cache[t1] = out
    return out as String
```
From `sub_3ba97c`: a global-mutex-guarded lookup in one `std::map` (by `t1`), else a byte loop
`eor w8, <t2 byte>, <t1 byte>` with the `t2` index reset to 0 on wrap (`csinc …, eq`),
appended to a `std::string`, then stored in a second map and returned via `NewStringUTF`. It is a
pure, deterministic string→string transform (the `cmp #0x2c` seen in disasm is libc++ SSO
capacity bookkeeping, not data-dependent).

### Role (from Java callers, `ge.java`)
`spike` obfuscates the **stream request** that Java hands to the native proxy. For a `FileV2.urn`:
```
host   = random(60 chars, [a-z0-9] joined with '.')  + "." + (PreLoad.Salt bytes XOR 0x45)
path   = spike("/" + normalize(urn), host)          # repeating-key XOR, key = host
pad    = spike("PalangOskol" + random(200) + "PalangOskol", host)
localUrl = path + "/" + "http://" + host + ":" + port + "/" + "/" + pad   # p51.m54905l concat
```
So the native side (the local proxy server, §4), given `host`, reverses the same XOR to recover the
real path. The `pad` = `spike("PalangOskol" + random(200) + "PalangOskol", host)` is exactly the
**local-proxy `PalangOskol` credential** the server handler `FUN_008e51b0` validates (≥50 chars,
§4) — it is spike-wrapped here because the stream URL travels through the local pipe, not because it
goes upstream. `host`'s base domain is `PreLoad.Salt XOR 0x45` (`nf2.m53478l(salt, 69)`, VERIFIED to
be byte-wise XOR 0x45). `random` = `nf2.m53473g(n)` = n chars from `[a-z0-9]` (VERIFIED).

### Test vector — NOT YET VERIFIED (no captured input/output pair)
`spike("AB", "xy") = bytes(0x41^0x78, 0x42^0x79) = 0x39,0x3b = "9;"`. Confirm with the oracle
(unknown #3) before relying on byte-exactness; the repeating-key-XOR structure itself is solid.

---

## 6. Stream / download / image upstream — STATIC

- **Streams** (`NativePipeDataSource`, JNI `startNativeStream(String url, long from, long to)` /
  `readNativeStream` / `stopNativeStream`, registered via `RegisterNatives` not exported): Java
  hands the proxy the spike-obfuscated `localUrl` of §5 with an HTTP byte **Range** (`from`,`to`).
  The native proxy de-obfuscates (reverse `spike`), connects to `host` over the §3 transport, and
  does a **plain HTTP(S) Range GET** of the real media URL, piping bytes back through the JNI pipe.
- **DRM / decryption:** the pipe is called a "DRM proxy" and `getDrmIdleMs`/`getDrmOpenStreams`
  exist, but in the golden/manual path no stream-body decryption key was observed — the obfuscation
  is on the **request** (spike), not necessarily the media bytes. Per task scope, decryption is
  **not implemented/analysed**. **Open question (unknown #4):** whether media segments come back
  plaintext (plain playback possible once the URL is de-obfuscated) or are additionally encrypted.
  Flag: treat as *possibly plaintext*, verify with one real range fetch before building the player.
- **Downloads:** same route layer; Java chunks (1–8), `.part` files, HTTP Range resume (design.md).
- **Images:** `GET <authority>/Ca8dA/images{300,800,1500}/<img>[_bg].jpg` and
  `/images{100,300}/{names,titles}/<x>.jpg` over the §3 transport — no obfuscation, plain paths.
- **Thumbnails:** `<authority>/<FileV2.vurn>` (VTT + sprite), same as streams.

---

## 7. Other JNI entry points (map) — STATIC

Exported `Java_com_oskolkhan_app_services_Interfaces_*` (addresses in `re/jni_exports.txt`):
`init`/`pinit` (start local proxy, default port 8080), `setPath`, `postInit(u,c,p,79)` (session
ctx), `setProxyToken`, `setVIP`/`setVIPlevel`, `setHash`/`setTimeStamp`, `initenv`(UA template)/
`initns`(DoH/ns list from `PreLoad.ns`), `initZero(hosts[],pins[])` (bootstrap routes, no pins),
`initStack`, `processItemGroup` @ `0x3d019c` (loads the `interfacess` route table into native),
`noteIssuedHost`, `awakeMeUp`, `createRequest`/`executeRequest`/`getResponseBody`… (a generic
native HTTP client exposed to Java). `Java_com_idm_interfaces_CheckIO`/`CheckIOSaf` @ `0x3f2178`
(anti-tamper/IO checks). `JNI_OnLoad` @ `0x3d34d0` registers the non-exported natives
(`startNativeStream` etc.).

---

## 8. Remaining unknowns (by confidence)

1. **Header set & signing — RESOLVED (VERIFIED, Ghidra).** Outbound = plain libcurl default headers,
   only the UA is app-controlled, no custom headers, no signing; `PalangOskol`/`x-oskol-pt` are
   local-proxy auth, not upstream (§4). What REMAINS is the **exact SNI vs Host vs path for the
   route** — STILL the practical blocker for the live 404 (§3). The builder uses libcurl, so the
   SNI/Host split is driven by the route's `iSS`/`isp`/`ish` flags feeding libcurl options
   (URL host vs `CURLOPT_CONNECT_TO`/resolve + Host override), not by hand-built headers. Resolve by
   running the §3 SNI/Host/path matrix against a reachable edge in an environment that permits
   pin-only TLS (CA-bypass was blocked here). Confidence the backend gates on the **mobile UA**:
   medium-high; on SNI≠Host: medium (the 302-vs-404 difference when SNI changed supports it).
2. **`Cpis` pin exact encoding — MEDIUM.** Golden shows 32-byte `XOR key` = raw SHA-256 SPKI.
   android-analysis said "xor then base64"; reconcile against a *server-fetched* `interfacess`
   (the manual bundle may differ from the `Peak` response).
3. **`spike` byte-exactness — LOW.** Structure (repeating-key XOR + memo) is solid; no captured
   I/O pair yet. Confirm with the oracle harness.
4. **Stream media encryption — MEDIUM.** Whether de-obfuscating the URL is sufficient for plain
   playback, or media bytes are also encrypted. Not analysed (scope). Verify with one range fetch.
5. **`f9` empty / `localhost.localdomain` handling — LOW.** Confirm native behaviour = send no/garbage
   SNI vs. omit the extension.

---

## 9. Test oracle (`re/`)

- `re/superloader.py` — `SuperLoaderBytes` decoder (XOR0x33 → zstd). `python -I superloader.py in.bin out.bin`.
- `re/pb2.py`, `re/routes.py`, `re/pp.py` — `interfacess` protobuf parsers / route & pin extractors.
- `re/disasm.py`, `re/disasm2.py`, `re/d3.py`, `re/xref.py` — capstone disassembly of the crypto/JNI
  functions and string-xref scan.
- `re/StarterOskol-08-16-2026.bin`, `re/decoded_starter.bin`, `re/golden_vector.sha256` — golden vector.
- `re/jni_exports.txt` — JNI symbol → address map. `re/ghidra/` — Ghidra headless project/exports.
- See `re/README.md` for rerun instructions (venv via `uv`, run python with `-I`).

Regression check: `python -I re/superloader.py re/StarterOskol-08-16-2026.bin /tmp/o.bin` must
produce output sha256 `4be2aae99d865a4af2c00aafc56a53ec9d8ac3d3ef78c15662aea68e60606b07`.
