import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { segments, langFromNumber, resolveLang, translateText } from '../shared/i18n.js';
import { issuePanel, verifyPassword, verifyToken, tokenFor, panelLink } from '../shared/panel-auth.js';
import { SCHEMA, sanitize } from '../shared/panel-settings.js';
import { mountPanel } from '../site/panel.js';
import { csongCaption, csongTail, DEFAULT_NAME, DEFAULT_FOOTER, renderCsong, DEFAULT_TEMPLATE, TEMPLATE_PLACEHOLDERS } from '../server/lib/csong.js';
import { captionFor } from '../server/commands/channelx.js';
import { LocalStorage } from '../shared/storage.js';
import { SessionStore } from '../shared/session-store.js';

test('i18n: country code -> language, manual overrides, English always possible', () => {
    assert.equal(langFromNumber('94771234567'), 'si');
    assert.equal(langFromNumber('+91 99999 99999'), 'hi');
    assert.equal(langFromNumber('971500000000'), 'ar');
    assert.equal(langFromNumber('15551234567'), 'en');
    assert.equal(resolveLang('auto', '94753262213'), 'si');
    assert.equal(resolveLang('en', '94753262213'), 'en');
    assert.equal(resolveLang('de', '94753262213'), 'de');
    assert.equal(resolveLang('zz', '94753262213'), 'si');
});

test('i18n: only plain phrases are translated – commands, links, code, names, user args, brands are protected', () => {
    const text = '🎵 *SONG RESULT*\n👤 Artist : Alan Walker\nTap to open `.menu` or send .ping now https://x.com/a RAM 120 MB Node v20\nSearching for lalitha songs on YouTube';
    const src = segments(text, 'lalitha').map((x) => x.src);
    assert.ok(src.includes('SONG RESULT') && src.includes('Artist') && src.includes('Tap to open'));
    assert.ok(!src.some((x) => /Alan|Walker|menu|ping|https|RAM|Node|lalitha/.test(x)), JSON.stringify(src));
});

test('i18n: English passes through untouched and a failing network falls back to the original', async () => {
    assert.equal(await translateText('Hello there friend', 'en'), 'Hello there friend');
    const real = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('offline'); };
    try { assert.equal(await translateText('Totally unique offline sentence', 'fr', { budgetMs: 500 }), 'Totally unique offline sentence'); }
    finally { globalThis.fetch = real; }
});

test('panel auth: password + stateless token, rotation kills old ones', () => {
    const a = issuePanel();
    assert.match(a.password, /^[A-HJKMNP-Z2-9]{8}$/);
    assert.ok(verifyPassword(a.password.toLowerCase(), a.panel));
    assert.ok(!verifyPassword('WRONG123', a.panel));
    const tok = tokenFor('94770000001', a.panel.ver);
    assert.ok(verifyToken('94770000001', tok, a.panel));
    assert.ok(!verifyToken('94770000002', tok, a.panel));
    const b = issuePanel(a.panel.ver);
    assert.ok(!verifyToken('94770000001', tok, b.panel));
    assert.match(panelLink('https://x.app', '94770000001', 1), /^https:\/\/x\.app\/panel#n=94770000001&k=[a-f0-9]{40}$/);
});

test('panel settings: whitelist only – footer, unknown keys and bad values are dropped', () => {
    assert.ok(!SCHEMA.some((f) => /^(footer|poweredBy)$/i.test(f.key)));
    const out = sanitize({ footer: 'HACK', mode: 'private', antidelete: 'nope', buttons: 'true', prefix: 'a', botName: '  My Bot\n ', lang: 'si', evil: 1 });
    assert.deepEqual(out, { mode: 'private', buttons: true, botName: 'My Bot', lang: 'si' });
});

test('panel API: login, me, save – wrong password blocked, rate-limited', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wmp-panel-'));
    const store = new SessionStore(new LocalStorage(path.join(dir, 'r2')));
    const { password, panel } = issuePanel();
    await store.saveMeta('94770000001', { number: '94770000001', panel, settings: { prefix: '!' } });
    const app = express(); app.use(express.json());
    mountPanel(app, { store, log: { info() {}, warn() {}, error() {} } });
    const srv = app.listen(0); const base = `http://127.0.0.1:${srv.address().port}`;
    const call = async (url, opts = {}) => { const r = await fetch(base + url, { ...opts, headers: { 'content-type': 'application/json', ...(opts.headers || {}) } }); return [r.status, await r.json()]; };
    try {
        let [st, j] = await call('/api/panel/login', { method: 'POST', body: JSON.stringify({ number: '94770000001', password }) });
        assert.equal(st, 200);
        const auth = { authorization: `Bearer ${j.number}.${j.token}` };
        [st, j] = await call('/api/panel/me', { headers: auth });
        assert.equal(st, 200); assert.equal(j.values.prefix, '!'); assert.ok(j.schema.length > 10);
        [st, j] = await call('/api/panel/settings', { method: 'POST', headers: auth, body: JSON.stringify({ settings: { mode: 'private', footer: 'x' } }) });
        assert.equal(st, 200); assert.equal(j.values.mode, 'private');
        assert.equal((await store.loadMeta('94770000001')).settings.mode, 'private');
        [st] = await call('/api/panel/me', { headers: { authorization: `Bearer 94770000001.${'0'.repeat(40)}` } });
        assert.equal(st, 401);
        for (let i = 0; i < 9; i++) [st] = await call('/api/panel/login', { method: 'POST', body: JSON.stringify({ number: '94770000001', password: 'BADPASS1' }) });
        assert.equal(st, 429);
    } finally { srv.close(); }
});

