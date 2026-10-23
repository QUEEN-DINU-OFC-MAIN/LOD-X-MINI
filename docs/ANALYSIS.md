# RCD X MINI — Full Code Analysis (2026-10-05)

Repo: `dexterfree0101/rcd-x-mini-platform` @ `73b77c1`
Baseline test run: `node --test --test-force-exit test/` → **85 pass / 0 fail** (before any edit).

---

## 1. Architecture (measured, not guessed)

```
start-all.js  ── one Node process, one event loop
   ├─ site/      Express pairing site (pair code + QR) → R2
   └─ server/    worker: manager.js + runner.js (1 runner per WhatsApp session)
web/           Next.js site (Vercel) — /, /connect, /commands, /status, /dexter7739, /panel
shared/        R2 storage + AES-256-GCM, auth state, shard logic, i18n, caches
vendor/baileys Baileys 7.0.0-rc14 + chama "Pro", vendored (NOT from npm)
```

**`render.yaml` runs `npm run all` → site + worker share ONE process.** 44 sessions + web UI +
all downloads + ffmpeg all compete for the same single JS thread. That is the hard ceiling on
"speed".

### What the library actually supports (checked in `vendor/baileys/lib`)

| Feature | Available? | Where |
|---|---|---|
| `buttons` → `interactiveMessage` (native_flow) | yes | `Utils/messages.js:290`, `Socket/messages-send.js:1048` |
| `buttonMode: 'nexus'` biz node | yes | `Socket/messages-send.js:1085` |
| `prepareWAMessageMedia` | yes | `Utils/messages.js:55` |
| `generateWAMessageFromContent` | yes | `Utils/messages.js:617` |
| `CarouselMessage` proto (the vajira-style menu) | **proto only** | `WAProto/index.js:46313` — no builder, must be hand-assembled |
| `waUploadToServer` on the socket | **not exported** | only internal (`Socket/messages-send.js:936`), used via `business.js` |
| `maxMsgRetryCount` / retry manager | yes | `Utils/message-retry-manager.js` |

Consequence for the menu: a carousel menu **is** possible (proto exists) but has to be built by
hand with `generateWAMessageFromContent` + `relayMessage` — and unlike `sendMessage`, that path
**bypasses `dress()` (the footer) and the i18n `tx()` translate wrapper** in `runner.js`. Any
carousel code must add the footer/translation itself or the bot will start sending unbranded,
untranslated menus.

---

## 2. The `ENOENT … pre-key-584.json` error — root cause FOUND

```
site/pairing.js:151-154   #upload()
  const names = (await fs.readdir(job.dir)).filter(...)
  for (const n of names) files[n] = await fs.readFile(path.join(job.dir, n), 'utf8')
```

`#finalize()` calls `#teardown(job, sock)` (line 127) and only **then** reads the folder.
The teardown does not stop Signal work already in flight — `libsignal.js:370 removePreKey`
does `keys.set({ 'pre-key': { id: null } })` → `shared/authstate.js:138 fs.rm(file)`.

So: `readdir` sees `pre-key-584.json`, Baileys deletes it, `readFile` throws `ENOENT`.
The whole `#upload` is retried (line 138, `try=1`), which is why the session usually still
links — but every retry re-saves creds and adds 1–6 s of latency to the pairing flow.

`shared/authstate.js:64-71 bundleFiles()` has the **same race, but silent**:
```js
try { files[n] = await fs.readFile(...) } catch {  }   // ← key is dropped, no log at all
```
That is worse than the pairing one: a pre-key silently disappears from the R2 bundle. After a
worker restart the session comes back with creds but **missing signal keys** → incoming messages
cannot be decrypted. This is the most plausible source of the *"Waiting for this message"*
placeholder the users see. **Not yet proven** — needs a log sample from a session where it
happens (see §7).

---

## 3. RAM: 1428 MB RSS / 1064 MB heap — root cause FOUND

Two facts measured here:

1. `scripts/mem-bench.mjs 12` → `{"sockets":12,"baselineMb":85.5,"afterMb":114.2,"perSocketMb":2.39}`
   → **an idle socket costs ~2.4 MB**. 44 sessions ≈ 105 MB of sockets, not 1428 MB.
2. `package.json` → `"all": "node … --max-old-space-size=${HEAP_MB:-380} start-all.js"`
   and **`render.yaml` sets `HEAP_MB: "4096"`**.

