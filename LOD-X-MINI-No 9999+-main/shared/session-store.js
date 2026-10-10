import zlib from 'node:zlib';
import { promisify } from 'node:util';
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export const SESSION_ID_RE = /^\d{6,16}$/;

export class SessionStore {
    constructor(storage, metaDb = null, log = console) {
        this.s = storage; this.db = metaDb; this.log = log;
        this.pgDirty = new Map(); this.pgTimer = null; this.pgEveryMs = 5 * 60_000;
    }
    k = {
        creds: (id) => `sessions/${id}/creds.json`,
        keys: (id) => `sessions/${id}/keys.json.gz`,
        meta: (id) => `sessions/${id}/meta.json`,
        queue: (id) => `queue/${id}.json`
    };

    async listSessionIds() {
        const { prefixes } = await this.s.list('sessions/', { delimiter: '/' });
        return prefixes.map((p) => p.slice('sessions/'.length, -1)).filter((id) => SESSION_ID_RE.test(id));
    }
    async listQueue() {
        const { keys } = await this.s.list('queue/');
        return keys.map((k) => k.slice('queue/'.length).replace(/\.json$/, '')).filter((id) => SESSION_ID_RE.test(id));
    }

    static validCreds(id, json) {
        try {
            const c = JSON.parse(typeof json === 'string' ? json : json.toString('utf8'));
            const num = String(c?.me?.id || '').split('@')[0].split(':')[0];
            return Boolean(num) && num === String(id);
        } catch { return false; }
    }
    async saveCreds(id, json) {
        if (!SessionStore.validCreds(id, json)) return false;
        await this.s.put(this.k.creds(id), json);
        return true;
    }
    async loadCreds(id) {
        const b = await this.s.get(this.k.creds(id));
        return b ? b.toString('utf8') : null;
    }

    async saveKeysBundle(id, files ) {
        return this.s.put(this.k.keys(id), await gzip(Buffer.from(JSON.stringify(files))));
    }
    async loadKeysBundle(id) {
        const b = await this.s.get(this.k.keys(id));
        if (!b) return null;
        return JSON.parse((await gunzip(b)).toString('utf8'));
    }

    async #loadMetaR2(id) {
        const b = await this.s.get(this.k.meta(id));
        if (!b) return null;
        try { return JSON.parse(b.toString('utf8')); } catch { return null; }
    }
    async loadMeta(id) {
        let row = null;
        if (this.db) {
            try { row = await this.db.get(id); }
            catch (e) { this.log.warn?.({ err: e.message }, 'settings db read failed – using local copy'); }
        }
        const local = await this.#loadMetaR2(id);
        if (row && local) return Number(local.updated || 0) > Number(row.updated || 0) ? local : row;
        return row || local || null;
    }
    async saveMeta(id, meta, { flush = false } = {}) {
        const stamped = { ...meta, updated: Date.now() };
        await this.s.put(this.k.meta(id), JSON.stringify(stamped));
        if (!this.db) return;
        if (flush) {
            this.pgDirty.delete(id);
            try { await this.db.put(id, stamped); }
            catch (e) { this.log.warn?.({ err: e.message }, 'settings db write failed – kept locally'); this.pgDirty.set(id, stamped); }
            return;
        }
        this.pgDirty.set(id, stamped);
        this.#schedulePg();
    }
    #schedulePg() {
        if (this.pgTimer || !this.pgDirty.size || !this.db) return;
        this.pgTimer = setTimeout(() => { this.pgTimer = null; this.flushPg().catch(() => {}); }, this.pgEveryMs);
        this.pgTimer.unref?.();
    }
    async flushPg() {
        if (!this.db || !this.pgDirty.size) return;
        const entries = [...this.pgDirty.entries()];
        this.pgDirty.clear();
        for (const [id, meta] of entries) {
            try { await this.db.put(id, meta); }
            catch (e) { this.log.warn?.({ err: e.message, id }, 'settings db flush failed – retrying later'); this.pgDirty.set(id, meta); }
        }
        this.#schedulePg();
    }

    putStats(shard, obj) { return this.s.put(`stats/${shard}.json`, JSON.stringify(obj)); }
    async listStats() {
        const { keys } = await this.s.list('stats/');
        const out = [];
        for (const k of keys.slice(0, 50)) {
            const b = await this.s.get(k);
            try { if (b) out.push(JSON.parse(b.toString('utf8'))); } catch {  }
        }
        return out;
    }

    enqueue(id, info = {}) { return this.s.put(this.k.queue(id), JSON.stringify({ id, at: Date.now(), ...info })); }
    dequeue(id) { return this.s.del(this.k.queue(id)); }

    async deleteSession(id) {
        const { keys } = await this.s.list(`sessions/${id}/`);
        for (const k of keys) await this.s.del(k);
        await this.dequeue(id);
        await this.db?.del(id).catch(() => {});
    }
}