test('csong caption: default name + footer, and every user can set their own (sanitised)', () => {
    assert.ok(csongCaption('Title', {}).endsWith(`> *${DEFAULT_NAME}\n${DEFAULT_FOOTER}*`));
    const c = csongCaption('Title', { csongName: 'My *Channel*', csongFooter: 'follow us\nnow' });
    assert.ok(c.endsWith('> *My Channel\nfollow us now*'), c);
    assert.equal(csongTail({ csongName: '', csongFooter: '' }), csongTail());
});

test('v23 csong template: placeholders render, custom template wins, legacy fallback still works, panel field editable', () => {
    const out = renderCsong({}, { title: 'Heenak', views: '1.2M', duration: '3:34', ago: '2 days' });
    assert.ok(out.includes('ᴛɪᴛʟᴇ : Heenak'), out);
    assert.ok(out.includes('3:34'));
    assert.ok(out.includes(`> *${DEFAULT_NAME}`));
    assert.ok(out.includes(DEFAULT_FOOTER));
    assert.ok(out.length <= 2000);
    const custom = renderCsong({ csongTemplate: '🎧 {title} | {views} views | {duration} | {ago} — {bot} — {footer} {unknown}' },
        { title: 'A', views: '9', duration: '1:00', ago: 'now' });
    assert.equal(custom, `🎧 A | 9 views | 1:00 | now — ${DEFAULT_NAME} — ${DEFAULT_FOOTER} {unknown}`);
    assert.deepEqual(TEMPLATE_PLACEHOLDERS, ['title', 'views', 'duration', 'ago', 'bot', 'footer']);
    const fresh = captionFor({}, { title: 'Song X', duration: '2:20' }, {});
    assert.ok(fresh.includes('.ılılılllı'), 'default settings use the fancy template');
    assert.ok(fresh.includes('Song X') && fresh.includes('2:20'));
    const legacy = captionFor({}, { title: 'Song Y' }, { csongName: 'MyChan', csongFooter: 'link' });
    assert.ok(legacy.includes('☘️ *Title: Song Y*'), 'legacy csongName keeps the old body');
    assert.ok(legacy.endsWith('> *MyChan\nlink*'));
    const forced = captionFor({}, { title: 'Song Z' }, { csongName: 'MyChan', csongTemplate: 'T:{title}' });
    assert.equal(forced, 'T:Song Z');
    const f = SCHEMA.find((x) => x.key === 'csongTemplate');
    assert.ok(f && f.type === 'textarea' && f.max === 1500);
    const big = sanitize({ csongTemplate: 'X'.repeat(2000) });
    assert.equal(big.csongTemplate.length, 1500);
    assert.equal(sanitize({ csongTemplate: '' }).csongTemplate, '');
});

test('panel settings: new status + csong fields are editable, AI auto-reply is a persona select, channel follow is gone', () => {
    const ai = SCHEMA.find((f) => f.key === 'aireply');
    assert.equal(ai.type, 'select');
    assert.ok(!ai.soon);
    assert.ok(!SCHEMA.some((f) => f.key === 'autofollow'));
    const out = sanitize({ aireply: 'girl', hearts: true, autovo: false, autofollow: false, statusreply: 'both', autoreactstatus: true, statussend: true, statusreplytext: 'Hi\nthere', csongName: 'X', csongFooter: 'Y' });
    assert.deepEqual(out, { aireply: 'girl', hearts: true, autovo: false, statusreply: 'both', autoreactstatus: true, statussend: true, statusreplytext: 'Hi\nthere', csongName: 'X', csongFooter: 'Y' });
});