So V8 is allowed to grow old space to **4 GB** before a major GC. `heapUsed: 1064 MB` is
therefore mostly **uncollected garbage, not a leak**. `MEM_LIMIT_MB: 6500` also disables the
manager's own capacity guard (`manager.js:34` refuses new sessions only above 90 % of that).

Fix = cap the heap so GC actually runs. This is the single highest-value change for RAM.

Secondary consumers (per session, `runner.js:45-53`): `msgs` 120 msgs × 4 h (full WAMessage
trees, needed by anti-delete), `contactBuf` up to 2000 JIDs, `statusSeen` 300 × 8 h.
Shared: `groupCache` 800 (group metadata with full participant lists), `devicesCache` 2000.

---

## 4. "download failed" / slow downloads — causes found

`server/lib/providers.js` + `server/lib/send.js`:

| # | Problem | Effect |
|---|---|---|
| a | `ytAudio()` uses `firstValid()` = **sequential** providers, each up to 45 s | worst case ~2 min before the user gets anything (or a failure) |
| b | `probeUrl()` on every candidate URL, 12 s timeout each | adds 12 s per dead link |
| c | `sendRemote()` hands WhatsApp a **remote URL** (`{ audio: { url } }`) | WhatsApp's own servers fetch it; provider URLs that are IP/region-locked or short-lived fail with "download failed" even though the bot succeeded |
| d | `dlQueue` concurrency = `DOWNLOAD_SLOTS` default **3** for all sessions | queueing → the 240 s `background()` timeout fires under load |
| e | `getBuffer()` caps at 16 MB and buffers fully in RAM | voice-note path (`songvn`) is the biggest RAM spike per request |

---

## 5. Menu / commands / branding

* `.menu` → `server/commands/main.js:27`, layout built by `server/lib/ui.js`.
  Current design: `╭━━━━❮ NAME ❯━━━━╮` box + `single_select` list + numbered text fallback
  (`textFromButtons`, with `numEmoji()` 0️⃣–9️⃣ keycaps).
  ⚠️ The keycap emojis are **on the numbers** — you asked for no emoji on numbers, so
  `ui.js:84-85 numEmoji` is exactly the thing to change.
* Every reply is decorated by `dress()` (`ui.js:15`) → appends `> RCD X MD • FREE RCD CONNECTED > …`.
* Categories are hard-coded in `ui.js:32 CATS` (15 of them). A per-category image needs a
  matching entry there — there is **no image per category today**, only 4 theme JPEGs
  (`server/assets/themes/{yellow,green,pink,blue}.jpg`, cached in `ui.js:28 _imgs`).
* `.settings` (`server/commands/settings.js:16`) shows **only prefix / mode / buttons**,
  while `shared/panel-settings.js SCHEMA` defines **28 real settings**. The WhatsApp side is
  missing 25 of them. Fix = render SCHEMA (single source of truth) in pages, RCD-branded.
* **Branding audit (grep for foreign names):** the repo contains **no** `vajira`, `ghost`,
  `kavin`, `lakshidu`, `td-dev` string anywhere. The only third-party branding is
  `server/lib/richmsg.js`:
  ```js
  const SIGNATURE = 'TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43…'   // base64 → "NIXEL.MessageBuilderV4.7…"
  trusted_sources: ['thenuxofc.store', 'nixel.dev', host]
  ```
  The `.alive` card is signed with **someone else's Meta-AI bot certificate**. That is the
  "not ours" part — and it is also the most likely cause of a client showing a pending /
  unsupported state for `.alive`.
* Newsletter `120363286758767913@newsletter` is already in `config.js devChannels` (auto-follow +
  auto-react), but it is **not** used as a `forwardedNewsletterMessageInfo` source anywhere
  (`grep forwardedNewsletter` → 0 hits in `server/ shared/ site/`).

---

## 6. Other real issues spotted while reading

