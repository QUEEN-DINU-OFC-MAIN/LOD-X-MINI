import PQueue from 'p-queue';
import { makeOwns } from '../shared/shard.js';
import { BoundedCache } from '../shared/cache.js';
import { PairingManager } from '../site/pairing.js';
import { SessionRunner } from './runner.js';

const rssMb = () => Math.round(process.memoryUsage().rss / 1048576);

export class SessionManager {
    constructor({ store, cfg, log, commands, runnerFactory }) {
        this.store = store; this.cfg = cfg; this.log = log;
        this.owns = makeOwns(cfg.worker.shardIndex, cfg.worker.shardCount);
        this.runners = new Map();
        this.pending = new Set();
        this.platform = {
            cfg: cfg.worker, commands, store, sessionCount: () => this.runners.size, runners: this.runners,
            cmdQueue: new PQueue({ concurrency: cfg.worker.cmdConcurrency }),
            groupCache: new BoundedCache({ max: 800, ttlMs: 5 * 60_000, shared: true }),
            devicesCache: new BoundedCache({ max: 2000, ttlMs: 5 * 60_000, shared: true })
        };
        this.platform.pairing = new PairingManager({ store, cfg: { ...cfg, site: { ...cfg.site, maxPairings: cfg.worker.maxPairings } }, log });
        this.platform.dlQueue = new PQueue({ concurrency: cfg.worker.downloadSlots });
        this.startQ = new PQueue({ concurrency: cfg.worker.startConcurrency, interval: cfg.worker.startDelayMs, intervalCap: 1 });
        this.makeRunner = runnerFactory || ((id) => new SessionRunner(id, { store, cfg, log, platform: this.platform }));
        this.timers = []; this.closing = false;
        this.fullWarned = new Map();
        const gcTimer = setInterval(() => { try { globalThis.gc?.(); } catch { } }, 3 * 60_000);
        gcTimer.unref?.(); this.timers.push(gcTimer);
    }

    capacity() {
        const w = this.cfg.worker;
        if (this.runners.size >= w.maxSessions) return `max sessions (${w.maxSessions})`;
        if (rssMb() > w.memLimitMb * 0.9) return `memory ${rssMb()}MB > 90% of ${w.memLimitMb}MB`;
        return null;
    }

    enqueue(id, { restart = false } = {}) {
        if (this.closing || !this.owns(id) || this.pending.has(id)) return false;
        const existing = this.runners.get(id);
        if (existing && !restart) {
            if (existing.state !== 'dead') return false;
        }
        if (!existing) {
            const full = this.capacity();
            if (full) {
                const last = this.fullWarned.get(id) || 0;
                if (Date.now() - last > 10 * 60_000) {
                    this.fullWarned.set(id, Date.now());
                    this.log.warn({ id, reason: full }, 'worker full – session stays queued (scale workers / raise MAX_SESSIONS)');
                }
                return false;
            }
        }
        this.pending.add(id);
        this.startQ.add(async () => {
            try {
                if (this.closing) return;
                const old = this.runners.get(id);
                if (old) { await old.stop({ flush: false }).catch(() => {}); this.runners.delete(id); }
                const r = this.makeRunner(id);
                r.onRemoved = (rid) => this.runners.delete(rid);
                this.runners.set(id, r);
                await r.start();
                this.log.info({ id, running: this.runners.size }, 'session started');
            } catch (e) {
                this.log.error({ id, err: e.message }, 'session start failed');
                this.runners.delete(id);
            } finally { this.pending.delete(id); }
        });
        return true;
    }

    async boot() {
        const ids = (await this.store.listSessionIds()).filter(this.owns).sort();
        this.log.info({ total: ids.length, shard: `${this.cfg.worker.shardIndex + 1}/${this.cfg.worker.shardCount}` }, 'boot: sessions owned by this worker');
        for (const id of ids) this.enqueue(id);
        this.timers.push(setInterval(() => this.pollQueue().catch((e) => this.log.error({ err: e.message }, 'queue poll')), this.cfg.worker.pollMs));
        this.timers.push(setInterval(() => this.reconcile().catch((e) => this.log.error({ err: e.message }, 'reconcile')), this.cfg.worker.reconcileMs));
        this.timers.push(setInterval(() => this.logStats(), this.cfg.worker.statsMs));
        const beat = () => this.store.putStats(this.cfg.worker.shardIndex, { ...this.stats(), shard: this.cfg.worker.shardIndex, maxSessions: this.cfg.worker.maxSessions, at: Date.now() }).catch((e) => this.log.warn({ err: e.message }, 'heartbeat'));
        beat();
        this.timers.push(setInterval(beat, 30_000));
    }

    async pollQueue() {
        if (this.closing) return;
        for (const id of await this.store.listQueue()) {
            if (!this.owns(id)) continue;
            const had = this.runners.has(id);
            if (this.enqueue(id, { restart: had })) {
                this.log.info({ id, relink: had }, 'queue: new session accepted');
                await this.store.dequeue(id).catch(() => {});
            } else if (this.runners.get(id)?.state === 'dead' || this.pending.has(id)) {
                await this.store.dequeue(id).catch(() => {});
            }
        }
    }

    async reconcile() {
        if (this.closing) return;
        for (const id of (await this.store.listSessionIds()).filter(this.owns)) {
            const r = this.runners.get(id);
            if (!r) { this.enqueue(id); continue; }
            if (r.state === 'dead' && !r.terminalDead && !this.pending.has(id)) {
                this.log.warn({ id, reason: r.deadReason || 'unknown' }, 'reconcile: recovering dead session');
                this.enqueue(id, { restart: true });
            }
        }
    }

    stats() {
        const by = {};
        for (const r of this.runners.values()) by[r.state] = (by[r.state] || 0) + 1;
        const mem = process.memoryUsage();
        return { sessions: this.runners.size, states: by, queuedStarts: this.startQ.size + this.startQ.pending, rssMb: rssMb(), heapMb: Math.round(mem.heapUsed / 1048576), perSessionMb: this.runners.size ? +(mem.rss / 1048576 / this.runners.size).toFixed(1) : 0 };
    }
    logStats() { this.relieveMemory(); this.log.info(this.stats(), 'stats'); }

    relieveMemory() {
        const w = this.cfg.worker;
        const rss = rssMb();
        if (rss < w.memLimitMb * 0.8) return false;
        const dropped = this.platform.groupCache.size + this.platform.devicesCache.size;
        this.platform.groupCache.flushAll();
        this.platform.devicesCache.flushAll();
        try { globalThis.gc?.(); } catch {  }
        this.log.warn({ rssMb: rss, limitMb: w.memLimitMb, dropped, sessions: this.runners.size }, 'memory pressure – shared caches dropped');
        return true;
    }

    async shutdown() {
        this.closing = true;
        this.timers.forEach(clearInterval);
        await this.platform.pairing.shutdown().catch(() => {});
        this.startQ.clear();
        const budget = this.cfg.worker.shutdownBudgetMs;
        const t0 = Date.now();
        this.log.info({ sessions: this.runners.size, budgetMs: budget }, 'shutdown: flushing sessions to storage');
        const q = new PQueue({ concurrency: 25 });
        let done = 0;
        const all = [...this.runners.values()].map((r) => q.add(async () => { await r.stop({ flush: true }); done++; }));
        await Promise.race([Promise.allSettled(all), new Promise((res) => setTimeout(res, budget))]);
        this.log.info({ flushed: done, total: this.runners.size, ms: Date.now() - t0 }, 'shutdown complete');
    }
}
