import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { LocalStorage, S3Storage, EncryptedStorage } from '../shared/storage.js';
import { SessionStore } from '../shared/session-store.js';
const require = createRequire(import.meta.url);

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'wmp-'));

async function contract(s) {
    await s.put('sessions/111111/creds.json', '{"a":1}');
    await s.put('sessions/222222/creds.json', '{"b":2}');
    await s.put('queue/111111.json', '{}');
    assert.equal((await s.get('sessions/111111/creds.json')).toString(), '{"a":1}');
    assert.equal(await s.get('nope'), null);
    const l = await s.list('sessions/', { delimiter: '/' });
    assert.deepEqual(l.prefixes.sort(), ['sessions/111111/', 'sessions/222222/']);
    assert.deepEqual((await s.list('queue/')).keys, ['queue/111111.json']);
    await s.del('queue/111111.json');
    assert.deepEqual((await s.list('queue/')).keys, []);
}

test('LocalStorage contract', async () => contract(new LocalStorage(tmp())));

test('EncryptedStorage: round-trip, ciphertext on disk, tamper detection, legacy plaintext read', async () => {
    const dir = tmp(); const raw = new LocalStorage(dir);
    const enc = new EncryptedStorage(raw, 'correct horse battery staple');
    await contract(enc);
    await enc.put('sessions/333333/creds.json', 'SECRET-CREDS');
    const onDisk = fs.readFileSync(path.join(dir, 'sessions/333333/creds.json'));
    assert.ok(!onDisk.toString('latin1').includes('SECRET-CREDS'), 'plaintext must not be stored');
    assert.equal((await enc.get('sessions/333333/creds.json')).toString(), 'SECRET-CREDS');
    await assert.rejects(new EncryptedStorage(raw, 'another passphrase!!').get('sessions/333333/creds.json'));
    onDisk[onDisk.length - 1] ^= 1; fs.writeFileSync(path.join(dir, 'sessions/333333/creds.json'), onDisk);
    await assert.rejects(enc.get('sessions/333333/creds.json'));
    await raw.put('sessions/444444/creds.json', 'plain');
    assert.equal((await enc.get('sessions/444444/creds.json')).toString(), 'plain');
});

test('Cloudflare R2 code path (S3Storage) against a local S3-compatible server', async () => {
    const S3rver = require('s3rver');
    const dir = tmp();
    const srv = new S3rver({ port: 0, address: '127.0.0.1', silent: true, directory: dir, configureBuckets: [{ name: 'wa-sessions' }] });
    const addr = await srv.run();
    const port = addr?.port ?? srv.server?.address?.().port ?? addr;
    try {
        const s3 = await S3Storage.create({ endpoint: `http://127.0.0.1:${port}`, bucket: 'wa-sessions', accessKeyId: 'S3RVER', secretAccessKey: 'S3RVER', forcePathStyle: true });
        await contract(new EncryptedStorage(s3, 'k'.repeat(24)));
    } finally { await srv.close(); }
});

test('SessionStore: keys bundle gzip round-trip, deleteSession wipes everything', async () => {
    const st = new SessionStore(new LocalStorage(tmp()));
    await st.saveCreds('94771234567', '{"x":1}');
    await st.saveKeysBundle('94771234567', { 'pre-key-1.json': '{"k":1}', 'session-abc.json': '{"s":2}' });
    await st.saveMeta('94771234567', { welcomed: false });
    await st.enqueue('94771234567');
    assert.deepEqual(await st.listSessionIds(), ['94771234567']);
    assert.deepEqual(await st.listQueue(), ['94771234567']);
    assert.deepEqual(await st.loadKeysBundle('94771234567'), { 'pre-key-1.json': '{"k":1}', 'session-abc.json': '{"s":2}' });
    await st.deleteSession('94771234567');
    assert.deepEqual(await st.listSessionIds(), []);
    assert.deepEqual(await st.listQueue(), []);
});

test('S3Storage.list follows continuation tokens (pagination loop, fake client)', async () => {
    const pages = [
        { Contents: [{ Key: 'queue/100000.json' }], CommonPrefixes: [{ Prefix: 'p1/' }], IsTruncated: true, NextContinuationToken: 'T1' },
        { Contents: [{ Key: 'queue/100001.json' }], IsTruncated: true, NextContinuationToken: 'T2' },
        { Contents: [{ Key: 'queue/100002.json' }], CommonPrefixes: [{ Prefix: 'p2/' }], IsTruncated: false }
    ];
    const seen = [];
    const fakeSdk = { S3Client: class { async send(cmd) { seen.push(cmd.input.ContinuationToken); return pages[seen.length - 1]; } }, ListObjectsV2Command: class { constructor(i) { this.input = i; } } };
    const s = new S3Storage({ endpoint: 'http://x', bucket: 'b', accessKeyId: 'a', secretAccessKey: 'b' }, fakeSdk);
    const r = await s.list('queue/', { delimiter: '/' });
    assert.deepEqual(seen, [undefined, 'T1', 'T2']);
    assert.equal(r.keys.length, 3); assert.deepEqual(r.prefixes, ['p1/', 'p2/']);
});
