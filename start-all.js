import { createLogger } from './shared/log.js';
import { loadConfig } from './shared/config.js';
import { installSignalQuiet } from './shared/signal-quiet.js';
import { createSite } from './site/index.js';




const cfg = loadConfig();
const log = createLogger({ level: cfg.worker.logLevel });
installSignalQuiet(log);
const { app, pairing, store } = await createSite({ cfg, log });
const server = app.listen(cfg.site.port, '0.0.0.0', () => log.info({ port: cfg.site.port }, 'pairing site up'));
process.on('SIGTERM', () => { pairing.shutdown().catch(() => {}); store.flushPg?.().catch(() => {}); server.close(); });

await import('./server/index.js');

const self = process.env.RENDER_EXTERNAL_URL || process.env.KEEPALIVE_URL;
if (self && process.env.KEEPALIVE !== 'off') setInterval(() => fetch(`${self}/healthz`, { signal: AbortSignal.timeout(10_000) }).catch(() => {}), 9 * 60_000).unref();
