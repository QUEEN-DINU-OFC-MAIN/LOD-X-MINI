import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { SessionStore } from '../shared/session-store.js';
import { LocalStorage } from '../shared/storage.js';

class FakeDb {
    constructor() { this.puts = []; this.row = null; }
    async get() { return this.row; }
    async put(id, data) { this.puts.push([id, data]); this.row = data; }
    async del() { this.row = null; }
}

test('v14: settings save locally first, DB sync is batched (immediate only on flush)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wmp-db-'));
    const db = new FakeDb();
    const store = new SessionStore(new LocalStorage(path.join(dir, 'r2')), db, { warn() {} });
    await store.saveMeta('94770000001', { a: 1 });
    assert.equal(db.puts.length, 0, 'no immediate DB write');
    const local = JSON.parse((await store.s.get(store.k.meta('94770000001'))).toString());
    assert.equal(local.a, 1);
    assert.ok(local.updated > 0);
    await store.saveMeta('94770000001', { a: 2 }, { flush: true });
    assert.equal(db.puts.length, 1, 'flush writes immediately');
    await store.saveMeta('94770000002', { b: 1 });
    assert.equal(db.puts.length, 1, 'second session waits for the batch');
    await store.flushPg();
    assert.equal(db.puts.length, 2, 'batch flush writes every dirty session');
    db.row = { stale: true, updated: 1 };
    const merged = await store.loadMeta('94770000001');
    assert.equal(merged.a, 2, 'the newer local copy wins over a stale DB row');
    await store.saveMeta('94770000003', { c: 1 });
    db.put = async () => { throw new Error('boom'); };
    await store.flushPg();
    assert.equal(store.pgDirty.size, 1, 'failed DB writes stay dirty for the next round');
});

import { installSignalQuiet } from '../shared/signal-quiet.js';

test('v15: signal decrypt noise is swallowed and summarised instead of spamming logs', async () => {
    const warns = [];
    const captured = [];
    const fakeConsoleErr = console.error;
    console.error.__orig && (console.error = console.error.__orig);
    const origErr = console.error;
    installSignalQuiet({ warn: (o, m) => warns.push([o, m]) }, { flushMs: 40 });
    console.error('Failed to decrypt message with any known session...');
    console.error('Session error:Error: Bad MAC', 'stacktrace');
    console.warn('Closing open session in favor of incoming prekey bundle');
    console.log('normal startup line');
    await new Promise((r) => setTimeout(r, 90));
    assert.equal(warns.length, 1, 'one summary line');
    assert.equal(warns[0][0].undecrypted, 3);
    assert.match(warns[0][1], /signal:/);
    console.error = origErr;
});
