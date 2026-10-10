import test from 'node:test';
import assert from 'node:assert/strict';
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
import { SCHEMA, defaultSettings } from '../shared/panel-settings.js';
import { issuePanel } from '../shared/panel-auth.js';
import config from '../config.js';
config.defaultLang = 'en';

const ME = '94770000001';
const quiet = { info() {}, warn() {}, error() {}, debug() {}, child() { return quiet; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('every panel setting has a real default (no blank or inverted toggles)', () => {
    const d = defaultSettings();
    for (const f of SCHEMA) assert.ok(f.key in d, `${f.key} has a default value`);
    assert.equal(d.autoreadstatus, true);
    assert.equal(d.autoreactstatus, true);
    assert.equal(d.autovo, true);
    assert.equal(d.hearts, false);
    assert.equal(d.aireply, 'off');
    assert.equal(d.btntext, false);
    assert.equal(d.menuStyle, 'carousel');
});

test('defaultSettings() reads config.defaultLang LIVE, not frozen at import time', () => {
    const before = config.defaultLang;
    try {
        config.defaultLang = 'ar';
        assert.equal(defaultSettings().lang, 'ar', 'picks up a config change made after import');
        config.defaultLang = 'en';
        assert.equal(defaultSettings().lang, 'en');
    } finally { config.defaultLang = before; }
});

const mkRunner = () => {
    const settings = { ...defaultSettings(), prefix: '.' };
    return {
        id: ME, meta: {}, l: quiet, settings,
        setSettings: async (patch) => Object.assign(settings, patch),
        async setPanel(panel) { this.meta = { ...(this.meta || {}), panel }; },
        uptime: () => '0d 0h 1m 0s'
    };
};

test('.settings returns the web link AND the password, and keeps the same password', async () => {
    const cmds = await loadCommands();
    const runner = mkRunner();
    const sent = [];
    const ctx = {
        prefix: '.', args: [], text: '', isOwner: true, jid: `${ME}@s.whatsapp.net`, runner,
        msg: { pushName: 'Owner', messageTimestamp: Math.floor(Date.now() / 1000) },
        sendButtons: async (o) => sent.push(o), reply: async (t) => sent.push({ text: t })
    };
    await cmds.get('settings').run(ctx);
    const body = sent[0].text;
    assert.match(body, /🌐 \*WEB PANEL\*/);
    assert.match(body, new RegExp(`🔗 https://rcdxmini\\.dexterid\\.org/panel#n=${ME}&k=[a-f0-9]{40}`), 'working panel link');
    assert.match(body, /🔑 Password : \*[A-Z2-9]{8}\*/, 'password shown');
    const first = runner.meta.panel.password;
    assert.ok(first, 'password persisted on the session');

    await cmds.get('settings').run(ctx);
    assert.match(sent[1].text, new RegExp(`🔑 Password : \\*${first}\\*`), 'second call reuses the same password (no silent reset)');
});

test('issuePanel stores the plain password alongside the verifying hash', () => {
    const { password, panel } = issuePanel(0);
    assert.equal(panel.password, password);
    assert.ok(panel.hash && panel.salt, 'hash + salt still present for verification');
    assert.equal(panel.ver, 1);
});

async function setup() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wmp-pf-'));
    const storage = new LocalStorage(path.join(dir, 'r2'));
    const store = new SessionStore(storage);
    await store.saveCreds(ME, JSON.stringify({ me: { id: `${ME}:1@s.whatsapp.net` }, registered: true }));
    const handlers = {}; const sent = [];
    const sock = {
        user: { id: `${ME}:1@s.whatsapp.net` },
        ev: { on: (n, f) => { handlers[n] = f; }, removeAllListeners() {} },
        sendMessage: async (jid, content) => { const key = { id: `SK${sent.length}`, remoteJid: jid }; sent.push({ jid, content }); return { key }; },
        sendPresenceUpdate: async () => {}, readMessages: async () => {}, end() {},
        groupMetadata: async (jid) => ({ id: jid, subject: 'G', participants: [] }),
        profilePictureUrl: async () => { throw new Error('none'); }
    };
    const cfg = loadConfig({ DATA_DIR: path.join(dir, 'data'), CMD_COOLDOWN_MS: '0', START_DELAY_MS: '1' });
    const platform = {
        cfg: cfg.worker, commands: await loadCommands(), sessionCount: () => 1,
        cmdQueue: new PQueue({ concurrency: 4 }), dlQueue: new PQueue({ concurrency: 2 }),
        groupCache: new BoundedCache({ max: 10 }), devicesCache: new BoundedCache({ max: 10 }),
        makeSocket: () => sock
    };
    const r = new SessionRunner(ME, { store, cfg, log: quiet, platform });
    await r.start(); r.state = 'open';
    const say = async (text, { from = '94711111111' } = {}) => {
        const n = sent.length;
        handlers['messages.upsert']({
            type: 'notify', messages: [{
                key: { id: `T${Math.random()}`, remoteJid: `${from}@s.whatsapp.net` },
                pushName: 'Tester', messageTimestamp: Math.floor(Date.now() / 1000), message: { conversation: text }
            }]
        });
        for (let i = 0; i < 40 && sent.length === n; i++) await sleep(25);
        await sleep(30);
        return sent.slice(n);
    };
    return { r, store, storage, sent, say };
}

test('auto-reply sends the attached photo with its caption', async () => {
    const { r, storage, say, sent } = await setup();
    const key = `assets/${ME}/replies/1-abcd1234.jpg`;
    await storage.put(key, Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]));
    r.meta.replies = { price: { text: 'Rs. 2500', mediaKey: key, mediaType: 'image' } };
    const out = await say('price');
    const img = out.find((x) => x.content.image);
    assert.ok(img, 'an image message was sent');
    assert.match(img.content.caption, /^Rs\. 2500/, 'caption carries the reply text (footer is appended by design)');
    assert.equal(Buffer.isBuffer(img.content.image), true);
    await r.stop({ flush: false });
});