| File | Issue |
|---|---|
| `runner.js:105` | `sock.sendMessage` is monkey-patched for `dress()`; `relayMessage` is not → `.alive` gets no footer and no translation. |
| `runner.js:449` | `qsock` Proxy creates a new object per command — fine, but `tx()` is awaited inside `sendMessage`, so a slow translator stalls the reply. |
| `runner.js:110` | `contactBuf` is created per connect and can hold 2000 JIDs; the status broadcast then lists all of them (`statusJidList`) — slow and a ban signal. |
| `main.js:60` | `.alive` uses `relayMessage` with the fake-cert widget and **no fallback path other than buttons**. |
| `settings.js` | `panel()` re-sends the same 3 quick buttons; no pagination. |
| `progress.js:11` | repaints the progress message every **1100 ms** → 1 WA message per second per download; on 44 sessions this is a rate-limit / temp-ban risk. |
| `main.js:76-79` | `.ping` sends 5 `edit` messages. Edits are `protocolMessage`; if the original was never acked the client shows a pending state. |
| `package.json` `start` | `node server/index.js` with **no** memory flags at all — if Render/Heroku ever falls back to `start`, the heap is uncapped. |
| `Procfile` worker | has `--max-old-space-size` but **no** `--expose-gc`, so `globalThis.gc()` in `server/index.js:29` and `manager.js:27` is a no-op there. |

---

## 7. What I still need from you (blocking)

1. **Category images** — you said "මම දෙන image ටික වගෙ" but no images were attached. Give me
   the URLs, or tell me to generate RCD-branded ones per category (they can live in
   `server/assets/menu/` and be sent as Buffers — no image host needed).
2. **Menu shape** — native buttons (`single_select`, what works today) vs the vajira-style
   **carousel** (swipeable image cards). The carousel needs the hand-built proto path from §1
   and does not render on every WhatsApp client.
3. **One log sample** of a session showing *"Waiting for this message"* + the worker log lines
   around it — to confirm the signal-key theory in §2 instead of guessing.

---

## 8. Fix order (agreed plan)

1. `site/pairing.js` ENOENT + `shared/authstate.js` silent key loss  ← correctness first
2. Heap/RAM: `HEAP_MB`, `MEM_LIMIT_MB`, `--expose-gc`, memory-pressure eviction
3. Downloads: race providers, buffer fallback when the remote URL fails, raise `DOWNLOAD_SLOTS`
4. Menu + command redesign (unique RCD design, **no emoji on numbers**), per-category images
5. `.settings` = full 28-setting panel from `panel-settings.js`, RCD-only branding
6. Newsletter `120363286758767913@newsletter` wiring
7. `.alive` de-branded (drop the NIXEL signature) — needs a decision, it changes how the card renders

Every step gets a test in `test/` and the full suite re-run.

---

## 9. DONE in this pass (tests: 85 → 98, all green)

`node --test --test-force-exit test/` → **98 pass / 0 fail**.

| # | Change | File | Test that proves it |
|---|---|---|---|
| 1 | New `collectKeyFiles()` — skips pre-keys that vanish mid-read (the `ENOENT … pre-key-N.json` race) instead of failing the upload | `shared/keyfiles.js` | `test/keyfiles.test.js` (6 tests, incl. the race reproduced by patching `fs.promises.readdir`) |
| 2 | Pairing upload now uses it → no more `upload retry err=ENOENT` + no 1–6 s pairing stall | `site/pairing.js` | same helper (call site itself is not unit-testable: needs a live socket) |
| 3 | Keys-bundle upload **aborts** instead of writing a partial bundle when a key file is genuinely unreadable → a key can no longer be silently deleted from R2 | `shared/authstate.js` | `authstate flush(): an unreadable key file aborts the upload…` |
| 4 | Keys-sync retry is exponential (was a fixed 5 s → hot loop on a stuck file) | `shared/authstate.js` | covered by the existing `R2 outage` retry test |
| 5 | **RAM**: `HEAP_MB 4096 → 1024`, `MEM_LIMIT_MB 6500 → 1500` | `render.yaml` | worker now logs `… limit 1500MB • heap 1024MB` |
| 6 | Worker logs the real V8 heap limit and warns when it is > 2× `MEM_LIMIT_MB` | `server/index.js`, `shared/log.js` | boot verified: `WORKER … limit 450MB • heap 953MB` + warning fired |
| 7 | `--expose-gc` on the Procfile worker so the periodic `gc()` is not a no-op | `Procfile` | – |
| 8 | Memory-pressure relief: past 80 % of `MEM_LIMIT_MB` the shared group/device caches are dropped + `gc()` | `server/manager.js` | `memory pressure: shared caches are dropped past 80%…` |
| 9 | **Downloads**: `ytAudio` races its 4 providers instead of trying them one by one (was up to ~2 min / 240 s timeout) | `server/lib/providers.js` | – (needs live providers) |
| 10 | **Downloads**: files ≤ `DL_BUFFER_MB` (default 8) are fetched here and sent as a Buffer, so short-lived/IP-locked provider URLs no longer fail inside WhatsApp as "download failed"; bigger files stay a URL (no RAM spike); local failure falls back to the URL | `server/lib/send.js` | `test/send.test.js` (6 tests) |
| 11 | `DOWNLOAD_SLOTS` default `3 → 5` | `shared/config.js` | – |
| 12 | `anabotTask` threw the number `0` instead of an `Error` | `server/lib/providers.js` | – |

