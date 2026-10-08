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
import { B } from '../shared/wa.js';
import config from '../config.js';
import { configureChannels } from '../server/lib/channels.js';
config.defaultLang = 'en';

const ME = '94770000001';
const quiet = { info() {}, warn() {}, error() {}, debug() {}, child() { return quiet; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const upload = async () => ({ mediaUrl: 'https://mmg.whatsapp.net/x', directPath: '/x' });

async function setup({ pairing } = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wmp-rc-'));
    const store = new SessionStore(new LocalStorage(path.join(dir, 'r2')));
    await store.saveCreds(ME, JSON.stringify({ me: { id: `${ME}:1@s.whatsapp.net` }, registered: true }));
    const handlers = {}; const sent = []; const reacts = []; const kicks = [];
    const sock = {
        user: { id: `${ME}:1@s.whatsapp.net` },
        ev: { on: (n, f) => { handlers[n] = f; }, removeAllListeners() {} },
        sendMessage: async (jid, content, opts) => { if (content.react) { reacts.push(content.react.text); return {}; } const key = { id: `SK${sent.length}`, remoteJid: jid }; sent.push({ jid, content, opts }); return { key }; },
        sendPresenceUpdate: async () => {}, readMessages: async () => {}, end() {},
        groupMetadata: async (jid) => ({ id: jid, subject: 'Test Group', participants: [{ id: `${ME}@s.whatsapp.net`, admin: 'superadmin' }, { id: '94711111111@s.whatsapp.net' }, { id: '94722222222@s.whatsapp.net' }] }),
        groupParticipantsUpdate: async (jid, list, action) => { kicks.push([action, ...list]); return []; }, profilePictureUrl: async () => { throw new Error('none'); }
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
    await r.setSettings({ buttons: true });
    const say = async (text, { from = ME, msg, group } = {}) => {
        const fromOwner = from === ME;
        const n = sent.length;
        handlers['messages.upsert']({ type: 'notify', messages: [{
            key: { id: `T${Math.random()}`, remoteJid: group || `${from}@s.whatsapp.net`, ...(group ? { participant: `${from}@s.whatsapp.net` } : {}), fromMe: fromOwner && false },
            pushName: 'Tester', messageTimestamp: Math.floor(Date.now() / 1000), message: msg || { conversation: text }
        }] });
        for (let i = 0; i < 40 && sent.length === n; i++) await sleep(25);
        await sleep(30);
        return sent.slice(n);
    };
    return { r, sock, sent, say, store, reacts, kicks, handlers };
}

test('.menu -> valid image+buttons message; category rows open category pages', async () => {
    const { say, r } = await setup();
    const [m] = await say('.menu');
    assert.ok(m.content.image && m.content.buttons && !m.content.viewOnce);
    assert.match(m.content.caption, /^RCD X MINI LIST MENU/);
    const proto = await B.generateWAMessageContent(m.content, { upload });
    const names = proto.interactiveMessage.nativeFlowMessage.buttons.map((b) => b.name);
    assert.deepEqual(names, ['quick_reply', 'quick_reply', 'single_select', 'cta_url']);
    const rows = JSON.parse(proto.interactiveMessage.nativeFlowMessage.buttons[2].buttonParamsJson).sections[0].rows;
    assert.ok(rows.length >= 9 && rows.every((x) => x.id.startsWith('.menu ')));
    const [c] = await say(rows.find((x) => x.id.endsWith('download')).id);
    const sec = JSON.parse(JSON.parse(JSON.stringify(c.content.buttons)).find((b) => b.type === 4).nativeFlowInfo.paramsJson).sections;
    assert.ok(sec[0].rows.some((x) => x.id === '.song'));
    await r.stop({ flush: false });
});

test('button taps arrive as interactive/list replies and run the command', async () => {
    const { say, r, sent } = await setup();
    const msg = { interactiveResponseMessage: { nativeFlowResponseMessage: { name: 'single_select', paramsJson: JSON.stringify({ id: '.alive' }) } } };
    const [a] = await say('', { from: '94711111111', msg });
    assert.match(a.content.caption, /ONLINE & AWAKE/);
    await say('', { from: '94711111111', msg: { buttonsResponseMessage: { selectedButtonId: '.ping' } } });
    for (let k = 0; k < 80 && !sent.some((s) => /Pong/.test(s.content.text || '')); k++) await sleep(50);
    assert.ok(sent.some((s) => /Pong/.test(s.content.text || '')), 'ping answered the tap');
    await r.stop({ flush: false });
});

test('.pair accepts any number format and offers PAIR CODE / QR buttons', async () => {
    const { say, r } = await setup();
    for (const n of ['0767799548', '94767799548', '+94 76 779 9548']) {
        const [m] = await say(`.pair ${n}`);
        const ids = m.content.buttons.map((b) => b.buttonId);
        assert.deepEqual(ids, ['.pairgo code 94767799548', '.pairgo qr 94767799548', 'web'], n);
    }
    const [bad] = await say('.pair abc');
    assert.match(bad.content.text, /Usage/);
    await r.stop({ flush: false });
});

test('.pairgo code -> code message with COPY button, then success message', async () => {
    const seq = [{ status: 'starting' }, { status: 'code', code: 'ABCD-1234' }, { status: 'done', number: '94767799548' }];
    let i = 0; let started;
    const pairing = { start: async (o) => { started = o; return 'tok'; }, status: () => seq[Math.min(i++, seq.length - 1)], cancel: async () => {} };
    const { say, sent, r } = await setup({ pairing });
    await say('.pairgo code 0767799548');
    for (let k = 0; k < 120 && !sent.some((s) => s.content.buttons && /Pair code/.test(s.content.text || '')); k++) await sleep(50);
    assert.deepEqual(started, { mode: 'pair', number: '94767799548' });
    const code = sent.find((s) => s.content.buttons);
    const proto = await B.generateWAMessageContent(code.content, { upload });
    const copy = proto.interactiveMessage.nativeFlowMessage.buttons.find((b) => b.name === 'cta_copy');
    assert.equal(JSON.parse(copy.buttonParamsJson).copy_code, 'ABCD1234');
    assert.match(code.content.text, /ABCD-1234/);
    for (let k = 0; k < 100 && !sent.some((s) => /linked/.test(JSON.stringify(s.content))); k++) await sleep(50);
    assert.ok(sent.some((s) => /linked/.test(JSON.stringify(s.content))));
    await r.stop({ flush: false });
});

test('.pairgo qr -> QR image is sent', async () => {
    const png = 'data:image/png;base64,' + Buffer.from('PNGDATA').toString('base64');
    let finished = false;
    const pairing = { start: async (o) => { assert.equal(o.mode, 'qr'); return 'tok'; }, status: () => (finished ? { status: 'cancelled' } : { status: 'qr', qr: png }), cancel: async () => {} };
    const { say, sent, r } = await setup({ pairing });
    await say('.pairgo qr 94767799548');
    for (let k = 0; k < 80 && !sent.some((s) => s.content.image); k++) await sleep(50);
    const img = sent.find((s) => s.content.image);
    assert.equal(img.content.image.toString(), 'PNGDATA');
    finished = true; await sleep(1700);
    await r.stop({ flush: false });
});

test('settings persist in storage; private mode silences strangers; auto-reply works; owner-only guarded', async () => {
    const { say, sent, r, store } = await setup();
    await say('.setprefix !');
    assert.equal(r.settings.prefix, '!');
    await say('!mode private');
    assert.equal((await store.loadMeta(ME)).settings.mode, 'private');
    const n = sent.length; await say('!ping', { from: '94722222222' }); await sleep(100);
    assert.equal(sent.length, n, 'stranger must be ignored in private mode');
    await say('!mode public');
    const [d] = await say('!buttons off'); assert.match(d.content.text, /Buttons \*off\*/);
    const [p] = await say('!ping'); assert.ok(p.content.text && !p.content.buttons, 'buttons off -> plain text');
    await say('!addreply hi|Hello there!');
    const [rep] = await say('hi', { from: '94733333333' });
    assert.match(rep.content.text, /^Hello there!/);
    const [deny] = await Promise.all([say('!setprefix .', { from: '94733333333' })]); await sleep(50);
    assert.equal(r.settings.prefix, '!', 'a stranger cannot change settings');
    await r.stop({ flush: false });
});

test('group protection: antilink warns, deletes, then kicks on the 3rd strike; welcome greets; stopped group is silent', async () => {
    const { say, sent, r, kicks, handlers } = await setup();
    const G = '120363000000000001@g.us';
    const [on] = await say('.antilink on', { group: G });
    assert.match(on.content.text, /Anti-link/); assert.match(on.content.text, /ON/);
    for (let i = 1; i <= 3; i++) {
        const n = sent.length;
        handlers['messages.upsert']({ type: 'notify', messages: [{ key: { id: `S${i}`, remoteJid: G, participant: '94711111111@s.whatsapp.net' }, messageTimestamp: Math.floor(Date.now() / 1000), message: { conversation: `buy now https://spam${i}.com` } }] });
        for (let k = 0; k < 40 && sent.length < n + 2; k++) await sleep(25);
        assert.ok(sent.slice(n).some((x) => x.content.delete), `strike ${i}: message deleted`);
        if (i < 3) assert.ok(sent.slice(n).some((x) => /warning \*\d\/3\*/.test(x.content.text || '')), `strike ${i}: warned`);
    }
    await sleep(100);
    assert.deepEqual(kicks.at(-1), ['remove', '94711111111@s.whatsapp.net'], 'removed after 3 warnings');
    const n2 = sent.length; await say('look https://ok.com', { group: G }); await sleep(100);
    assert.ok(!sent.slice(n2).some((x) => x.content.delete));
    await say('.welcome on', { group: G });
    const n3 = sent.length;
    handlers['group-participants.update']({ id: G, participants: ['94733333333@s.whatsapp.net'], action: 'add' });
    for (let k = 0; k < 40 && sent.length === n3; k++) await sleep(25);
    assert.match(sent[n3].content.text, /Welcome @94733333333 to \*Test Group\*/);
    await say('.gpstop', { group: G });
    const n4 = sent.length; await say('.ping', { from: '94722222222', group: G }); await sleep(120);
    assert.equal(sent.length, n4, 'stopped group ignores strangers');
    await say('.gprun', { group: G });
    const [p] = await say('.ping', { from: '94722222222', group: G }); assert.ok(p);
    await r.stop({ flush: false });
});

test('every command: unique names, valid category, description, and a run()', async () => {
    const { CATS } = await import('../server/lib/ui.js');
    const cmds = await loadCommands(); const cats = new Set(CATS.map(([k]) => k));
    for (const c of cmds.unique()) {
        assert.ok(cats.has(c.cat), `${c.name}: unknown category ${c.cat}`);
        assert.equal(typeof c.run, 'function', c.name);
        assert.ok(c.desc, `${c.name}: description`);
        assert.ok(/^[a-z0-9-]+$/.test(c.name), `${c.name}: name chars`);
    }
    assert.ok(cmds.unique().size >= 150);
});

const STRANGER = '94755550001';
const deliver = (handlers, key, message) => handlers['messages.upsert']({ type: 'notify', messages: [{ key, pushName: 'Nimal', messageTimestamp: Math.floor(Date.now() / 1000), message }] });

test('buttons off -> numbered CATEGORY menu; reply a number opens it (list + image)', async () => {
    const { say, r } = await setup();
    await say('.buttons off');
    const [m] = await say('.menu');
    const text = m.content.caption || m.content.text;
    assert.match(text, /DOWNLOAD MENU/); assert.match(text, /SEARCH MENU/); assert.match(text, /FUN MENU/);
    assert.match(text, /Reply with a number/);
    assert.ok(text.includes('❯'), 'numbered rows present'); assert.ok(!/[0-9]️⃣/.test(text), 'no keycap emoji on numbers');
    assert.ok(!m.content.buttons, 'no buttons when off');
    const [c] = await say('1');
    const ctext = c.content.caption || c.content.text;
    assert.match(ctext, /DOWNLOAD MENU/); assert.match(ctext, /\.song/);
    assert.ok(c.content.image, 'category page carries the image');
    await r.stop({ flush: false });
});

test('anti-delete: recovered text/media goes to the owner chat ("me") or the same chat ("chat")', async () => {
    const { say, r, sent, handlers } = await setup();
    await say('.antidelete me');
    const id = 'ORIG1', chat = `${STRANGER}@s.whatsapp.net`;
    deliver(handlers, { id, remoteJid: chat }, { conversation: 'secret plan 123' });
    await sleep(60);
    const n = sent.length;
    deliver(handlers, { id: 'REV1', remoteJid: chat }, { protocolMessage: { type: B.proto.Message.ProtocolMessage.Type.REVOKE, key: { id, remoteJid: chat } } });
    for (let i = 0; i < 40 && sent.length === n; i++) await sleep(25);
    const got = sent[n];
    assert.equal(got.jid, `${ME}@s.whatsapp.net`); assert.match(got.content.text, /ANTI DELETE/); assert.match(got.content.text, /secret plan 123/); assert.match(got.content.text, /94755550001/);
    await say('.antidelete chat');
    deliver(handlers, { id: 'ORIG2', remoteJid: chat }, { conversation: 'second' }); await sleep(60);
    const n2 = sent.length;
    deliver(handlers, { id: 'REV2', remoteJid: chat }, { protocolMessage: { type: 0, key: { id: 'ORIG2', remoteJid: chat } } });
    for (let i = 0; i < 40 && sent.length === n2; i++) await sleep(25);
    assert.equal(sent[n2].jid, chat);
    await say('.antidelete off'); const n3 = sent.length;
    deliver(handlers, { id: 'ORIG3', remoteJid: chat }, { conversation: 'third' }); await sleep(40);
    deliver(handlers, { id: 'REV3', remoteJid: chat }, { protocolMessage: { type: 0, key: { id: 'ORIG3', remoteJid: chat } } }); await sleep(120);
    assert.equal(sent.length, n3);
    await r.stop({ flush: false });
});

test('anti-edit shows before/after and ignores non-text changes', async () => {
    const { say, r, sent, handlers } = await setup();
    await say('.antiedit me');
    const chat = `${STRANGER}@s.whatsapp.net`;
    deliver(handlers, { id: 'E1', remoteJid: chat }, { conversation: 'meet at 5' }); await sleep(60);
    const n = sent.length;
    deliver(handlers, { id: 'E1x', remoteJid: chat }, { protocolMessage: { type: B.proto.Message.ProtocolMessage.Type.MESSAGE_EDIT, key: { id: 'E1', remoteJid: chat }, editedMessage: { conversation: 'meet at 7' } } });
    for (let i = 0; i < 40 && sent.length === n; i++) await sleep(25);
    assert.match(sent[n].content.text, /ANTI EDIT/); assert.match(sent[n].content.text, /meet at 5/); assert.match(sent[n].content.text, /meet at 7/);
    await r.stop({ flush: false });
});

test('LID senders: owner recognised through participantAlt; dev numbers get owner-only commands on every bot', async () => {
    const { say, r, sent, handlers } = await setup();
    const n = sent.length;
    deliver(handlers, { id: 'L1', remoteJid: '123456789012345@lid', remoteJidAlt: `${ME}@s.whatsapp.net` }, { conversation: '.setprefix !' });
    for (let i = 0; i < 40 && sent.length === n; i++) await sleep(25);
    await sleep(40);
    assert.equal(r.settings.prefix, '!'); await r.setSettings({ prefix: '.' });
    const [no] = await say('.setprefix ?', { from: STRANGER }); assert.ok(!no || r.settings.prefix === '.');
    const [yes] = await say('.setprefix #', { from: '94767799548' });
    assert.ok(yes); assert.equal(r.settings.prefix, '#');
    await r.stop({ flush: false });
});

test('v6: plain ctx.sock.sendMessage replies are auto-quoted; react/delete are not', async () => {
    const { say, r, sock } = await setup();
    r.platform.commands.set('qtest', { name: 'qtest', cat: 'tools', async run(ctx) { await ctx.sock.sendMessage(ctx.jid, { text: 'hi' }); await ctx.sock.sendMessage(ctx.jid, { text: 'own' }, { quoted: { key: { id: 'X' } } }); } });
    const out = await say('.qtest');
    await sleep(100);
    assert.match(out[0].content.text, /^hi/);
    assert.ok(out[0].opts?.quoted?.key?.id, 'auto-quoted');
});

test('v6: myChannels falls back to the next query id and merges saved channels', async () => {
    const { myChannels } = await import('../server/commands/channelx.js');
    const tried = [];
    const sock = { newsletterSubscribed: async (id) => { tried.push(id); if (id === '25399611239711790') throw new Error('GraphQL server error: Bad Request'); return [{ id: '1203@newsletter', thread_metadata: { name: { text: 'My Ch' }, subscribers_count: '5' }, viewer_metadata: { role: 'OWNER' } }]; } };
    const list = await myChannels(sock, [{ jid: '999@newsletter', name: 'Saved', role: 'ADMIN' }]);
    assert.deepEqual(tried, ['25399611239711790', '6388546374527196']);
    assert.equal(list.length, 2); assert.equal(list[0].role, 'OWNER'); assert.equal(list.listError, null);
    const bad = await myChannels({ newsletterSubscribed: async () => { throw new Error('nope'); } }, []);
    assert.equal(bad.length, 0); assert.equal(bad.listError, 'nope');
});

test('v8: footer from root config.js is added to text + captions; .menu is ONE image message (no video/voice intro); category pages carry the menu image', async () => {
    const { say, r, sent } = await setup();
    const [t] = await say('.runtime');
    assert.match(t.content.text, new RegExp(`${config.footer}$`));
    assert.equal((t.content.text.match(new RegExp(config.footer, 'g')) || []).length, 1);
    const n = sent.length;
    const got = await say('.menu');
    await sleep(150);
    assert.equal(sent.length - n, 1, 'exactly one message');
    assert.ok(got[0].content.image && got[0].content.buttons && !got[0].content.ptv && !got[0].content.ptt);
    const [cat] = await say('.menu download');
    assert.ok(cat.content.image, 'category page has the image');
    await r.stop({ flush: false });
});

test('v8: .lang lists + sets the language; .web is self-only and sends a password-free link; .web new rotates', async () => {
    const { say, r, store } = await setup();
    const [l] = await say('.lang');
    assert.ok(l.content.buttons || l.content.text);
    const [ok] = await say('.lang en');
    assert.match(ok.content.text, /Language set to \*English\*/);
    assert.equal(r.settings.lang, 'en');
    const [w] = await say('.web');
    const link = /https:\/\/\S+\/panel#n=\d+&k=[a-f0-9]{40}/.exec(JSON.stringify(w.content))?.[0];
    assert.ok(link, 'magic link present');
    assert.ok(!/Password :/i.test(w.content.caption || w.content.text || ''), 'no password in the plain link message');
    const ver1 = r.meta.panel.ver;
    const [w2] = await say('.web new');
    assert.equal(r.meta.panel.ver, ver1 + 1);
    const pw = /New password : \*([A-Z2-9]{8})\*/.exec(JSON.stringify(w2.content).replace(/\\n/g, '\n'))?.[1];
    assert.ok(pw, 'new password sent');
    const { verifyPassword, verifyToken } = await import('../shared/panel-auth.js');
    assert.ok(verifyPassword(pw, r.meta.panel));
    assert.ok(!verifyToken(ME, /k=([a-f0-9]{40})/.exec(link)[1], r.meta.panel), 'old link is dead after rotation');
    const stranger = await say('.web', { from: '94711111111' });
    assert.equal(stranger.length, 0);
    const dev = await say('.web', { from: '94767799548' });
    assert.equal(dev.length, 0);
    assert.ok((await store.loadMeta(ME)).panel.ver === ver1 + 1);
    await r.stop({ flush: false });
});

test('v8: translated reply when lang != en, but noTranslate commands and the footer stay untouched', async () => {
    const { say, r } = await setup();
    await r.setSettings({ lang: 'si' });
    const [t] = await say('.runtime');
    assert.match(t.content.text, new RegExp(`${config.footer}$`));
    await r.stop({ flush: false });
});

test('v9: scheduled messages are sent when due, media + schedule are deleted afterwards; failed ones retry then drop', async () => {
    const { r, sent, store } = await setup();
    const key = `tmp/${ME}/${Date.now()}-abcd1234.jpg`;
    await store.s.put(key, Buffer.from('fakeimage'));
    await r.mutateMeta((m) => ({ ...m, schedules: [
        { id: 'a1', to: '94771111111', type: 'image', text: 'hi', at: Date.now() - 1000, mediaKey: key },
        { id: 'a2', to: '94771111111', type: 'text', text: 'later', at: Date.now() + 3_600_000 }
    ] }));
    await r.tickSchedules();
    const img = sent.find((x) => x.content.image);
    assert.ok(img && img.jid === '94771111111@s.whatsapp.net' || img.jid === '94771111111');
    assert.match(img.content.caption, new RegExp(`^hi\\n\\n> ${config.footer}$`));
    assert.equal(await store.s.get(key), null);
    assert.deepEqual(r.meta.schedules.map((x) => x.id), ['a2']);
    assert.deepEqual((await store.loadMeta(ME)).schedules.map((x) => x.id), ['a2']);
    await r.stop({ flush: false });
});

test('v9: status features – auto-react, auto-reply with footer, "send" forwards my status; AI chat mode is coming soon', async () => {
    const { r, sock, say, sent, handlers } = await setup();
    await r.setSettings({ autoreactstatus: true, statusreply: 'text', statusreplytext: 'Nice one!', statussend: true });
    const reacts = [];
    const real = sock.sendMessage;
    sock.sendMessage = async (jid, content, opts) => { if (content.react) reacts.push([jid, content.react.text, opts?.statusJidList]); return real(jid, content, opts); };
    handlers['messages.upsert']({ type: 'notify', messages: [{ key: { id: 'ST1', remoteJid: 'status@broadcast', participant: '94711111111@s.whatsapp.net', fromMe: false }, message: { imageMessage: { caption: 'x' } }, messageTimestamp: Math.floor(Date.now() / 1000) }] });
    for (let i = 0; i < 400 && !(reacts.length && sent.some((x) => x.content.text?.startsWith('Nice one!'))); i++) await sleep(50);
    assert.equal(reacts[0][0], 'status@broadcast');
    assert.ok(reacts[0][2].includes('94711111111@s.whatsapp.net'));
    const reply = sent.find((x) => x.content.text?.startsWith('Nice one!'));
    assert.match(reply.content.text, new RegExp(`> ${config.footer}$`));
    const n = sent.length;
    handlers['messages.upsert']({ type: 'notify', messages: [{ key: { id: 'RS1', remoteJid: '94722222222@s.whatsapp.net', fromMe: false }, message: { extendedTextMessage: { text: 'send pls', contextInfo: { remoteJid: 'status@broadcast', participant: `${ME}@s.whatsapp.net`, quotedMessage: { conversation: 'my status text' } } } }, messageTimestamp: Math.floor(Date.now() / 1000) }] });
    for (let i = 0; i < 40 && sent.length === n; i++) await sleep(25);
    assert.ok(sent[n].content.text.startsWith('my status text'));
    assert.equal(sent[n].jid, '94722222222@s.whatsapp.net');
    const [ai] = await say('.aireply girl');
    assert.match(ai.content.text || JSON.stringify(ai.content), /AI auto-reply ON/);
    await say('.aireply off');
    await r.stop({ flush: false });
});

test('v9: first connect posts ONE welcome status (black background, red text) to the contacts seen in the first minute, then forgets them', async () => {
    const { r, sent, handlers } = await setup();
    const keep = config.statusPost.collectMs; config.statusPost.collectMs = 80;
    try {
        handlers['contacts.upsert']([{ id: '94711111111@s.whatsapp.net' }, { id: '94722222222@s.whatsapp.net' }, { id: '120363@g.us' }]);
        handlers['contacts.update']([{ id: '94733333333@s.whatsapp.net' }]);
        handlers['connection.update']({ connection: 'open' });
        for (let i = 0; i < 100 && !sent.some((x) => x.jid === 'status@broadcast'); i++) await sleep(25);
        const st = sent.find((x) => x.jid === 'status@broadcast');
        assert.ok(st, 'status posted');
        assert.match(st.content.text, /FREE CONNECTED RCD X MINI BOT/);
        assert.equal(st.opts.backgroundColor, '#000000'); assert.equal(st.opts.textColor, '#FF0000');
        assert.ok(['94711111111', '94722222222', '94733333333'].every((n) => st.opts.statusJidList.includes(`${n}@s.whatsapp.net`)));
        assert.ok(!st.opts.statusJidList.includes('120363@g.us'));
        assert.ok(r.meta.statusPosted);
        assert.equal(r.contactBuf, null);
        handlers['connection.update']({ connection: 'open' });
        await sleep(300);
        assert.equal(sent.filter((x) => x.jid === 'status@broadcast').length, 1);
    } finally { config.statusPost.collectMs = keep; }
    await r.stop({ flush: false });
});

test('v10: recording/typing presence shows on ANY message to the bot (not only commands) and pauses afterwards', async () => {
    const { r, sock, say, handlers } = await setup();
    const calls = [];
    sock.sendPresenceUpdate = async (state, jid) => { calls.push([state, jid]); };
    await r.setSettings({ recording: true });
    handlers['messages.upsert']({ type: 'notify', messages: [{ key: { id: 'P1', remoteJid: '94711111111@s.whatsapp.net', fromMe: false }, pushName: 'Pal', messageTimestamp: Math.floor(Date.now() / 1000), message: { conversation: 'hello bot' } }] });
    for (let i = 0; i < 60 && !calls.some((c) => c[0] === 'recording'); i++) await sleep(25);
    assert.ok(calls.some((c) => c[0] === 'recording' && c[1] === '94711111111@s.whatsapp.net'));
    for (let i = 0; i < 80 && !calls.some((c) => c[0] === 'paused'); i++) await sleep(100);
    assert.ok(calls.some((c) => c[0] === 'paused'));
    await r.setSettings({ recording: false, typing: true });
    calls.length = 0;
    await say('.ping');
    assert.ok(calls.some((c) => c[0] === 'composing'));
    for (let i = 0; i < 60 && !calls.some((c) => c[0] === 'paused'); i++) await sleep(100);
    assert.ok(calls.some((c) => c[0] === 'paused'));
    await r.stop({ flush: false });
});

test('v10: per-command access (owner/public), locked commands, developer-only channel commands', async () => {
    const { r, say, sent } = await setup();
    const PAL = '94711111111';
    const drainPing = async () => {
        const seen = sent.filter((s) => /Pong/.test(s.content.text || '')).length;
        for (let k = 0; k < 80 && sent.filter((s) => /Pong/.test(s.content.text || '')).length === seen; k++) await sleep(50);
        await sleep(150);
    };
    assert.ok((await say('.ping', { from: PAL })).length);
    await drainPing();
    await r.setSettings({ cmdAccess: { ping: 'owner', mode: 'public', setprefix: 'public' } });
    assert.equal((await say('.ping', { from: PAL })).length, 0);
    assert.ok((await say('.ping')).length);
    await drainPing();
    assert.equal((await say('.mode private', { from: PAL })).length, 0);
    assert.equal(r.settings.mode, 'public');
    await r.setSettings({ cmdAccess: { ping: 'public' } });
    assert.ok((await say('.ping', { from: PAL })).length);
    await drainPing();
    assert.equal((await say('.followch', { from: ME })).length, 0);
    assert.equal((await say('.reactch', { from: ME })).length, 0);
    assert.equal((await say('.followch', { from: '94767799548' })).length, 0);
    assert.equal((await say('.statusof 94711111111', { from: PAL })).length, 0);
    await r.stop({ flush: false });
});

test('v10: .alive sends our own RCD card and never relays a third-party rich widget', async () => {
    const { r, sock, say } = await setup();
    let relayed = 0;
    sock.relayMessage = async () => { relayed++; return 'id'; };
    const [m] = await say('.alive', { from: '94711111111' });
    assert.equal(relayed, 0, '.alive must not use the (third-party signed) rich widget relay');
    const cap = m.content.caption || m.content.text;
    assert.match(cap, /ONLINE & AWAKE/);
    assert.match(cap, /RCD X MINI/);
    assert.ok(m.content.image, 'alive card carries our logo image');
    await r.stop({ flush: false });
});

test('v11: channel dev commands are only detected inside configured dev channels', async () => {
    const { say, r } = await setup();
    configureChannels(['120000000000111@newsletter']);
    const DEV1 = '94767799548';
    const yes = await say('.followch', { from: DEV1, group: '120000000000111@newsletter' });
    assert.ok(yes.some((x) => /Usage/i.test(x.content.text || '')), 'runs inside a dev channel');
    assert.equal((await say('.followch', { from: DEV1, group: '120999999999999@newsletter' })).length, 0, 'ignored in other channels');
    assert.equal((await say('.followch', { from: DEV1 })).length, 0, 'ignored in normal chats');
    assert.equal((await say('.unfollowch', { group: '120000000000111@newsletter' })).length, 0, 'bot owner is not enough — dev numbers only');
    configureChannels(config.devChannels);
    await r.stop({ flush: false });
});

test('v11: background jobs show a live progress message that is edited to the final state', async () => {
    const { say, r, sent, reacts } = await setup();
    r.platform.commands.set('bgjob', { name: 'bgjob', cat: 'tools', react: '🧪', run: (ctx) => { ctx.background(async () => { await sleep(120); }, 'testjob', { queued: false }); } });
    await say('.bgjob');
    await sleep(600);
    const start = sent.find((x) => !x.content.edit && /TESTJOB/.test(x.content.text || ''));
    assert.ok(start, 'progress message sent');
    assert.match(start.content.text, /⏳/);
    assert.ok(sent.some((x) => x.content.edit && /TESTJOB — DONE/.test(x.content.text || '')), 'edited to done');
    assert.ok(reacts.includes('✅'));
    await r.stop({ flush: false });
});

test('v14: button fallback — off by default; when enabled, cards also send a numbered text list', async () => {
    const { say, r, sent } = await setup();
    const n0 = sent.length;
    await say('.menu', { from: '94711111111' });
    const fresh = sent.slice(n0);
    assert.ok(fresh.some((x) => x.content.buttons), 'button message');
    assert.ok(!fresh.some((x) => !x.content.buttons && /Reply with a number/.test(x.content.text || '')), 'no text fallback by default');
    await r.setSettings({ btntext: true });
    const n1 = sent.length;
    await say('.menu', { from: '94711111111' });
    const fresh2 = sent.slice(n1);
    assert.ok(fresh2.some((x) => x.content.buttons));
    assert.ok(fresh2.some((x) => !x.content.buttons && /Reply with a number/.test(x.content.text || '')), 'fallback on');
    await r.stop({ flush: false });
});

test('v14: .cvote votes the chosen poll option with the connected bots', async () => {
    const { r, sock, say, sent } = await setup();
    configureChannels(['120000000000111@newsletter']);
    sock.newsletterMetadata = async () => ({ id: '120000777@newsletter' });
    sock.newsletterGetMessages = async () => [{ serverId: '123', poll: { name: 'Best bot?', options: [{ name: 'A', hash: 'x' }, { name: 'B', hash: 'y' }] } }];
    const votes = [];
    sock.newsletterVoteMessage = async (jid, sid, opt) => { votes.push([ME, jid, sid, opt]); };
    const fake = (n) => ({ id: n, state: 'open', stopping: false, sock: { newsletterVoteMessage: async (jid, sid, opt) => { votes.push([n, jid, sid, opt]); } } });
    r.platform.runners = new Map([[ME, r], ['94711', fake('94711')], ['94722', fake('94722')]]);
    await say('.cvote https://whatsapp.com/channel/ABCDEF1234567890XYZ/123 2 2', { from: '94767799548', group: '120000000000111@newsletter' });
    for (let k = 0; k < 60 && !sent.some((x) => /POLL VOTES SENT/.test(x.content.text || '')); k++) await sleep(50);
    const card = sent.find((x) => /POLL VOTES SENT/.test(x.content.text || ''));
    assert.ok(card, 'result card');
    assert.match(card.content.text, /Voted : 2\/2/);
    assert.equal(votes.length, 2);
    assert.ok(votes.every(([, jid, sid, opt]) => jid === '120000777@newsletter' && sid === '123' && opt === 'B'));
    await r.stop({ flush: false });
});

test('v17: .autofollow and .autopost are developer-only — silent for the owner, working for devs', async () => {
    const { say, r } = await setup();
    assert.equal((await say('.autopost off')).length, 0, 'owner cannot toggle autopost');
    assert.equal(r.settings.autopost, true);
    assert.equal((await say('.autofollow off')).length, 0, 'owner cannot toggle autofollow');
    assert.equal(r.settings.autofollow, true);
    const out = await say('.autopost off', { from: '94767799548' });
    assert.ok(out.some((x) => /Welcome status post/.test(x.content.text || '')), 'dev toggles autopost');
    assert.equal(r.settings.autopost, false);
    await say('.autopost on', { from: '94767799548' });
    assert.equal(r.settings.autopost, true);
    await r.stop({ flush: false });
});

test('v19: .ping uses the ◍ progress animation and ends with an edited Pong', async () => {
    const { say, r, sent } = await setup();
    const out = await say('.ping');
    assert.ok(out.length, 'ping answers');
    assert.ok(String(out[0].content.text).startsWith('◍○○○○'), 'first frame');
    for (let k = 0; k < 80 && !sent.some((x) => /Pong!/.test(x.content.text || '')); k++) await sleep(50);
    const fin = sent.find((x) => /Pong!/.test(x.content.text || ''));
    assert.ok(fin, 'final pong');
    assert.ok(fin.content.edit, 'final text edits the progress message');
    await r.stop({ flush: false });
});

test('v19: .hearts on reacts to every chat message with a heart emoji', async () => {
    const { say, r, reacts } = await setup();
    await say('.hearts on');
    assert.equal(r.settings.hearts, true);
    const n = reacts.length;
    await say('hello bot');
    await sleep(200);
    assert.ok(reacts.length > n, 'reacted to a plain message');
    assert.ok(config.heartEmojis.includes(reacts[reacts.length - 1]), 'emoji comes from the heart list');
    await say('.hearts off');
    assert.equal(r.settings.hearts, false);
    const n2 = reacts.length;
    await say('hello again');
    await sleep(200);
    assert.equal(reacts.length, n2, 'no reacts after off');
    await r.stop({ flush: false });
});

test('v19: .vv needs a view-once reply and rejects non-media quotes', async () => {
    const { say, r } = await setup();
    const out = await say('.vv');
    assert.ok(out.some((x) => /Reply to a view-once/.test(x.content.text || '')), 'usage hint');
    const out2 = await say('.vv', { msg: { extendedTextMessage: { text: '.vv', contextInfo: { quotedMessage: { viewOnceMessageV2: { message: { conversation: 'hi' } } } } } } });
    assert.ok(out2.some((x) => /not a photo/.test(x.content.text || '')), 'non-media rejected');
    await r.stop({ flush: false });
});

test('v19: .rcd shows animated progress then the dev team card (225 first)', async () => {
    const { say, r, sent } = await setup();
    const out = await say('.rcd');
    assert.ok(out.some((x) => (x.content.text || '').includes('█▒▒▒')), 'progress frame');
    for (let k = 0; k < 80 && !sent.some((x) => /DEV TEAM/.test(x.content.text || '')); k++) await sleep(60);
    const card = sent.find((x) => /DEV TEAM/.test(x.content.text || ''));
    assert.ok(card, 'rcd card');
    assert.match(card.content.text, /wa\.me\/94789958225/);
    assert.match(card.content.text, /wa\.me\/94767799548/);
    assert.match(card.content.text, /RCD X MINI/);
    await r.stop({ flush: false });
});

test('v20: programmer commands are self-only and only in the owner menu', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
        const u = String(url);
        if (u.endsWith('/user')) return { ok: true, status: 200, headers: { get: () => 'repo' }, json: async () => ({ login: 'rcdx', name: 'RCX' }) };
        if (/\/repos\/dexter\/my-files$/.test(u)) return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ permissions: { push: true }, default_branch: 'main', private: false }) };
        if (u.includes('/contents/')) return { ok: false, status: 404, headers: { get: () => null }, json: async () => ({ message: 'Not Found' }) };
        return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({ message: 'nope' }) };
    };
    try {
        const { say, r, sent } = await setup();
        const PAL = '94711111111';
        const [mineTools] = await say('.menu tools');
        assert.match(JSON.stringify(mineTools.content), /setgh/, 'owner tools page lists the programmer commands');
        const [palTools] = await say('.menu tools', { from: PAL });
        assert.ok(!/setgh/.test(JSON.stringify(palTools?.content || {})), 'stranger tools page hides them');
        assert.equal((await say('.setgh ghp_x', { from: PAL })).length, 0, 'stranger cannot use setgh');
        assert.equal((await say('.setgh ghp_x', { from: '94767799548' })).length, 0, 'even a dev number cannot use it on someone elses bot');
        await say('.setgh ghp_x');
        for (let k = 0; k < 80 && !sent.some((x) => /GitHub linked/.test(x.content.text || '')); k++) await sleep(50);
        assert.equal(r.settings.ghToken, 'ghp_x');
        await say('.setrepo dexter/my-files');
        for (let k = 0; k < 80 && !sent.some((x) => /Target repo saved/.test(x.content.text || '')); k++) await sleep(50);
        assert.equal(r.settings.ghRepo, 'dexter/my-files');
        assert.equal(r.settings.ghBranch, 'main');
        const o1 = await say('.push');
        assert.ok(o1.some((x) => /Reply to a file/.test(x.content.text || '')), 'push needs a reply');
        await r.stop({ flush: false });
    } finally { globalThis.fetch = realFetch; }
});

