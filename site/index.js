import express from 'express';
import path from 'node:path';
import { MetaDb } from '../shared/meta-db.js';
import { createLogger } from '../shared/log.js';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../shared/config.js';
import { createStorage } from '../shared/storage.js';
import { SessionStore } from '../shared/session-store.js';
import { PairingManager } from './pairing.js';
import { mountPanel } from './panel.js';
import { editUsageMap, editStats, cfUsageSummary, EDIT_DAILY_LIMIT } from '../server/lib/cfedit.js';
import appConfig from '../config.js';
import { uploadToImgbb } from '../server/lib/dp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createSite({ cfg = loadConfig(), storage, log = createLogger({ level: 'info' }) } = {}) {
    storage ??= await createStorage(cfg, log);
    const store = new SessionStore(storage, await MetaDb.open(cfg.databaseUrl, log).catch((e) => { log.error({ err: e.message }, 'PostgreSQL unavailable – settings stay in R2'); return null; }), log);
    const pairing = new PairingManager({ store, cfg, log });

    const app = express();
    app.set('trust proxy', true);
    app.disable('x-powered-by');
    const jsonSmall = express.json({ limit: '64kb' });
    const jsonUpload = express.json({ limit: '12mb' });
    app.use((req, res, next) => (req.path === '/api/fulldp/upload' ? next() : jsonSmall(req, res, next)));
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Cache-Control', 'no-store');
        next();
    });

    const hits = new Map();
    const blocked = new Map();
    const apiRoutes = new Map();
    setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (v.every((t) => n - t > 600_000)) hits.delete(k); }, 60_000).unref();
    setInterval(() => { const c = Date.now() - 86_400_000; for (const [k, v] of blocked) { const f = v.filter((x) => x.at > c); f.length ? blocked.set(k, f) : blocked.delete(k); } }, 600_000).unref();
    const limited = (ip) => {
        const n = Date.now();
        const arr = (hits.get(ip) || []).filter((t) => n - t < 600_000);
        if (arr.length >= cfg.site.linksPerIpPer10Min) {
            hits.set(ip, arr);
            blocked.set(ip, [...(blocked.get(ip) || []).filter((x) => n - x.at < 86_400_000), { at: n, path: 'POST /api/link' }]);
            return true;
        }
        arr.push(n); hits.set(ip, arr); return false;
    };
    app.use((req, res, next) => {
        if (!req.path.startsWith('/api/')) return next();
        const key = `${req.method} ${req.path.replace(/\/[a-f0-9]{32}$/, '/:token').replace(/(\/api\/panel\/)[a-z-]+/, '$1*')}`;
        const e = apiRoutes.get(key) || { calls: 0, errors: 0, msTotal: 0 };
        const t0 = Date.now();
        e.calls += 1;
        res.on('finish', () => {
            e.msTotal += Date.now() - t0;
            if (res.statusCode >= 400) e.errors += 1;
            apiRoutes.set(key, e);
        });
        next();
    });

    app.get('/healthz', (_q, r) => r.json({ ok: true, activePairings: pairing.active }));
    app.get('/api/config', (_q, r) => r.json({ brand: cfg.site.brand, prefix: cfg.site.prefix }));

    let statsCache = { at: 0, v: null };
    const computeStats = async () => {
        if (Date.now() - statsCache.at > 15_000) {
            const [beats, total] = await Promise.all([store.listStats(), store.listSessionIds().then((a) => a.length).catch(() => null)]);
            const fresh = beats.filter((b) => Date.now() - b.at < 120_000);
            const sum = (f) => fresh.reduce((n, b) => n + (f(b) || 0), 0);
            statsCache = { at: Date.now(), v: {
                brand: cfg.site.brand, totalSessions: total, workersOnline: fresh.length,
                connected: sum((b) => b.states?.open), reconnecting: sum((b) => (b.states?.backoff || 0) + (b.states?.starting || 0)),
                dead: sum((b) => b.states?.dead), starting: sum((b) => b.states?.starting), backoff: sum((b) => b.states?.backoff),
                capacity: sum((b) => b.maxSessions), rssMb: sum((b) => b.rssMb), at: Date.now()
            } };
        }
        return statsCache.v;
    };
    app.get('/api/stats', async (_q, res) => {
        try {
            res.setHeader('Cache-Control', 'public, max-age=10');
            res.json(await computeStats());
        } catch (e) { log.error({ err: e.message }, 'stats'); res.status(500).json({ error: 'unavailable' }); }
    });

    const HISTORY_KEY = 'stats/history.json';
    const HIST_MAX_MS = 3 * 86_400_000;
    let hist = [];
    try {
        const b = await storage.get(HISTORY_KEY);
        if (b) hist = JSON.parse(b.toString('utf8')).filter((p) => p && typeof p.t === 'number' && Date.now() - p.t < HIST_MAX_MS);
    } catch { hist = []; }
    setInterval(async () => {
        try {
            const s = await computeStats();
            if (!s) return;
            hist.push({ t: Date.now(), on: s.connected, re: s.reconnecting, tot: s.totalSessions ?? 0 });
            const cut = Date.now() - HIST_MAX_MS;
            while (hist.length && hist[0].t < cut) hist.shift();
            if (hist.length % 5 === 0) await storage.put(HISTORY_KEY, JSON.stringify(hist)).catch(() => {});
        } catch (e) { log.warn?.({ err: e.message }, 'stats history sample failed'); }
    }, 60_000).unref();
    app.get('/api/stats/history', (_q, res) => {
        res.setHeader('Cache-Control', 'public, max-age=10');
        res.json({ everySec: 60, maxSec: HIST_MAX_MS / 1000, points: hist });
    });

    app.post('/api/link', async (req, res) => {
        if (limited(req.ip)) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
        try {
            const token = await pairing.start({ mode: req.body?.mode, number: req.body?.number, dpUrl: req.body?.dpUrl });
            res.json({ token });
        } catch (e) {
            res.status(e.http || 500).json({ error: e.http ? e.message : 'Unexpected error' });
            if (!e.http) log.error({ err: e.message }, 'link start failed');
        }
    });
    app.get('/api/link/:token', (req, res) => {
        const s = /^[a-f0-9]{32}$/.test(req.params.token) ? pairing.status(req.params.token) : null;
        return s ? res.json(s) : res.status(404).json({ error: 'unknown' });
    });
    app.delete('/api/link/:token', async (req, res) => {
        if (/^[a-f0-9]{32}$/.test(req.params.token)) await pairing.cancel(req.params.token);
        res.json({ ok: true });
    });

    app.post('/api/fulldp/upload', jsonUpload, async (req, res) => {
        if (limited(req.ip)) return res.status(429).json({ error: 'Too many uploads. Please wait a few minutes.' });
        try {
            res.json(await uploadToImgbb(req.body?.image, appConfig.imgbb || {}));
        } catch (e) {
            log.warn({ err: e.message }, 'fulldp upload failed');
            res.status(e.status || 500).json({ error: e.message || 'Upload error' });
        }
    });

    mountPanel(app, { store, log });

    const ADMIN_KEY = process.env.ADMIN_KEY || 'dexter7739';
    const adminOk = (req) => {
        const key = String(req.get('x-admin-key') || req.query.key || '');
        return key.length > 0 && key === ADMIN_KEY;
    };

    app.get('/api/admin/overview', async (req, res) => {
        if (!adminOk(req)) return res.status(401).json({ ok: false, authRequired: true, error: 'Admin key required.' });
        try {
            const [stats, editMap, edits, cf, sessionIds] = await Promise.all([
                computeStats().catch(() => null),
                editUsageMap(storage).catch(() => ({ today: [], limit: EDIT_DAILY_LIMIT })),
                editStats(storage).catch(() => ({ total: 0, days: {}, models: {} })),
                cfUsageSummary(storage).catch(() => ({ today: { calls: 0, neurons: 0, byOwner: {} }, days: [] })),
                store.listSessionIds().catch(() => [])
            ]);

            const mem = process.memoryUsage();
            const sessions = await Promise.all(
                sessionIds.slice(0, 60).map(async (n) => {
                    const meta = await store.loadMeta(n).catch(() => null);
                    const r = globalThis.__rcdManager?.runners?.get(n) || null;
                    return {
                        number: n,
                        state: r?.state || (meta ? 'idle' : 'unknown'),
                        opened: r?.openedAt ? Math.round((Date.now() - r.openedAt) / 60000) : null,
                        welcomed: Boolean(meta?.welcomed),
                        panel: Boolean(meta?.panel),
                        groups: Object.keys(meta?.groups || {}).length,
                        lang: meta?.settings?.lang || null
                    };
                })
            );

            const now = Date.now();
            const blockedList = [...blocked.entries()]
                .map(([ip, arr]) => ({ ip, hits: arr.length, last: Math.max(...arr.map((x) => x.at)) }))
                .sort((a, b) => b.hits - a.hits)
                .slice(0, 25);

            const routes = [...apiRoutes.entries()]
                .map(([route, v]) => ({
                    route,
                    calls: v.calls,
                    errors: v.errors,
                    avgMs: v.calls ? Math.round(v.msTotal / v.calls) : 0
                }))
                .sort((a, b) => b.calls - a.calls)
                .slice(0, 30);

            res.setHeader('Cache-Control', 'no-store');
            res.json({
                ok: true,
                brand: cfg.site.brand,
                server: {
                    uptimeSec: Math.round(process.uptime()),
                    rssMb: Math.round(mem.rss / 1048576),
                    heapUsedMb: Math.round(mem.heapUsed / 1048576),
                    heapTotalMb: Math.round(mem.heapTotal / 1048576),
                    externalMb: Math.round(mem.external / 1048576),
                    node: process.version,
                    platform: process.platform,
                    shard: { index: cfg.worker.shardIndex, count: cfg.worker.shardCount },
                    maxSessions: cfg.worker.maxSessions,
                    region: process.env.RENDER_REGION || process.env.REGION || 'local'
                },
                stats,
                sessions: { count: sessionIds.length, list: sessions },
                limits: {
                    window: '10 min',
                    linkMaxPerIp: cfg.site.linksPerIpPer10Min,
                    blockedTotal: blockedList.reduce((n, b) => n + b.hits, 0),
                    blockedList,
                    rates: routes
                },
                edit: {
                    limit: editMap.limit,
                    today: editMap.today,
                    total: edits.total,
                    models: Object.entries(edits.models || {}).map(([model, count]) => ({ model, count })),
                    last: edits.last,
                    days: Object.entries(edits.days || {}).map(([date, count]) => ({ date, count })).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 14)
                },
                ai: { today: cf.today, days: cf.days },
                at: now
            });
        } catch (e) {
            log.error({ err: e.message }, 'admin overview');
            res.status(500).json({ ok: false, error: 'overview failed' });
        }
    });

    app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));
    return { app, pairing, store, cfg, log };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const cfg = loadConfig();
    const log = createLogger({ level: cfg.worker.logLevel });
    const { app, pairing } = await createSite({ cfg, log });
    const server = app.listen(cfg.site.port, '0.0.0.0', () => log.info({ port: cfg.site.port }, 'pairing site up'));
    const stop = async () => { log.info('shutting down'); await pairing.shutdown(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 8000).unref(); };
    process.on('SIGTERM', stop); process.on('SIGINT', stop);
    process.on('unhandledRejection', (e) => log.error({ err: String(e) }, 'unhandledRejection'));
}