**Deliberately NOT changed yet:** `.alive`'s `NIXEL` certificate (`server/lib/richmsg.js`),
the menu design, `.settings`, the newsletter wiring — all waiting on your answers below.

## 10. Menu / branding / settings / newsletter (this pass, tests 98 → 105)

- **Carousel menu** (`server/lib/menu.js`, new): one swipeable card per non-empty category,
  each card = generated/provided RCD image header + that category's command list, footer =
  RCD footer, `contextInfo.forwardedNewsletterMessageInfo` wired to
  `120363286758767913@newsletter`. `.menu` tries the carousel and **falls back to the classic
  button menu** if the client/socket cannot build it (`main.js`). New setting
  `menuStyle = carousel | buttons` (panel + `.set menuStyle buttons`).
- **Category images**: your 4 (fun/search/download/main) saved under `server/assets/menu/`,
  plus 6 generated in the same cyber style (ai/tools/group/media/settings/education);
  remaining categories map onto these (`ui.js CAT_IMG`). No image host needed — sent as Buffers.
- **Numbers**: keycap emoji removed; bold unicode digits + `❯` (`ui.js`), unique RCD frame.
- **Branding**: `.alive` no longer relays the third-party (NIXEL-signed) rich widget — it now
  sends our own RCD card (`main.js`). `richmsg.js` `trusted_sources` reduced to our own host.
  *Note: the invisible verification signature in `richmsg.js` is protocol-level and only
  matters if the rich widget is ever re-enabled; it is no longer used by any live command.*
- **`.settings`** now renders **all 28 SCHEMA settings** grouped, plus a new **`.set <key> <value>`**
  owner command (sanitised via `shared/panel-settings.js`), RCD-only.
- Tests: `test/menu-carousel.test.js` (3), `test/settings-panel.test.js` (4).
- **Flake note:** one pre-existing network-dependent channel test intermittently failed once in
  a full run and passed on re-runs; it is unrelated to this pass (real WhatsApp/HTTP calls).

## 11. Swipe-menu buttons + ordering + CineSubz movie category (tests 105 → 110)

- **Buttons on the swipe menu:** every carousel card now carries quick-reply buttons
  (ALIVE / PING / TEXT MENU / OWNER) in its `nativeFlowMessage` (`server/lib/menu.js`).
- **Category order:** cards are sorted **most commands → fewest** (was fixed CATS order).
- **Movie category:** `['movie','🎬','MOVIE']` added to `CATS` + `server/assets/menu/movie.jpg`.
- **CineSubz** (`server/lib/cinesubz.js`, `server/commands/movie.js`):
  - `.cinesubz <q>` (owner-only, **2/hour** rolling limit) → `/search?q=` → results as a swipe
    carousel of posters; each card quick-reply `⬇️ DOWNLOAD`. Falls back to a numbered list if the
    carousel cannot be built.
  - `.cszdl` opens `/download?url=` and offers episode/link buttons; `.cszget` sends the file
    (video, or document if over the video cap).
  - Defensive parsing of mixed field names; de-dup of links.
  - **Live API note (2026-10-05):** `/search?q=` currently returns `results: []` and
    `/download?url=` returns `404 Post ID not found` for the sample URL — i.e. the upstream
    cinesubz.co scrape has no data right now. Code is built to the documented shapes and is covered
    by mocked tests (`test/cinesubz.test.js`); it will work once the API returns data.
- Rate-limiter regression fixed (it first counted the current call against itself, blocking the 2nd).

## 12. LID <-> PN mapping — connected logs show the real number (tests 110 -> 118)

