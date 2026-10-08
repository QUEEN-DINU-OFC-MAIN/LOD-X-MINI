import crypto from 'node:crypto';
import path from 'node:path';
import QRCode from 'qrcode';
import { B, waLogger, normalizeNumber, numberOfJid, selfJid, statusCodeOf } from '../shared/wa.js';
import { openAuthState } from '../shared/authstate.js';
import { collectKeyFiles } from '../shared/keyfiles.js';
import { installingCaption } from '../shared/messages.js';
import { issuePanel } from '../shared/panel-auth.js';
import { resolveLang } from '../shared/i18n.js';
import { menuImage } from '../server/lib/ui.js';
import { selfIdentity, rememberSelfMapping, isLidJid } from '../server/lib/pn.js';
import { fullFrame, safeImgUrl, fetchImageBuffer } from '../server/lib/dp.js';
import { ensureWritableDir } from '../shared/config.js';
import appConfig from '../config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class PairingManager {
    constructor({ store, cfg, log }) {
        this.store = store; this.cfg = cfg; this.log = log;
        this.jobs = new Map();
        this.sweeper = setInterval(() => this.#sweep(), 15_000);
        this.sweeper.unref?.();
    }

    get active() { return [...this.jobs.values()].filter((j) => !j.final).length; }

    status(token) {
        const j = this.jobs.get(token);
        if (!j) return null;
        return { status: j.status, code: j.code, qr: j.qr, number: j.number, error: j.error, expiresAt: j.expiresAt };
    }

    async cancel(token) {
        const j = this.jobs.get(token);
        if (j && !j.final) await this.#close(j, 'cancelled', 'Cancelled');
    }

    async start({ mode, number, dpUrl }) {
        if (this.active >= this.cfg.site.maxPairings) throw Object.assign(new Error('Server is busy, try again in a minute'), { http: 503 });
        let num = null;
        if (mode === 'pair') {
            num = normalizeNumber(number);
            if (!num) throw Object.assign(new Error('Enter your number with country code, e.g. 94771234567'), { http: 400 });
        } else if (mode !== 'qr') throw Object.assign(new Error('mode must be pair or qr'), { http: 400 });

        const token = crypto.randomBytes(16).toString('hex');
        const dir = await ensureWritableDir(path.join(this.cfg.dataDir, 'pair', token), this.log);
        const job = {
            token, mode, number: num, status: 'starting', code: null, qr: null, error: null, final: false,
            createdAt: Date.now(), expiresAt: Date.now() + this.cfg.site.pairingTtlMs,
            sock: null, auth: null, reconnects: 0, codeRequested: false, finalizing: false,
            dpUrl: safeImgUrl(dpUrl),
            dir
        };
        this.jobs.set(token, job);
        this.#connect(job).catch((e) => this.#fail(job, e));
        return token;
    }

    async #connect(job) {
        if (job.final) return;
        if (!job.auth) job.auth = await openAuthState(`pair-${job.token}`, { store: this.store, dir: job.dir, fresh: true, autoSync: false, log: this.log });
        const { state, saveCreds } = job.auth;
        const sock = B.makeWASocket({
            version: B.DEFAULT_CONNECTION_CONFIG.version,
            auth: { creds: state.creds, keys: B.makeCacheableSignalKeyStore(state.keys, waLogger) },
            logger: waLogger,
            browser: B.Browsers.ubuntu('Chrome'),
            printQRInTerminal: false,
            markOnlineOnConnect: false,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            getMessage: async () => undefined
        });
        job.sock = sock;
        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', async (u) => {
            if (job.final || job.sock !== sock) return;
            const { connection, qr, lastDisconnect } = u;

            if (qr) {
                if (job.mode === 'qr') {
                    job.qr = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
                    job.status = 'qr';
                } else if (!job.codeRequested && !state.creds.registered) {
                    job.codeRequested = true;
                    try {
                        const raw = await sock.requestPairingCode(job.number);
                        job.code = raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
                        job.status = 'code';
                    } catch (e) {
                        return this.#fail(job, new Error('Could not request a pairing code. Check the number and try again.'));
                    }
                }
            }
            if (connection === 'open' && !job.finalizing) {
                job.finalizing = true;
                job.status = 'linked';
                this.#finalize(job, sock).catch((e) => this.#fail(job, e));
            }
            if (connection === 'close' && !job.finalizing) {
                const code = statusCodeOf(lastDisconnect);
                if (code === B.DisconnectReason.restartRequired || (code !== B.DisconnectReason.loggedOut && job.reconnects < 3)) {
                    if (code !== B.DisconnectReason.restartRequired) job.reconnects++;
                    this.#teardown(job, sock);
                    await sleep(400);
                    this.#connect(job).catch((e) => this.#fail(job, e));
                } else {
                    this.#fail(job, new Error(code === B.DisconnectReason.loggedOut ? 'Link was rejected' : 'Connection closed, please try again'));
                }
            }
        });
    }

    async #finalize(job, sock) {
        const cfg = this.cfg;
        const number = numberOfJid(sock.user?.id || job.auth.state.creds.me?.id);
        if (!number) throw new Error('Linked, but could not read the account number');

        const self = await selfIdentity(sock);
        const realPn = (job.mode === 'pair' && job.number) ? job.number : (self.pn || number);
        const lid = self.lid || (isLidJid(sock.user?.id) ? numberOfJid(sock.user.id) : null);
        if (lid && realPn !== lid) await rememberSelfMapping(sock, { pn: realPn, lid });

        if (job.dpUrl) {
            try {
                const buf = await fetchImageBuffer(job.dpUrl);
                const me = sock.user?.id || selfJid(sock);
                try {
                    await sock.updateProfilePicture(me, await fullFrame(buf, 'full'), { raw: true });
                } catch {
                    await sock.updateProfilePicture(me, await fullFrame(buf, 'blur'), { raw: true });
                }
                this.log.info({ number: realPn }, 'full DP set from /fulldp upload');
            } catch (e) { this.log.warn({ err: e.message }, 'full DP set failed (continuing)'); }
        }

        const issued = issuePanel();
        await sleep(cfg.site.settleMs);
        try {
            const lang = resolveLang(appConfig.defaultLang, realPn);
            const caption = await installingCaption(lang, { brand: cfg.site.brand, prefix: cfg.site.prefix, number: realPn, webUrl: appConfig.webUrl, password: issued.password });
            await sock.sendMessage(sock.user?.id || selfJid(sock), { image: menuImage('random'), caption });
        } catch (e) { this.log.warn({ err: e.message }, 'welcome message failed (continuing)'); }
        await sleep(2500);

        job.status = 'saving';
        await job.auth.saveCreds();
        this.#teardown(job, sock);
        await sleep(1500);

        let lastErr;
        for (let i = 0; i < 4; i++) {
            try {
                await this.#upload(job, number);
                const old = await this.store.loadMeta(number).catch(() => null);
                await this.store.saveMeta(number, { ...(old || {}), number, pn: realPn, lid, linkedAt: Date.now(), welcomed: false, panel: issued.panel, v: 1 });
                await this.store.enqueue(number, { reason: 'linked' });
                lastErr = null; break;
            } catch (e) { lastErr = e; this.log.warn({ err: e.message, try: i + 1 }, 'upload retry'); await sleep(1000 * (i + 1)); }
        }
        if (lastErr) throw new Error('Could not save your session. Please try again.');

        job.number = number;
        await this.#close(job, 'done');
        this.log.info({ number, pn: realPn, lid }, 'session linked + queued');
    }

    async #upload(job, number) {
        const { state } = job.auth;
        const saved = await this.store.saveCreds(number, JSON.stringify(state.creds, B.BufferJSON.replacer));
        if (!saved) throw new Error('Link was not completed (no account in credentials) – nothing was stored');
        const { files, gone } = await collectKeyFiles(job.dir, { log: this.log });
        if (gone.length) this.log.debug?.({ number, gone: gone.length }, 'pairing upload: keys removed during read');
        await this.store.saveKeysBundle(number, files);
    }

    #teardown(job, sock) {
        try { sock.ev.removeAllListeners('connection.update'); sock.ev.removeAllListeners('creds.update'); } catch {  }
        try { sock.end(undefined); } catch {  }
        if (job.sock === sock) job.sock = null;
    }

    async #fail(job, err) {
        if (job.final) return;
        this.log.warn({ err: err.message, mode: job.mode }, 'pairing failed');
        job.error = err.message;
        await this.#close(job, 'failed');
    }

    async #close(job, status, error) {
        job.final = true;
        job.status = status;
        if (error) job.error = error;
        job.qr = null;
        if (job.sock) this.#teardown(job, job.sock);
        if (job.auth) await job.auth.dispose({ rm: true }).catch(() => {});
        job.finishedAt = Date.now();
    }

    #sweep() {
        const now = Date.now();
        for (const [t, j] of this.jobs) {
            if (!j.final && now > j.expiresAt && !j.finalizing) this.#close(j, 'expired', 'Time is up – start again');
            else if (j.final && now - (j.finishedAt || now) > 5 * 60_000) this.jobs.delete(t);
            else if (!j.final && now > j.expiresAt + 120_000) this.#close(j, 'failed', 'Timed out');
        }
    }

    async shutdown() {
        clearInterval(this.sweeper);
        for (const j of this.jobs.values()) if (!j.final) await this.#close(j, 'cancelled', 'Server restarting').catch(() => {});
    }
}
