/**
 * fixes/keepalive.js
 * 1) /healthz endpoint for keep-alive pingers (UptimeRobot, cron dyno, etc.)
 * 2) Safety nets: log unhandled errors instead of exiting (fixes random "exit 0"/crashes)
 * 3) Optional self-ping (set SELF_PING_URL to keep an eco dyno awake)
 *
 * Usage (site/index.js, near the top):
 *   require('./fixes/keepalive').installSafetyNets();
 *   const { addHealthRoute, startSelfPing } = require('./fixes/keepalive');
 *   addHealthRoute(app);
 *   startSelfPing();
 */

function installSafetyNets(logger = console) {
  // Never let a stray rejection/exception kill the web process
  process.on('unhandledRejection', (e) => {
    logger.error('🟡 unhandledRejection (ignored):', e && e.message ? e.message : e);
  });
  process.on('uncaughtException', (e) => {
    logger.error('🟡 uncaughtException (ignored):', e && e.message ? e.message : e);
  });
}

function addHealthRoute(app) {
  app.get('/healthz', (req, res) => res.status(200).type('text').send('ok'));
}

/** Ping SELF_PING_URL every 10 min (default: this app's /healthz) */
function startSelfPing({ url = process.env.SELF_PING_URL, intervalMs = 10 * 60_000, logger = console } = {}) {
  if (!url) return null;
  const timer = setInterval(async () => {
    try {
      await fetch(url, { signal: AbortSignal.timeout(8000) });
    } catch (e) {
      logger.warn(`🟡 self-ping failed: ${e.message}`);
    }
  }, intervalMs);
  timer.unref?.();
  logger.log(`🟢 self-ping every ${intervalMs / 60000} min → ${url}`);
  return timer;
}

module.exports = { installSafetyNets, addHealthRoute, startSelfPing };
