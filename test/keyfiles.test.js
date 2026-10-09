/import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { collectKeyFiles } from '../shared/keyfiles.js';
import { LocalStorage } from '../shared/storage.js';
import { SessionStore } from '../shared/session-store.js';
import { openAuthState } from '../shared/authstate.js';
import { B } from '../shared/wa.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'wmp-kf-'));
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

async function deleteAfterReaddir(dir, victim, fn) {
    const real = fsp.readdir.bind(fsp);
    let armed = true;
    fsp.readdir = async (...args) => {
        const out = await real(...args);
        if (armed && String(args[0]) === dir) { armed = false; fs.rmSync(path.join(dir, victim), { force: true }); }
        return out;
    };
    try { return await fn(); } finally { fsp.readdir = real; }
}

function seed(dir) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'creds.json'), '{"a":1}');
    fs.writeFileSync(path.join(dir, 'pre-key-1.json'), '{"id":1}');
    fs.writeFileSync(path.join(dir, 'pre-key-2.json'), '{"id":2}');
    fs.writeFileSync(path.join(dir, 'session-abc.1.json'), '{"s":1}');
    fs.writeFileSync(path.join(dir, 'not-a-key.txt'), 'ignored');
    return dir;
}

test('collectKeyFiles: normal folder -> every key, creds and non-json skipped', async () => {
    const { files, gone } = await collectKeyFiles(seed(tmp()));
    assert.deepEqual(Object.keys(files).sort(), ['pre-key-1.json', 'pre-key-2.json', 'session-abc.1.json']);
    assert.deepEqual(gone, []);
    assert.equal(files['pre-key-1.json'], '{"id":1}');
});

test('collectKeyFiles: a pre-key deleted between readdir and readFile is skipped, NOT an error', async () => {
    const dir = seed(tmp());
    const { files, gone } = await deleteAfterReaddir(dir, 'pre-key-2.json', () => collectKeyFiles(dir));
    assert.deepEqual(gone, ['pre-key-2.json']);
    assert.deepEqual(Object.keys(files).sort(), ['pre-key-1.json', 'session-abc.1.json']);
});

test('collectKeyFiles: a key file that really cannot be read throws (no partial bundle)', async () => {
    const dir = seed(tmp());
    fs.mkdirSync(path.join(dir, 'pre-key-9.json'));
    await assert.rejects(collectKeyFiles(dir), /EISDIR/);
});

test('authstate flush(): a spent pre-key vanishing mid-read still uploads the other keys', async () => {
    const store = new SessionStore(new LocalStorage(tmp()));
    const dir = tmp();
    const a = await openAuthState('94770000006', {
        store, dir, fresh: true, autoSync: false, log: quiet, keysSyncMinMs: 60_000
    });
    a.state.creds.me = { id: '94770000006:1@s.whatsapp.net', name: 'T' };
    await a.state.keys.set({
        'pre-key': { 7: { private: Buffer.from('p7'), public: Buffer.from('q7') }, 8: { private: Buffer.from('p8'), public: Buffer.from('q8') } }
    });
    await deleteAfterReaddir(dir, 'pre-key-7.json', () => a.flush({ force: true }));
    const bundle = await store.loadKeysBundle('94770000006');
    assert.ok(!('pre-key-7.json' in bundle), 'the spent key is gone from the bundle');
    assert.ok('pre-key-8.json' in bundle, 'the surviving key was still uploaded');
    await a.dispose();
});

test('authstate flush(): an unreadable key file aborts the upload and leaves the stored bundle intact', async () => {
    const store = new SessionStore(new LocalStorage(tmp()));
    const dir = tmp();
    const a = await openAuthState('94770000007', {
        store, dir, fresh: true, autoSync: false, log: quiet, keysSyncMinMs: 60_000
    });
    a.state.creds.me = { id: '94770000007:1@s.whatsapp.net', name: 'T' };
    await a.state.keys.set({ 'sender-key': { 'g@g.us--x': Buffer.from('sk') } });
    await a.flush({ force: true });
    const before = await store.loadKeysBundle('94770000007');
    assert.ok('sender-key-g@g.us--x.json' in before);

    fs.mkdirSync(path.join(dir, 'pre-key-99.json'));
    await assert.rejects(a.flush({ force: true }), /EISDIR/);
    const after = await store.loadKeysBundle('94770000007');
    assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort(), 'stored bundle was not overwritten with a partial one');
    await a.dispose();
});

test('Buffer keys survive the round trip through collectKeyFiles (BufferJSON)', async () => {
    const store = new SessionStore(new LocalStorage(tmp()));
    const dir = tmp();
    const a = await openAuthState('94770000008', { store, dir, fresh: true, autoSync: false, log: quiet });
    a.state.creds.me = { id: '94770000008:1@s.whatsapp.net', name: 'T' };
    await a.state.keys.set({ 'pre-key': { 3: { private: Buffer.from('p3'), public: Buffer.from('q3') } } });
    await a.flush({ force: true });
    await store.saveCreds('94770000008', JSON.stringify(a.state.creds, B.BufferJSON.replacer));
    const b = await openAuthState('94770000008', { store, dir: tmp(), log: quiet });
    const k = await b.state.keys.get('pre-key', ['3']);
    assert.equal(k['3'].private.toString(), 'p3');
    await a.dispose(); await b.dispose();
});
