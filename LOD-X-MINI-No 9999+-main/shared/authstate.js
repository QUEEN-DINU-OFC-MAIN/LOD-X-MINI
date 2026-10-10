import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Mutex } from 'async-mutex';
import { B } from './wa.js';
import { collectKeyFiles } from './keyfiles.js';

const SAFE_NAME = /^[A-Za-z0-9_.@-]+\.json$/;
const CREDS = 'creds.json';
const fileOf = (type, id) => `${type}-${String(id).replace(/\//g, '__').replace(/:/g, '-')}.json`;
const sha = (s) => crypto.createHash('sha1').update(s).digest('hex');

async function writeAtomic(file, data) {
    const tmp = `${file}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, file);
}

export async function openAuthState(id, { store, dir, fresh = false, autoSync = true, log = console, credsDebounceMs = 1500, keysSyncMinMs = 120_000, retryBaseMs = 5000 }) {
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });

    let creds;
    let initialJson = '';
    if (fresh) {
        creds = B.initAuthCreds();
    } else {
        const json = await store.loadCreds(id);
        if (!json) throw Object.assign(new Error(`no creds.json in storage for ${id}`), { code: 'NO_CREDS' });
        initialJson = json;
        creds = JSON.parse(json, B.BufferJSON.reviver);
        await writeAtomic(path.join(dir, CREDS), json);
        const bundle = await store.loadKeysBundle(id).catch((e) => {
            log.warn?.({ id, err: e.message }, 'keys bundle unreadable – continuing with creds only');
            return null;
        });
        if (bundle) {
            for (const [name, content] of Object.entries(bundle)) {
                if (SAFE_NAME.test(name) && name !== CREDS) await fs.writeFile(path.join(dir, name), content);
            }
        }
    }

    const writeMutex = new Mutex();
    const syncMutex = new Mutex();
    let lastCredsHash = initialJson ? sha(initialJson) : '';
    let keysDirty = false;
    let lastKeysSync = 0;
    let credsTimer = null;
    let keysTimer = null;
    let credsFailures = 0;
    let keysFailures = 0;
    let disposed = false;

    const serializeCreds = () => JSON.stringify(creds, B.BufferJSON.replacer);

    async function uploadCreds(force = false) {
        await syncMutex.runExclusive(async () => {
            const json = serializeCreds();
            const h = sha(json);
            if (!force && h === lastCredsHash) return;
            await store.saveCreds(id, json);
            lastCredsHash = h;
        });
    }
    const bundleFiles = async () => (await collectKeyFiles(dir, { skip: CREDS, log: log.child ? log.child({ id }) : log })).files;
    async function uploadKeys(force = false) {
        if (!keysDirty && !force) return;
        await syncMutex.runExclusive(async () => {
            keysDirty = false;
            try {
                await store.saveKeysBundle(id, await bundleFiles());
                lastKeysSync = Date.now();
                keysFailures = 0;
            } catch (e) {
                keysDirty = true;
                throw e;
            }
        });
    }

    const keysSyncFailed = () => {
        const backoff = Math.min(retryBaseMs * 2 ** keysFailures++, 120_000);
        lastKeysSync = Date.now() - keysSyncMinMs + Math.min(backoff, keysSyncMinMs);
    };

    function scheduleCreds(delay = credsDebounceMs) {
        if (!autoSync || disposed || credsTimer) return;
        credsTimer = setTimeout(async () => {
            credsTimer = null;
            try {
                await uploadCreds();
                credsFailures = 0;
            } catch (e) {
                credsFailures++;
                log.error?.({ id, err: e.message, attempt: credsFailures }, 'creds upload failed – will retry');
                scheduleCreds(Math.min(retryBaseMs * 2 ** (credsFailures - 1), 120_000));
            }
        }, delay);
        credsTimer.unref?.();
    }
    function scheduleKeys() {
        if (!autoSync || disposed || keysTimer) return;
        const wait = Math.max(0, keysSyncMinMs - (Date.now() - lastKeysSync)) + Math.floor(Math.random() * Math.min(5000, keysSyncMinMs * 0.1));
        keysTimer = setTimeout(async () => {
            keysTimer = null;
            try { await uploadKeys(); } catch (e) {
                log.error?.({ id, err: e.message }, 'keys bundle upload failed – will retry');
                keysSyncFailed(); scheduleKeys();
            }
        }, wait);
        keysTimer.unref?.();
    }

    const keys = {
        get: async (type, ids) => {
            const data = {};
            await Promise.all(
                ids.map(async (kid) => {
                    let v = null;
                    try {
                        v = JSON.parse(await fs.readFile(path.join(dir, fileOf(type, kid)), 'utf8'), B.BufferJSON.reviver);
                    } catch {  }
                    if (type === 'app-state-sync-key' && v) v = B.proto.Message.AppStateSyncKeyData.fromObject(v);
                    data[kid] = v;
                })
            );
            return data;
        },
        set: async (data) => {
            await writeMutex.runExclusive(async () => {
                const jobs = [];
                for (const type in data) {
                    for (const kid in data[type]) {
                        const file = path.join(dir, fileOf(type, kid));
                        const v = data[type][kid];
                        jobs.push(v ? writeAtomic(file, JSON.stringify(v, B.BufferJSON.replacer)) : fs.rm(file, { force: true }));
                    }
                }
                await Promise.all(jobs);
            });
            keysDirty = true;
            scheduleKeys();
        }
    };

    const saveCreds = async () => {
        await writeAtomic(path.join(dir, CREDS), serializeCreds());
        scheduleCreds();
    };

    return {
        id, dir,
        state: { creds, keys },
        saveCreds,
        async flush({ force = false } = {}) {
            if (credsTimer) { clearTimeout(credsTimer); credsTimer = null; }
            if (keysTimer) { clearTimeout(keysTimer); keysTimer = null; }
            await uploadCreds(force);
            await uploadKeys(force);
        },
        get pending() { return Boolean(credsTimer) || keysDirty || sha(serializeCreds()) !== lastCredsHash; },
        async dispose({ rm = true } = {}) {
            disposed = true;
            clearTimeout(credsTimer); clearTimeout(keysTimer);
            if (rm) await fs.rm(dir, { recursive: true, force: true });
        }
    };
}