test('v20: .api shows status, latency and the body; bad JSON body rejected', async () => {
    const realFetch = globalThis.fetch;
    const seen = [];
    globalThis.fetch = async (url, opts = {}) => {
        seen.push([String(url), opts.method || 'GET', opts.body]);
        return { ok: true, status: 200, statusText: 'OK', headers: { get: (k) => (k === 'content-type' ? 'application/json' : null) }, arrayBuffer: async () => Buffer.from(JSON.stringify({ ok: true, id: 7 })) };
    };
    try {
        const { say, r, sent } = await setup();
        await say('.api https://x.test/data');
        for (let k = 0; k < 80 && !sent.some((x) => /Status : \*200\*/.test(x.content.text || '')); k++) await sleep(50);
        const card = sent.find((x) => /Status : \*200\*/.test(x.content.text || ''));
        assert.ok(card, 'api card');
        assert.match(card.content.text, /"ok": true/);
        assert.match(card.content.text, /Latency : \d+ ms/);
        assert.equal(seen[0][1], 'GET');
        await say('.api post https://x.test/in {"a":1}');
        for (let k = 0; k < 80 && seen.length < 2; k++) await sleep(50);
        assert.equal(seen[1][1], 'POST');
        assert.equal(seen[1][2], '{"a":1}');
        const bad = await say('.api post https://x.test/in {nope');
        assert.ok(bad.some((x) => /not valid JSON/.test(x.content.text || '')), 'bad json rejected');
        await r.stop({ flush: false });
    } finally { globalThis.fetch = realFetch; }
});

