import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCommands } from '../server/commands/index.js';
import { commandSections, categorySections, textMenu, buildButtons, CATS, THEMES, menuImage } from '../server/lib/ui.js';
import { normalizePhone } from '../server/lib/phone.js';
import { SessionStore } from '../shared/session-store.js';

test('every command is well-formed and aliases do not collide', async () => {
    const cmds = await loadCommands();
    const names = new Set();
    for (const c of cmds.unique()) {
        assert.ok(c.name && c.cat && c.desc && typeof c.run === 'function', c.name);
        assert.ok(CATS.some(([k]) => k === c.cat), `${c.name}: bad category ${c.cat}`);
        assert.ok(!names.has(c.name), `duplicate ${c.name}`); names.add(c.name);
    }
    assert.ok(cmds.unique().size >= 85, `only ${cmds.unique().size} commands`);
});

test('menu sections obey WhatsApp limits (<=10 rows, short titles, ids carry prefix)', async () => {
    const list = [...(await loadCommands()).unique()];
    const sec = CATS.flatMap(([k]) => commandSections('.', list, { only: k }));
    const top = categorySections('.', list);
    assert.ok(top.length >= 1 && top.every((t) => t.rows.length <= 10 && t.rows.every((r) => r.id.startsWith('.menu '))) && top.length <= 10);
    for (const [k] of CATS) assert.ok(commandSections('.', list, { only: k }).length <= 10, `${k}: more than 10 sections`);
    for (const s of sec) {
        assert.ok(s.rows.length <= 10 && s.title.length <= 24);
        for (const r of s.rows) assert.ok(r.id.startsWith('.') && r.title.length <= 24 && r.description.length <= 72);
    }
    assert.ok(textMenu({ prefix: '.', commands: list, header: 'H' }).includes('.menu'));
});

test('button payload matches the owner snippet shape', () => {
    const b = buildButtons({ prefix: '.', quick: [{ id: '.alive', label: 'ALIVE' }, { id: '.owner', label: 'OWNER' }], sections: [{ title: 'RCD X MD FREE BOT', rows: [] }] });
    assert.deepEqual(b[0], { buttonId: '.alive', buttonText: { displayText: 'ALIVE' }, type: 1 });
    assert.equal(b[2].type, 4); assert.equal(b[2].nativeFlowInfo.name, 'single_select');
    assert.equal(JSON.parse(b[2].nativeFlowInfo.paramsJson).title, 'Click Here ❏');
});

test('phone numbers: every common way of typing a number', () => {
    for (const x of ['0767799548', '94767799548', '+94 76 779 9548', '0094767799548', '94-76-779-9548', '767799548', '(076) 779-9548']) assert.equal(normalizePhone(x), '94767799548', x);
    assert.equal(normalizePhone('+1 415 555 0132'), '14155550132');
    assert.equal(normalizePhone('12'), null); assert.equal(normalizePhone(''), null);
});

test('only REAL linked sessions are stored: fake / half-finished creds are rejected', async () => {
    const writes = [];
    const store = new SessionStore({ put: async (k) => writes.push(k) });
    assert.equal(await store.saveCreds('94767799548', '{}'), false);
    assert.equal(await store.saveCreds('94767799548', JSON.stringify({ registered: false, noiseKey: {} })), false);
    assert.equal(await store.saveCreds('94767799548', JSON.stringify({ me: { id: '94111111111:2@s.whatsapp.net' } })), false);
    assert.equal(await store.saveCreds('94767799548', 'not json'), false);
    assert.equal(writes.length, 0);
    assert.equal(await store.saveCreds('94767799548', JSON.stringify({ me: { id: '94767799548:5@s.whatsapp.net' }, registered: true })), true);
    assert.equal(writes.length, 1);
});

test('four logo themes exist, are small JPEGs, and "random" returns one of them', () => {
    assert.deepEqual(THEMES, ['yellow', 'green', 'pink', 'blue']);
    for (const t of THEMES) { const b = menuImage(t); assert.equal(b[0], 0xff); assert.ok(b.length > 50_000 && b.length < 200_000, t); }
    const r = menuImage('random'); assert.ok(THEMES.some((t) => r === menuImage(t)));
});

test('button messages are NOT view-once (view-once shows as already opened on the sender phone)', async () => {
    const { B } = await import('../shared/wa.js');
    const sent = [];
    const cmds = await loadCommands();
    const runnerSrc = (await import('node:fs')).readFileSync(new URL('../server/runner.js', import.meta.url), 'utf8');
    assert.ok(!/viewOnce:\s*true/.test(runnerSrc.replace(/\/\/.*$/gm, '')), 'runner must not set viewOnce:true');
    assert.ok(cmds.get('pair') && cmds.get('v2') === cmds.get('pair'));
});
