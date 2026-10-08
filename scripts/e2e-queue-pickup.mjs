import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { LocalStorage } from '../shared/storage.js';
import { SessionStore } from '../shared/session-store.js';
import { B } from '../shared/wa.js';
fs.rmSync('/tmp/e2e-r2', { recursive: true, force: true });
const store = new SessionStore(new LocalStorage('/tmp/e2e-r2'));
const p = spawn('node', ['server/index.js'], { env: { ...process.env, STORAGE_DRIVER: 'local', LOCAL_STORAGE_DIR: '/tmp/e2e-r2', DATA_DIR: '/tmp/e2e-data', START_DELAY_MS: '100', QUEUE_POLL_SEC: '2', LOG_LEVEL: 'info' } });
const out = []; p.stdout.on('data', (d) => out.push(...String(d).trim().split('\n')));
await new Promise((r) => setTimeout(r, 2500));
const creds = B.initAuthCreds(); creds.registered = true; creds.me = { id: '94700000002:1@s.whatsapp.net', name: 'x' };
await store.saveCreds('94700000002', JSON.stringify(creds, B.BufferJSON.replacer)); await store.saveMeta('94700000002', { welcomed: true });
await store.enqueue('94700000002'); const t0 = Date.now();
await new Promise((r) => setTimeout(r, 9000));
for (const l of out) { try { const j = JSON.parse(l); if (/queue|session started|logged out/.test(j.msg)) console.log(`+${((j.time - t0) / 1000).toFixed(1)}s`, j.msg, j.id || j.s || ''); } catch {} }
console.log('marker left in queue:', JSON.stringify(await store.listQueue()));
p.kill('SIGTERM'); process.exit(0);
