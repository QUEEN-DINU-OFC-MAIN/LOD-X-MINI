/**
 * fixes/stats-sampler.js
 * Cluster stats sampler with TLS FIX + retry — never crashes the app.
 *
 * Fixes: "stats history sample failed err=write EPROTO ... ssl/tls alert
 *        handshake failure ... SSL alert number 40"
 *
 * WHY alert 40 happened (pick the one that matches your code):
 *  1. Custom https.Agent with secureProtocol/minVersion 'TLSv1' or old ciphers
 *     → modern servers require TLS 1.2+  → REMOVE those options (use defaults)
 *  2. Connecting to the other node by IP → no SNI → Heroku/Cloudflare rejects
 *     → ALWAYS use the full https://hostname URL (SNI is set automatically)
 *  3. Remote node was asleep/down at sample time → retry + skip
 *
 * Usage:
 *   const { sampleStats, startStatsSampler } = require('./fixes/stats-sampler');
 *   startStatsSampler({ peerUrl: process.env.PEER_STATS_URL, db: app.locals.db });
 */

/** One sample attempt — global fetch (Node 20) uses modern TLS by default. */
async function sampleOnce(peerUrl, timeoutMs = 8000) {
  const url = new URL('/api/stats', peerUrl); // hostname → SNI ✅
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'application/json' },
    // NOTE: no custom agent, no secureProtocol, no ciphers → TLS 1.2/1.3 ✅
  });
  if (!res.ok) throw new Error(`peer responded ${res.status}`);
  return res.json();
}

/** Sample with 3 retries + exponential backoff. Throws on final failure. */
async function sampleStats(peerUrl, timeoutMs = 8000) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await sampleOnce(peerUrl, timeoutMs);
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw lastErr;
}

/**
 * Start the periodic sampler. NEVER lets an error escape or exit the process.
 *   peerUrl : e.g. process.env.PEER_STATS_URL = 'https://server2.example.com'
 *   db      : the postgres module (fixes/postgres.js) — stats saved to stats_history
 */
function startStatsSampler({ peerUrl, db, intervalMs = 15_000, logger = console, serverName = process.env.DYNO || 'web.1' } = {}) {
  if (!peerUrl) {
    logger.warn('🟡 stats sampler disabled (PEER_STATS_URL not set)');
    return null;
  }

  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const s = await sampleStats(peerUrl);
      if (db && db.isReady && db.isReady()) {
        await db.addStatsSample({
          server: serverName,
          live: s.live ?? 0,
          paired: s.paired ?? 0,
          samples: s.samples ?? 0,
        });
      }
      logger.log(`🟢 stats sample ok: live=${s.live ?? '?'} paired=${s.paired ?? '?'}`);
    } catch (e) {
      // 🟡 logged, retried, and IGNORED — the site keeps running
      logger.warn(`🟡 stats history sample failed err=${e.message}`);
    } finally {
      if (!stopped) setTimeout(tick, intervalMs);
    }
  };

  setTimeout(tick, 5_000); // first sample after boot
  logger.log(`🟢 stats sampler started → ${peerUrl} every ${intervalMs / 1000}s`);
  return { stop: () => { stopped = true; } };
}

module.exports = { sampleStats, sampleOnce, startStatsSampler };
