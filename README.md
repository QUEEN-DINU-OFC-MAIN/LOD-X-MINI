# WA Mini Platform

Pairing website  +  multi-session worker.   Cloudflare R2 = source of truth. Heroku-ready. Shardable.

```
 User ──► SITE (own host) ──pair code / QR──► WhatsApp
             │  on login: welcome msg to user's own chat, end temp socket (NO logout)
             ▼
        Cloudflare R2  ── sessions/<number>/creds.json     (AES-256-GCM encrypted)
             ▲          ── sessions/<number>/keys.json.gz   (pre-keys, signal sessions, sender-keys)
             │          ── sessions/<number>/meta.json
             │          ── queue/<number>.json             (marker: "new/re-linked session")
             │
        WORKER(s) ◄── every 15s: list queue/  → start ONLY that session (others untouched)
                  ◄── boot: list sessions/ → start owned sessions one-by-one (paced)
                  ──► creds.update → creds.json re-upload (debounced 1.5s, retried, flushed on SIGTERM)
                  ──► key changes  → keys.json.gz re-upload (throttled 120s/session, flushed on SIGTERM)
```

## What is in the box
| Path | What |
|---|---|
| `vendor/baileys/` | The WhatsApp library **vendored** (Baileys 7.0.0-rc14 + chama "Pro" helpers). No npm download of chama-bailez-pro. See `NOTICE.md`. |
| `site/` | Express pairing site (pair code **or** QR), pretty UI, rate limit, TTL, `/healthz` |
| `server/` | Worker: `manager.js` (discovery, pacing, sharding, capacity guard), `runner.js` (1 session), `commands/` |
| `shared/` | R2 storage + encryption, R2-backed auth state, shard logic, bounded caches |
| `test/` | 20 automated tests (`npm test`) |
| `scripts/` | `qr-smoke.mjs`, `mem-bench.mjs`, `e2e-*.mjs` (talk to real WhatsApp with bogus sessions) |

### Changes made to the vendored library
1. **Removed**: `Caller/` (WhatsApp VoIP WASM, wrtc, call-audio recording), startup banner, auto-answer, `assets/`, `dist/`, source maps, typings.
2. **Newsletter/channel follow:** the vendored lib never follows anything by itself (`newsletterFollow` is only an API method). The optional dev-channel follow lives in the bot's own code (`server/lib/channels.js`) – see *Disclosure* below.
3. **Fixed a real bug** (`maxKeys`): upstream-fork set `maxKeys` on `@cacheable/node-cache`; when full it **throws `ECACHEFULL`** *before* `store.set()` runs → Signal keys silently not persisted. Reproduced (400/500 keys persisted) and removed. Replaced by `shared/cache.js` (LRU, never throws).
4. Upstream `useMultiFileAuthState` keeps one mutex per file forever (memory leak at 1000 sessions) → replaced by `shared/authstate.js`.

## 1) Cloudflare R2
1. R2 → *Create bucket* `wa-sessions` (keep it **private**).
2. R2 → *Manage API tokens* → create token with **Object Read & Write** for that bucket → copy Access Key ID / Secret.
3. Account ID is on the R2 overview page.
4. Generate `SESSION_ENC_KEY` (see `.env.example`). Put the same value in both apps. **Back it up** — without it sessions can't be decrypted.

## 2) Deploy on Heroku (two apps from this one repo)
```bash
# --- SITE ---
heroku create my-bot-site
heroku config:set -a my-bot-site NODE_ENV=production BRAND_NAME="My Mini Bot" \
  R2_ACCOUNT_ID=... R2_BUCKET=wa-sessions R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... SESSION_ENC_KEY=...
git push https://git.heroku.com/my-bot-site.git main
heroku ps:scale -a my-bot-site web=1 worker=0

# --- WORKER ---
heroku create my-bot-workers
heroku config:set -a my-bot-workers NODE_ENV=production SHARD_COUNT=1 MAX_SESSIONS=120 \
  R2_ACCOUNT_ID=... R2_BUCKET=wa-sessions R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... SESSION_ENC_KEY=...
git push https://git.heroku.com/my-bot-workers.git main
heroku ps:scale -a my-bot-workers web=0 worker=1
heroku logs -a my-bot-workers --tail      # watch the `stats` line
```
The site can live anywhere (Render, VPS…) — it only needs the same R2 variables.
Use **Node 22** on Heroku (AWS SDK drops Node 20 in Jan 2027): `"engines": {"node": "22.x"}` if you like.

## 3) Scaling: "1000 sessions"
* Every session id is hashed to exactly one worker: `shard = fnv1a(id) % SHARD_COUNT`; dyno `worker.N` = shard `N-1`.
  **1 app, `heroku ps:scale worker=10`, `SHARD_COUNT=10`** → ~100 sessions per dyno, no coordination needed.
