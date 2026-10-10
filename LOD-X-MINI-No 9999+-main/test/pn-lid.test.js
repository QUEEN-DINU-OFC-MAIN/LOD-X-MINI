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
import { selfIdentity, rememberSelfMapping, isLidJid, isPnJid } from '../server/lib/pn.js';
import { selfJid } from '../shared/wa.js';
import { SessionRunner } from '../server/runner.js';
import { loadCommands } from '../server/commands/index.js';
import config from '../config.js';
config.defaultLang = 'en';

const PN = '17272829292';
const LID_A = '111111111111111', LID_B = '222222222222222', LID_C = '333333333333333', LID_D = '444444444444444';

test('selfIdentity: a normal pn account resolves the number, isLid=false', async () => {
    const s = await selfIdentity({ user: { id: `${PN}:1@s.whatsapp.net`, lid: `${LID_A}@lid` } });
    assert.equal(s.pn, PN);
    assert.equal(s.lid, LID_A);
    assert.equal(s.isLid, false);
});

test('selfIdentity: a LID-primary account recovers the pn from the stored mapping', async () => {
    const sock = {
        user: { id: `${LID_B}@lid`, lid: `${LID_B}@lid` },
        signalRepository: { lidMapping: { getPNForLID: async (l) => (String(l).startsWith(LID_B) ? `${PN}:0@s.whatsapp.net` : null) } }
    };
    const s = await selfIdentity(sock);
    assert.equal(s.pn, PN, 'real number recovered from the lid<->pn mapping');
    assert.equal(s.isLid, true);
    assert.equal(s.lid, LID_B);
});

test('selfIdentity: LID-primary with NO mapping returns pn=null (caller must fall back)', async () => {
    const sock = { user: { id: `${LID_C}@lid`, lid: `${LID_C}@lid` }, signalRepository: { lidMapping: { getPNForLID: async () => null } } };
    const s = await selfIdentity(sock);
    assert.equal(s.pn, null, 'never pretends a lid is a phone number');
    assert.equal(s.lid, LID_C);
});

test('rememberSelfMapping stores lid<->pn, after which selfIdentity resolves offline', async () => {
    const stored = [];
    const sock = {
        user: { id: `${LID_D}@lid`, lid: `${LID_D}@lid` },
        signalRepository: { lidMapping: { storeLIDPNMappings: async (p) => stored.push(...p), getPNForLID: async () => null } }
    };
    assert.equal(await rememberSelfMapping(sock, { pn: PN, lid: LID_D }), true);
    assert.deepEqual(stored, [{ lid: `${LID_D}@lid`, pn: `${PN}@s.whatsapp.net` }]);
    const s = await selfIdentity(sock);
    assert.equal(s.pn, PN);
});

test('rememberSelfMapping rejects junk (same id / non-digits / missing)', async () => {
    const boom = { signalRepository: { lidMapping: { storeLIDPNMappings: async () => { throw new Error('must not store junk'); } } } };
    assert.equal(await rememberSelfMapping(boom, { pn: PN, lid: PN }), false);
    assert.equal(await rememberSelfMapping(boom, { pn: 'not-a-number', lid: LID_A }), false);
    assert.equal(await rememberSelfMapping(boom, { pn: PN, lid: null }), false);
});

test('selfJid keeps the @lid domain for LID-primary accounts (else self-messages go nowhere)', () => {
    assert.equal(selfJid({ user: { id: `${PN}:1@s.whatsapp.net` } }), `${PN}@s.whatsapp.net`);
    assert.equal(selfJid({ user: { id: `${LID_A}:2@lid` } }), `${LID_A}@lid`);
});

test('isLidJid / isPnJid classify jids', () => {
    assert.ok(isLidJid(`${LID_A}@lid`) && !isLidJid(`${PN}@s.whatsapp.net`));
    assert.ok(isPnJid(`${PN}@s.whatsapp.net`) && !isPnJid(`${LID_A}@lid`));
});

function makeLog(sink) {
    const mk = (base) => ({
        info: (o, m) => sink.push({ ...base, ...(o && typeof o === 'object' ? o : {}), msg: typeof o === 'object' ? m : o }),
        warn() {}, error() {}, debug() {},
        child: (b) => mk({ ...base, ...b })
    });
    return mk({});
}

test('runner: a LID-keyed session binds logs to the real pn (meta.pn), not the lid', async () => {
    const LIDR = '555555555555555', PNR = '17272829292';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wmp-pn-'));
    const store = new SessionStore(new LocalStorage(path.join(dir, 'r2')));
    await store.saveCreds(LIDR, JSON.stringify({ me: { id: `${LIDR}:1@lid`, lid: `${LIDR}@lid` }, registered: true }));
    await store.saveMeta(LIDR, { number: LIDR, pn: PNR, lid: LIDR, welcomed: true });

    const sink = [];
    const handlers = {};
    const sock = {
        user: { id: `${LIDR}:1@lid`, lid: `${LIDR}@lid` },
        ev: { on: (n, f) => { handlers[n] = f; }, removeAllListeners() {} },
        sendMessage: async () => ({ key: { id: 'x' } }),
        sendPresenceUpdate: async () => {}, readMessages: async () => {}, end() {}
    };
    const cfg = loadConfig({ DATA_DIR: path.join(dir, 'data'), CMD_COOLDOWN_MS: '0', START_DELAY_MS: '1' });
    const platform = {
        cfg: cfg.worker, commands: await loadCommands(), sessionCount: () => 1,
        cmdQueue: new PQueue({ concurrency: 2 }), dlQueue: new PQueue({ concurrency: 1 }),
        groupCache: new BoundedCache({ max: 10 }), devicesCache: new BoundedCache({ max: 10 }),
        makeSocket: () => sock
    };
    const r = new SessionRunner(LIDR, { store, cfg, log: makeLog(sink), platform });
    await r.start();
    assert.equal(r.id, LIDR, 'storage key stays the lid (no migration)');
    assert.equal(r.pn, PNR, 'runner uses the real phone number from meta.pn');

    await handlers['connection.update']({ connection: 'open' });
    const conn = sink.find((l) => l.msg === 'connected');
    assert.ok(conn, 'a connected line was logged');
    assert.equal(conn.s, PNR, 'log tag is the pn, not the lid');
    assert.equal(conn.pn, `+${PNR}`);
    assert.equal(conn.lid, `+${LIDR}`);
    await r.stop({ flush: false });
});
