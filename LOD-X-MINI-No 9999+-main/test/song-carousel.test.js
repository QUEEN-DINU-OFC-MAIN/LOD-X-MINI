import test from 'node:test';
import assert from 'node:assert/strict';
import { B } from '../shared/wa.js';
import { songCarousel } from '../server/commands/download.js';

const upload = async () => ({ mediaUrl: 'https://mmg.whatsapp.net/x', directPath: '/x' });

test('.song swipe menu: carousel of results, per-card format buttons + YouTube url', async () => {
    const relayed = [];
    const sock = { waUploadToServer: upload, relayMessage: async (...a) => { relayed.push(a); return 'id'; } };
    const ctx = { sock, jid: '94770000001@s.whatsapp.net', prefix: '.', text: 'despacito' };
    const results = [
        { id: 'kJQP0kiwTNk', title: 'Luis Fonsi - Despacito', channel: 'LuisFonsiVEVO', duration: '4:42', views: '9B views', thumb: 'http://127.0.0.1:1/dead.jpg' },
        { id: 'abc12345678', title: 'Despacito (cover)', channel: 'Someone', duration: '3:10', views: '1M views', thumb: 'http://127.0.0.1:1/dead2.jpg' }
    ];
    await songCarousel(ctx, results);
    assert.equal(relayed.length, 1, 'one carousel relayed');
    const message = relayed[0][1];
    const im = message.viewOnceMessage.message.interactiveMessage;
    const cards = im.carouselMessage.cards;
    assert.equal(cards.length, 2, 'one card per result');
    assert.deepEqual(cards[0].nativeFlowMessage.buttons, [], 'button-less cards for mobile');
    assert.match(cards[0].body.text, /Despacito/, 'detail lives in the body (shown once on phone)');
    assert.doesNotMatch(cards[0].header.title, /Despacito/, 'short header title so it is not duplicated');
    const bytes = B.proto.Message.encode(message).finish().length;
    assert.ok(bytes < 30_000, `proto too large: ${bytes}`);
});
