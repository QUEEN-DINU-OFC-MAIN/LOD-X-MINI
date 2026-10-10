import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCommands } from '../server/commands/index.js';
import { SCHEMA } from '../shared/panel-settings.js';

const mk = (overrides = {}) => {
    const settings = { prefix: '.', mode: 'public', buttons: true, botName: 'RCD X MINI', react: true, theme: 'random', menuStyle: 'carousel' };
    const sent = [];
    const ctx = {
        prefix: '.', args: [], text: '', isOwner: true,
        msg: { pushName: 'Owner', messageTimestamp: Math.floor(Date.now() / 1000) },
        runner: {
            settings,
            setSettings: async (patch) => Object.assign(settings, patch),
            uptime: () => '0d 0h 1m 0s'
        },
        sendButtons: async (o) => sent.push(o),
        reply: async (t) => sent.push({ text: t }),
        ...overrides
    };
    return { ctx, settings, sent };
};

test('.settings shows every SCHEMA key grouped, RCD-branded', async () => {
    const cmds = await loadCommands();
    const { ctx, sent } = mk();
    await cmds.get('settings').run(ctx);
    const body = sent[0].text;
    for (const f of SCHEMA) assert.ok(body.includes(`${f.key} ❯`), `lists ${f.key}`);
    assert.match(body, /RCD X MINI — SETTINGS/);
    assert.match(body, /set <key> <value>/);
    assert.ok(!/vajira/i.test(body), 'no foreign brand');
});

test('.set toggles a bool and rejects invalid select values', async () => {
    const cmds = await loadCommands();
    const { ctx, settings, sent } = mk();
    ctx.args = ['react', 'off'];
    await cmds.get('set').run(ctx);
    assert.equal(settings.react, false);

    ctx.args = ['mode', 'hacked'];
    await cmds.get('set').run(ctx);
    assert.equal(settings.mode, 'public', 'invalid select rejected');

    ctx.args = ['mode', 'private'];
    await cmds.get('set').run(ctx);
    assert.equal(settings.mode, 'private');
});

test('.set with unknown key lists valid keys instead of guessing', async () => {
    const cmds = await loadCommands();
    const { ctx, sent } = mk();
    ctx.args = ['nope', 'x'];
    await cmds.get('set').run(ctx);
    assert.match(sent[0].text, /Unknown key/);
    assert.ok(sent[0].text.includes('react'));
});

test('.set prefix key is sanitised (letters rejected)', async () => {
    const cmds = await loadCommands();
    const { ctx, settings } = mk();
    ctx.args = ['prefix', 'abc'];
    await cmds.get('set').run(ctx);
    assert.equal(settings.prefix, '.', 'letters are not a valid prefix');
});