test('panel API: schedule + upload + replies + status voice (media is stored temporarily and removed with the schedule)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wmp-panel2-'));
    const store = new SessionStore(new LocalStorage(path.join(dir, 'r2')));
    const { panel } = issuePanel();
    const N = '94770000002';
    await store.saveMeta(N, { number: N, panel });
    const app = express(); app.use(express.json({ limit: '64kb' }));
    mountPanel(app, { store, log: { info() {}, warn() {}, error() {} } });
    const srv = app.listen(0); const base = `http://127.0.0.1:${srv.address().port}`;
    const H = { authorization: `Bearer ${N}.${tokenFor(N, panel.ver)}` };
    const J = { ...H, 'content-type': 'application/json' };
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    try {
        let r = await fetch(`${base}/api/panel/upload?kind=image`, { method: 'POST', headers: { ...H, 'content-type': 'image/png' }, body: png });
        const up = await r.json();
        assert.equal(r.status, 200); assert.match(up.mediaKey, new RegExp(`^tmp/${N}/\\d+-[a-f0-9]{8}\\.jpg$`));
        assert.ok(await store.s.get(up.mediaKey));
        r = await fetch(`${base}/api/panel/upload?kind=image`, { method: 'POST', headers: { ...H, 'content-type': 'application/pdf' }, body: png });
        assert.equal(r.status, 415);
        const at = Date.now() + 3600_000;
        r = await fetch(`${base}/api/panel/schedule`, { method: 'POST', headers: J, body: JSON.stringify({ to: '+94 77 111 1111', type: 'image', text: 'hello', at, mediaKey: up.mediaKey, mime: up.mime }) });
        let j = await r.json();
        assert.equal(r.status, 200); assert.equal(j.schedules.length, 1); assert.equal(j.schedules[0].to, '94771111111');
        r = await fetch(`${base}/api/panel/schedule`, { method: 'POST', headers: J, body: JSON.stringify({ to: '94771111111', type: 'text', text: 'x', at: Date.now() - 999999 }) });
        assert.equal(r.status, 400);
        r = await fetch(`${base}/api/panel/schedule`, { method: 'POST', headers: J, body: JSON.stringify({ to: '94771111111', type: 'image', at, mediaKey: `tmp/94779999999/1-aaaaaaaa.jpg` }) });
        assert.equal(r.status, 400);
        r = await fetch(`${base}/api/panel/replies`, { method: 'POST', headers: J, body: JSON.stringify({ replies: { ' Hi  There ': 'Hello!', '': 'x' } }) });
        j = await r.json(); assert.deepEqual(j.replies, { 'hi there': 'Hello!' });
        r = await fetch(`${base}/api/panel/schedule/${j.schedules[0].id}`, { method: 'DELETE', headers: H });
        j = await r.json(); assert.equal(j.schedules.length, 0);
        assert.equal(await store.s.get(up.mediaKey), null, 'media removed with the schedule');
    } finally { srv.close(); }
});

test('panel API: command access map is sanitised and stored in settings', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wmp-acc-'));
    const store = new SessionStore(new LocalStorage(path.join(dir, 'r2')));
    const { password, panel } = issuePanel();
    await store.saveMeta('94770000001', { number: '94770000001', panel, settings: { prefix: '!' } });
    const app = express(); app.use(express.json());
    mountPanel(app, { store, log: { info() {}, warn() {}, error() {} } });
    const srv = app.listen(0); const base = `http://127.0.0.1:${srv.address().port}`;
    try {
        const login = await (await fetch(base + '/api/panel/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ number: '94770000001', password }) })).json();
        const h = { 'content-type': 'application/json', authorization: `Bearer 94770000001.${login.token}` };
        const r = await fetch(base + '/api/panel/access', { method: 'POST', headers: h, body: JSON.stringify({ access: { Ping: 'owner', sticker: 'public', bad: 'root', 'x y': 'owner', ['a'.repeat(30)]: 'owner' } }) });
        const j = await r.json();
        assert.deepEqual(j.access, { ping: 'owner', sticker: 'public' });
        assert.equal((await store.loadMeta('94770000001')).settings.cmdAccess.ping, 'owner');
        assert.equal((await store.loadMeta('94770000001')).settings.prefix, '!');
    } finally { srv.close(); }
});
