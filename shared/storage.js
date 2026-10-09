import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class LocalStorage {
    constructor(dir) {
        this.dir = path.resolve(dir);
    }
    #p(key) {
        const full = path.resolve(this.dir, key);
        if (!full.startsWith(this.dir + path.sep)) throw new Error('bad key');
        return full;
    }
    async put(key, body) {
        const f = this.#p(key);
        await fs.mkdir(path.dirname(f), { recursive: true });
        const tmp = `${f}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
        await fs.writeFile(tmp, body);
        await fs.rename(tmp, f);
    }
    async get(key) {
        try {
            return await fs.readFile(this.#p(key));
        } catch (e) {
            if (e.code === 'ENOENT') return null;
            throw e;
        }
    }
    async del(key) {
        await fs.rm(this.#p(key), { force: true });
    }
    async list(prefix = '', { delimiter = '' } = {}) {
        const keys = [];
        const prefixes = new Set();
        const walk = async (d) => {
            let ents;
            try { ents = await fs.readdir(d, { withFileTypes: true }); } catch { return; }
            for (const e of ents) {
                const full = path.join(d, e.name);
                if (e.isDirectory()) await walk(full);
                else if (!e.name.endsWith('.tmp')) keys.push(path.relative(this.dir, full).split(path.sep).join('/'));
            }
        };
        await walk(this.dir);
        const out = [];
        for (const k of keys.sort()) {
            if (!k.startsWith(prefix)) continue;
            const rest = k.slice(prefix.length);
            const i = delimiter ? rest.indexOf(delimiter) : -1;
            if (i >= 0) prefixes.add(prefix + rest.slice(0, i + 1));
            else out.push(k);
        }
        return { keys: out, prefixes: [...prefixes] };
    }
}

export class S3Storage {
    constructor({ endpoint, bucket, accessKeyId, secretAccessKey, forcePathStyle = false }, sdk) {
        this.bucket = bucket;
        this.sdk = sdk;
        this.client = new sdk.S3Client({
            region: 'auto',
            endpoint,
            forcePathStyle,
            credentials: { accessKeyId, secretAccessKey },
            maxAttempts: 5,
            requestChecksumCalculation: 'WHEN_REQUIRED',
            responseChecksumValidation: 'WHEN_REQUIRED'
        });
    }
    static async create(cfg) {
        const sdk = await import('@aws-sdk/client-s3');
        return new S3Storage(cfg, sdk);
    }
    async put(key, body) {
        await this.client.send(new this.sdk.PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body }));
    }
    async get(key) {
        try {
            const r = await this.client.send(new this.sdk.GetObjectCommand({ Bucket: this.bucket, Key: key }));
            return Buffer.from(await r.Body.transformToByteArray());
        } catch (e) {
            if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return null;
            throw e;
        }
    }
    async del(key) {
        await this.client.send(new this.sdk.DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    }
    async list(prefix = '', { delimiter = '' } = {}) {
        const keys = [];
        const prefixes = [];
        let token;
        do {
            const r = await this.client.send(
                new this.sdk.ListObjectsV2Command({
                    Bucket: this.bucket,
                    Prefix: prefix,
                    Delimiter: delimiter || undefined,
                    ContinuationToken: token
                })
            );
            for (const o of r.Contents || []) keys.push(o.Key);
            for (const p of r.CommonPrefixes || []) prefixes.push(p.Prefix);
            token = r.IsTruncated ? r.NextContinuationToken : undefined;
        } while (token);
        return { keys, prefixes };
    }
}

const MAGIC = Buffer.from('WMP1');
export class EncryptedStorage {
    constructor(inner, secret) {
        this.inner = inner;
        this.key = /^[0-9a-f]{64}$/i.test(secret)
            ? Buffer.from(secret, 'hex')
            : crypto.scryptSync(secret, 'wa-mini-platform/v1', 32);
    }
    #enc(buf) {
        const iv = crypto.randomBytes(12);
        const c = crypto.createCipheriv('aes-256-gcm', this.key, iv);
        const ct = Buffer.concat([c.update(buf), c.final()]);
        return Buffer.concat([MAGIC, iv, c.getAuthTag(), ct]);
    }
    #dec(buf) {
        if (buf.subarray(0, 4).equals(MAGIC)) {
            const iv = buf.subarray(4, 16);
            const tag = buf.subarray(16, 32);
            const d = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
            d.setAuthTag(tag);
            return Buffer.concat([d.update(buf.subarray(32)), d.final()]);
        }
        return buf;
    }
    put(key, body) {
        return this.inner.put(key, this.#enc(Buffer.isBuffer(body) ? body : Buffer.from(body)));
    }
    async get(key) {
        const b = await this.inner.get(key);
        return b ? this.#dec(b) : null;
    }
    del(key) { return this.inner.del(key); }
    list(prefix, opts) { return this.inner.list(prefix, opts); }
}

export async function createStorage(cfg, log = console) {
    let base;
    if (cfg.storage.driver === 'r2' || cfg.storage.driver === 's3') {
        const s = cfg.storage;
        if (!s.endpoint || !s.bucket || !s.accessKeyId || !s.secretAccessKey)
            throw new Error('R2 config incomplete: need R2_ACCOUNT_ID (or R2_ENDPOINT), R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
        base = await S3Storage.create(s);
        log.info?.({ bucket: s.bucket }, 'storage: Cloudflare R2');
    } else {
        base = new LocalStorage(cfg.storage.localDir);
        log.warn?.({ dir: cfg.storage.localDir }, 'storage: LOCAL folder (dev only – use R2 in production)');
    }
    if (cfg.encKey) {
        log.info?.('storage: session encryption ON (AES-256-GCM)');
        return new EncryptedStorage(base, cfg.encKey);
    }
    if (cfg.requireEnc) throw new Error('SESSION_ENC_KEY is required (REQUIRE_ENCRYPTION is on). Sessions = full WhatsApp account access.');
    log.warn?.('storage: session encryption OFF – creds.json is stored in plain text!');
    return base;
}
