import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import PQueue from 'p-queue';
import { LocalStorage } from '../shared/storage.js';
import { SessionStore } from '../shared/session-store.js';
import { loadConfig } from '../shared/config.js';
import { BoundedCache } from '../shared/cache.js';
import { SessionRunner } from '../server/runner.js';
import { loadCommands } from '../server/commands/index.js';
import { B } from '../shared/wa.js';

const ME = '94770000001';
const quiet = { info() {}, warn() {}, error() {}, debug() {}, child() { return quiet; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const upload = async () => ({ mediaUrl: 'https://mmg.whatsapp.net/x', directPath: '/x' });

async function setup({ pairing } = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wmp-rc-'));
    const store = new SessionStore(new LocalStorage(path.join(dir, 'r2')));
    await store.saveCreds(ME, JSON.stringify({ me: { id: `${ME}:1@s.whatsapp.net` }, registered: true }));
    const handlers = {}; const sent = [];
    const sock = {
        user: { id: `${ME}:1@s.whatsapp.net` },
        ev: { on: (n, f) => { handlers[n] = f; }, removeAllListeners() {} },
        sendMessage: async (jid, content, opts) => { sent.push({ jid, content, opts }); return {}; },
        sendPresenceUpdate: async () => {}, readMessages: async () => {}, end() {}
    };
    const cfg = loadConfig({ DATA_DIR: path.join(dir, 'data'), CMD_COOLDOWN_MS: '0', START_DELAY_MS: '1' });
    const platform = {
        cfg: cfg.worker, commands: await loadCommands(), sessionCount: () => 1,
        cmdQueue: new PQueue({ concurrency: 4 }), dlQueue: new PQueue({ concurrency: 2 }),
        groupCache: new BoundedCache({ max: 10 }), devicesCache: new BoundedCache({ max: 10 }),
        makeSocket: () => sock, pairing
    };
    const r = new SessionRunner(ME, { store, cfg, log: quiet, platform });
    await r.start(); r.state = 'open';
    const say = async (text, { from = ME, msg } = {}) => {
        const fromOwner = from === ME;
        const n = sent.length;
        handlers['messages.upsert']({ type: 'notify', messages: [{
            key: { id: `T${Math.random()}`, remoteJid: `${from}@s.whatsapp.net`, fromMe: fromOwner && false },
            pushName: 'Tester', messageTimestamp: Math.floor(Date.now() / 1000), message: msg || { conversation: text }
        }] });
        for (let i = 0; i < 40 && sent.length === n; i++) await sleep(25);
        await sleep(30);
        return sent.slice(n);
    };
    return { r, sock, sent, say, store };
}

const { say, sent, r } = await setup();
const cmds = process.argv.slice(2);
for (const c of cmds) {
    const n = sent.length; const t0 = Date.now();
    await say(c);
    for (let i = 0; i < 400 && Date.now() - t0 < 120000; i++) { await sleep(300); if (sent.length > n && i > 6 && !/Downloading|Searching|⏳|🔎/.test(JSON.stringify(sent[sent.length-1].content).slice(0,300))) break; }
    for (const m of sent.slice(n)) {
        const k = Object.keys(m.content).filter((x) => !['quoted'].includes(x));
        const sz = Object.fromEntries(Object.entries(m.content).filter(([, v]) => Buffer.isBuffer(v)).map(([x, v]) => [x, v.length]));
        console.log(`${c.padEnd(36)} ${((Date.now() - t0) / 1000).toFixed(1)}s ->`, k.join(','), JSON.stringify(sz), String(m.content.text || m.content.caption || m.content.fileName || m.content.image?.url || '').replace(/\n/g, ' ').slice(0, 110));
    }
}
await r.stop({ flush: false }); process.exit(0);
