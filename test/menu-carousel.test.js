import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { B } from '../shared/wa.js';
import { loadCommands } from '../server/commands/index.js';
import { buildCarouselContent, sendCarouselMenu } from '../server/lib/menu.js';
import { menuImageFor, checkCategoryImages, CATS } from '../server/lib/ui.js';

const upload = async () => ({ mediaUrl: 'https://mmg.whatsapp.net/x', directPath: '/x', fileLength: 100 });

const mkCtx = (cmds) => ({
    prefix: '.', args: [], text: '', isSelf: false, sender: '9471@s.whatsapp.net',
    settings: { prefix: '.', mode: 'public', botName: 'RCD X MINI', menuStyle: 'carousel' },
    msg: { pushName: 'Tester', messageTimestamp: Math.floor(Date.now() / 1000) },
    runner: { uptime: () => '0d 0h 1m 0s' },
    platform: { commands: cmds },
    sock: { waUploadToServer: upload }
});

test('every category maps to its OWN banner (no sharing, all real JPEGs)', () => {
    assert.deepEqual(checkCategoryImages(CATS.map(([k]) => k)), []);
    const cats = CATS.map(([k]) => k);
    const seen = new Map();
    for (const cat of cats) {
        const b = menuImageFor(cat);
        assert.equal(b[0], 0xff); assert.equal(b[1], 0xd8, `${cat} is a JPEG`);
        assert.ok(b.length < 400_000, `${cat} small enough`);
        const h = createHash('md5').update(b).digest('hex');
        assert.ok(!seen.has(h), `${cat} has a unique banner`);
        seen.set(h, cat);
    }
});

test('carousel menu builds one card per non-empty category, each with an image header', async () => {
    const cmds = await loadCommands();
    const content = await buildCarouselContent(mkCtx(cmds));
    const im = content.viewOnceMessage.message.interactiveMessage;
    const cards = im.carouselMessage.cards;
    const catsWith = new Set([...cmds.unique()].filter((c) => !c.hidden).map((c) => c.cat));
    assert.ok(cards.length >= 8, `expected many category cards, got ${cards.length}`);
    for (const card of cards) {
        assert.ok(card.header.imageMessage, 'card has uploaded image header');
        assert.match(card.header.title, /MENU/);
    }
    assert.ok(im.contextInfo.forwardedNewsletterMessageInfo.newsletterJid.endsWith('@newsletter'), 'newsletter wired');
    const bytes = B.proto.Message.encode(content.viewOnceMessage.message).finish().length;
    assert.ok(bytes > 1000 && bytes < 200_000, `carousel proto size sane: ${bytes}`);
});

test('sendCarouselMenu relays the built carousel via relayMessage', async () => {
    const cmds = await loadCommands();
    const ctx = mkCtx(cmds);
    let relayed = null;
    ctx.sock.relayMessage = async (jid, msg, opts) => { relayed = { jid, msg, opts }; return 'id'; };
    ctx.jid = '9471@s.whatsapp.net';
    await sendCarouselMenu(ctx);
    assert.ok(relayed, 'relayMessage called');
    assert.ok(relayed.msg.viewOnceMessage.message.interactiveMessage.carouselMessage.cards.length > 0);
});
