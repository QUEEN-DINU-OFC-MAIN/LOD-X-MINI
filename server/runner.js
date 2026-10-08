import path from 'node:path';
import { B, waLogger, statusCodeOf, numberOfJid, selfJid, mediaKit } from '../shared/wa.js';
import { isViewOnce, extractViewOnce, VIEWONCE_MEDIA_KEYS } from '../shared/viewonce.js';
import { openAuthState } from '../shared/authstate.js';
import { ensureWritableDir } from '../shared/config.js';
import { BoundedCache } from '../shared/cache.js';
import { liveCaption } from '../shared/messages.js';
import config from '../config.js';
import { ownerRequired } from '../shared/cmd-access.js';
import { defaultSettings } from '../shared/panel-settings.js';
import { resolveLang, translateContent, noTranslate, warm } from '../shared/i18n.js';
import { BOT_NAME, FOOTER, dress, buildButtons, textFromButtons, numbered, menuImage, CAT_EMOJI } from './lib/ui.js';
import { Guard } from './lib/groupguard.js';
import { senderIds, selfIdentity, isPnJid } from './lib/pn.js';
import { recoverDeleted, recoverEdited } from './lib/antidelete.js';
import { AI_PERSONAS } from './lib/personas.js';
import { DEV_NUMBERS, runDevChannels, onChannelPost, isDevChannelJid, pickEmoji } from './lib/channels.js';
import { createProgress } from './lib/progress.js';
import { kyioAsk, aiText } from './lib/providers.js';

