import v8 from 'node:v8';
import { createLogger } from '../shared/log.js';
import { loadConfig } from '../shared/config.js';
import { installSignalQuiet } from '../shared/signal-quiet.js';
import { createStorage } from '../shared/storage.js';
import { MetaDb } from '../shared/meta-db.js';
import { SessionStore } from '../shared/session-store.js';
import { loadCommands } from './commands/index.js';
import { SessionManager } from './manager.js';
import { CATS, checkCategoryImages } from './lib/ui.js';

const cfg = loadConfig();
const log = createLogger({ level: cfg.worker.logLevel });
installSignalQuiet(log);
const store = new SessionStore(await createStorage(cfg, log), await MetaDb.open(cfg.databaseUrl, log).catch((e) => { log.error({ err: e.message }, 'PostgreSQL unavailable – settings stay in R2'); return null; }), log);
const manager = new SessionManager({ store, cfg, log, commands: await loadCommands() });
globalThis.__rcdManager = manager;

log.info({ shard: cfg.worker.shardIndex, of: cfg.worker.shardCount, maxSessions: cfg.worker.maxSessions, memLimitMb: cfg.worker.memLimitMb, heapLimitMb: Math.round(v8.getHeapStatistics().heap_size_limit / 1048576) }, 'worker starting');
if (v8.getHeapStatistics().heap_size_limit > cfg.worker.memLimitMb * 2 * 1048576) {
    log.warn({ heapLimitMb: Math.round(v8.getHeapStatistics().heap_size_limit / 1048576), memLimitMb: cfg.worker.memLimitMb }, 'V8 heap limit is far above MEM_LIMIT_MB – V8 will not collect until RSS is huge. Lower HEAP_MB.');
}
await manager.boot();

const imgIssues = checkCategoryImages(CATS.map(([k]) => k));
if (imgIssues.length) log.warn({ issues: imgIssues }, 'menu category images misconfigured');
else log.info({ categories: CATS.length }, 'menu category images OK');

let stopping = false;
const stop = async (sig) => {
    if (stopping) return; stopping = true;
    log.info({ sig }, 'signal received');
    await manager.shutdown();
    process.exit(0);
};
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
if (typeof globalThis.gc === 'function') setInterval(() => { try { globalThis.gc(); } catch {  } }, 45_000).unref();
process.on('unhandledRejection', (e) => log.error({ err: String(e?.stack || e) }, 'unhandledRejection'));
process.on('uncaughtException', (e) => log.error({ err: String(e?.stack || e) }, 'uncaughtException'));