Problem: WhatsApp now issues some accounts with a LID as creds.me.id (it comes from the pair-success
device node — validate-connection.js: me: { id: deviceNode.attrs.jid }). For those, the session key and
every log line showed the LID instead of the phone number (e.g. +17272829292). onWhatsApp() refuses
LIDs, so the number can't be re-derived from the network — only from a stored lid<->pn mapping
(getPNForLID reads keys, no network) or the number the owner typed at pairing.

Fix (key stays the LID — no migration, no login risk; the real number rides alongside in meta.pn):
- server/lib/pn.js: selfIdentity(sock) resolves the account's real pn + lid; rememberSelfMapping()
  persists a lid<->pn pair into the signal store + cache; isPnJid/isLidJid exported.
- site/pairing.js: at link time the owner-typed number is authoritative -> stored as meta.pn (+ meta.lid),
  the mapping is persisted, the welcome caption + log show the real number.
- server/runner.js: #resolveSelf() on connect sets this.pn, REBINDS the log tag to it and logs
  connected {pn:+..., lid:+...}; lang, ownerNumber and the anti-view-once target use the pn.
- shared/wa.js: selfJid() keeps the @lid domain (rebuilding a lid as @s.whatsapp.net addressed the
  wrong user — broke self-messages for lid accounts).
- site/panel.js + web panel: display + language detection use meta.pn.
- Movie category labelled MOVIE • SOON (CineSubz API still returns no data).
- Tests: test/pn-lid.test.js (8) — selfIdentity (pn / lid-with-mapping / lid-without), mapping
  persistence, junk rejection, selfJid domain, and a runner integration test proving a LID-keyed
  session logs +<pn> not the lid.

## 13. Menu cards: list + buttons + URL on phone AND web; .song swipe menu (tests 118 -> 119)

