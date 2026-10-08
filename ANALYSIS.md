# 🔍 LOD-X-MINI / RCD X MINI — Heroku Log Analysis & Fix Report
**App:** `lod-x-mini-973b0448a8cc.herokuapp.com` → `rcdxmini.dexterid.org`
**Process:** `web: node site/index.js` · **Date:** 2026-10-09

---

## 📜 Log Timeline (what happened)

| Time (UTC) | Log | Meaning |
|---|---|---|
| 10-07 23:14:39 | `web.1: Idling` → `State changed from up to down` | Dyno stopped by Heroku (idle timeout / dyno cycle) |
| 10-07 23:14:41 | `🟡 stats history sample failed err=write EPROTO ... ssl/tls alert handshake failure ... SSL alert number 40` | Outbound HTTPS (cluster stats sync) TLS handshake rejected |
| 10-07 23:14:41 | `▫️ shutting down` → `SIGTERM` → `Process exited with status 0` | Graceful shutdown (exit 0 = clean) |
| 10-08 05:56 / 06:56 | `app[api]: Log session created by user dinu21834@gmail.com` | Dashboard log-drain sessions |
| 10-08 19:12:49 | `web.1: State changed from down to starting` | Dyno restart |
| 10-08 19:12:58 | `Starting process with command node site/index.js` | Boot |
| 10-08 19:12:59 | `storage: Cloudflare R2 bucket=danu` | ✅ R2 env vars OK |
| 10-08 19:12:59 | `storage: session encryption ON (AES-256-GCM)` | ✅ SESSION_SECRET OK |
| 10-08 19:12:59 | `🔴 PostgreSQL unavailable – settings stay in R2 err=Invalid URL` | 🔴 **ERROR 1** |
| 10-08 19:12:59 | `🌐 SITE listening on :27759` | ✅ Web up (verify `0.0.0.0` + `process.env.PORT`) |

---

## 🔴 ERROR 1 — `PostgreSQL unavailable – settings stay in R2 err=Invalid URL`

**Root cause:** `process.env.DATABASE_URL` is **missing or malformed**. The code does
`new URL(process.env.DATABASE_URL)` (or `new Client(url)`) → throws `TypeError: Invalid URL`.

- If **no Postgres add-on** is attached → `DATABASE_URL` is `undefined` → "Invalid URL".
- If set manually with a typo (missing `postgres://` scheme, quotes, spaces) → same error.

**Impact:** Settings fall back to R2 only; no durable relational store; the
"Connected-bots trend" stats history (1441 samples) has no persistent home.

**Fix:**
1. Attach Postgres (sets `DATABASE_URL` automatically):
   `heroku addons:create heroku-postgresql:essential-0`
2. Code: validate URL → connect with `ssl: { rejectUnauthorized: false }`
   (Heroku PG uses self-signed certs) → **auto-create tables** on boot.
3. See `fixes/postgres.js` — drop-in module with `CREATE TABLE IF NOT EXISTS`
   for `users`, `settings`, `sessions`, `stats_history`.

---

## 🟡 ERROR 2 — `stats history sample failed ... SSL alert number 40`

`write EPROTO ... ssl3_read_bytes:ssl/tls alert handshake failure ... SSL alert number 40`

The app samples stats from the **other cluster node** (Server 01 ↔ Server 02) over
HTTPS and the remote endpoint **rejects the TLS handshake** (alert 40 = handshake_failure).

**Likely causes (in order):**
1. **Old TLS forced in code** — custom `https.Agent` with `secureProtocol: 'TLSv1_method'`,
   `minVersion: 'TLSv1'`, or legacy `ciphers` → modern server (Heroku/Cloudflare) requires TLS 1.2+ → alert 40.
2. **No SNI** — connecting to the other node **by IP** instead of hostname.
   Heroku's router **requires SNI** for HTTPS; IP-based TLS fails.
3. **ALPN mismatch** (h2 vs http/1.1).
4. Remote node down/idling at sample time.

**Fix:** use the **default** Node 20 TLS agent (TLS 1.2 min / 1.3 preferred), always
connect via **full hostname** (SNI automatic), never override `secureProtocol`/`ciphers`,
add `AbortSignal.timeout()`, **retry 3× with backoff**, and **catch + log — never crash**.
See `fixes/stats-sampler.js`.

---

## ⚠️ ERROR 3 — `Idling` / `up → down` / `exit 0`

- `Idling` + SIGTERM + `exit 0` = **Heroku stopped the dyno** (eco/free dyno sleeps after
  ~30 min without inbound traffic, or dyno cycle). The app's own `shutting down` handler
  ran correctly — **that part is fine**.
- Risk: while asleep, the WhatsApp session drops; cold start on next request.
- The stats TLS error at the same second is a **separate** issue — but if any sampler
  throws an **unhandled rejection**, it can trigger early exit. Guard it.

**Fix:**
- Add `/healthz` (200 OK) → `fixes/keepalive.js`
- Keep-alive pinger (UptimeRobot / cron dyno pinging `/healthz` every 5–10 min)
- `process.on('unhandledRejection' / 'uncaughtException')` → **log, don't exit**
- Bind `0.0.0.0` + use `process.env.PORT`
- ⚠️ For a **24/7 WhatsApp bot**, eco dynos (idle) are risky → use **hobby ($7) / basic** dyno.

---

## ✅ Boot checks (2026-10-08 19:12:59)

| Check | Status |
|---|---|
| Cloudflare R2 (`bucket=danu`) | ✅ env vars present |
| Session encryption AES-256-GCM | ✅ `SESSION_SECRET` present |
| PostgreSQL | 🔴 fix (Error 1) |
| `SITE listening on :27759` | ✅ but confirm `0.0.0.0` binding + `PORT` env |

---

## 🎯 Requested features → fixes

| Request | Fix file |
|---|---|
| Auto-scroll with output (live console in panel) | `fixes/log-stream.js` (SSE + auto-scroll client) |
| PostgreSQL table auto-create (+ related) | `fixes/postgres.js` |
| herokuapp.com → auto-redirect to `rcdxmini.dexterid.org` | `fixes/domain-redirect.js` |
| Never crash on stats errors / keep alive | `fixes/keepalive.js` + `fixes/stats-sampler.js` |
| Deploy/run on Heroku | `fixes/HEROKU-DEPLOY.md` |

---

## 🚀 Deploy (quick)

```bash
heroku login
heroku git:remote -a lod-x-mini-973b0448a8cc
heroku addons:create heroku-postgresql:essential-0   # sets DATABASE_URL
heroku config:set SESSION_SECRET="$(openssl rand -hex 32)" NODE_ENV=production
heroku domains:add rcdxmini.dexterid.org            # then CNAME in DNS
git push heroku main
heroku ps:scale web=1
heroku logs --tail
```

Full details: `fixes/HEROKU-DEPLOY.md`
