import test from 'node:test';
import assert from 'node:assert/strict';
import { B } from '../shared/wa.js';
import { loadCommands } from '../server/commands/index.js';
import { buildButtons, menuImage, categorySections } from '../server/lib/ui.js';

const upload = async () => ({ mediaUrl: 'https://mmg.whatsapp.net/x', directPath: '/x' });

test('menu command output -> valid interactive proto (image header, NOT view-once, 2 quick_reply + single_select)', async () => {
    const cmds = await loadCommands();
    let sent;
    const ctx = {
        prefix: '.', args: [], text: '', settings: { prefix: '.', mode: 'public', buttons: true },
        msg: { pushName: 'Tester', messageTimestamp: Math.floor(Date.now() / 1000) },
        menuImage: () => menuImage('pink'), runner: { uptime: () => '0d 0h 1m 0s' }, platform: { commands: cmds },
        sendButtons: async (o) => {
            const { buildButtons: bb } = await import('../server/lib/ui.js');
            sent = { buttons: bb({ prefix: '.', ...o }), headerType: 1, image: o.image, caption: `RCD X MINI LIST MENU\n\n${o.text}`, footer: o.footer };
        }
    };
    await cmds.get('menu').run(ctx);
    const msg = await B.generateWAMessageContent(sent, { upload });
    assert.ok(!msg.viewOnceMessage, 'must not be wrapped in viewOnce');
    const im = msg.interactiveMessage;
    assert.ok(im.header.imageMessage);
    assert.match(im.body.text, /^RCD X MINI LIST MENU/);
    const names = im.nativeFlowMessage.buttons.map((b) => b.name);
    assert.deepEqual(names, ['quick_reply', 'quick_reply', 'single_select', 'cta_url']);
    const sel = JSON.parse(im.nativeFlowMessage.buttons[2].buttonParamsJson);
    assert.equal(sel.title, 'Click Here ❏');
    assert.ok(sel.sections.length >= 1 && sel.sections.length <= 10); assert.equal(sel.sections[0].title, 'RCD X MINI FREE BOT'); assert.ok(sel.sections.flatMap((x) => x.rows).length >= 11); assert.ok(sel.sections.every((x) => x.rows.length <= 10));
    const bytes = B.proto.Message.encode(msg).finish().length;
    assert.ok(bytes < 12_000, `proto too large: ${bytes}`);
});

test('copy + quick buttons for the pair code message', async () => {
    const b = buildButtons({ prefix: '.', quick: [{ id: '.pair 94767799548', label: 'NEW CODE' }], copy: [{ label: '📋 COPY CODE', code: 'ABCD1234' }] });
    const msg = await B.generateWAMessageContent({ buttons: b, headerType: 1, text: 'code', footer: 'f' }, { upload });
    const btns = msg.interactiveMessage.nativeFlowMessage.buttons;
    assert.deepEqual(btns.map((x) => x.name), ['quick_reply', 'cta_copy', 'cta_url']);
    assert.equal(JSON.parse(btns[1].buttonParamsJson).copy_code, 'ABCD1234');
});

test('legacy {id,text}, url, copy shapes still convert', async () => {
    const msg = await B.generateWAMessageContent({ text: 'x', buttons: [{ id: 'a', text: 'A' }, { url: 'https://x.y', text: 'Go' }, { code: '123', text: 'Copy' }] }, { upload });
    const n = msg.interactiveMessage.nativeFlowMessage.buttons.map((b) => b.name);
    assert.deepEqual(n, ['quick_reply', 'cta_url', 'cta_copy']);
});

test('menu image is a real small JPEG shared in memory', () => {
    const b = menuImage('green');
    assert.equal(b[0], 0xff); assert.equal(b[1], 0xd8); assert.ok(b.length < 200_000);
    assert.equal(menuImage('green'), b);
});