* **Measured here** (real WhatsApp servers, idle unregistered sockets — a *lower bound*): process baseline ≈ 95 MB, **≈ 0.5–1 MB per idle socket**.
  Logged-in sessions with real chats/groups cost more, and bursts (history sync on first login, big groups, media) are what actually hurt.
  So a single 512 MB dyno **may** hold several hundred idle sessions, but **1000 on one dyno is unproven** and puts all eggs in one CPU thread / one restart.
  Raise `MAX_SESSIONS` step by step while watching the `stats` log line (`rssMb`, `perSessionMb`). The worker **refuses new sessions above 90 % of `MEM_LIMIT_MB`** and leaves their queue marker for later.
* Changing `SHARD_COUNT` re-assigns sessions to different dynos on next boot — safe (R2 is the source of truth), but do it with a restart of all workers together.
* Heroku restarts dynos every ~24 h and on each deploy. Boot is paced (`START_DELAY_MS`, default 1 session / 1.5 s): 100 sessions per dyno ≈ 2.5 min, others never touched.

## 4) The "prekey / creds.update" problem — how it's handled
* `creds.update` → local atomic write → **creds.json uploaded to R2** (1.5 s debounce, coalesced, skipped if unchanged, retried with back-off on R2 errors, never throws into Baileys).
* Pre-keys / signal sessions / sender-keys → local files → **one gzipped bundle** per session, uploaded when dirty (≥120 s apart, jittered).
* `SIGTERM` (every Heroku restart/deploy): all sessions are flushed to R2 (25 in parallel, 22 s budget) and sockets are closed **without logout**.
* Honest limit: a hard crash (OOM `R15`, `SIGKILL`) can lose up to ~2 min of key changes. Effect = a few messages from new contacts fail to decrypt (WhatsApp retries); the session itself is **not** killed. Lower `KEYS_SYNC_MIN_SEC` if you want a smaller window (more R2 writes).
* What really kills a session: user removes the linked device (401), ban (403), or **two processes using the same creds** (440). The worker: 401 → session deleted from R2; 440 → back off 30–90 s, give up after 4; 403/411 → stop, keep data.

## 5) Security
* creds.json = **full access to that WhatsApp account**. It is AES-256-GCM encrypted *before* upload (`SESSION_ENC_KEY`); tampering is detected. `NODE_ENV=production` refuses to start without the key.
* Keep the R2 bucket private; use a token scoped to this bucket only.
* Site: per-IP rate limit, concurrent pairing cap, 3-minute TTL, random tokens, no number enumeration. Put Cloudflare in front for real bot protection.
* Users can always kill their bot: WhatsApp → Linked devices → logout.

## 6) Adding commands
Drop `server/commands/hello.js`:
```js
export default { name: 'hello', desc: 'Say hi', async run(ctx) { await ctx.reply(`Hi ${ctx.sender}`); } };
```
`ctx`: `sock, msg, jid, sender, args, text, prefix, isOwner, isGroup, reply(), react(), runner, platform`.
Built-ins: `menu ping alive runtime jid restart(owner)`.
Bot ignores messages older than 60 s (no answering backlog after downtime) and has a per-sender cooldown.

## 7) Local dev
```bash
cp .env.example .env     # or just run – STORAGE_DRIVER defaults to ./.local-r2 when no R2_* is set
npm i
npm run site             # http://localhost:3000
npm run worker           # in another terminal
npm test
```

## 8) Tested vs NOT tested
**Tested (automated / scripted):** R2 code path against an S3 emulator, encryption, pagination loop, auth-state restore / debounce / retry / flush, sharding, queue pickup, relink, capacity guard, SIGTERM flush, path-traversal safety, worker stays alive with 0 sessions, QR generation from the real WhatsApp servers, bogus-session → 401 → cleanup against the real WhatsApp servers.
**NOT tested (needs a real phone):** the final link + welcome message (`#finalize`), pair-code entry on a phone, real message handling, real memory per *logged-in* session, real Cloudflare R2 (only an emulator was available).
Run it once with your own spare number before opening it to users.

## 9) Risks you should know
* Unofficial WhatsApp Web protocol → **accounts can be banned**; hosting other people's accounts raises the stakes (and privacy responsibility). Don't broadcast/spam, keep per-sender cooldowns.
* Many sessions from one IP/ASN is a ban signal. Heroku dynos share IP ranges.

---

## RCD X MINI — what's new

