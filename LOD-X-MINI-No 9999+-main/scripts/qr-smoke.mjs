import { loadConfig } from '../shared/config.js';
import { createSite } from '../site/index.js';
import { LocalStorage } from '../shared/storage.js';
import pino from 'pino';
const cfg = loadConfig({ DATA_DIR: '/tmp/qt-data', LOCAL_STORAGE_DIR: '/tmp/qt-r2' });
const { app, pairing } = await createSite({ cfg, storage: new LocalStorage(cfg.storage.localDir), log: pino({ level: 'warn' }) });
const srv = app.listen(0); const base = `http://127.0.0.1:${srv.address().port}`;
const j = (r) => r.json();
console.log('bad number  ->', (await fetch(base + '/api/link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'pair', number: '12' }) })).status);
const { token } = await fetch(base + '/api/link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'qr' }) }).then(j);
let s; for (let i = 0; i < 20; i++) { s = await fetch(`${base}/api/link/${token}`).then(j); if (s.status === 'qr') break; await new Promise(r => setTimeout(r, 1000)); }
console.log('qr status   ->', s.status, '| qr data-url:', s.qr?.slice(0, 30) + '…', '| len', s.qr?.length);
await pairing.cancel(token); await pairing.shutdown(); srv.close(); process.exit(0);
