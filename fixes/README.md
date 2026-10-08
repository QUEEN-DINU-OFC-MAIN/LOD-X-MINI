# 🧰 Fixes — How to apply

All fixes are **drop-in modules**. Add them to your real codebase (`site/index.js` + co).

## Files
| File | Fixes | How to apply |
|---|---|---|
| `domain-redirect.js` | herokuapp.com → rcdxmini.dexterid.org (301) | `const domainRedirect = require('./fixes/domain-redirect'); domainRedirect(app);` — **first**, before routes |
| `postgres.js` | `Invalid URL` + **auto-create tables** | `const pg = require('./fixes/postgres'); await pg.initPostgres(); app.locals.db = pg;` + `npm install pg` |
| `stats-sampler.js` | TLS alert 40 + retry, never crash | `const { startStatsSampler } = require('./fixes/stats-sampler'); startStatsSampler({ peerUrl: process.env.PEER_STATS_URL, db: pg });` |
| `log-stream.js` | Auto-scroll live output in panel | `const { streamLogs, capture } = require('./fixes/log-stream'); streamLogs(app);` + tee `console.log` into `capture` + EventSource snippet (in file header) |
| `keepalive.js` | `/healthz`, no-crash safety nets, self-ping | `require('./fixes/keepalive').installSafetyNets(); addHealthRoute(app); startSelfPing();` |

## Minimal integration into `site/index.js`
```js
const express = require('express');
const app = express();

const domainRedirect = require('./fixes/domain-redirect');
const { installSafetyNets, addHealthRoute, startSelfPing } = require('./fixes/keepalive');
const { streamLogs, capture } = require('./fixes/log-stream');
const pg = require('./fixes/postgres');
const { startStatsSampler } = require('./fixes/stats-sampler');

installSafetyNets();          // never exit on stray errors
domainRedirect(app);          // 301 herokuapp.com → rcdxmini.dexterid.org
addHealthRoute(app);          // /healthz
streamLogs(app);              // GET /api/logs/stream (SSE, auto-scroll)

// tee console output to the panel's live view
const origLog = console.log;
console.log = (...a) => { origLog(...a); capture(a.map(String).join(' ')); };

// ... your existing routes ...

(async () => {
  await pg.initPostgres();                 // auto-creates tables
  app.locals.db = pg;
  startStatsSampler({ peerUrl: process.env.PEER_STATS_URL, db: pg });
  startSelfPing();

  const PORT = process.env.PORT || 27759;
  app.listen(PORT, '0.0.0.0', () => console.log(`🌐 SITE listening on :${PORT}`));
})();
```

## Dependencies
```bash
npm install pg        # postgres.js only — everything else is dependency-free
```