- `server/lib/menu.js` buildCard: the category command list moved from the header into the BODY so it
  renders on BOTH phone and web; each card also carries quick buttons (ALIVE/PING/TEXT/OWNER) plus a
  `cta_url` WEBSITE button (https://lodxmini.vercel.app).
- `server/lib/ui.js` buildButtons: every button message now appends a `cta_url` WEBSITE button.
- `server/commands/download.js` `.song`: when buttons are on it searches YouTube (P.ytSearch, 6) and
  sends a swipe carousel of results; each card offers AUDIO / VOICE / VIDEO quick buttons + a
  cta_url to the video. Falls back to the single-result picker if search/carousel fails. Exported for
  tests; `test/song-carousel.test.js`.
- `server/assets/menu/main.jpg` regenerated: said "DOWNLOAD MENU" before; now "MAIN MENU" (RCD X MINI).

## 14. Cross-platform carousel fix: list in header AND body; no cta_url on cards (v35)

Root cause of "phone shows no swipe menu / PC shows no command list":
- Phone renders a carousel card's HEADER title; web renders the card BODY. v31 put the list only in the
  header (phone ok, PC missing it). v34 moved it only to the body (PC ok, phone missing it) AND added a
  `cta_url` button inside cards, which broke carousel rendering on phone.
Fix:
- menu.js buildCard: command list now in BOTH header.title (phone) and body (web); cards carry only
  quick_reply buttons (ALIVE/PING/TEXT/OWNER) — cta_url removed from cards.
- The website URL is placed as tappable text in the menu header and as a cta_url button on every normal
  button message (buildButtons), instead of inside carousel cards.
- download.js songCarousel: info in header+body; per-card quick_reply AUDIO/VOICE/VIDEO only (no cta_url).

## 15. Mobile carousel: cards must be BUTTON-LESS (v36)

Real-device result from the owner: the ORIGINAL (v31) carousel — `nativeFlowMessage: { buttons: [] }` —
rendered on mobile; every variant with real per-card buttons rendered on web ONLY. So per-card
nativeFlow buttons are what make Android drop the carousel.

Fix (v36):
- menu.js buildCard: restored the proven structure — image header + command list in BOTH header.title
  (phone) and body (web) + EMPTY nativeFlowMessage. No buttons inside cards.
- Quick actions / URL stay on NORMAL button messages (Android renders those fine), not in cards.
- .song: carousel cards button-less (visual); selection moved to a mobile-safe single_select picker sent
  alongside (rows -> `.songdl audio <id>`).

## 16. Buttons-off numbered full menu + .img search swipe menu (v37, tests -> 120)

- main.js .menu: when `settings.buttons` is OFF (and no category arg), send the FULL command list as a
  numbered "reply a number" text (commandSections) instead of the carousel. Raised ui.js numbered() cap
  60 -> 400 so ALL ~240 commands get numbers.
- providers.js: imgSearch(q) — Bing image scrape of `murl` direct image URLs (verified live).
- commands/imgsearch.js: `.img <q>` (aliases imgsearch/gimage) -> button-less swipe carousel of image
  results (mobile-safe); falls back to sending a few images if the carousel can't be built. Exported for
  tests (test/imgsearch.test.js).
- Freed the `img` alias from the AI `image` command (it was colliding with the new search command).

## 17. Buttons-off .menu = numbered CATEGORIES + prettier category pages (v38)

User clarified the intended buttons-off flow: `.menu` shows `1 DOWNLOAD MENU 2 SEARCH MENU 3 FUN MENU …`;
replying a number opens that category with its command list + image. So v37's full-command numbered list
was reverted to numbered CATEGORIES (categorySections) for the buttons-off path.
- main.js .menu: buttons-off (no category) -> sendButtons(categorySections) numbered categories.
- Category page text rebuilt as a clean box (`╭──❮ 📥 DOWNLOAD MENU ──╮` with  rows) and carries the
  category image, for both buttons-on and off.
- Test restored to assert numbered categories + reply opens category (list + image).

## 18. Pretty numbered menus + random number fonts + cardmenu toggle (v39)

- ui.js textFromButtons: cleaned the numbered rows (removed the stray `_…_`/`&gt;` clutter; description now
  appended with a `·` separator on the same line). Numbers render in one of 5 decorative fonts (bold,
  fullwidth, double-struck, circled, sans) chosen at random per message (display-only; replies are still
  plain digits). `pickNumFont()` exported.
- panel: new Look-&-feel toggle `cardmenu` ("Swipe card menu") + DEFAULTS cardmenu:true. .menu sends the
  swipe carousel only when buttons on AND cardmenu !== false; otherwise the button/numbered list.

## 19. Numbered list: description on its own line below the command (v40)

User wants the command on one line and its description on the next line (indented), cleanly — no `&gt;`
or `_` artifacts. textFromButtons now emits:
  ┃ <num>❯ .crypto
  ┃      ↳ Crypto price (.crypto bitcoin)

## 20. No duplicate list on phone: list ONLY in body, short header title (v41)

Phone renders BOTH the carousel card header title and the body; web renders the body. Putting the command
list in both (v36) made it appear TWICE on phone. Fix: header title is now short (`🛠️ TOOLS MENU`); the
full command list lives ONLY in the body (shown once on phone and on web). Same for .song (header `🎵 n`,
detail in body) and .img (header `🖼️ n`, query+file in body).

## 21. Branding cleanup, per-category banners, speed, defaults (v42)

Five fixes in one batch:
- **Footer / branding**: every message now ends with `FREE RCD CONNECTED > https://lodxmini.vercel.app`
  only. The old "RCD X MD" footer piece is gone from config.footer/poweredBy; listTitle is
  `RCD X MINI FREE BOT`. All stray "RCD X MD" strings in code (programmer/stickers/alive/antidelete)
  replaced with "RCD X MINI".
- **Category images**: each carousel category renders its OWN banner. Added dedicated sticker/aiimage/
  privacy/channel/reply.jpg and pointed CAT_IMG at them (was reusing media/ai/settings/group art).
  New `checkCategoryImages()` runs at server boot (server/index.js) and warns if any category is missing a
  file or shares one with another category. Test asserts a clean check + 16 distinct md5 banners.
- **Speed**: card media uploads for the carousel (.menu), .song and .img carousels were sequential
  (prepareWAMessageMedia one card at a time). Now parallelised via Promise.all over the cards, so the first
  .menu renders much faster.
- **Defaults**: new linked users arrive with buttons OFF (numbered menu) — runner `get settings()` and
  panel DEFAULTS both default `buttons:false`. Existing saved settings are untouched.

## 22. /fulldp page — upload a photo, connect, auto-set full DP (v43)

New web page `/fulldp` (web/app/fulldp/page.tsx) + nav link. Flow: upload a photo → it is stored
temporarily on the ImgBB CDN → user connects their number (pair code or QR) to the RCD X MINI bot →
the instant the pairing socket opens, the bot sets that photo as the account's FULL profile picture
(no crop), exactly like the `.setpp fulldp` command.
- server/lib/dp.js: extracted `fullFrame()` out of mainx.js (now shared) + added `safeImgUrl()`
  (only https://(i.)ibb.co is ever fetched back — SSRF guard), `fetchImageBuffer()` (size-capped),
  and `uploadToImgbb()` (posts key+image+expiration, maps the CDN JSON, throws Error.status).
- config.js: `imgbb { key, expiration }` (key overridable via IMGBB_KEY; default expiration 3600s).
- site/index.js: `POST /api/fulldp/upload` (own 12mb JSON parser; the global 64kb parser skips this
  path) → uploadToImgbb. `/api/link` now forwards `dpUrl` into pairing.start.
- site/pairing.js: job stores `dpUrl: safeImgUrl(dpUrl)`; #finalize() downloads it and calls
  updateProfilePicture(full → blur fallback) while the socket is still open. Never fatal.
- web proxy: `POST /api/fulldp/upload` → primary backend (handleFulldpUpload).
- Tests (test/fulldp.test.js, 6): SSRF guard, fullFrame JPEG/aspect, uploadToImgbb success + 400/500/502,
  fetchImageBuffer cap. Suite 126/126; `next build` lists /fulldp.

## 23. Panel settings, media auto-replies, status reactions, and view-once reply recovery (v44)

- Panel and runner now use one live `defaultSettings()` table from `shared/panel-settings.js`.
  This fixes settings displayed as OFF in the web panel while the bot was actually ON, including
  `autoreadstatus`, `autoreactstatus`, and `autovo`, and prevents future default drift. Config-derived
  language is read at call time rather than frozen during module import.
- Command Access UI is compact: smaller controls, three-column command grid, descriptions available
  as hover titles, and a scroll limit so `Who can use each command` does not dominate the page.
- Keyword auto-replies can now attach a photo, video, or voice note. Panel uploads are persisted under
  `assets/<number>/replies/`; the server validates ownership of media keys, removes orphaned media, and
  legacy text-only replies remain compatible. The runner sends the attachment with optional caption and
  falls back to text if the media is unavailable.
- Status emoji reactions now mark the status read before reacting, include PN/LID participant variants,
  and retry once after WhatsApp indexing delay; errors are logged instead of silently swallowed.
- If the owner replies to a view-once media message with any message or emoji, the bot reveals and sends
  that media to the owner chat, matching `.vv`; ordinary quoted media does not trigger it.
- `.settings` now includes the working web-panel link, number, and password. Existing sessions receive a
  password once if needed; the hashed password remains for verification and the generated password is
  retained so it can be shown again. Keep these credentials private.
- Validation: full suite **136/136**, panel regression tests **10/10**, and Next.js production build clean.

## 24. Clean button modes (v45)

Removed the user-facing `nexus` / `legacy` packet-format choice and the `btntest` testing command.
`btnmode` now has four clear options:
- `swipe` — SWIPE CARD main menu
- `list` — BUTTON LIST menu
- `menu` — MENU BUTTON + QUICK REPLY
- `quick` — QUICK REPLY BUTTON ONLY (single-select menu omitted)

Added `.menustyle swipe|list` as a simple compatibility command. The panel's Button mode select now
shows the same four options, and generated command metadata no longer exposes `btntest`.
The normal website CTA remains on normal button messages.
Validation: backend **136/136**, TypeScript check clean, Next.js production build clean.

## 25. Recoverable dead sessions and explicit offline presence (v46)

- SessionRunner now distinguishes terminal dead states (logout / forbidden / multi-device mismatch)
  from transient dead states (repeated connection replacement). SessionManager reconciliation recreates
  transient dead runners from stored credentials instead of leaving them permanently stuck in its map.
- The runner now explicitly sends `available` or `unavailable` after every successful connection. Since
  `markOnlineOnConnect` is disabled, turning Always online OFF must actively publish unavailable; otherwise
  WhatsApp can keep showing a stale online presence.
- Worker stats now expose `dead`, `starting`, and `backoff` counts alongside open/reconnecting, making
  a 53-session worker diagnosable instead of hiding sessions in the aggregate.
- Validation: **136/136** backend tests pass.