test('auto-reply sends a voice note when the attachment is audio', async () => {
    const { r, storage, say } = await setup();
    const key = `assets/${ME}/replies/2-abcd1234.ogg`;
    await storage.put(key, Buffer.from([1, 2, 3, 4]));
    r.meta.replies = { hi: { text: '', mediaKey: key, mediaType: 'voice' } };
    const out = await say('hi');
    const voice = out.find((x) => x.content.audio);
    assert.ok(voice, 'an audio message was sent');
    assert.equal(voice.content.ptt, true);
    assert.match(voice.content.mimetype, /audio\/ogg/);
    await r.stop({ flush: false });
});

test('auto-reply falls back to text when the stored media is gone', async () => {
    const { r, say } = await setup();
    r.meta.replies = { gone: { text: 'still here', mediaKey: `assets/${ME}/replies/missing.jpg`, mediaType: 'image' } };
    const out = await say('gone');
    assert.ok(out.some((x) => x.content.text?.startsWith('still here')), 'text fallback sent');
    assert.ok(!out.some((x) => x.content.image), 'no broken image sent');
    await r.stop({ flush: false });
});

test('legacy plain-text auto-replies still work', async () => {
    const { r, say } = await setup();
    r.meta.replies = { menu: 'ask the owner' };
    const out = await say('menu');
    assert.ok(out.some((x) => x.content.text?.startsWith('ask the owner')));
    await r.stop({ flush: false });
});

