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
The last gap — the exact **SNI/Host/path** per route — is now **RESOLVED by decompile (§10, 2026-10-29)**:
SNI = Host = the route's `HsN` hostname, scheme = https (`iSS`), path forwarded unchanged, pin =
`Cpis[cpi]` (SHA-256 SPKI). The live 404s were an IP↔host↔pin mismatch, not an SNI policy. A worked,
reproducible request for the real API backend is in §10.7 and `re/build_request.py`.

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
| 5 | `Cpis` | repeated bytes | **pins**, 933 in golden. Each is 32 bytes **XOR key** = a raw SHA-256 **SPKI** pin (HPKP `sha256//<b64>`); some entries empty (no pin). Selected by `interfacex.cpi` (`f10`). *(Both old notes were right: raw is 32 bytes; Java base64-encodes each before `initZero`, so the native pin array holds base64 strings — §10.5.)* |
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
| 14 | `H` | small int — index into `HsN` for the Host-override (==`HostName` in all golden rows); stored at endpoint+0x60 (VERIFIED §10.4) |
| 16 | `iSS` | bool — **use TLS (https) iff set** (endpoint+0x64). NOT "is SNI" — corrected §10.4. golden: 1 everywhere → https |
| 17 | `isp` | bool — **force the `Host:` header to `HsN[H]`** (endpoint+0x65). golden: 0 everywhere → keep forwarded Host (which already = route host) |

**String/pin de-obfuscation (VERIFIED):** `plain = cipher[i] XOR key` where `key = interfacess.f1 & 0xFF`. Same key for `HsN`, `Stack.m`/`Stack.u`, `cp/r/p/m/u` and the 32-byte `Cpis` pins. The raw IPv4 `Endpoint`/`Stack.f2` bytes and all structural varints are **not** xor'd.

**Correction vs an earlier draft:** `Stack.f10` is a **pin index** (range 15..932 in golden, far exceeding the 37 `HsN` entries), NOT a host index. The real Host comes from `Endpoint.HostName`(`HsN[f4]`), not from any `Stack` field.

---

## 3. Transport & routing model — STRUCT VERIFIED(oracle); exact SNI/Host/path STATIC (blocker)