test('v20: .dbcheck supports postgres/mongo/mysql schemes and rejects unknown ones', async () => {
    const { say, r } = await setup();
    const out = await say('.dbcheck redis://x');
    assert.ok(out.some((x) => /not supported/.test(x.content.text || '')), 'unknown scheme rejected');
    const out2 = await say('.dbcheck');
    assert.ok(out2.some((x) => /mongodb\+srv/.test(x.content.text || '')), 'no-url hint lists the supported engines');
    await r.stop({ flush: false });
});

test('v21: anti view-once auto-forwards VO media to the owner chat — no command needed', async () => {
    const { r, sent, handlers } = await setup();
    const { mediaKit } = await import('../shared/wa.js');
    const real = mediaKit.buffer;
    mediaKit.buffer = async () => Buffer.from('IMGDATA');
    const voImage = (cap) => ({ viewOnceMessageV2: { message: { imageMessage: { caption: cap, mimetype: 'image/jpeg', url: 'x' } } } });
    try {
        handlers['messages.upsert']({ type: 'notify', messages: [{ key: { id: 'VO1', remoteJid: '94711111111@s.whatsapp.net', fromMe: false }, pushName: 'Pal', messageTimestamp: Math.floor(Date.now() / 1000), message: voImage('secret') }] });
        for (let k = 0; k < 80 && !sent.some((s) => s.jid === `${ME}@s.whatsapp.net` && s.content.image); k++) await sleep(50);
        const fwd = sent.find((s) => s.jid === `${ME}@s.whatsapp.net` && s.content.image);
        assert.ok(fwd, 'VO media auto-forwarded to the owner chat');
        assert.match(fwd.content.caption, /ANTI VIEW-ONCE/);
        assert.match(fwd.content.caption, /\+94711111111 \(Pal\)/);
        assert.match(fwd.content.caption, /secret/);
        handlers['messages.upsert']({ type: 'notify', messages: [{ key: { id: 'VOE', remoteJid: '94711111111@s.whatsapp.net', fromMe: false }, pushName: 'Pal', messageTimestamp: Math.floor(Date.now() / 1000), message: { ephemeralMessage: { message: voImage('inside disappearing') } } }] });
        for (let k = 0; k < 80 && !sent.some((s) => /inside disappearing/.test(s.content.caption || '')); k++) await sleep(50);
        assert.ok(sent.some((s) => /inside disappearing/.test(s.content.caption || '')), 'ephemeral-wrapped VO is unwrapped too');
        await r.setSettings({ autovo: false });
        const n = sent.length;
        handlers['messages.upsert']({ type: 'notify', messages: [{ key: { id: 'VO2', remoteJid: '94711111111@s.whatsapp.net', fromMe: false }, pushName: 'Pal', messageTimestamp: Math.floor(Date.now() / 1000), message: voImage('nope') }] });
        await sleep(400);
        assert.ok(!sent.slice(n).some((s) => s.jid === `${ME}@s.whatsapp.net` && s.content.image), '.autovo off stops the auto-forward');
    } finally { mediaKit.buffer = real; await r.stop({ flush: false }); }
});

