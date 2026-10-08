import { verifyPassword, verifyToken, tokenFor } from '../shared/panel-auth.js';
import { SCHEMA, sanitize, defaultSettings } from '../shared/panel-settings.js';
import { resolveLang, langFromNumber } from '../shared/i18n.js';
import crypto from 'node:crypto';
import express from 'express';
import { cleanAccess } from '../shared/cmd-access.js';
import { toVoice } from '../server/lib/media.js';

const NUMBER = /^\d{6,16}$/;
const MAX_SCHEDULES = 20;
const MAX_REPLIES = 50;
const MAX_UPLOAD = 10 << 20;
const TARGET = /^(me|\d{6,16}|\d{6,20}(-\d+)?@g\.us)$/;

export function mountPanel(app, { store, log }) {
    const fails = new Map();
    const blocked = (key) => {
        const now = Date.now();
        const arr = (fails.get(key) || []).filter((t) => now - t < 15 * 60_000);
        fails.set(key, arr);
        return arr.length >= 8;
    };
    const fail = (key) => fails.set(key, [...(fails.get(key) || []), Date.now()]);
    setInterval(() => { const n = Date.now(); for (const [k, v] of fails) if (v.every((t) => n - t > 900_000)) fails.delete(k); }, 300_000).unref();

    const runnerOf = (number) => globalThis.__rcdManager?.runners?.get(number) || null;
    const metaOf = async (number) => runnerOf(number)?.meta || (await store.loadMeta(number).catch(() => null));

    async function auth(req, res) {
        const m = /^Bearer (\d{6,16})\.([a-f0-9]{40})$/.exec(req.get('authorization') || '');
        if (!m) { res.status(401).json({ error: 'Please sign in again.' }); return null; }
        const [, number, token] = m;
        if (blocked(`t:${req.ip}`)) { res.status(429).json({ error: 'Too many attempts. Try again later.' }); return null; }
        const meta = await metaOf(number);
        if (!meta?.panel || !verifyToken(number, token, meta.panel)) { fail(`t:${req.ip}`); res.status(401).json({ error: 'This link is no longer valid. Send .web to your bot for a new one.' }); return null; }
        return { number, meta };
    }

    const mutate = async (number, fn) => {
        const r = runnerOf(number);
        if (r) return r.mutateMeta(fn);
        const meta = fn({ ...((await store.loadMeta(number)) || { number }) });
        await store.saveMeta(number, meta);
    };

    const view = async (number, meta) => {
        const r = runnerOf(number);
        const values = { ...defaultSettings(), ...(meta.settings || {}) };
        const pn = meta.pn || number;
        return {
            number, pn, state: r?.state || 'offline', values, schema: SCHEMA,
            language: resolveLang(values.lang, pn), detectedLanguage: langFromNumber(pn), linkedAt: meta.linkedAt || null,
            schedules: (meta.schedules || []).map((x) => ({ id: x.id, to: x.to, type: x.type, text: x.text || '', at: x.at, size: x.size || 0 })).sort((a, b) => a.at - b.at),
            replies: meta.replies || {},
            access: cleanAccess(meta.settings?.cmdAccess),
            statusVoice: meta.statusVoice ? { at: meta.statusVoice.at, size: meta.statusVoice.size } : null,
            limits: { schedules: MAX_SCHEDULES, replies: MAX_REPLIES, uploadMb: MAX_UPLOAD >> 20 }
        };
    };

    const fresh = async (number) => view(number, (await metaOf(number)) || {});

    const sweepTmp = async (number, meta) => {
        const keep = new Set((meta.schedules || []).map((x) => x.mediaKey).filter(Boolean));
        const { keys } = await store.s.list(`tmp/${number}/`).catch(() => ({ keys: [] }));
        for (const k of keys) {
            const ts = Number(/\/(\d+)-/.exec(k)?.[1] || 0);
            if (!keep.has(k) && Date.now() - ts > 2 * 3600_000) await store.s.del(k).catch(() => {});
        }
    };

    const KINDS = {
        image: { mime: /^image\/(jpeg|png|webp)$/, ext: 'jpg', process: 'image' },
        video: { mime: /^video\/(mp4|quicktime|webm|3gpp)$/, ext: 'mp4' },
        voice: { mime: /^(audio|video)\/[\w.+-]+$/, process: 'voice' },
        statusvoice: { mime: /^(audio|video)\/[\w.+-]+$/ },
        rimage: { mime: /^image\/(jpeg|png|webp)$/, ext: 'jpg', process: 'image', persist: 'replies' },
        rvideo: { mime: /^video\/(mp4|quicktime|webm|3gpp)$/, ext: 'mp4', persist: 'replies' },
        rvoice: { mime: /^(audio|video)\/[\w.+-]+$/, process: 'voice', persist: 'replies' }
    };
    const AUDIO_EXT = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/m4a': 'm4a', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/webm': 'webm', 'video/webm': 'webm', 'video/mp4': 'mp4', 'audio/aac': 'aac' };

    app.post('/api/panel/login', async (req, res) => {
        const number = String(req.body?.number || '').replace(/\D/g, '');
        const password = String(req.body?.password || '');
        if (!NUMBER.test(number) || !password) return res.status(400).json({ error: 'Enter your number and password.' });
        if (blocked(`l:${req.ip}`) || blocked(`n:${number}`)) return res.status(429).json({ error: 'Too many attempts. Please wait 15 minutes.' });
        const meta = await metaOf(number);
        if (!meta?.panel || !verifyPassword(password, meta.panel)) {
            fail(`l:${req.ip}`); fail(`n:${number}`);
            return res.status(401).json({ error: 'Wrong number or password.' });
        }
        res.json({ number, token: tokenFor(number, meta.panel.ver) });
    });

    app.get('/api/panel/me', async (req, res) => {
        const a = await auth(req, res); if (!a) return;
        res.json(await view(a.number, a.meta));
    });

    app.get('/api/panel/output', async (req, res) => {
        const a = await auth(req, res); if (!a) return;
        const since = Number(req.query.since || 0);
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, at: Date.now(), lines: getRecentLogs(since) });
    });

    app.post('/api/panel/upload', express.raw({ type: () => true, limit: MAX_UPLOAD }), async (req, res) => {
        const a = await auth(req, res); if (!a) return;
        try {
            const kind = String(req.query.kind || '');
            const spec = KINDS[kind];
            const mime = String(req.get('content-type') || '').split(';')[0].trim().toLowerCase();
            const body = req.body;
            if (!spec || !Buffer.isBuffer(body) || !body.length) return res.status(400).json({ error: 'Choose a file first.' });
            if (!spec.mime.test(mime)) return res.status(415).json({ error: 'That file type is not supported.' });
            let out = body, ext = spec.ext;
            if (spec.process === 'image') {
                const { default: sharp } = await import('sharp');
                out = await sharp(body, { failOn: 'none' }).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
            } else if (spec.process === 'voice') {
                out = await toVoice(body, AUDIO_EXT[mime] || 'bin');
                ext = 'ogg';
            }
            if (kind === 'statusvoice') {
                const key = `assets/${a.number}/status-voice.ogg`;
                await store.s.put(key, out);
                await mutate(a.number, (m) => ({ ...m, statusVoice: { key, at: Date.now(), size: out.length } }));
                return res.json(await fresh(a.number));
            }
            const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
            const key = spec.persist ? `assets/${a.number}/${spec.persist}/${name}` : `tmp/${a.number}/${name}`;
            await store.s.put(key, out);
            if (!spec.persist) sweepTmp(a.number, a.meta).catch(() => {});
            res.json({ mediaKey: key, size: out.length, mime: spec.process === 'voice' ? 'audio/ogg' : spec.process === 'image' ? 'image/jpeg' : mime });
        } catch (e) {
            log.warn({ err: e.message }, 'panel upload');
            res.status(500).json({ error: 'Could not process that file. Try another one.' });
        }
    });

    app.post('/api/panel/schedule', async (req, res) => {
        const a = await auth(req, res); if (!a) return;
        const b = req.body || {};
        const type = ['text', 'image', 'video', 'voice'].includes(b.type) ? b.type : null;
        const rawTo = String(b.to || '').trim();
        const to = rawTo === 'me' || /@g\.us$/.test(rawTo) ? rawTo : rawTo.replace(/\D/g, '');
        const at = Number(b.at);
        const text = String(b.text || '').slice(0, 1000).trim();
        const now = Date.now();
        if (!type) return res.status(400).json({ error: 'Choose what to send.' });
        if (!TARGET.test(to)) return res.status(400).json({ error: 'Enter a phone number with country code, or a group id.' });
        if (!Number.isFinite(at) || at < now - 30_000 || at > now + 60 * 86_400_000) return res.status(400).json({ error: 'Pick a time within the next 60 days.' });
        if (type === 'text' && !text) return res.status(400).json({ error: 'Write the message.' });
        if ((a.meta.schedules || []).length >= MAX_SCHEDULES) return res.status(400).json({ error: `You can keep up to ${MAX_SCHEDULES} scheduled messages.` });
        let mediaKey = null, mime = null, size = 0;
        if (type !== 'text') {
            mediaKey = String(b.mediaKey || '');
            if (!new RegExp(`^tmp/${a.number}/\\d+-[a-f0-9]{8}\\.\\w+$`).test(mediaKey)) return res.status(400).json({ error: 'Upload the file again.' });
            const buf = await store.s.get(mediaKey).catch(() => null);
            if (!buf) return res.status(400).json({ error: 'Upload the file again.' });
            size = buf.length; mime = String(b.mime || '').slice(0, 40);
        }
        const item = { id: crypto.randomBytes(5).toString('hex'), to, type, text: type === 'voice' ? '' : text, at: Math.max(at, now + 5000), mediaKey, mime, size, createdAt: now };
        try {
            await mutate(a.number, (m) => ({ ...m, schedules: [...(m.schedules || []), item] }));
            res.json(await fresh(a.number));
        } catch (e) { log.error({ err: e.message }, 'panel schedule'); res.status(500).json({ error: 'Could not save. Please try again.' }); }
    });

    app.delete('/api/panel/schedule/:id', async (req, res) => {
        const a = await auth(req, res); if (!a) return;
        const it = (a.meta.schedules || []).find((x) => x.id === req.params.id);
        if (it?.mediaKey) await store.s.del(it.mediaKey).catch(() => {});
        await mutate(a.number, (m) => ({ ...m, schedules: (m.schedules || []).filter((x) => x.id !== req.params.id) }));
        res.json(await fresh(a.number));
    });

    const MEDIA_TYPES = ['image', 'video', 'voice'];
    app.post('/api/panel/replies', async (req, res) => {
        const a = await auth(req, res); if (!a) return;
        const src = req.body?.replies && typeof req.body.replies === 'object' ? req.body.replies : {};
        const replies = {};
        for (const [k, v] of Object.entries(src).slice(0, MAX_REPLIES)) {
            const key = String(k).toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 40);
            if (!key) continue;
            let text = '', mediaKey = null, mediaType = null;
            if (typeof v === 'string') text = v.trim().slice(0, 500);
            else if (v && typeof v === 'object') {
                text = String(v.text ?? '').trim().slice(0, 500);
                mediaType = MEDIA_TYPES.includes(v.mediaType) ? v.mediaType : null;
                const mk = String(v.mediaKey ?? '');
                if (mediaType && mk.startsWith(`assets/${a.number}/replies/`) && mk.length <= 200) mediaKey = mk;
            }
            if (!text && !mediaKey) continue;
            replies[key] = mediaKey ? { text, mediaKey, mediaType } : text;
        }
        const keep = new Set(Object.values(replies).filter((x) => x && typeof x === 'object').map((x) => x.mediaKey));
        const old = a.meta?.replies || {};
        for (const v of Object.values(old)) {
            if (v && typeof v === 'object' && v.mediaKey && !keep.has(v.mediaKey)) await store.s.del(v.mediaKey).catch(() => {});
        }
        await mutate(a.number, (m) => ({ ...m, replies }));
        res.json(await fresh(a.number));
    });

    app.delete('/api/panel/status-voice', async (req, res) => {
        const a = await auth(req, res); if (!a) return;
        if (a.meta.statusVoice?.key) await store.s.del(a.meta.statusVoice.key).catch(() => {});
        await mutate(a.number, (m) => { const { statusVoice, ...rest } = m; return rest; });
        res.json(await fresh(a.number));
    });

    app.post('/api/panel/access', async (req, res) => {
        const a = await auth(req, res); if (!a) return;
        const access = cleanAccess(req.body?.access);
        await mutate(a.number, (m) => ({ ...m, settings: { ...(m.settings || {}), cmdAccess: access } }));
        res.json(await fresh(a.number));
    });

    app.post('/api/panel/settings', async (req, res) => {
        const a = await auth(req, res); if (!a) return;
        const patch = sanitize(req.body?.settings);
        if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing valid to save.' });
        try {
            const r = runnerOf(a.number);
            if (r) await r.setSettings(patch);
            else {
                const meta = { ...a.meta, settings: { ...(a.meta.settings || {}), ...patch } };
                await store.saveMeta(a.number, meta);
                a.meta = meta;
            }
            log.info({ number: a.number, keys: Object.keys(patch).join(',') }, 'panel settings saved');
            res.json(await view(a.number, runnerOf(a.number)?.meta || a.meta));
        } catch (e) { log.error({ err: e.message }, 'panel save'); res.status(500).json({ error: 'Could not save. Please try again.' }); }
    });
}
