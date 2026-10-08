export class BoundedCache {
    constructor({ max = 500, ttlMs = 5 * 60_000, shared = false } = {}) {
        this.max = max; this.ttlMs = ttlMs; this.shared = shared; this.m = new Map();
    }
    get(k) {
        const e = this.m.get(k);
        if (!e) return undefined;
        if (e.x < Date.now()) { this.m.delete(k); return undefined; }
        this.m.delete(k); this.m.set(k, e);
        return e.v;
    }
    set(k, v) {
        if (this.m.has(k)) this.m.delete(k);
        this.m.set(k, { v, x: Date.now() + this.ttlMs });
        while (this.m.size > this.max) this.m.delete(this.m.keys().next().value);
        return true;
    }
    del(k) { return this.m.delete(k) ? 1 : 0; }
    mget(keys) { const o = {}; for (const k of keys) { const v = this.get(k); if (v !== undefined) o[k] = v; } return o; }
    mset(arr) { for (const { key, val } of arr) this.set(key, val); return true; }
    flushAll() { this.m.clear(); }
    close() { if (!this.shared) this.m.clear(); }
    get size() { return this.m.size; }
}