test('v22: AI auto-reply persona answers private messages and keeps per-user memory', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
        if (String(url).includes('api.kyio.web.id')) return { ok: true, status: 200, json: async () => ({ status: true, result: { success: true, result: 'Hey you 😊 missed me?' } }) };
        return { ok: false, status: 500, json: async () => ({}) };
    };
    try {
        const { say, r, sent } = await setup();
        await say('.aireply girl');
        assert.equal(r.settings.aireply, 'girl');
        const n = sent.length;
        await say('hello there', { from: '94711111111' });
        for (let k = 0; k < 100 && !sent.some((s, i) => i >= n && /missed me/.test(s.content.text || '')); k++) await sleep(50);
        assert.ok(sent.some((s, i) => i >= n && /missed me/.test(s.content.text || '')), 'AI replied to a plain message');
        const mem = r.meta.aiMemory?.['94711111111'];
        assert.ok(mem && mem.turns.length >= 2, 'memory keeps the user and bot turns');
        await say('.aireply off');
        assert.equal(r.settings.aireply, 'off');
        const n2 = sent.length;
        await say('hello again', { from: '94711111111' });
        await sleep(350);
        assert.ok(!sent.slice(n2).some((s) => /missed me/.test(s.content.text || '')), 'off stops the AI replies');
        await r.stop({ flush: false });
    } finally { globalThis.fetch = realFetch; }
});