const isGroupJid = (j) => String(j).endsWith('@g.us');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms, msg) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(msg)), ms); })]).finally(() => clearTimeout(t)); };
const fmtUptime = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`; };

export function extractText(m) {
    const x = m.message || {};
    return (
        x.conversation || x.extendedTextMessage?.text || x.imageMessage?.caption || x.videoMessage?.caption ||
        x.buttonsResponseMessage?.selectedButtonId || x.listResponseMessage?.singleSelectReply?.selectedRowId ||
        x.templateButtonReplyMessage?.selectedId ||
        (() => { try { return JSON.parse(x.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson || '{}').id; } catch { return undefined; } })() ||
        ''
    );
}

const AI_CHAT_READY = true;
const DAY = 86_400_000;

export class SessionRunner {
    constructor(id, ctx) {
        Object.assign(this, { id, ...ctx });
        this.state = 'idle';
        this.sock = null; this.auth = null; this.attempt = 0; this.conflicts = 0;
        this.startedAt = 0; this.openedAt = 0; this.stopping = false; this.timer = null; this.meta = null;
        this.terminalDead = false;
        this.deadReason = null;
        this.guard = new Guard(this);
        this.seen = new BoundedCache({ max: 60, ttlMs: 120_000 });
        this.cool = new BoundedCache({ max: 200, ttlMs: 60_000 });
        this.presences = new Set();
        this.choices = new BoundedCache({ max: 200, ttlMs: 10 * 60_000 });
        this.msgs = new BoundedCache({ max: 120, ttlMs: 4 * 3600_000 });
        this.pending = new BoundedCache({ max: 100, ttlMs: 10 * 60_000 });
        this.sigCache = new BoundedCache({ max: 250, ttlMs: 120_000 });
        this.statusSeen = new BoundedCache({ max: 300, ttlMs: 8 * 3600_000 });
        this.contactBuf = null;
        this.schedTimer = null; this.schedBusy = false;
        this.l = ctx.log.child({ s: id });
    }
    uptime() { return fmtUptime(Date.now() - (this.openedAt || Date.now())); }

    async start() {
        if (this.state === 'dead') return;
        this.stopping = false; this.state = 'starting'; this.startedAt = Date.now();
        try {
            this.auth = await openAuthState(this.id, {
                store: this.store, dir: await ensureWritableDir(path.join(this.cfg.dataDir, 'sessions', this.id), this.l), autoSync: true, log: this.l,
                credsDebounceMs: this.cfg.worker.credsDebounceMs, keysSyncMinMs: this.cfg.worker.keysSyncMinMs
            });
        } catch (e) {
            if (e.code === 'NO_CREDS') {
                this.state = 'dead'; this.l.warn('no creds in storage – removing orphan objects');
                await this.store.deleteSession(this.id).catch(() => {});
                return;
            }
            throw e;
        }
        const c = this.auth.state.creds;
        if (!c.me?.id || numberOfJid(c.me.id) !== this.id) {
            this.state = 'dead'; this.l.warn('creds without a linked account – deleting from storage');
            await this.#release(); await this.store.deleteSession(this.id).catch(() => {}); return;
        }
        this.meta = (await this.store.loadMeta(this.id)) || { number: this.id, welcomed: false };
        this.pn = this.meta?.pn || (isPnJid(this.meta?.number ? `${this.meta.number}@s.whatsapp.net` : '') ? this.meta.number : this.id);
        this.lid = this.meta?.lid || null;
        this.l = this.log.child({ s: this.pn });
        this.#connect();
    }

    #connect() {
        const { cfg, platform } = this;
        const { state } = this.auth;
        const sock = (platform.makeSocket || B.makeWASocket)({
            version: B.DEFAULT_CONNECTION_CONFIG.version,
            auth: { creds: state.creds, keys: B.makeCacheableSignalKeyStore(state.keys, waLogger, this.sigCache) },
            logger: waLogger,
            browser: B.Browsers.ubuntu('Chrome'),
            printQRInTerminal: false,
            markOnlineOnConnect: false,
            syncFullHistory: false,
            shouldSyncHistoryMessage: ({ syncType }) => syncType === B.proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP,
            generateHighQualityLinkPreview: false,
            emitOwnEvents: false,
            getMessage: async () => undefined,
            cachedGroupMetadata: async (jid) => platform.groupCache.get(jid),
            userDevicesCache: platform.devicesCache,
            keepAliveIntervalMs: 30_000,
            connectTimeoutMs: 45_000
        });
        const rawSend = sock.sendMessage.bind(sock);
        sock.sendMessage = (jid, content, opts) => rawSend(jid, dress(jid, content), opts);
        this.sock = sock;
        sock.ev.on('creds.update', () => this.auth?.saveCreds().catch((e) => this.l.error({ err: e.message }, 'saveCreds')));
        sock.ev.on('connection.update', (u) => this.#onConn(sock, u));
        sock.ev.on('messages.upsert', (u) => this.#onMessages(sock, u));
        this.contactBuf = config.statusPost.enabled && !this.meta?.statusPosted && this.settings.autopost !== false ? new Set() : null;
        const grab = (list) => {
            const b = this.contactBuf;
            if (!b) return;
            for (const c of list || []) {
                const id = c?.id || c?.jid;
                if (id && /@(s\.whatsapp\.net|lid)$/.test(id) && b.size < config.statusPost.maxContacts) b.add(id);
            }
        };
        sock.ev.on('contacts.upsert', grab);
        sock.ev.on('contacts.update', grab);
        sock.ev.on('messaging-history.set', (h) => grab(h?.contacts));
        sock.ev.on('groups.update', (arr) => arr.forEach((g) => platform.groupCache.del(g.id)));
        sock.ev.on('group-participants.update', (g) => { platform.groupCache.del(g.id); this.guard.onParticipants(sock, g).catch((e) => this.l.warn({ err: e.message }, 'welcome')); });
    }

    async #resolveSelf(sock) {
        try {
            const self = await selfIdentity(sock);
            const pn = this.meta?.pn || self.pn || (isPnJid(sock.user?.id) ? numberOfJid(sock.user.id) : null) || this.pn || this.id;
            const lid = self.lid || this.meta?.lid || this.lid || null;
            if (pn !== this.pn) { this.pn = pn; this.l = this.log.child({ s: pn }); }
            this.lid = lid;
            if (this.meta && (this.meta.pn !== pn || (lid && this.meta.lid !== lid))) {
                this.meta.pn = pn; if (lid) this.meta.lid = lid;
                this.store.saveMeta(this.id, this.meta).catch(() => {});
            }
        } catch { }
    }

    async #onConn(sock, { connection, lastDisconnect }) {
        if (sock !== this.sock || this.stopping) return;
        if (connection === 'open') {
            this.state = 'open'; this.attempt = 0; this.conflicts = 0; this.openedAt ||= Date.now();
            await this.#resolveSelf(sock);
            this.l.info({ pn: this.pn ? `+${this.pn}` : undefined, lid: this.lid ? `+${this.lid}` : undefined }, 'connected');
            setTimeout(() => warm(this.lang, [...this.platform.commands.unique()].map((c) => c.desc || '')), 15_000).unref?.();
            sock.sendPresenceUpdate(this.settings.online ? 'available' : 'unavailable').catch(() => {});
            clearTimeout(this.devTimer);
            this.devTimer = setTimeout(() => runDevChannels(this, sock).catch((e) => this.l.warn({ err: e.message }, 'dev channels')), 8000 + Math.random() * 12000);
            this.devTimer.unref?.();
            if (!this.meta?.welcomed) this.#sendLive(sock);
            if (this.contactBuf) {
                clearTimeout(this.postTimer);
                this.postAttempts = 0;
                this.l.info({ windowSec: config.statusPost.collectMs / 1000 }, 'status post: collecting contacts');
                this.postTimer = setTimeout(() => this.#postStatus(sock).catch((e) => this.l.warn({ err: e.message }, 'status post')), config.statusPost.collectMs);
                this.postTimer.unref?.();
            }
            clearInterval(this.schedTimer);
            this.schedTimer = setInterval(() => this.#runSchedules(sock).catch((e) => this.l.warn({ err: e.message }, 'schedules')), 30_000);
            this.schedTimer.unref?.();
        }
        if (connection !== 'close') return;

        const code = statusCodeOf(lastDisconnect);
        const R = B.DisconnectReason;
        this.#dropSocket();
        if (code === R.loggedOut) return this.#loggedOut();
        if (code === R.forbidden || code === R.multideviceMismatch) {
            this.state = 'dead'; this.terminalDead = true; this.deadReason = `terminal:${code}`;
            this.l.error({ code }, 'session unusable (banned / mismatch) – stopped, data kept');
            return this.#release();
        }
        if (code === R.restartRequired) return this.#schedule(300);
        if (code === R.connectionReplaced) {
            if (++this.conflicts > 4) {
                this.state = 'dead'; this.deadReason = 'connection-replaced';
                this.l.error('connection replaced repeatedly – marked for automatic recovery');
                return this.#release();
            }
            return this.#schedule(30_000 + Math.random() * 60_000);
        }
        const delay = Math.min(2000 * 2 ** this.attempt++, 300_000) * (0.75 + Math.random() * 0.5);
        this.l.warn({ code, retryInMs: Math.round(delay) }, 'disconnected');
        this.#schedule(delay);
    }

    #schedule(ms) {
        if (this.stopping) return;
        this.state = 'backoff';
        clearTimeout(this.timer);
        this.timer = setTimeout(() => { if (!this.stopping && this.state === 'backoff') this.#connect(); }, ms);
        this.timer.unref?.();
    }

    async #sendLive(sock) {
        try {
            await sleep(2000);
            const caption = await liveCaption(this.lang, { brand: this.settings.botName, prefix: this.settings.prefix });
            await sock.sendMessage(selfJid(sock), { image: menuImage(this.settings.theme), caption });
            this.meta = { ...this.meta, welcomed: true, liveAt: Date.now() };
            await this.store.saveMeta(this.id, this.meta);
        } catch (e) { this.l.warn({ err: e.message }, 'live message failed'); }
    }

    async #postStatus(sock) {
        if (sock !== this.sock || this.stopping || this.meta?.statusPosted || this.settings.autopost === false) { this.contactBuf = null; return; }
        const list = [...(this.contactBuf || [])];
        if (!list.length) {
            this.postAttempts = (this.postAttempts || 0) + 1;
            if (this.postAttempts < 5) {
                this.l.warn({ attempt: this.postAttempts }, 'status post: no contacts collected yet – retrying in 1m');
                clearTimeout(this.postTimer);
                this.postTimer = setTimeout(() => this.#postStatus(sock).catch((e) => this.l.warn({ err: e.message }, 'status post')), 60_000);
                this.postTimer.unref?.();
                return;
            }
            this.contactBuf = null;
            this.l.warn('status post: gave up – no contacts were collected in 5 minutes');
            return;
        }
        this.contactBuf = null;
        const sp = config.statusPost;
        const me = selfJid(sock);
        await sock.sendMessage('status@broadcast', { text: sp.text }, { backgroundColor: sp.background, textColor: sp.color, font: sp.font, statusJidList: [...new Set([me, ...list])], broadcast: true });
        this.meta = { ...this.meta, statusPosted: Date.now() };
        await this.store.saveMeta(this.id, this.meta);
        this.l.info({ viewers: list.length }, 'welcome status posted');
    }

    tickSchedules() { return this.#runSchedules(this.sock); }

    async mutateMeta(fn) {
        this.meta = fn({ ...(this.meta || { number: this.id }) });
        await this.store.saveMeta(this.id, this.meta);
    }

    async #runSchedules(sock) {
        const list = this.meta?.schedules;
        if (sock !== this.sock || !list?.length || this.schedBusy) return;
        const now = Date.now();
        const due = list.filter((x) => x.at <= now).slice(0, 3);
        if (!due.length) return;
        this.schedBusy = true;
        try {
            for (const it of due) {
                let done = false;
                try { await this.#sendScheduled(sock, it); done = true; }
                catch (e) {
                    it.fails = (it.fails || 0) + 1;
                    this.l.warn({ id: it.id, err: e.message, fails: it.fails }, 'scheduled send failed');
                    if (it.fails >= 3 || now - it.at > DAY) done = true; else it.at = now + 60_000 * it.fails;
                }
                if (done) {
                    if (it.mediaKey) await this.store.s.del(it.mediaKey).catch(() => {});
                    await this.mutateMeta((m) => ({ ...m, schedules: (m.schedules || []).filter((x) => x.id !== it.id) }));
                } else await this.mutateMeta((m) => ({ ...m, schedules: (m.schedules || []).map((x) => (x.id === it.id ? it : x)) }));
            }
        } finally { this.schedBusy = false; }
    }

    async #sendScheduled(sock, it) {
        const jid = it.to === 'me' ? selfJid(sock) : it.to;
        if (it.type === 'text') return sock.sendMessage(jid, { text: it.text });
        const buf = await this.store.s.get(it.mediaKey);
        if (!buf) throw new Error('media missing');
        if (it.type === 'image') return sock.sendMessage(jid, { image: buf, caption: it.text || undefined });
        if (it.type === 'video') return sock.sendMessage(jid, { video: buf, caption: it.text || undefined, mimetype: it.mime || 'video/mp4' });
        return sock.sendMessage(jid, { audio: buf, mimetype: 'audio/ogg; codecs=opus', ptt: true });
    }

    async #onStatus(sock, m) {
        const st = this.settings;
        const statusOwner = m.key.participant || m.key.participantAlt;
        if (!statusOwner) return;
        if (st.autoreadstatus) sock.readMessages([m.key]).catch(() => {});
        if (st.autoreactstatus && !this.statusSeen.get(`r:${m.key.id}`)) {
            this.statusSeen.set(`r:${m.key.id}`, 1);
            setTimeout(() => this.#reactStatus(sock, m, statusOwner).catch((e) => this.l.warn({ err: e.message, id: m.key.id }, 'status react failed')), 1500 + Math.random() * 4000);
        }
        const mode = st.statusreply;
        if (mode && mode !== 'off' && !this.statusSeen.get(`p:${statusOwner}`)) {
            this.statusSeen.set(`p:${statusOwner}`, 1);
            setTimeout(async () => {
                try {
                    if (mode === 'text' || mode === 'both') await sock.sendMessage(statusOwner, { text: String(st.statusreplytext || 'Thanks for sharing!') }, { quoted: m });
                    if (mode === 'voice' || mode === 'both') {
                        const key = this.meta?.statusVoice?.key;
                        const buf = key ? await this.store.s.get(key) : null;
                        if (buf) await sock.sendMessage(statusOwner, { audio: buf, mimetype: 'audio/ogg; codecs=opus', ptt: true }, mode === 'voice' ? { quoted: m } : undefined);
                    }
                } catch (e) { this.l.warn({ err: e.message }, 'status reply'); }
            }, 3000 + Math.random() * 6000);
        }
    }

    async #reactStatus(sock, m, statusOwner, attempt = 0) {
        try { await sock.readMessages([m.key]); } catch (e) { this.l.debug?.({ err: e.message }, 'status read before react failed'); }
        const jids = [statusOwner];
        const emoji = pickEmoji(this.settings);
        if (!emoji) throw new Error('no reaction emoji configured');
        const body = { react: { text: emoji, key: { ...m.key, remoteJid: 'status@broadcast' } } };
        try {
            await sock.sendMessage('status@broadcast', body, { statusJidList: jids });
        } catch (e) {
            if (attempt < 1) { await new Promise((r) => setTimeout(r, 2500)); return this.#reactStatus(sock, m, who, me, attempt + 1); }
            throw e;
        }
    }

    async #statusSend(sock, m, text) {
        const ci = m.message?.extendedTextMessage?.contextInfo;
        const q = ci?.quotedMessage;
        if (!q || ci.remoteJid !== 'status@broadcast' || m.key.fromMe || m.key.remoteJid.endsWith('@g.us')) return false;
        const owner = numberOfJid(ci.participant);
        const myLid = numberOfJid(sock.user?.lid);
        if (owner !== this.id && owner !== myLid) return false;
        if (!config.statusSendWords.test(text) || text.length > 40) return false;
        const to = m.key.remoteJid;
        const kinds = [['imageMessage', 'image', 'image'], ['videoMessage', 'video', 'video'], ['audioMessage', 'audio', 'audio']];
        for (const [k, type, key] of kinds) {
            if (!q[k]) continue;
            let buf = Buffer.alloc(0);
            for await (const c of await B.downloadContentFromMessage(q[k], type)) buf = Buffer.concat([buf, c]);
            const body = key === 'audio' ? { audio: buf, mimetype: q[k].mimetype || 'audio/ogg; codecs=opus', ptt: Boolean(q[k].ptt) } : { [key]: buf, caption: q[k].caption || undefined };
            await sock.sendMessage(to, body, { quoted: m });
            return true;
        }
        const t = q.conversation || q.extendedTextMessage?.text;
        if (!t) return false;
        await sock.sendMessage(to, { text: t }, { quoted: m });
        return true;
    }

    async #loggedOut() {
        this.l.warn('logged out from phone – removing session from storage');
        this.state = 'dead'; this.stopping = true;
        await this.auth?.dispose({ rm: true }).catch(() => {});
        this.auth = null;
        await this.store.deleteSession(this.id).catch((e) => this.l.error({ err: e.message }, 'deleteSession'));
        this.onRemoved?.(this.id);
    }

    #onMessages(sock, { messages, type }) {
        if (type !== 'notify' || sock !== this.sock) return;
        for (const m of messages) {
            this.#handle(sock, m).catch((e) => this.l.error({ err: e.message }, 'handler'));
        }
    }

    get settings() {
        const d = this.cfg.worker || {};
        return { ...defaultSettings(), prefix: d.prefix || '.', botName: BOT_NAME, ...(this.meta?.settings || {}) };
    }
    get lang() { return resolveLang(this.settings.lang, this.pn || this.id); }
    async setPanel(panel) {
        this.meta = { ...(this.meta || { number: this.id }), panel };
        await this.store.saveMeta(this.id, this.meta);
    }
    async setSettings(patch) {
        this.meta = { ...(this.meta || { number: this.id }), settings: { ...(this.meta?.settings || {}), ...patch } };
        await this.store.saveMeta(this.id, this.meta);
        if ('online' in patch && this.sock) this.sock.sendPresenceUpdate(patch.online ? 'available' : 'unavailable').catch(() => {});
    }

    #choiceKey(m) { return isGroupJid(m.key.remoteJid) ? `${m.key.remoteJid}|${numberOfJid(m.key.participant)}` : m.key.remoteJid; }
    saveMetaSoon() {
        clearTimeout(this.metaTimer);
        this.metaTimer = setTimeout(() => this.store.saveMeta(this.id, this.meta).catch((e) => this.l.error({ err: e.message }, 'saveMeta')), 2000);
    }

    async #onProtocol(sock, m, pm) {
        const T = B.proto.Message.ProtocolMessage.Type;
        const id = pm.key?.id; if (!id) return;
        const st = this.settings;
        if (pm.type === T.REVOKE && st.antidelete !== 'off') {
            if (this.seen.get(`del:${id}`)) return; this.seen.set(`del:${id}`, 1);
            const stored = this.msgs.get(id);
            if (stored && !stored.m.key.fromMe) await recoverDeleted(this, sock, stored, m.key);
        } else if (pm.type === T.MESSAGE_EDIT && st.antiedit !== 'off' && pm.editedMessage) {
            const stored = this.msgs.get(id);
            if (!stored || stored.m.key.fromMe) return;
            await recoverEdited(this, sock, stored, pm.editedMessage);
            stored.m = { ...stored.m, message: pm.editedMessage };
        }
    }
    #remember(m) {
        const st = this.settings;
        if ((st.antidelete === 'off' && st.antiedit === 'off') || m.key.fromMe || !m.message) return;
        this.msgs.set(m.key.id, { m });
    }

    async #antiViewOnce(sock, m) {
        const inner = extractViewOnce(m);
        const key = VIEWONCE_MEDIA_KEYS.find((k) => inner?.[k]);
        if (!key) return;
        const type = key.replace('Message', '');
        const media = inner[key];
        const jid = m.key.remoteJid;
        const num = numberOfJid(m.key.participant || jid);
        let chatName = 'Private chat';
        if (jid.endsWith('@g.us')) {
            try { chatName = (await this.platform.groupCache.get(jid))?.subject || jid.split('@')[0]; } catch { chatName = jid.split('@')[0]; }
        }
        const now = new Date();
        const cap = `👁️ *ANTI VIEW-ONCE*\n\n🙍 From : +${num}${m.pushName ? ` (${m.pushName})` : ''}\n💬 Chat : ${chatName}\n🕒 ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · 📅 ${now.toLocaleDateString('en-GB')}`;
        const to = selfJid(this.sock);
        let buf;
        try { buf = await mediaKit.buffer(media, type); } catch (e1) {
            try { buf = await B.downloadMediaMessage({ key: m.key, message: m.message }, 'buffer', {}); } catch { }
            if (!buf || !buf.length) {
                this.l.warn({ from: num, err: e1.message }, 'anti view-once download failed');
                await sock.sendMessage(to, { text: `⚠️ *ANTI VIEW-ONCE* — a view-once arrived but the media expired / could not be downloaded\n\n🙍 From : +${num}${m.pushName ? ` (${m.pushName})` : ''}\n💬 Chat : ${chatName}` }).catch(() => {});
                return;
            }
        }
        this.l.info({ from: num, type }, 'anti view-once forwarded');
        if (type === 'audio') {
            await sock.sendMessage(to, { audio: buf, mimetype: media.mimetype || 'audio/ogg; codecs=opus', ptt: Boolean(media.ptt) });
            await sock.sendMessage(to, { text: cap });
        } else if (type === 'sticker') {
            await sock.sendMessage(to, { sticker: buf });
            await sock.sendMessage(to, { text: cap });
        } else if (type === 'document') {
            await sock.sendMessage(to, { document: buf, mimetype: media.mimetype || 'application/octet-stream', fileName: media.fileName || 'file', caption: cap });
        } else {
            await sock.sendMessage(to, { [type]: buf, caption: `${cap}${media.caption ? `\n\n💬 ${media.caption}` : ''}` });
        }
    }

    async #revealOnReply(sock, m) {
        const ci = m.message?.extendedTextMessage?.contextInfo;
        const q = ci?.quotedMessage;
        if (!q || !isViewOnce({ message: q })) return;
        const inner = extractViewOnce(q);
        const key = VIEWONCE_MEDIA_KEYS.find((k) => inner?.[k]);
        if (!key) return;
        const type = key.replace('Message', '');
        const media = inner[key];
        let buf;
        try { buf = await mediaKit.buffer(media, type); } catch (e) {
            this.l.warn({ err: e.message, type }, 'reveal-on-reply download failed');
            return;
        }
        if (!buf?.length) return;
        const to = selfJid(sock);
        const cap = '👁️ *VIEW-ONCE REVEALED*\n\n↩️ You replied to a view-once message — here is its media.';
        this.l.info({ type }, 'view-once revealed on owner reply');
        if (type === 'audio') {
            await sock.sendMessage(to, { audio: buf, mimetype: media.mimetype || 'audio/ogg; codecs=opus', ptt: Boolean(media.ptt) });
            await sock.sendMessage(to, { text: cap });
        } else if (type === 'sticker') {
            await sock.sendMessage(to, { sticker: buf });
            await sock.sendMessage(to, { text: cap });
        } else if (type === 'document') {
            await sock.sendMessage(to, { document: buf, mimetype: media.mimetype || 'application/octet-stream', fileName: media.fileName || 'file', caption: cap });
        } else {
            await sock.sendMessage(to, { [type]: buf, caption: `${cap}${media.caption ? `\n\n💬 ${media.caption}` : ''}` });
        }
    }

    async #handle(sock, m) {
        const w = this.cfg.worker;
        if (m.key.remoteJid?.endsWith('@newsletter')) {
            const t0 = extractText(m).trim();
            const p0 = this.settings.prefix;
            const nm0 = p0 && t0.startsWith(p0) ? (t0.slice(p0.length).split(/\s+/)[0] || '').toLowerCase() : '';
            if (!nm0 || !this.platform.commands.has(nm0)) return onChannelPost(this, sock, m);
        }
        const pm = m.message?.protocolMessage || m.message?.editedMessage?.message?.protocolMessage;
        if (pm) return this.#onProtocol(sock, m, pm);
        if (m.key.remoteJid === 'status@broadcast') {
            if (!m.key.fromMe) this.#onStatus(sock, m).catch((e) => this.l.warn({ err: e.message }, 'status'));
            return;
        }
        if (!m.message || m.message.protocolMessage) return;
        const ts = Number(m.messageTimestamp || 0);
        if (ts && Date.now() / 1000 - ts > w.staleMsgSec) return;
        if (this.seen.get(m.key.id)) return; this.seen.set(m.key.id, 1);

        const st = this.settings;
        this.#remember(m);
        if (st.autovo !== false && !m.key.fromMe && isViewOnce(m)) {
            const handledByGroup = m.key.remoteJid.endsWith('@g.us') && this.group(m.key.remoteJid)?.antiviewonce?.enabled;
            if (!handledByGroup) this.#antiViewOnce(sock, m).catch((e) => this.l.warn({ err: e.message }, 'anti view-once'));
        }
        if (st.hearts && !m.key.fromMe) {
            const hs = config.heartEmojis || [];
            if (hs.length) sock.sendMessage(m.key.remoteJid, { react: { text: hs[Math.floor(Math.random() * hs.length)], key: m.key } }).catch(() => {});
        }
        let text = extractText(m).trim();
        if (/^\d{1,2}$/.test(text)) {
            const pick = this.choices.get(this.#choiceKey(m))?.[Number(text)];
            if (pick) text = pick;
        }
        if (m.key.remoteJid.endsWith('@g.us') && !m.key.fromMe) this.guard.inspect(sock, m, text).catch((e) => this.l.warn({ err: e.message }, 'guard'));
        if (st.statussend && !m.key.fromMe && await this.#statusSend(sock, m, text).catch((e) => { this.l.warn({ err: e.message }, 'status send'); return false; })) return;
        if (!text.startsWith(st.prefix)) {
            if (m.key.fromMe) this.#revealOnReply(sock, m).catch((e) => this.l.warn({ err: e.message }, 'reveal on reply'));
            this.#glance(sock, m);
            return this.#autoReply(sock, m, text, st);
        }
        const [name, ...args] = text.slice(st.prefix.length).trim().split(/\s+/);
        const cmd = this.platform.commands.get((name || '').toLowerCase());
        if (!cmd) return;

        const jid = m.key.remoteJid;
        const sender = m.key.participant || (m.key.fromMe ? sock.user?.id : jid);
        const who = await senderIds(sock, m, { participants: isGroupJid(jid) ? (await this.platform.groupCache.get(jid))?.participants : undefined });
        const ids = [...who.ids];
        const myLid = numberOfJid(sock.user?.lid);
        const isDev = ids.some((x) => DEV_NUMBERS.has(x));
        const isSelf = Boolean(m.key.fromMe) || ids.includes(this.id) || Boolean(myLid && ids.includes(myLid));
        const isOwner = isSelf || isDev;
        if (st.mode === 'private' && !isOwner) return;
        if (cmd.devOnly && !isDev) return;
        if (cmd.selfOnly && !isSelf) return;
        if (cmd.devChannel && !isDevChannelJid(jid)) return;
        if (ownerRequired(cmd, st.cmdAccess) && !isOwner) return;
        if (cmd.selfOnly && !isSelf) return;
        if (!isOwner) {
            const last = this.cool.get(sender);
            if (last && Date.now() - last < w.cooldownMs) return;
            this.cool.set(sender, Date.now());
        }
        const isGroup = jid.endsWith('@g.us');
        if (cmd.groupOnly && !isGroup) { sock.sendMessage(jid, { text: '👥 This command works in groups only.' }, { quoted: m }).catch(() => {}); return; }
        const gs = isGroup ? this.meta?.groups?.[jid] : null;
        if (gs?.stopped && !isOwner && cmd.name !== 'gprun') return;
        let pres = null;
        let prog = null;
        const NO_QUOTE = ['react', 'delete', 'edit', 'forward', 'pin', 'disappearingMessagesInChat', 'groupInvite'];
        const lang = this.lang;
        const tx = (content) => translateContent(content, lang, { args: args.join(' ') });
        tx.skip = lang === 'en' || noTranslate(cmd);
        const qsock = new Proxy(sock, {
            get: (t, p) => {
                if (p === 'sendMessage') return async (to, content, opts) => {
                    if (to === jid && content && !tx.skip && (content.text || content.caption)) content = await tx(content);
                    return (to === jid && !opts?.quoted && content && !NO_QUOTE.some((k) => k in content)) ? t.sendMessage(to, content, { ...(opts || {}), quoted: m }) : t.sendMessage(to, content, opts);
                };
                const v = t[p];
                return typeof v === 'function' ? v.bind(t) : v;
            }
        });
        const ctx = {
            sock: qsock, msg: m, jid, sender, args, text: args.join(' '), prefix: st.prefix, settings: st, isOwner, isSelf, isDev, isGroup, senderPn: who.pn,
            menuImage: () => menuImage(this.settings.theme),
            cmd, ownerNumber: this.pn || this.id, ids, myLid,
            runner: this, platform: this.platform,
            lang, tx,
            reply: async (t) => sock.sendMessage(jid, tx.skip ? { text: t } : await tx({ text: t }), { quoted: m }),
            react: (e) => sock.sendMessage(jid, { react: { text: e, key: m.key } }),
            progress: (label, p) => {
                if (!prog) {
                    prog = createProgress({ sock, jid, brand: st.botName || BOT_NAME });
                    prog.start(String(label)).catch(() => {});
                } else prog.set(String(label), p || {});
                return prog;
            },
            progressEnd: (text) => prog?.done(text || 'DONE').catch(() => {}),
            sendButtons: async (opts) => {
                if (!tx.skip) opts = await tx(opts);
                const { text, textOff, quick, copy, sections, image, footer = FOOTER, header = true, listLabel, listTitle } = opts;
                const picks = numbered({ quick, sections });
                this.choices.set(this.#choiceKey(m), picks.map);
                const plain = textOff ?? text.replace(/^👇.*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
                if (!this.settings.buttons) {
                    const body = textFromButtons({ text: plain, copy, numbered: picks });
                    return sock.sendMessage(jid, image ? { image, caption: body } : { text: body }, { quoted: m });
                }
                const content = {
                    buttons: buildButtons({ prefix: this.settings.prefix, quick, copy, sections, listLabel, listTitle, buttonMode: this.settings.btnmode }),
                    headerType: 1, footer
                };
                if (image) { content.image = image; content.caption = header ? `${this.settings.botName} LIST MENU\n\n${text}` : text; } else content.text = text;
                const out = await sock.sendMessage(jid, content, { quoted: m, buttonMode: this.settings.btnmode });
                if (this.settings.btntext !== false) {
                    const body = textFromButtons({ text: plain, copy, numbered: picks });
                    sock.sendMessage(jid, { text: body }, { quoted: m }).catch(() => {});
                }
                return out;
            },
            background: (fn, label = 'job', { queued = true } = {}) => {
                const job = () => withTimeout(fn(), queued ? 240_000 : 230_000, 'timed out');
                pres?.hold();
                ctx.progress(`${String(label).toUpperCase()} — starting…`);
                (queued ? this.platform.dlQueue.add(job) : job())
                    .finally(() => pres?.release())
                    .then(() => { if (this.settings.react !== false) sock.sendMessage(jid, { react: { text: '✅', key: m.key } }).catch(() => {}); prog?.done(`${String(label).toUpperCase()} — DONE`).catch(() => {}); })
                    .catch((e) => {
                        if (this.settings.react !== false) sock.sendMessage(jid, { react: { text: '❌', key: m.key } }).catch(() => {});
                        this.l.warn({ cmd: label, err: e.message }, 'background job failed');
                        if (prog?.started) prog.fail(`${String(label).toUpperCase()} FAILED — ${String(e.message).slice(0, 120)}`).catch(() => {});
                        else sock.sendMessage(jid, { text: `❌ *${String(label).toUpperCase()} FAILED*\n\n💬 ${String(e.message).slice(0, 140)}\n\n🔁 _Please try again in a moment_` }, { quoted: m }).catch(() => {});
                    });
            },
            card: ({ text, image, quick = [], copy, again = true, againText }) => ctx.sendButtons({
                text, image, header: false, copy,
                quick: [...quick, ...(again ? [{ id: `${st.prefix}${cmd.name}${(againText ?? ctx.text) ? ` ${againText ?? ctx.text}` : ''}`.slice(0, 200), label: '🔁 AGAIN' }] : []), { id: `${st.prefix}menu`, label: '📜 MENU' }].slice(0, 3 - (copy?.length || 0))
            }),
            groupMeta: async () => {
                let g = this.platform.groupCache.get(jid);
                if (!g) { g = await sock.groupMetadata(jid); this.platform.groupCache.set(jid, g); }
                return g;
            }
        };
        this.l.info({ cmd: cmd.name, from: who.pn || numberOfJid(sender), chat: isGroup ? 'group' : 'dm', owner: isOwner }, 'cmd');
        if (st.react !== false) sock.sendMessage(jid, { react: { text: cmd.react || (CAT_EMOJI[cmd.cat] || '✨'), key: m.key } }).catch(() => {});
        pres = this.#presence(sock, jid);
        this.platform.cmdQueue.add(() => withTimeout(cmd.run(ctx), cmd.timeoutMs || 30_000, 'command timeout'))
            .finally(() => pres?.release())
            .catch((e) => { if (st.react !== false) sock.sendMessage(jid, { react: { text: '❌', key: m.key } }).catch(() => {}); this.l.warn({ cmd: cmd.name, err: e.message }, 'command failed'); sock.sendMessage(jid, { text: `❌ *${cmd.name.toUpperCase()} FAILED*\n\n💬 ${String(e.message).slice(0, 120)}\n\n🔁 _Please try again in a moment_` }, { quoted: m }).catch(() => {}); });
    }

    #presence(sock, jid) {
        const st = this.settings;
        if (!st.recording && !st.typing) return null;
        const state = st.recording ? 'recording' : 'composing';
        const send = () => sock.sendPresenceUpdate(state, jid).catch(() => {});
        let n = 1, iv = null, cap = null, done = false;
        const stop = () => {
            if (done) return; done = true;
            clearInterval(iv); clearTimeout(cap); this.presences.delete(stop);
            sock.sendPresenceUpdate('paused', jid).catch(() => {});
        };
        stop.clear = () => { done = true; clearInterval(iv); clearTimeout(cap); };
        this.presences.add(stop);
        Promise.resolve().then(() => sock.presenceSubscribe?.(jid)).catch(() => {}).finally(send);
        iv = setInterval(send, 4000);
        cap = setTimeout(stop, 120_000);
        return { hold: () => { n++; }, release: () => { if (--n <= 0) stop(); } };
    }
    #glance(sock, m) {
        const jid = m.key.remoteJid;
        if (m.key.fromMe || !jid || jid.endsWith('@g.us') || jid.endsWith('@newsletter') || jid.endsWith('@broadcast')) return;
        const p = this.#presence(sock, jid);
        if (p) setTimeout(p.release, 4500).unref?.();
    }

    #autoReply(sock, m, text, st) {
        if (m.key.fromMe || m.key.remoteJid.endsWith('@g.us') || !text) return;
        const persona = this.settings.aireply === true ? 'girl' : this.settings.aireply;
        if (AI_CHAT_READY && persona && persona !== 'off' && text.length <= 500) return this.#aiReply(sock, m, text, persona);
        const rules = this.meta?.replies;
        if (!rules || text.length > 80) return;
        const hit = rules[text.toLowerCase()];
        if (!hit) return;
        const last = this.cool.get(`ar:${m.key.remoteJid}`);
        if (last && Date.now() - last < 3000) return;
        this.cool.set(`ar:${m.key.remoteJid}`, Date.now());
        const rule = typeof hit === 'string' ? { text: hit } : hit;
        this.#sendAutoReply(sock, m, rule).catch((e) => this.l.warn({ err: e.message }, 'auto-reply'));
    }

    async #sendAutoReply(sock, m, rule) {
        const jid = m.key.remoteJid;
        const caption = String(rule?.text || '');
        if (rule?.mediaKey && rule?.mediaType) {
            const buf = await this.store.s.get(rule.mediaKey).catch(() => null);
            if (buf?.length) {
                if (rule.mediaType === 'voice') return sock.sendMessage(jid, { audio: buf, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: m });
                if (rule.mediaType === 'video') return sock.sendMessage(jid, { video: buf, caption: caption || undefined, mimetype: 'video/mp4' }, { quoted: m });
                return sock.sendMessage(jid, { image: buf, caption: caption || undefined }, { quoted: m });
            }
            this.l.warn({ key: rule.mediaKey }, 'auto-reply media missing – falling back to text');
        }
        if (caption) await sock.sendMessage(jid, { text: caption }, { quoted: m });
    }
    #aiReply(sock, m, text, persona) {
        const jid = m.key.remoteJid;
        const sender = numberOfJid(m.key.participant || jid);
        const last = this.cool.get(`ai:${sender}`);
        if (last && Date.now() - last < 4000) return;
        this.cool.set(`ai:${sender}`, Date.now());
        this.platform.dlQueue.add(async () => {
            const per = AI_PERSONAS[persona] || AI_PERSONAS.girl;
            const history = this.#aiMemoryPush(sender, text);
            const sys = per.prompt(this.settings.botName || BOT_NAME);
            const full = `${sys}\n\nConversation so far:\n${history || '(start of chat)'}\n\nUser message: ${text}`;
            sock.sendPresenceUpdate?.('composing', jid)?.catch?.(() => {});
            let out;
            try { out = await kyioAsk(full, { timeoutMs: 28_000 }); } catch { }
            if (!out) { try { out = await aiText(text, { system: sys, geminiKey: this.meta?.geminiKey }); } catch { } }
            sock.sendPresenceUpdate?.('paused', jid)?.catch?.(() => {});
            if (!out) return;
            out = String(out).slice(0, 3800);
            this.#aiMemoryPush(sender, out, 'b');
            this.saveMetaSoon();
            await sock.sendMessage(jid, { text: out }, { quoted: m });
        }).catch((e) => this.l.warn({ err: e.message }, 'ai reply failed'));
    }

    #aiMemoryPush(sender, text, role = 'u') {
        const mem = (this.meta.aiMemory ||= {});
        const now = Date.now();
        for (const u of Object.keys(mem)) if (now - (mem[u].at || 0) > 7 * 86400_000) delete mem[u];
        const users = Object.keys(mem);
        if (users.length > 100) {
            users.sort((a, b) => (mem[a].at || 0) - (mem[b].at || 0));
            for (const u of users.slice(0, users.length - 100)) delete mem[u];
        }
        const e = (mem[sender] ||= { at: now, turns: [] });
        e.at = now;
        e.turns.push({ r: role, x: String(text).slice(0, 120) });
        if (e.turns.length > 8) e.turns = e.turns.slice(-8);
        return e.turns.slice(0, -1).map((t) => `${t.r === 'u' ? 'User' : this.settings.botName || BOT_NAME}: ${t.x}`).join('\n');
    }

    group(jid) { return this.meta?.groups?.[jid] || {}; }
    async setGroup(jid, fn) {
        const groups = { ...(this.meta?.groups || {}) };
        const g = { ...(groups[jid] || {}) };
        fn(g); groups[jid] = g;
        const keys = Object.keys(groups);
        if (keys.length > 300) for (const k of keys) { if (k !== jid && !Object.keys(groups[k]).length) delete groups[k]; if (Object.keys(groups).length <= 300) break; }
        this.meta = { ...(this.meta || { number: this.id }), groups };
        clearTimeout(this.metaTimer);
        this.metaTimer = setTimeout(() => this.store.saveMeta(this.id, this.meta).catch((e) => this.l.error({ err: e.message }, 'saveMeta')), 2000);
    }
    async setReplies(fn) {
        const replies = fn({ ...(this.meta?.replies || {}) });
        this.meta = { ...(this.meta || { number: this.id }), replies };
        await this.store.saveMeta(this.id, this.meta);
    }

    #dropSocket() {
        const s = this.sock; this.sock = null;
        if (!s) return;
        for (const f of this.presences) f.clear(); this.presences.clear();
        clearTimeout(this.devTimer); clearTimeout(this.postTimer); clearInterval(this.schedTimer); this.contactBuf = null;
        try { s.ev.removeAllListeners('connection.update'); s.ev.removeAllListeners('messages.upsert'); s.ev.removeAllListeners('creds.update'); s.ev.removeAllListeners('groups.update'); s.ev.removeAllListeners('group-participants.update'); } catch {  }
        try { s.end(undefined); } catch {  }
    }
    async #release() { await this.auth?.dispose({ rm: true }).catch(() => {}); this.auth = null; }

    async reconnect(why) {
        this.l.info({ why }, 'reconnect');
        this.#dropSocket(); clearTimeout(this.timer);
        this.state = 'backoff'; this.#schedule(500);
    }

    async stop({ flush = true } = {}) {
        this.stopping = true; clearTimeout(this.timer); clearTimeout(this.postTimer);
        if (this.metaTimer) { clearTimeout(this.metaTimer); this.metaTimer = null; }
        if (this.meta) await this.store.saveMeta(this.id, this.meta, { flush }).catch(() => {});
        this.#dropSocket();
        if (this.auth) {
            try { if (flush) { await this.auth.saveCreds(); await this.auth.flush({ force: false }); } }
            catch (e) { this.l.error({ err: e.message }, 'final flush failed'); }
            await this.#release();
        }
        if (this.state !== 'dead') this.state = 'stopped';
    }
}
