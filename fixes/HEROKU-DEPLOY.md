# 🚀 Heroku Deploy Guide — RCD X MINI (`lod-x-mini-973b0448a8cc`)

## 1. Prerequisites
```bash
# Node 20 on Heroku (matches local v20.20.2)
heroku config:set NODE_VERSION=20

# PostgreSQL — sets DATABASE_URL automatically (fixes "Invalid URL")
heroku addons:create heroku-postgresql:essential-0
# if essential-0 is not listed:  heroku addons:plans heroku-postgresql

# App config vars
heroku config:set NODE_ENV=production
heroku config:set SESSION_SECRET="$(openssl rand -hex 32)"
heroku config:set PUBLIC_URL="https://rcdxmini.dexterid.org"

# Cloudflare R2 (already working — keep as-is)
# R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET=danu

# Cluster stats (fixes TLS alert 40 — use the OTHER server's https hostname!)
heroku config:set PEER_STATS_URL="https://<other-server-hostname>/"

# Optional: self keep-alive (eco dynos idle after 30 min)
heroku config:set SELF_PING_URL="https://lod-x-mini-973b0448a8cc.herokuapp.com/healthz"
```

## 2. Custom domain (rcdxmini.dexterid.org)
```bash
heroku domains:add rcdxmini.dexterid.org
heroku domains            # copy the "DNS Target"
# DNS: CNAME  rcdxmini  ->  <DNS Target>
# The fixes/domain-redirect.js middleware 301-redirects herokuapp.com → custom domain
```

## 3. Deploy
```bash
# Option A — Heroku git
heroku git:remote -a lod-x-mini-973b0448a8cc
git push heroku main

# Option B — GitHub auto-deploy (Heroku dashboard → Deploy → GitHub
# → connect QUEEN-DINU-OFC-MAIN/LOD-X-MINI → enable automatic deploys)
```

## 4. Scale & verify
```bash
heroku ps:scale web=1
heroku logs --tail
curl -s https://lod-x-mini-973b0448a8cc.herokuapp.com/healthz        # → ok
curl -sI https://lod-x-mini-973b0448a8cc.herokuapp.com/ | head -3   # → 301 to rcdxmini.dexterid.org
```

## 5. ⚠️ Dyno tier warning
- **Eco dynos idle** after ~30 min without traffic → WhatsApp session drops, cold starts.
- For a **24/7 bot**, use at least a **hobby ($7/mo)** or **basic** dyno, or keep
  `SELF_PING_URL` + UptimeRobot on `/healthz`.

## 6. Procfile (should already exist)
```
web: node site/index.js
```

## 7. After deploy — confirm fixes in logs
```
🟢 PostgreSQL connected – tables auto-created      ← Error 1 fixed
🟢 stats sampler started → https://... every 15s  ← Error 2 fixed
↪️  redirect *.herokuapp.com → https://rcdxmini.dexterid.org  ← redirect fixed
```