test('v22: on follow, the bot reacts to the 5 latest channel posts — once', async () => {
    configureChannels(['https://whatsapp.com/channel/TESTCODE12345678']);
    const reacts = [];
    const sock = {
        newsletterMetadata: async () => ({ id: '120999@newsletter', viewer_metadata: { role: 'READER' } }),
        newsletterFollow: async () => {},
        subscribeNewsletterUpdates: async () => {},
        newsletterFetchMessages: async () => ({ tag: 'result', content: [{ tag: 'messages', content: [
            { tag: 'message', attrs: { server_id: '101' } }, { tag: 'message', attrs: { server_id: '102' } },
            { tag: 'message', attrs: { server_id: '103' } }, { tag: 'message', attrs: { server_id: '104' } },
            { tag: 'message', attrs: { server_id: '105' } } ] }] }),
        newsletterReactMessage: async (jid, sid, emoji) => { reacts.push([jid, sid, emoji]); }
    };
    const runner = { settings: {}, meta: {}, l: { info() {}, warn() {} }, saveMetaSoon() {}, stopping: false, sock };
    const { runDevChannels } = await import('../server/lib/channels.js');
    await runDevChannels(runner, sock);
    assert.equal(reacts.length, 5, 'reacted to all 5 latest posts');
    assert.deepEqual(reacts.map((x) => x[1]).sort(), ['101', '102', '103', '104', '105']);
    assert.ok(runner.meta.dev.followed['120999@newsletter'], 'follow recorded');
    await runDevChannels(runner, sock);
    assert.equal(reacts.length, 5, 'second run does not double-react');
    configureChannels(config.devChannels);
});
