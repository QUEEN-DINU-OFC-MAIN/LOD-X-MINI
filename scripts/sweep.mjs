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
        sendMessage: async (jid, content, opts) => { if (content.react) return {}; sent.push({ jid, content, opts, at: Date.now() }); return {}; },
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
    globalThis.handlers_say = (t) => handlers['messages.upsert']({ type: 'notify', messages: [{ key: { id: `T${Math.random()}`, remoteJid: `${ME}@s.whatsapp.net`, fromMe: false }, pushName: 'Tester', messageTimestamp: Math.floor(Date.now() / 1000), message: { conversation: t } }] });
    return { r, sock, sent, say, store };
}

const { say, sent, r } = await setup();
const lines = process.argv.slice(2);
const kind = (c) => ['image', 'video', 'audio', 'sticker', 'document', 'poll', 'text', 'caption'].filter((k) => k in c).join('+') + (c.buttons ? '+buttons' : '');
const SETTLE = 5000;
const results = [];
for (const line of lines) {
    const n = sent.length; const t0 = Date.now();
    handlers_say(line);
    let last = Date.now();
    for (;;) {
        await sleep(400);
        if (sent.length > n) last = Math.max(last, sent[sent.length - 1].at);
        const pendingWork = r.platform.cmdQueue.pending + r.platform.cmdQueue.size + r.platform.dlQueue.pending + r.platform.dlQueue.size;
        if (!pendingWork && Date.now() - Math.max(last, t0) > (sent.length > n ? 2500 : 4000)) break;
        if (Date.now() - t0 > 150000) break;
    }
    const msgs = sent.slice(n);
    const txt = msgs.map((m) => m.content.text || m.content.caption || '').join(' | ').replace(/\s+/g, ' ');
    const warn = /⚠️|❌|failed|error|unavailable|timed out/i.test(txt);
    const status = !msgs.length ? 'SILENT' : warn ? 'FAIL' : 'ok';
    results.push([status, line]);
    console.log(`${status.padEnd(6)} ${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s ${line.slice(0, 44).padEnd(44)} ${msgs.map((m) => kind(m.content)).join(',')} ${txt.slice(0, 110)}`);
}
const bad = results.filter((x) => x[0] !== 'ok');
console.log(`\nSUMMARY ${results.length - bad.length}/${results.length} ok`, bad.map((x) => x[1]).join(' ; '));
process.exit(0);