test('POST /api/panel/replies keeps media, rejects foreign keys, drops orphans', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wmp-pe-'));
    process.env.DATA_DIR = path.join(dir, 'data');
    const { createSite } = await import('../site/index.js');
    const { app, store, pairing } = await createSite({ cfg: loadConfig({ DATA_DIR: path.join(dir, 'data') }), log: quiet });
    const srv = app.listen(0, '127.0.0.1');
    await new Promise((r) => srv.once('listening', r));
    const base = `http://127.0.0.1:${srv.address().port}`;
    try {
        const NUM = '94770000099';
        const { panel } = issuePanel(0);
        const mine = `assets/${NUM}/replies/1-aaaa1111.jpg`;
        await store.s.put(mine, Buffer.from([1, 2, 3]));
        await store.saveMeta(NUM, { number: NUM, panel, replies: {} });
        const { tokenFor } = await import('../shared/panel-auth.js');
        const headers = { 'content-type': 'application/json', authorization: `Bearer ${NUM}.${tokenFor(NUM, panel.ver)}` };

        const r = await fetch(`${base}/api/panel/replies`, {
            method: 'POST', headers,
            body: JSON.stringify({
                replies: {
                    price: { text: 'Rs 2500', mediaKey: mine, mediaType: 'image' },
                    evil: { text: 'x', mediaKey: 'assets/94770000001/replies/steal.jpg', mediaType: 'image' },
                    badtype: { text: 'y', mediaKey: mine, mediaType: 'exe' },
                    plain: 'just text',
                    empty: '   '
                }
            })
        });
        assert.equal(r.status, 200);
        const replies = (await r.json()).replies;
        assert.deepEqual(replies.price, { text: 'Rs 2500', mediaKey: mine, mediaType: 'image' }, 'own media kept');
        assert.equal(replies.evil, 'x', "another number's mediaKey is stripped, text kept");
        assert.equal(replies.badtype, 'y', 'unknown mediaType is stripped');
        assert.equal(replies.plain, 'just text', 'plain text still supported');
        assert.ok(!('empty' in replies), 'blank reply dropped');
    } finally {
        srv.close(); await pairing.shutdown();
    }
});

test('owner replying to a NORMAL photo does NOT trigger a view-once reveal', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wmp-rv-'));
    const store = new SessionStore(new LocalStorage(path.join(dir, 'r2')));
    await store.saveCreds(ME, JSON.stringify({ me: { id: `${ME}:1@s.whatsapp.net` }, registered: true }));
    const handlers = {}; const sent = [];
    const sock = {
        user: { id: `${ME}:1@s.whatsapp.net` },
        ev: { on: (n, f) => { handlers[n] = f; }, removeAllListeners() {} },
        sendMessage: async (jid, content) => { const key = { id: `SK${sent.length}`, remoteJid: jid }; sent.push({ jid, content }); return { key }; },
        sendPresenceUpdate: async () => {}, readMessages: async () => {}, end() {},
        groupMetadata: async (jid) => ({ id: jid, subject: 'G', participants: [] }),
        profilePictureUrl: async () => { throw new Error('none'); }
    };
    const cfg = loadConfig({ DATA_DIR: path.join(dir, 'data'), CMD_COOLDOWN_MS: '0', START_DELAY_MS: '1' });
    const platform = {
        cfg: cfg.worker, commands: await loadCommands(), sessionCount: () => 1,
        cmdQueue: new PQueue({ concurrency: 4 }), dlQueue: new PQueue({ concurrency: 2 }),
        groupCache: new BoundedCache({ max: 10 }), devicesCache: new BoundedCache({ max: 10 }),
        makeSocket: () => sock
    };
    const r = new SessionRunner(ME, { store, cfg, log: quiet, platform });
    await r.start(); r.state = 'open';

    const sendAsOwner = (quotedMessage) => new Promise((res) => {
        const n = sent.length;
        handlers['messages.upsert']({
            type: 'notify', messages: [{
                key: { id: `T${Math.random()}`, remoteJid: '94711111111@s.whatsapp.net', fromMe: true },
                messageTimestamp: Math.floor(Date.now() / 1000),
                message: { extendedTextMessage: { text: '😍', contextInfo: { quotedMessage, participant: '94711111111@s.whatsapp.net' } } }
            }]
        });
        setTimeout(() => res(sent.slice(n)), 400);
    });

    const out = await sendAsOwner({ imageMessage: { mimetype: 'image/jpeg', caption: 'normal' } });
    assert.deepEqual(out, [], 'no reveal for a normal photo quote');
    await r.stop({ flush: false });
});
