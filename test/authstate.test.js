import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { LocalStorage } from '../shared/storage.js';
import { SessionStore } from '../shared/session-store.js';
import { openAuthState } from '../shared/authstate.js';
import { B } from '../shared/wa.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'wmp-as-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const quiet = { info() {}, warn() {}, error() {} };
const opts = (store, dir, extra = {}) => ({ store, dir, log: quiet, credsDebounceMs: 40, keysSyncMinMs: 120, ...extra });

async function seedLikeSite(store, id) {
    const a = await openAuthState('pair-x', { store, dir: tmp(), fresh: true, autoSync: false, log: quiet });
    await a.state.keys.set({ 'pre-key': { 1: { private: Buffer.from('priv'), public: Buffer.from('pub') } }, session: { 'abc.1': Buffer.from('sess') } });
    a.state.creds.me = { id: `${id}:1@s.whatsapp.net`, name: 'T' };
    await a.saveCreds();
    await store.saveCreds(id, JSON.stringify(a.state.creds, B.BufferJSON.replacer));
    const files = {};
    for (const n of fs.readdirSync(a.dir)) if (n !== 'creds.json') files[n] = fs.readFileSync(path.join(a.dir, n), 'utf8');
    await store.saveKeysBundle(id, files);
    return a.state.creds;
}

test('restore: creds + Buffers + signal keys survive R2 -> new process', async () => {
    const store = new SessionStore(new LocalStorage(tmp()));
    const original = await seedLikeSite(store, '94753262213');
    const a = await openAuthState('94753262213', opts(store, tmp()));
    assert.ok(Buffer.isBuffer(a.state.creds.noiseKey.private));
    assert.deepEqual(a.state.creds.noiseKey.private, original.noiseKey.private);
    assert.equal(a.state.creds.registrationId, original.registrationId);
    const k = await a.state.keys.get('pre-key', ['1', '999']);
    assert.equal(k['1'].private.toString(), 'priv');
    assert.equal(k['999'], null);
    assert.equal((await a.state.keys.get('session', ['abc.1']))['abc.1'].toString(), 'sess');
    await a.dispose();
});

test('creds.update -> creds.json re-uploaded (debounced, coalesced, hash-skipped)', async () => {
    const raw = new LocalStorage(tmp());
    let puts = 0; const spy = { ...raw, put: (k, b) => { if (k.endsWith('creds.json')) puts++; return raw.put(k, b); }, get: (k) => raw.get(k), del: (k) => raw.del(k), list: (p, o) => raw.list(p, o) };
    const store = new SessionStore(spy);
    await seedLikeSite(store, '94770000001'); puts = 0;
    const a = await openAuthState('94770000001', opts(store, tmp()));
    for (let i = 0; i < 10; i++) { a.state.creds.nextPreKeyId = 100 + i; await a.saveCreds(); }
    await sleep(200);
    assert.equal(puts, 1, 'coalesced into a single upload');
    const got = JSON.parse(await store.loadCreds('94770000001'), B.BufferJSON.reviver);
    assert.equal(got.nextPreKeyId, 109);
    await a.saveCreds(); await sleep(150);
    assert.equal(puts, 1, 'unchanged creds are not re-uploaded');
    await a.dispose();
});

test('prekey changes: keys bundle is uploaded (throttled) and a fresh worker sees them', async () => {
    const store = new SessionStore(new LocalStorage(tmp()));
    await seedLikeSite(store, '94770000002');
    const a = await openAuthState('94770000002', opts(store, tmp()));
    await a.state.keys.set({ 'pre-key': { 2: { private: Buffer.from('p2'), public: Buffer.from('q2') }, 1: null } });
    await sleep(400);
    const b = await openAuthState('94770000002', opts(store, tmp()));
    const got = await b.state.keys.get('pre-key', ['1', '2']);
    assert.equal(got['2'].private.toString(), 'p2');
    assert.equal(got['1'], null, 'consumed prekey must be gone too');
    await a.dispose(); await b.dispose();
});

test('flush() on shutdown pushes pending creds + keys immediately', async () => {
    const store = new SessionStore(new LocalStorage(tmp()));
    await seedLikeSite(store, '94770000003');
    const a = await openAuthState('94770000003', opts(store, tmp(), { credsDebounceMs: 60_000, keysSyncMinMs: 60_000 }));
    a.state.creds.nextPreKeyId = 777; await a.saveCreds();
    await a.state.keys.set({ 'sender-key': { 'g@g.us--x': Buffer.from('sk') } });
    assert.equal(a.pending, true);
    await a.flush();
    assert.equal(a.pending, false);
    assert.equal(JSON.parse(await store.loadCreds('94770000003'), B.BufferJSON.reviver).nextPreKeyId, 777);
    assert.ok('sender-key-g@g.us--x.json' in (await store.loadKeysBundle('94770000003')));
    await a.dispose();
});

test('R2 outage: upload retries until it succeeds, nothing throws into Baileys', async () => {
    const raw = new LocalStorage(tmp()); let fail = 2;
    const flaky = { put: (k, b) => (k.endsWith('creds.json') && fail-- > 0 ? Promise.reject(new Error('R2 503')) : raw.put(k, b)), get: (k) => raw.get(k), del: (k) => raw.del(k), list: (p, o) => raw.list(p, o) };
    const store = new SessionStore(raw); await seedLikeSite(store, '94770000004');
    const a = await openAuthState('94770000004', { ...opts(new SessionStore(flaky), tmp()), credsDebounceMs: 20, retryBaseMs: 60 });
    a.state.creds.nextPreKeyId = 4242; await a.saveCreds();
    await sleep(700);
    assert.equal(JSON.parse(await store.loadCreds('94770000004'), B.BufferJSON.reviver).nextPreKeyId, 4242);
    await a.dispose();
});

test('malicious bundle file names are ignored (no path traversal)', async () => {
    const store = new SessionStore(new LocalStorage(tmp())); await seedLikeSite(store, '94770000005');
    await store.saveKeysBundle('94770000005', { '../../evil.json': 'x', 'ok-1.json': '{}', '/etc/passwd': 'x', 'creds.json': '{"hacked":1}' });
    const dir = tmp();
    const a = await openAuthState('94770000005', opts(store, path.join(dir, 's')));
    assert.deepEqual(fs.readdirSync(path.join(dir, 's')).sort(), ['creds.json', 'ok-1.json']);
    assert.ok(!fs.existsSync(path.join(dir, 'evil.json')));
    assert.ok(!('hacked' in JSON.parse(fs.readFileSync(path.join(dir, 's', 'creds.json'), 'utf8'))));
    await a.dispose();
});

test('missing creds -> NO_CREDS (worker skips instead of crashing)', async () => {
    const store = new SessionStore(new LocalStorage(tmp()));
    await assert.rejects(openAuthState('94779999999', opts(store, tmp())), { code: 'NO_CREDS' });
});
