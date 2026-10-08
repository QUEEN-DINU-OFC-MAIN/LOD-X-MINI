import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { LocalStorage } from '../shared/storage.js';
import { SessionStore } from '../shared/session-store.js';
import { loadConfig } from '../shared/config.js';
import { SessionManager } from '../server/manager.js';
import { shardOf, makeOwns } from '../shared/shard.js';
import { BoundedCache } from '../shared/cache.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const quiet = { info() {}, warn() {}, error() {}, child() { return quiet; } };
const mk = async (envExtra = {}, ids = []) => {
    const store = new SessionStore(new LocalStorage(fs.mkdtempSync(path.join(os.tmpdir(), 'wmp-m-'))));
    for (const id of ids) await store.saveCreds(id, realCreds(id));
    const cfg = loadConfig({ START_DELAY_MS: '15', QUEUE_POLL_SEC: '1', STATS_SEC: '3600', MEM_LIMIT_MB: '100000', ...envExtra });
    const log = [];
    class FakeRunner {
        constructor(id) { this.id = id; this.state = 'idle'; }
        async start() { log.push(['start', this.id, Date.now()]); if (this.id.endsWith('13')) throw new Error('boom'); this.state = 'open'; }
        async stop(o) { log.push(['stop', this.id, o]); this.state = 'stopped'; }
    }
    const m = new SessionManager({ store, cfg, log: quiet, commands: new Map(), runnerFactory: (id) => new FakeRunner(id) });
    return { m, store, log, cfg };
};
const ids = (n, base = 94770000000) => Array.from({ length: n }, (_, i) => String(base + i));

const realCreds = (id) => JSON.stringify({ me: { id: `${id}:1@s.whatsapp.net` }, registered: true });
test('boot: starts every owned session one-by-one with pacing; one failing session does not stop the rest', async () => {
    const all = ids(30);
    const { m, log } = await mk({}, all);
    await m.boot(); await sleep(30 * 15 + 400);
    const starts = log.filter((l) => l[0] === 'start');
    assert.equal(starts.length, 30);
    const gaps = starts.slice(1).map((s, i) => s[2] - starts[i][2]);
    assert.ok(Math.min(...gaps) >= 10, `paced start (min gap ${Math.min(...gaps)}ms)`);
    assert.equal(m.runners.size, 29, 'the failing session was dropped, 29 keep running');
    await m.shutdown();
});

test('sharding: every session belongs to exactly one worker, evenly spread', () => {
    const all = ids(5000); const count = 10; const per = Array(count).fill(0);
    for (const id of all) { const owners = Array.from({ length: count }, (_, i) => makeOwns(i, count)(id)).filter(Boolean); assert.equal(owners.length, 1); per[shardOf(id, count)]++; }
    assert.ok(Math.max(...per) / Math.min(...per) < 1.25, `balanced: ${per}`);
});

test('worker with shard 1/3 only runs its own sessions', async () => {
    const all = ids(60);
    const { m, log } = await mk({ SHARD_COUNT: '3', SHARD_INDEX: '1' }, all);
    await m.boot(); await sleep(60 * 15 / 3 + 500);
    const mine = all.filter((id) => shardOf(id, 3) === 1);
    assert.deepEqual(log.filter((l) => l[0] === 'start').map((l) => l[1]).sort(), mine.sort());
    await m.shutdown();
});

test('new session via queue marker: only that session starts, running bots are untouched', async () => {
    const { m, store, log } = await mk({}, ids(5));
    await m.boot(); await sleep(300);
    log.length = 0;
    await store.saveCreds('94779990001', realCreds('94779990001')); await store.enqueue('94779990001');
    await m.pollQueue(); await sleep(100);
    assert.deepEqual(log.map((l) => [l[0], l[1]]), [['start', '94779990001']], 'no stop/restart of other bots');
    assert.deepEqual(await store.listQueue(), [], 'marker consumed');
    await m.shutdown();
});

test('re-link of an already running number restarts ONLY that number', async () => {
    const { m, store, log } = await mk({}, ids(4));
    await m.boot(); await sleep(250); log.length = 0;
    await store.enqueue('94770000002'); await m.pollQueue(); await sleep(100);
    assert.deepEqual(log.map((l) => [l[0], l[1]]), [['stop', '94770000002'], ['start', '94770000002']]);
    assert.equal(log[0][2].flush, false, 'old runner stopped WITHOUT overwriting the freshly linked creds');
    await m.shutdown();
});

test('capacity guard: worker at MAX_SESSIONS leaves the marker queued instead of overloading', async () => {
    const { m, store } = await mk({ MAX_SESSIONS: '2' }, ids(2));
    await m.boot(); await sleep(150);
    await store.saveCreds('94779990002', realCreds('94779990002')); await store.enqueue('94779990002');
    await m.pollQueue();
    assert.equal(m.runners.size, 2);
    assert.deepEqual(await store.listQueue(), ['94779990002'], 'stays queued for later / another shard');
    await m.shutdown();
});

test('shutdown flushes every session (SIGTERM path)', async () => {
    const { m, log } = await mk({}, ids(12));
    await m.boot(); await sleep(12 * 15 + 200); log.length = 0;
    await m.shutdown();
    const stops = log.filter((l) => l[0] === 'stop');
    assert.equal(stops.length, 12); assert.ok(stops.every((s) => s[2].flush === true));
});

test('BoundedCache never throws when full (regression for the maxKeys/ECACHEFULL bug) and expires', async () => {
    const c = new BoundedCache({ max: 3, ttlMs: 50 });
    for (let i = 0; i < 100; i++) c.set('k' + i, i);
    assert.equal(c.size, 3); assert.equal(c.get('k99'), 99); assert.equal(c.get('k0'), undefined);
    await sleep(70); assert.equal(c.get('k99'), undefined);
});

test('memory pressure: shared caches are dropped past 80% of MEM_LIMIT_MB, kept below it', async () => {
    const { m } = await mk({ MEM_LIMIT_MB: '1' });
    m.platform.groupCache.set('g@g.us', { subject: 'x' });
    m.platform.devicesCache.set('94771234567', [{ id: 'a' }]);
    assert.equal(m.relieveMemory(), true, 'RSS is above 80% of a 1 MB limit');
    assert.equal(m.platform.groupCache.size, 0, 'group metadata cache dropped');
    assert.equal(m.platform.devicesCache.size, 0, 'device cache dropped');

    const { m: calm } = await mk({ MEM_LIMIT_MB: '100000' });
    calm.platform.groupCache.set('g@g.us', { subject: 'x' });
    assert.equal(calm.relieveMemory(), false, 'no pressure -> nothing dropped');
    assert.equal(calm.platform.groupCache.size, 1);
    await m.shutdown(); await calm.shutdown();
});