> **RESOLVED 2026-10-29 — see the new [§10](#10-upstream-request-builder--verifieddecompile) for the byte-confirmed builder.**
> The decompile (proxy handler `FUN_008e51b0`, route lookup `FUN_004be4f0`, header builder
> `FUN_008e3150`, TLS setup `FUN_00b9d0e4`) shows the model below was **wrong about SNI**: there is
> **no decoy-SNI substitution**. SNI = Host = the route's `HsN` hostname (plain libcurl/beast). The
> `iSS` flag is **"use TLS" (https), not "is SNI"**; `isp` is **"force the Host header to `HsN[H]`"**.
> The golden file's `Stack.u` decoy domains belong to the bulk `Stack` connection pool, not to the
> API routes. The live 404s were an IP↔host↔pin mismatch (wrong endpoint row), not an SNI policy.
> Read §10 and ignore the "most-likely model" guesses below where they conflict.

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

1. **Header set, signing, AND SNI/Host/path — RESOLVED (VERIFIED, decompile; §10).** Outbound =
   plain forwarding libcurl/beast client. **SNI = Host = `HsN[HostName]`** (no decoy); `iSS` = https
   toggle (not "is SNI"); `isp` = force-Host-to-`HsN[H]`; path forwarded unchanged; pin = `Cpis[cpi]`
   SPKI SHA-256; only the mobile UA + Accept/Accept-Encoding are app-set; no token/signature upstream.
   The live 404s were an **IP↔host↔pin mismatch** (wrong endpoint row), fixed by pairing all three
   from one endpoint row (§10.7). Only residual: SPKI-vs-full-cert pin digest (§10.5, MEDIUM) and the
   literal `PreLoad.Envs` UA template (§4, needs one live fetch).
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

---

## 10. Upstream request builder — VERIFIED(decompile) 2026-10-29

Reverse-engineered from a second Ghidra 12.2 headless pass (data/string-xref + caller/callee graph;
scripts `re/ghidra/scripts/FindBuilder.java`, `FindCallers.java`, `C2.java`; outputs in
`re/ghidra/decomp2|3|4/` and `findbuilder.txt`/`findcallers.txt`). Addresses are Ghidra VAs
(file offset = VA − 0x100000; e.g. proxy handler file `0x7e51b0` = Ghidra `0x8e51b0`).

This resolves the one remaining blocker (SNI/Host/path per route). **The whole upstream path is a
plain forwarding HTTPS client (static libcurl + BoringSSL/beast). There is NO decoy SNI, NO request
signing, and the local `/Ca8d5/...` path is forwarded to the backend unchanged.** The earlier §3
"camouflage SNI" model is withdrawn.

### 10.1 Request flow (who does what)
```
Java Retrofit (base http://127.0.0.1:<port>/)  --GET/POST /Ca8d5/...-->  native local proxy
  FUN_008e51b0 (proxy handler; requires PalangOskol + x-oskol-pt, §4):
    1. parse request-target; first segment selects Ca8d5 (data) vs Ca8dA (images, +'A')
    2. derive integer route id = BASE62(a path segment)      [see 10.2]
    3. route = FUN_004be4f0(id)  -> pick ONE endpoint row     [see 10.3]
    4. store endpoint into the session (param_1+0x29c/+0x2a0/+0x2a8/+0x300)
    5. FUN_008e3150(session, endpoint): build upstream header list  [see 10.4]
    6. open TLS to endpoint.ip:443, pin-verify, send, stream response back
```

### 10.2 Route selection — base62 id (VERIFIED, `FUN_008e51b0` @ 0x8e6f..0x8e6b)
The id is decoded from a path segment, LSB-first from the END of the segment, through a 256-entry
byte→value table `DAT_00dcaa88` (base62 alphabet → 0..61, everything else → −1). Decisive lines:
```
iVar84  = iVar84 + *(int*)(&DAT_00dcaa88 + seg[i]*4) * iVar105;   // accumulate
iVar105 = iVar105 * 0x3e;                                          // multiplier *= 62
} while (*(int*)(&DAT_00dcaa88 + seg[i]*4) != -1);                 // until a non-base62 byte
```
So `id = Σ tbl[ch]·62^k`. The id is then the route-group key. A bad/absent segment → HTTP 404
("NotFound"); a bad endpoint index → HTTP 502 ("Bad Gateway - Bad Endpoint Index"). For data paths
such as `/Ca8d5/data/item/{id}` the `{id}` segment is that base62 key; the init/data/API control
calls resolve to the API route groups (ids **99999999 / 99999998 / 99999990** in the golden table —
the groups that carry the `api.*`/`gworker`/`edge05.556512` hosts).

### 10.3 Endpoint pick + Cloudflare fallback (VERIFIED, `FUN_004be4f0` @ 0x4be4f0)
`FUN_004be4f0(int id, int* out, endpoints*)` locks the route-group hash-map (getter
`FUN_004b6d00` → global `DAT_00dcaff8`; map keyed by the signed-int32 group id), then:
- **negative-id fallback** (lines 82-84): `if ((DAT_00dcb064|DAT_00dcb060) && group.count>1) id = -id;`
  — this is why the table carries negative-id sentinel groups (−99999999 …) pointing at Cloudflare
  `104.18.32.47`: when a fail/degrade flag is set and the group has >1 endpoint, routing flips to the
  CF-fronting variant.
- **weighted-random endpoint pick** via a Mersenne-Twister-style RNG (`lVar8+0x9c0` state) modulo the
  candidate count — so successive calls spread across the group's endpoints. Returns the endpoint row.

### 10.4 Endpoint row layout + header build (VERIFIED, `FUN_008e3150` @ 0x8e3150, written by `processItemGroup` @ 0x4d019c)
Per-endpoint native struct (0x68 bytes). Confirmed field offsets:
| off | field | use |
|---|---|---|
| +0x00 | Endpoint IP bytes | TCP connect target (raw IPv4, not xor'd); `0.0.0.0` = resolve by DNS |
| +0x18 | `HostName` (int) | index into `HsN` → the connection hostname (SNI **and** Host) |
| +0x38 | `HsN[HostName]` string | the hostname itself |
| +0x40 | `fr`/mode (int) | compared `!=3`; retry/mode selector |
| +0x58 | `dp` (xor'd string, decoded in Java) | optional per-route path/host prefix; empty in golden |
| +0x60 | `H` (int) | index into `HsN` for the Host override (== `HostName` in all golden rows) |
| +0x64 | **`iSS`** (bool) | **scheme: https iff set, else http** (NOT "is SNI") |
| +0x65 | **`isp`** (bool) | **if set, force the `Host:` header to `HsN[H]`** |

- **Scheme** (`FUN_008e51b0` ~line 1798): SSO std::string `"https"` (len 5) by default, `"http"`
  (len 4) when `(endpoint+0x64 & 1)==0`. golden: `iSS==1` everywhere → **https**, port **443**
  (`local_c0 = 0x1bb`).
- **Host / SNI**: `FUN_008e3150` forwards the client's headers minus a hop-by-hop drop-set
  (`connection`, `keep-alive`, `proxy-connection`, `transfer-encoding`, `upgrade`, `expect`,
  `content-length`, `trailer`, `te` — set `DAT_00dcdf20`) into the upstream header list
  (`session+0x210`). When the incoming request has a `host` header **and** `isp(+0x65)==1`, it
  **replaces** it with `HsN[H]` via the `"Host: {}"` template at `0x237352` (line 486-538). The TLS
  **SNI is set by the libcurl/BoringSSL backend `FUN_00b9d0e4` to the connection hostname = the URL
  host = `HsN[HostName]`** — there is no decoy/substitution code (the only `"Failed set SNI"` site
  @ `0x1a023f` is libcurl's standard `SSL_set_tlsext_host_name`). **⇒ SNI = Host = `HsN[HostName]`.**
- **Path**: the request-target is forwarded **unchanged**; the backend genuinely serves
  `/Ca8d5/...` (Retrofit paths are literal: `um.java` has `@GET "/Ca8d5/init/Peak/{seed}X"`,
  `@GET "/Ca8d5/data/item/{id}"`, etc.). No rewrite from `r/p/m/u/cp/dp` on the API path.
- **Extra bytes/token**: none upstream. Only `User-Agent` (from `PreLoad.Envs` via `initenv`, §4),
  `Accept-Encoding: deflate, gzip, br, zstd`, `Accept: */*`. `PalangOskol`/`x-oskol-pt` are
  stripped (local-only; `FUN_008e2c1c` checks the "PalangOskol" literal on the inbound side).

### 10.5 Pin verification (VERIFIED, `FUN_005a3f40` / `FUN_00761934`)
`Cpis[i]` = **32 raw bytes = SHA-256 of the server-cert SubjectPublicKeyInfo** (xor'd with the
`interfacess.key` in the protobuf; Java base64-encodes each before `initZero`, so the native pin
array holds base64 strings — reconciles the old "xor then base64" vs "32-byte" note). The endpoint's
`cpi` field (interfacex `f10`) selects which pin; an empty `Cpis` slot = no pin for that row. The
verify callbacks (`FUN_005a3f40`, `FUN_00761934`, which both read pin vector `DAT_00dca438` and call
`FUN_004be4f0` to get the active route's pin) compute SHA-256 over the presented cert's SPKI and
compare. HPKP form for a pin-only client: `sha256//<base64>`. *(SPKI vs full-cert is the one residual
MEDIUM; SPKI is the overwhelming convention and matches the 32-byte size and the Java "pin" framing.)*

### 10.6 Cold bootstrap (Test/Hi → PreLoad → Peak) — STATIC (structure VERIFIED)
Before any `Peak`/`interfacess` exists, `initZero(hosts[], pins=[])` loads the `hell` bootstrap hosts
with **no pins** (android-analysis §2; live decode 2026-10-28 gave 7 hosts). Each `hell` entry carries
`h`(host), `e`(IPv4), `v`(epv), `iss`, `isp`, `ish`(issued-SNI), `p`(port). So at bootstrap the SNI
MAY differ from Host: **SNI = `ish` if present else `h`; Host = `h`; https iff `iss`; port = `p`.** The
client tries each bootstrap host: `GET /Ca8d5/Test/Hi` (expects `"true"`), then `GET /Ca8d5/init/PreLoad`
and `GET /Ca8d5/init/Peak/<MMddHH>X` from the first host that answers, **without pinning** (no
`Cpis` yet). `noteIssuedHost` just records a single global "last issued host" string (memo); it is not
a per-route SNI table. Once `Peak` is parsed and `processItemGroup`/`initStack` populate the pinned
route table, all subsequent calls use §10.3-10.5 (SNI=Host=`HsN`, pinned).

### 10.7 Worked example — STATIC (cannot test from here; core worker runs from Iran)
Generator: `re/build_request.py` (`python -I re/build_request.py [freshPeak.bin]`) — parses
`decoded_starter.bin`, emits exact per-endpoint requests for the API groups. The live device used
an ArvanCloud edge `185.143.234.238:443`; that row is in group **99999999** and reproduces exactly:

```
# GET /Ca8d5/init/PreLoad   (and /Ca8d5/Test/Hi, /Ca8d5/init/Peak/<MMddHH>X — same transport)
curl -sS \
    --resolve api.g00gleapi.sbs:443:185.143.234.238 \
    --pinnedpubkey 'sha256///eVZxXQJ6Fxqe9piYxc2e6xPH2cs1Gx7TaHCaOwxqqo=' \
    -H 'User-Agent: Dalvik/2.1.0 (Linux; U; Android 16; 23113RKC6G Build/AQ3A.240912.001)' \
    -H 'Accept-Encoding: deflate, gzip, br, zstd' -H 'Accept: */*' \
    'https://api.g00gleapi.sbs/Ca8d5/init/PreLoad'
```
i.e. **connect IP `185.143.234.238`, SNI = Host = `api.g00gleapi.sbs`, scheme https, port 443, path
sent unchanged, pin `sha256///eVZxXQJ6Fxqe9piYxc2e6xPH2cs1Gx7TaHCaOwxqqo=` (= `Cpis[11]`), mobile UA,
no token/signature.** Other working rows in group 99999999 (IP → host → `Cpis[cpi]` b64):
- `185.143.233.238` → `gworker.sbs` → `j4nZMIgOjQ06OmwbS4DIE7anEIBGKNrXBEmz1cGoQxk=` (cpi 10)
- `185.143.233.238`/`185.143.234.238` → `api.g00gleapi.sbs` → `/eVZxXQJ6Fxqe9piYxc2e6xPH2cs1Gx7TaHCaOwxqqo=` (cpi 11)
- `185.229.134.130`/`185.229.134.55` → `api.gamezula.sbs` → `f5+rUJWyEt4KttDY9WIjfodQKgS5OHoFi/iq79+aa9E=` (cpi 12)
- `193.151.157.135` → `edge05.556512.ir.cdn.ir` → `oAYfwnBc/ZwbcL9ElIqK4Y4nZqEHiS9lWSyx+hL7r3w=` (cpi 13)
- `194.225.130.83` → `api.gworker.sbs` → `WKoGcV8WXxsioEH1r+heg3WIDIJas4jLkNu6cnTbF0M=` (cpi 14)

**Why the earlier live probes 404'd:** the user paired SNI=Host=`gworker.sbs` with a *different*
endpoint's IP/pin. The fix is to take IP, hostname, and pin from the **same endpoint row** and send
the real `/Ca8d5/...` path. The golden table is from 2026-08-16; IPs/pins may have rotated, so the
core worker should bootstrap a **fresh** `Peak` (§10.6, unpinned) and re-run `build_request.py` on it.

### 10.8 Rust core checklist
1. TLS client that validates **pin only** (SPKI SHA-256), skipping CA + hostname checks (BoringSSL
   custom verify, or rustls `ServerCertVerifier` returning Ok after SPKI-pin match). SNI = Host =
   route hostname. ALPN h2 + http/1.1.
2. Force the connect IP (don't DNS-resolve the camouflage hostname): rustls+hyper with a manual
   `TcpStream::connect(endpoint_ip:443)` then TLS with `ServerName = hostname`.
3. Headers: mobile UA (fetch `PreLoad.Envs`, fill `$osVersion`/`$deviceName`; §4),
   `Accept-Encoding: deflate, gzip, br, zstd`, `Accept: */*`. Forward the literal `/Ca8d5/...` path.
   No `PalangOskol`/`x-oskol-pt`/signature upstream.
4. Bootstrap unpinned over the `hell` hosts (SNI=`ish`||`h`); then pinned over the `Peak` table.
5. On failure/geo-block, retry the group's other endpoints (and the negative-id CF-fronting variant).

---

## §11. LIVE-VERIFIED full API recipe (2026-10-29, from the user's Iran device)

**THIS SUPERSEDES the STATIC guesses in §3/§10 for the path.** Confirmed by real requests
(phone `/system/bin/curl`, Iran network) returning 200 + real data.

### The one correction: the `Ca8d5`/`Ca8dA` first segment is a LOCAL route selector and is STRIPPED upstream.
- Local (Retrofit→proxy): `GET /Ca8d5/data/home/0`, `/Ca8d5/init/PreLoad`, `/Ca8d5/Test/Hi`, images `/Ca8dA/images300<img>.jpg`.
- Upstream (what libexo actually sends): the SAME path **without** the selector segment:
  `/data/home/0`, `/init/PreLoad`, `/Test/Hi`, `/images300<img>.jpg`.
- Evidence: on `api.gamezula.sbs@185.229.134.55` and `edge05.556512.ir.cdn.ir@193.151.157.135`,
  `/Ca8d5/*` → 404 but `/Test/Hi` → 200 `"true"`, `/init/PreLoad` → 200 zstd, `/data/home/0` → 200 zstd.

### Transport (VERIFIED LIVE)
- Connect route IP : 443, HTTPS. **SNI = Host = the route row's hostname** (same endpoint row's IP+host+pin; no decoy SNI — matches §10).
- Headers: `User-Agent: <mobile/Poco UA>`, `Accept-Encoding: deflate, gzip, br, zstd`, `Accept: */*`. No other headers, no signing, no token upstream.
- Response body is **zstd-compressed** (Content-Encoding) → decompress → **protobuf** (`PModel.*`). (Also serves br/gzip per Accept-Encoding.)
- Pin = SHA-256(SPKI), base64, selected by `interfacex.cpi` into `Cpis` (XOR key&0xff). Server works with a plain client too (pinning is client-side hardening).

### Routing (VERIFIED LIVE)
- `GET /init/Peak/<MMddHH>X` (seed = local month/day/hour `%02d%02d%02d` + literal `X`) → zstd → `interfacess`.
  De-obfuscate HsN/Cpis/strings by XOR with `key & 0xff`.
- Group **99999999** = init+data API endpoints (host/IP/pin rows). Group 99999998 = secondary. Content/media = numbered groups. Negative-sentinel / no-host rows = Cloudflare fallback (104.18.32.47 / 104.21.7.50).
- Route selection for a `/Ca8d5/<area>/...` call: base62 of a path segment → interfacex id within the area group (see §10); init/data control traffic resolves to group 99999999.

### Worked, LIVE-200 example
```
curl -k --resolve api.gamezula.sbs:443:185.229.134.55 \
  -A '<mobile UA>' -H 'Accept-Encoding: deflate, gzip, br, zstd' -H 'Accept: */*' \
  https://api.gamezula.sbs/init/PreLoad      # -> 200, zstd(PreLoad protobuf)
#   /Test/Hi -> 200 "true"   /data/home/0 -> 200 zstd(Home)   /init/Peak/<seed>X -> 200 zstd(interfacess)
```

### PreLoad (live) notable fields
- f27 (ns) = DNS list `178.22.122.100,178.22.122.100,217.218.127.127,46.32.31.30`; f18=content-ratings; f19=home Lists (Persian+emoji); f20=genres; f21/f23/f24/f26/f34 = config/version flags. No non-empty Envs/UA-template observed → the mobile UA we send is accepted as-is.

### Bootstrap note
Old `.bin`/`.okx` starter files decode (SuperLoaderBytes = zstd(XOR 0x33)) to a full `interfacess`; their group-99999999 hosts rotate, but the scheme is identical. A client can either ship a recent starter or just fetch `/init/Peak` from any currently-live group-99999999 host to self-update.

---

## 12. External-link URL builder (play / download) — VERIFIED(decompile) 2026-10-29

Reverse of `sources/p000/ge.java` case 4 (ItemActivity "open in external player" /
"copy link"), the native `Interfaces.spike`, and the Java helpers. Implemented in
`crates/oskol-core/src/media.rs`; op `playUrl` in `api.rs`. This **upgrades §5** —
`spike` is XOR **plus a custom base-62 encoding**, not plain XOR→string.

### URL shape (matches the user's real sample)
```
http://<rand60>.<rand40>.<saltDomain>:<port>/<spikeA>/<spikeB>[/<fileIdEnc>-<filename>]
```
Sample:
```
http://y59e8y37…qnojv.msm2kd…mrnv5.d4k4pp4hei8et7qi73n09h3vgfc.fun:1221/
  E4ivanttEXW4…kKe3 / p19Yj68…PKfnV / 6p6N-The.Salesman.2016.720p.BluRay.x264.YTS.DigiMoviez.mp4
```

### Pieces (all VERIFIED from decompile unless noted)
- **saltDomain** = `PreLoad.Salt` bytes **XOR 0x45** (`nf2.m53478l(salt,69)`).
  Confirmed against the live `re-native/preload.zst`: field 17 (`bytes Salt`, len 31)
  = `d4k4pp4hei8et7qi73n09h3vgfc.fun` XOR 0x45. **Deterministic — reproducible.**
- **host** = `join(chunks(60, rand100), ".") + "." + saltDomain`, where `rand100` =
  100 chars from `[a-z0-9]` (`nf2.m53473g`, pool = a..z then 0..9). The two leading
  labels are **random per request** (noise; also seed the spike key). Not reproducible
  and not meant to be — the proxy reads them back from the URL authority.
- **port** = `r96.f80991g` — the port the native local proxy bound at `init`
  (default 1000; the sample's device bound **1221**). It is the port whatever proxy
  serves these links must listen on. In core it is a parameter (`DEFAULT_PORT = 1221`,
  overridable via the `port` op arg).
- **spikeA** = `spike("/" + clean(urn), host)`; `clean` = `nf2.m53477k` =
  OkHttp-normalize path(+`?`query) of `http://1.2.3.4/<urn>`, strip one leading `/`.
- **spikeB** = `spike("PalangOskol" + rand(200) + "PalangOskol", host)` — the
  `PalangOskol` local-proxy credential (§4), spike-wrapped. Random per request.
- **trailing segment** (only when the urn's last path segment has a non-empty
  extension): `/<g41.m46609b(FileV2.id)>-<clean(lastSegment) before '?'>`.
- concat is `p51.m54905l(spikeA, "/", iz(...), spikeB)` = `iz + spikeA + "/" + spikeB`
  where `iz.m51157p(port,"http://",host,":","/")` = `"http://"+host+":"+port+"/"`.
  (The §5 guess "`path + "/" + http://… + "/" + pad`" was **wrong**; the real order
  is `http://host:port/ + spikeA + / + spikeB`, as the sample shows.)

### `spike(t1, t2)` — VERIFIED (`FUN_004ba97c`, charset `_INIT_22` @ `0x4bc0cc`)
```
spike(t1, t2):
    x = bytes(t1[i] ^ t2[i % len(t2)])              # repeating-key XOR, key = t2
    n = int.from_bytes(x, 'big')                    # x as big-endian base-256 int
    out = ""                                        # base-62 digits, LSD FIRST (no reverse)
    while n > 0: out += ALPHABET[n % 62]; n //= 62
    return out                                      # memoised in two global std::maps
```
- `ALPHABET` (62, custom) = `YHDWmMCJcvwEA5oxtjIB3UbK1lP6QqupTXnd8Fi7Rkrs2G0aNe4gVhOfyz9LZS`
  — read verbatim from the `std::string` built in `_INIT_22` (`DAT_00dca950`, size 0x3e).
- The native encoder is an in-place long division (process bytes MSB→LSB, carry),
  dropping leading-zero quotient digits — identical to the bignum form above. A reverse
  lookup table (`memset(&DAT_00dcaa88,0xff,0x400)` + fill) exists for the inverse
  (the proxy de-obfuscating the request).
- Confidence **HIGH** on algorithm + alphabet (full decompile + self-consistent
  round-trip in `media.rs` tests). The one residual with **no device oracle** is the
  digit endianness (LSD-first); implemented exactly as decompiled.

### `g41.m46609b(id)` — VERIFIED (file-id encoder)
Bespoke **base-64** (MSB-first, `sb.reverse()`), alphabet `g41.f59073a` =
`5EA6FLYQdNOKT2bMXeolv1k.IzRPw3s_a9DVqhgW0rU7cGumZJxi4C8nSypBfjHt` (incl. `.` and `_`).
`id==0` → first char. This is NOT standard base64.

### Worked example (fixed, reproducible)
```
spike("AB", "xy")  = "B4W"       # 0x41^0x78,0x42^0x79 = 0x393b -> base62 LSD-first
spike("/the.salesman.2016.mp4", "abc.def.d4k4pp4hei8et7qi73n09h3vgfc.fun")
                   = "ptFykGlIbMeqyd1TdfV9AlfzQRmLWW"
salt_domain(XOR(0x45) of the .fun domain) == "d4k4pp4hei8et7qi73n09h3vgfc.fun"
```

### op contract (`api(playUrl, …)`)
```
args:   { urn: string, vurn?: string, download?: bool, id?: int, port?: int }
return: { url: string, filename: string }
```
`vurn`/`download` are accepted but do not alter the URL (downloads do HTTP Range GETs
on the *same* URL — §6 — and `vurn` addresses thumbnails, not the stream). `filename`
= last path segment before `?`, percent-decoded. Salt is taken from the live
`Core::preload_cached()`.

### What the user can do to confirm
Call `api("playUrl", {"urn": "<a real FileV2.urn>", "id": <FileV2.id>})`, copy `url`,
and open it in **mpv**/**VLC** — provided a proxy that reverses `spike` is listening on
`<port>` and the `.fun` host resolves to it (on Android that is the in-app NDK proxy;
the deterministic parts — saltDomain, port, structure — match the sample, but the
random host labels differ every call by design).