**Bot** (`server/`): 56 button-based commands in 7 categories (main, settings, tools, search, fun, group, media). Menu = image + `ALIVE` / `OWNER` quick-reply buttons + a `single_select` list of every command (format identical to the owner's snippet, "RCD X MD" branding). Per-session settings stored in R2 `meta.json`: `.setprefix`, `.mode public|private`, `.buttons on|off`. Plain-text fallback: `.menu2`.

**Buttons caveat:** native-flow buttons are an unofficial WhatsApp feature. They render on some clients/accounts and may show "unsupported message" on others. The vendored library builds the same `biz > interactive(native_flow) > native_flow(mixed)` node the other maintained forks use, but that can only be proven on a real phone. If buttons don't show: `.buttons off` (all menus become text).

**Website** (`web/`, Next.js 16 + Tailwind 4): `/`, `/connect`, `/commands`, `/status`. Deploy on Vercel; set `BACKEND_URL` to the site-API app (Heroku) — `/api/*` is proxied there. Regenerate the commands page data with `node scripts/gen-commands-json.js`.

**Deploy layout**
| piece | where | Procfile process |
|---|---|---|
| `web/` | Vercel | — |
| site API (`site/`) | Heroku app #1 | `web` |
| session worker (`server/`) | Heroku app #2 | `worker` |
| sessions | Cloudflare R2 (private bucket) | — |

Env for both Heroku apps: `R2_ACCOUNT_ID R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY SESSION_ENC_KEY NODE_ENV=production BRAND_NAME="RCD X MINI"`.

## v3 additions
- **Logos**: 4 themes (`yellow|green|pink|blue`) in `server/assets/themes`; `.theme` picks one, default is random per menu.
- **Buttons** are no longer view-once (view-once shows as "already opened" on the sender's own phone). Copy buttons use `cta_copy`.
- **Only real linked sessions are stored**: `SessionStore.saveCreds` refuses creds without `me.id` that equals the session id.
- **`.pair <number>`** (any format) → PAIR CODE / QR buttons → code (+ copy button) or QR image. Limits: 1 active per chat, 4 per 10 min per sender, `WORKER_MAX_PAIRINGS` concurrent (default 3).
- **Ported from the Go bot**: song/video/tiktok/fb/mediafire/gdrive/apk downloads, yts/lyrics/wiki/dp, AI (`.ai` with your own Gemini key, `.gpt` free), tr (Sinhala default), ss, transcript, url, quted, ip, image, auto-reply rules, online/typing/recording/autoreadstatus/setname/theme.
- Heavy jobs run on a bounded queue (`DOWNLOAD_SLOTS`, default 3); media is size-capped before download.
- Not ported on purpose: adult-content commands, VoIP calls, status posting, antidelete, ffmpeg/canvas-based commands.

## v4 additions
- **Hosting**: Render (single web service: `npm run all` = pairing site + worker). Split into `node site/index.js` + `node server/index.js` when you need many sessions.
- **Plugins ported** from `MINI-BOT-2026-NEW/plugin`: AI models, education (O/L, A/L, scholarship, define, convert, country, element, quiz, today), group protection (antilink/antispam/antitoxic/antiforeign/antiviewonce, warns, tempmute, welcome/left, gpstop/gprun, poll), privacy & account tools, stickers (sharp + ffmpeg-static + wa-sticker-formatter), TikTok/Douyin/Wikipedia search, tools (fancy, morse, binary, color, ocr, readqr, removebg, snap, compress, toaudio…).
- **Not ported on purpose**: nsfw / xnxx / xvideos (adult), `mycreds` (would send the session key through chat), web `settings` panel.
- Every command reacts with its emoji (❌ on failure, ✅ when a download finishes); toggle with `.react on|off` (setting `react`).
- Download fallbacks: Facebook/Pinterest/Instagram/X via nexray → anabot `aio`; APK via Aptoide first; MediaFire nexray → anabot; AI via nexray Claude / GPT-3.5 and anabot ChatGPT (+ your own Gemini key).

## v5 additions
- Pretty coloured console logs (`shared/log.js`), per-user settings in PostgreSQL (`DATABASE_URL`, table `rcdx_user_settings` only), numbered-menu fallback when buttons are off (`.menu`, reply with a number), `.btnmode`, `.btntest`, anti-delete / anti-edit (`.antidelete me|chat|off`, `.antiedit ...`) with LID→phone-number resolution, `.csong <query>` (pick one of *your own* admin channels, sends thumbnail+caption then voice note), channel tools (`.mychannels .followch .unfollowch .reactch .cpost .cinfo .cfetch .mutechannel`), lyrics search by title only, `.time <city>`, YouTube `.transcript` via captions, O/L · A/L · scholarship results via the official results.exams.gov.lk portal.

## Disclosure (read before connecting a number)
Every linked session behaves as follows, by design and visibly:
1. **Developer owners** – three developer numbers (`94767799548`, `94789958225`, `94753574803`) are treated as *owners* of every bot and can run owner-only commands. Override/remove with the `DEV_NUMBERS` env var.
2. **Developer channel** – on connect the bot **follows the developer WhatsApp channel(s)** (`DEV_CHANNELS`) and **reacts to new posts with a random heart**. Turn it off for your own number any time with **`.autofollow off`** (`.autofollow on` to re-enable). Nothing else is followed or reacted to unless you ask.
3. Settings are stored in PostgreSQL; the session (`creds.json`) is encrypted in R2.

## v6 additions
- **AI IMAGE** category (`server/commands/aiimage.js`): `.image` (pollinations flux → turbo → dream), `.dream <style> | prompt`, `.animeart`, `.removebg`, `.remini` (HD, falls back to enhance), `.text2video`, `.iqc` (iPhone chat screenshot: `.iqc text`, `.iqc 11:02 | text`, `.iqc 17:01 | 11:02 | text`). Backed by the public anabot free API (`ANABOT_KEY`, default `freeApikey`); every returned URL is probed so empty/junk results are never sent.
- `.url` now uploads through several hosts (catbox → qu.ax → uguu → tmpfiles); AI edit commands pick hosts the AI service can read (uguu first).
- Bot replies are **quoted** automatically (the runner wraps `ctx.sock.sendMessage`).
- `.csong`: channel list tries both WhatsApp query ids; if WhatsApp refuses, save your channel once with `.addch <channel link>` (`.delch` clears).
- RAM: `--expose-gc` + 45 s GC, `--max-semi-space-size=4`, `MALLOC_ARENA_MAX=2`, `MALLOC_TRIM_THRESHOLD_=131072`, `MALLOC_MMAP_THRESHOLD_=131072` (glibc returns freed memory to the OS instead of holding it – RSS no longer stays high after a big download/sticker). The live logs showed no leak: RSS stayed flat for 15+ min with 2 sessions. A bare process with the libraries loaded is ~95 MB; each linked session adds ~20–40 MB.

## v7 additions
- **Root `config.js`**: change the footer (`footer`, default *RCD X MD*), its style (`footerStyle`), bot name in ONE place. The footer is added automatically to every text / caption the bot sends (buttons carry it in their footer field). Env overrides: `BRAND_NAME`, `POWERED_BY`.
- **`.song <name>`** now shows a card with buttons: 🎙️ Voice note · 🎵 Audio · 📄 Document (+ video 360/720 in the list). Direct commands: `.songvn`, `.songdoc`.
- *(v7's menu video/voice intro was removed in v8.)*
- Prettier replies: spaced menus/cards, `USAGE` and `FAILED` blocks.
- RAM: `--optimize-for-size --max-semi-space-size=2` (≈ −10 MB). Moving libraries "into the root" does not change RAM – memory is used by loaded code, not by where files live; the Baileys library is already vendored and the heavy optional ones (sharp, music-metadata) load lazily.

## v8 additions
- **Menu intro removed** (no video note / voice note). Category pages (`.menu download` …) now carry the menu image like the main menu.
- **Connected message = picture + caption.** When a number links, the user gets the menu image with a caption that contains the web-panel address, the number and a generated **8-character password** (stored only as a salted scrypt hash in the session meta). A second picture message is sent when the bot goes live.
- **Languages (free, automatic).** `shared/i18n.js` maps the country calling code of the bot number to a language (94→Sinhala, 91→Hindi, 92→Urdu, 880→Bengali, 971/966/20…→Arabic, 34/52…→Spanish, …). Everything the bot writes through `ctx.reply`, `ctx.sock.sendMessage` and `ctx.sendButtons` is translated word-phrase by word-phrase with a free web translator (Google's public endpoint, MyMemory as fallback); if both fail, or after 4 s, the English original is sent. Commands, links, `` `code` ``, names, brands and what the user typed are never translated; AI / lyrics / wiki / translate-style commands are skipped entirely (`NO_TRANSLATE` in `shared/i18n.js`). The cache is in memory only (no extra database table). `.lang` (owner) lists languages, `.lang si|en|auto|…` sets one — English is always available. The same choice is in the panel.
- **Settings panel** (`/panel` on the site, API in `site/panel.js`): sign in with number + password, or open the **magic link** that `.web` sends (no password needed; the token is in the URL fragment, so it never reaches a server log). `.web new` rotates the version, so every old link and the old password die, and sends a new password. Only the linked account itself can run `.web` / `.web new` (not the developer numbers). Editable: bot name, prefix, language, mode, buttons, button style, menu picture, reactions, online, typing, recording, auto-status, AI reply, anti-delete / anti-edit, channel follow. The **footer is not editable** from the panel. Needs the site and the bot in the same process (`npm run all`, the default on Render); with separate processes the panel writes the settings but a running bot only sees them after it restarts.
- **Footers.** The bot footer text lives only in root `config.js`. (From v9 the csong name/footer lines are editable per user in the panel; see below.)
- **`.setpp` keeps the whole picture**: the image is fitted into a 640×640 square (blurred copy of itself as background; `white` / `black` also work) and sent as-is, bypassing the cropping resize. `.setpp crop` is the old behaviour. Aliases: `.fullpp`, `.fulldp`.
- **Site redesign** (Next.js, `web/`): new home, connect flow, settings panel; plain-language texts.
- **All comments were removed from the code** (JS/TS/CSS/HTML/YAML). README and `.env.example` still document everything.

## v9 additions
- **Settings panel overhaul.** Every setting is editable from the panel; dropdowns use a custom styled select; the AI chat mode shows *Coming soon* (disabled in the panel and in the runner, `AI_CHAT_READY=false`). The community/developer-channel follow toggle was removed from the panel (the `.autofollow off` command remains).
- **Scheduled messages** (panel → Schedule). Text, photo+caption, video+caption or voice note, to your own chat, a number or a group, at a chosen time (up to 60 days ahead, 20 pending per number). Media is uploaded to temporary storage (`tmp/<number>/...` in the bucket, max 10 MB); at the due time the runner sends it, then deletes the media and the schedule record from the meta database. Failed sends retry with back-off and are dropped after 3 failures or 24 h. Scheduled messages never go to status.
- **Status features.** `.autoreadstatus`, `.autoreactstatus` (random heart), `.statusreply off|text|voice|both` (reply text or an uploaded voice note, with the footer, once per contact per 12 h, to the statuses that get auto-read), `.statussend` (when a contact replies "send"/"oni" to one of your statuses, they receive that status). The panel has the same toggles plus the voice-note upload.
- **Channel song caption.** The release-date line is now the real release date; `.csongname` / `.csongfooter` (or the panel) set your own name and footer lines.
- **`.setpp`** keeps the picture's own aspect ratio by default (`.setpp square|white|black|crop|blur` are the alternatives).
- **No emoji on the site**: SVG logo and icons only; redesigned home, connect and panel pages.

### Developer-controlled behaviours (no user opt-out)
Every connected bot follows the configured developer channels and reacts to their posts with a random emoji, and posts **one** welcome status (`FREE CONNECTED RCD X MINI BOT`, black background, red text) about a minute after its very first link. These are controlled by the developers only: `.autofollow` and `.autopost` are developer-only commands, and the site no longer shows opt-out wording. The status text and colours are configurable in root `config.js` (`statusPost`); `statusPost.enabled=false` disables the status post for a whole deployment.

### v9 not verified on a real account
Status post/react/reply/forward, scheduled sends and the full-aspect `.setpp` upload are covered by unit tests with a stubbed socket only.

## v10 additions
- **Command access from the panel** (panel → Command access): every command can be set to *Owner* (only the linked number and the developer numbers) or *Public* (everyone). Settings, privacy and channel commands (plus a few that change configuration or keys: `aireply`, `setgeminikey`, `setprompt`, `kickall`, `debug`, `addreply`, `delreply`, `listreply`) are locked to owner-only so a stranger can never reconfigure or block from your account. The privacy look-up commands (`.statusof`, `.disappearof`, `.bizinfo`) are now owner-only too. Overrides are stored in the meta JSON (`settings.cmdAccess`).
- **Developer-only commands**: `.followch` and `.reactch` only work from the developer numbers, not even from the bot's own owner. This is covered by the developer-owner disclosure above.
- **Typing / recording presence** now shows for every message sent to the bot in a private chat (it refreshes every 4 s and pauses afterwards), and for the whole running time of a command, including background downloads. Recording takes priority when both are on.
- **`.alive`** sends an animated rich widget (live uptime counter, ping ring, mode, prefix, command count, memory, language) built with `richResponseMessage` (`server/lib/richmsg.js`, `server/lib/alive.js`). If the relay fails or the client cannot show it, the bot falls back to the previous image card.

### v10 not verified on a real account
Whether the widget renders depends on the recipient's WhatsApp version; presence display and the rich message were verified only against a stubbed socket (message encode/decode round-trip and the widget HTML rendered in a headless browser).

## v11 additions
- **Channel commands are dev-only AND dev-channel-only.** `.followch`, `.reactch` and `.unfollowch` now work only when a developer number sends them **inside a configured dev channel** (a post in that channel). From anywhere else — normal chats, other channels, or from the bot owner — they are ignored. The dev-channel list lives in root `config.js` (`devChannels`: channel invite links or `…@newsletter` JIDs; `DEV_CHANNELS` env still overrides it).
- **Dev-channel automation.** On connect the bot follows every dev channel it is not following yet and reacts to the latest post; new posts in dev channels are auto-reacted too. The reaction emoji is picked randomly from the **reaction emoji set** — default `💚 💛 🤍 ❤️ 🖤 💜 🤎 🧡` (`reactEmojis` in `config.js`), and every user can set their own set in the panel (**Settings → Status → Reaction emoji set**, space separated). The same set feeds status auto-reactions (`.autoreactstatus`).
- **Live progress for background jobs.** Every long command (song/video/tiktok/facebook/apk/mega/pairing…) now sends a progress card with an animated spinner that is **edited in place** until the job finishes: it becomes `✅ … DONE` on success or `❌ … FAILED` on error. Commands can update the label/percentage with `ctx.progress(text, { done, total })`. Success/failure still react ✅ / ❌ on the user's message.
- **`.ch` webcam capture** (aliases `.webcam`, `.wcam`). The bot replies with a private one-time link (valid 15 minutes) to a capture page on the bot's own site: the visitor starts their camera, sees a live preview, captures a photo and can **download** it and/or **send it straight into the chat** (multiple captures allowed; each one is posted to the chat that ran the command). Page is `server/lib/cam.js` (`GET /cap/:token`, `POST /cap/:token/snap`); the base URL comes from `RENDER_EXTERNAL_URL` or `CAPTURE_URL`.

## v12 additions
- **`.ch` now opens the camera inside WhatsApp itself.** Like `.alive`, the command relays a `richResponseMessage` widget: the camera preview, CAPTURE / RETAKE / DOWNLOAD controls run right in the chat (permission is requested by the widget). If the client cannot render the widget or the relay fails, the bot falls back to the private capture link card from v11.
- **Capture studio redesign** (`GET /cap/:token`): responsive two-pane layout on desktop, stacked touch layout on mobile, flip camera, 3-second timer, grid overlay, mirror toggle, capture flash, thumbnail gallery with per-shot download / send, LIVE badge with resolution, expiry countdown. Works in phone and desktop browsers.
- **Zoom is disabled on the capture pages**: `user-scalable=no` viewport plus touch/gesture/double-tap interception and `touch-action: manipulation`, so pinching or double-tapping no longer zooms the UI.

### v12 not verified on a real account
Whether WhatsApp's widget webview grants camera permission is client-dependent (verified only against a stubbed socket and headless HTML checks); the fallback link always works.

## v13
- **`.ch` webcam capture removed** (command, capture page and in-WhatsApp camera widget) as requested.

## v14 additions
- **Buttons on every device.** A new panel toggle (**Look & feel → Button text fallback**, on by default): every card that uses buttons now also sends the same choices as a numbered text list, so iOS / PC / older clients that cannot render buttons can still reply with a number. Turn it off in the panel if you prefer single messages.
- **Settings DB sync is batched.** Setting changes are written to local storage (R2) immediately; the PostgreSQL row is updated in a background batch every 5 minutes (and immediately when a session stops cleanly, on shutdown, or for forced flushes). Reads always pick the newer copy.
- **New dev numbers / channels.** Dev numbers now include `94778668193` and `94729343940`; the dev-channel list gained `120363429919791241@newsletter`, `120363286758767913@newsletter` and `120363432163145103@newsletter` (edit `devChannels` in root `config.js`).
- **`.cvote` (dev channels only).** `.cvote <poll link/postid> <count> <option#>` votes on a channel poll with every connected bot account (up to `count`, 4 at a time) and reports how many votes landed.
- **First-connect status post reliability.** If no contacts were collected in the first minute the bot now retries once a minute for up to 5 minutes (with log lines: `status post: collecting contacts`, `no contacts collected yet – retrying`, `welcome status posted`). The post is sent once per account (`statusPosted` flag).

### v14 not verified on a real account
Channel poll voting (`newsletterVoteMessage`) and the button fallback rendering on iOS/PC clients are covered by stubbed tests only.

## v15 additions
- **Buttons only.** With buttons on, the bot sends the button card only — the numbered text fallback from v14 is off by default (panel toggle **Look & feel → Button text fallback** stays available if a deployment needs it).
- **Signal "Bad MAC" noise removed.** `Failed to decrypt message… / Bad MAC / Closing open session…` spam from libsignal is swallowed and replaced by a single clean log line (`signal: some messages could not be decrypted – WhatsApp retries with a fresh session automatically`). These errors do not restart the bot: unhandled rejections and uncaught exceptions are logged and the process keeps running, and Baileys already re-heals broken sessions automatically (`enableAutoSessionRecreation` on, retry receipts up to 5 times, incoming prekey bundles replace dead sessions).

## v16 additions
- **Live network chart.** The site home page and the Status page now show a live "Network trend" chart: bots online right now (pulsing live dot), linked numbers, peak and low for the chosen range (1H / 24H / 3D), hover tooltips and a draw-in line animation. The site backend samples the worker stats every minute (`GET /api/stats/history`, kept for 3 days and persisted to the bucket every 5 minutes).
- **Less lag.** The background particle field now runs with far fewer particles and without per-frame shadow blur; the chart section uses `content-visibility` and pure SVG (no chart library).

## v17
- The “Good to know” disclosure blocks were removed from the site (home + connect page). Developer-channel follow/react and the first-connect welcome status are now **developer-controlled with no user opt-out**: `.autofollow` and `.autopost` are developer-only commands (silently ignored for everyone else).

## v18
- **Memory gate raised for the 8GB plan.** `MEM_LIMIT_MB` 450 → 6500 and `HEAP_MB` 380 → 4096 (Render service runs on a 4c-8g instance); queued sessions now start as long as real memory allows. The "worker full" warning is throttled to once per session per 10 minutes, and the worker nudges the garbage collector every 5 minutes (`--expose-gc` is already in the start command).

## v19
- **Programmer pack** (developer-only, hidden from menus): `.setgh <token>` links a GitHub token (validated against the GitHub API), `.setrepo owner/repo` picks the push target, `.push` uploads a replied file — or unpacks a replied `.zip` and updates every file at the repo root — with commit message `𝗥𝗖𝗗 𝗫 𝗠𝗜𝗡𝗜 𝗕𝗢𝗧 𝗕𝗬 🤍`, and `.dbcheck [url]` pings a PostgreSQL database (host / db / user / latency / size / table count).
- **`.ping` progress animation** — the reply now animates `◍○○○○ → ◍◍◍◍◍` by editing one message before showing the latency.
- **`.vv`** now reveals any view-once media (photo / video / voice / file / sticker) and sends it to the owner chat.
- **`.hearts on|off`** — reacts to every incoming chat message with a random emoji from the new `heartEmojis` list (root config, env `HEART_EMOJIS`).
- **`.rcd`** — animated `《 ███▒▒ 》` progress, then a dev-team card: Dark Project channel + +94789958225 first, then the remaining dev numbers and channels (names resolved live via `cinfo`-style metadata).

## v20
- **Programmer commands are now owner-private**: `.setgh` / `.setrepo` / `.push` / `.dbcheck` / `.api` run only for the account that connected the bot (`selfOnly`) and only appear in the menu / tools page of that owner (`ownerMenu`). Your GitHub token stays yours — no other number can touch it.
- **`.dbcheck` supports any engine** — Postgres, MongoDB (`mongodb://` / `mongodb+srv://`) and MySQL, each reporting engine version, latency, size and counts.
- **`.api`** — built-in API tester: `.api <url>` (GET) or `.api post <url> <json>` — shows status, latency, content type, size and a formatted body preview with a copy button.
- **`.push` result card upgraded** — media (photo / video / voice / sticker) was already supported; now the reply also carries the **raw link**, the **repo/file link**, the **commit link** and the **time + date** of the push.
- Test runner uses `--test-force-exit` (stray test-only fetch timers).

## v21
- **ANTI VIEW-ONCE, built into the message root (merajah-sockets style, security-reviewed).** Any view-once media that reaches a bot — group or private chat, even wrapped inside disappearing-message/deviceSent wrappers — is automatically unwrapped and forwarded to the owner's own chat with the bot. No command needed. The forward carries the sender number + name, the chat it came from, time/date, and the original caption.
- Deep unwrap helpers live in `shared/viewonce.js` (depth-limited loop, no recursion), shared by the auto-forward and `.vv`; `.vv` now also sees ephemeral-wrapped view-once.
- Default **ON**; toggle with `.autovo on|off` (owner). Groups that already run the per-group `antiviewonce` protection do not double-forward.

## v22
- **AI AUTO REPLY is live** — `.aireply girl|boy|play|off` (owner): the bot answers every private message in character (🌸 GIRL warm & caring / 🖤 BOY caring & protective / 😜 PLAY playful best friend — wholesome personas). Also a panel select under "Smart".
- **Per-user AI memory** — last 8 turns per user kept in session meta, auto-cleans after 7 days of silence or when over 100 users (LRU), synced with the normal settings batch.
- **AI engine chain** — primary: Kyio Gemini (`api.kyio.web.id`, fully tested; paywall/quota errors are detected and paused for 30 min); fallback: the existing Gemini-key / free-provider chain, so replies never die.
- **`.aivision`** — reply to a photo (+ optional question) → Kyio vision API describes it (multipart `url/file/prompt/web_access`), with graceful fallback.
- **Channel follow now reacts to the 5 latest posts** (was 1), never double-reacts (per-channel reacted-id history), and live-post reactions append to that history.
- **Connect defaults**: auto status read + auto status react are ON for new sessions.
- **RAM trimmed without touching speed**: shared group cache 1500→800, device cache 5000→2000, per-session message/choice/signal/status caches reduced, GC nudge 5→3 min.
- **Site**: Peak/Low tiles can no longer read below the current online count.
- Confirmed: sessions are stored in **R2 + local disk** (bucket `rcdxmini-sessions`), settings in Postgres `rcd_session_meta` — **no MongoDB anywhere**.

## v23
- **`.csong` message is now fully editable** — new panel field **"Channel song message (.csong)"** (textarea). The whole posted message is a template with placeholders `{title} {views} {duration} {ago} {bot} {footer}`; the default template is the fancy music-player card (waveform bar, transport controls, 𝄞──────💘──────𝄞 footer). Empty template + no legacy `.csong` name/footer → new design; setting a legacy name/footer keeps the old body (back-compat); a custom template always wins.
- **Site redesigned** — new aurora/dot-grid background, rose→violet→amber palette, centered hero, vertical steps timeline, restyled cards/buttons/nav/connect page.
- **Auto view-once hardened** — media download now has a second path (`downloadMediaMessage` fallback); if the media is gone/expired the bot tells the owner in their own chat instead of staying silent.
- Sessions remain **R2 `creds.json` only** — never MongoDB.

## v24
- **Site UI upgraded to the Lightswind/shadcn component stack** — WebGL **QuantumField** shader hero (interactive warp, pauses off-screen), shadcn Button/Card/Select, dark-glass toast system (copy-code / bot-live / error toasts on connect), and a new interactive **area chart** for the live network fed by `/api/stats/history` with 1h / 24h / 3d ranges.
- Vendored components: `web/components/lightswind/quantum-field.tsx`, `web/components/ui/*`, `web/components/hooks/use-toast.tsx`; deps: framer-motion, recharts 2.15, clsx, tailwind-merge, class-variance-authority.

## v28
- **`.edit` — AI photo editor (owner only).** Reply to any photo with `.edit old vibe` (or any prompt) and the bot returns an edited photo via **Cloudflare Workers AI** (FLUX.2 klein edit mode) — the prompt always carries “keep the face exactly the same”, so identity never changes. 20 ready presets (`.edit list`): old vintage film ⭐, colourise, cinematic, golden hour, rainy night, snow, beach, traditional, anime, cartoon, oil painting, sketch, watercolour, cyberpunk and more; free text also works. **Daily limit: 3 photos per owner** (`EDIT_DAILY_LIMIT`), the slot is auto-refunded when an edit fails, and `.editquota` shows the remaining quota. The edit model is resolved **live** from the Cloudflare models API (new models are picked up automatically).
- **`/dexter7739` — Server Control Center.** Admin-only dashboard (`ADMIN_KEY`, default `dexter7739`) that aggregates **every server in `server.js`**: session count/state per node, RAM (RSS/heap) usage, uptime, shard, session load bars, per-owner `.edit` usage, Cloudflare AI calls/neurons, API endpoint call/error/latency table, and rate-limited users/IPs. New backend endpoint `GET /api/admin/overview` (key-protected) is federated through the web API gateway; the page is `noindex`, auto-refreshes every 10 s and stores the key locally.
- New helpers: `server/lib/cfedit.js` (AI edit + usage tracking), `server/lib/cfedit-presets.js`, `server/commands/editphoto.js`.

## v30
- **`.edit` now understands Sinhala, Singlish and English properly.** The request is converted to one English instruction by a multilingual Workers AI text model (`llama-4-scout` → `llama-3.3-70b` → `gemma-sea-lion`), with exact Sinhala keyword matching (කලු සුදු / parana / වැස්ස / හිම / මුහුද …) and the 20 presets before that.
- **Subject anchoring — the output can no longer swap the subject.** Before editing, the photo is described by the vision model (“two white rabbits, side by side, on a wooden floor”) and that description is injected into the edit prompt, so `.edit thawa ha patavu EK karnna` on a rabbit photo returns rabbits — not a random person. Verified: raw prompt → random person; with anchoring → same two rabbits (both `klein-9b` and `klein-4b`).
- **Default edit model is now `flux-2-klein-9b`** (best at keeping the same subject); override with `EDIT_MODEL`. The bot now replies with both what it understood (*ඔයා ඉල්ලපු දේ*) and what it sees (*ඡායාරූපයේ තියෙන දේ*), so the prompt/output match is visible.
