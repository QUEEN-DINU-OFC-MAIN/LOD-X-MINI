import test from 'node:test';
import assert from 'node:assert/strict';
import { B } from '../shared/wa.js';
import { imgCarousel } from '../server/commands/imgsearch.js';

const upload = async () => ({ mediaUrl: 'https://mmg.whatsapp.net/x', directPath: '/x' });

test('.img swipe menu: button-less carousel of image results (mobile-safe)', async () => {
    const relayed = [];
    const sock = { waUploadToServer: upload, relayMessage: async (...a) => { relayed.push(a); return 'id'; } };
    const ctx = { sock, jid: '94770000001@s.whatsapp.net', prefix: '.', text: 'car' };
    const results = [
        { url: 'http://127.0.0.1:1/a.jpg', title: 'car 1' },
        { url: 'http://127.0.0.1:1/b.jpg', title: 'car 2' }
    ];
    await imgCarousel(ctx, results, 'car');
    assert.equal(relayed.length, 1, 'one carousel relayed');
    const im = relayed[0][1].viewOnceMessage.message.interactiveMessage;
    const cards = im.carouselMessage.cards;
    assert.equal(cards.length, 2, 'one card per image');
    assert.deepEqual(cards[0].nativeFlowMessage.buttons, [], 'button-less for mobile');
    assert.ok(cards[0].header.imageMessage, 'card carries an uploaded image');
    assert.match(im.body.text, /car/, 'root body names the query');
    const bytes = B.proto.Message.encode(relayed[0][1]).finish().length;
    assert.ok(bytes < 30_000, `proto too large: ${bytes}`);
});
