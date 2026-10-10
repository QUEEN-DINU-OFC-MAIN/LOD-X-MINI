import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { fullFrame, safeImgUrl, fetchImageBuffer, uploadToImgbb } from '../server/lib/dp.js';

const jpeg = (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: '#3366ff' } }).jpeg().toBuffer();

test('safeImgUrl only allows the ImgBB CDN over https (SSRF guard)', () => {
    assert.equal(safeImgUrl('https://i.ibb.co/abc/x.jpg'), 'https://i.ibb.co/abc/x.jpg');
    assert.equal(safeImgUrl('https://ibb.co/abc/x.png'), 'https://ibb.co/abc/x.png');
    assert.equal(safeImgUrl('http://i.ibb.co/abc/x.jpg'), null, 'http rejected');
    assert.equal(safeImgUrl('https://evil.com/x.jpg'), null, 'other host rejected');
    assert.equal(safeImgUrl('https://i.ibb.co.evil.com/x.jpg'), null, 'lookalike host rejected');
    assert.equal(safeImgUrl('http://169.254.169.254/latest/meta-data'), null, 'metadata endpoint rejected');
    assert.equal(safeImgUrl('not a url'), null);
    assert.equal(safeImgUrl(''), null);
    assert.equal(safeImgUrl(undefined), null);
});

test('fullFrame returns a whole-picture JPEG; blur pads to a square', async () => {
    const src = await jpeg(300, 120);
    const full = await fullFrame(src, 'full');
    assert.equal(full[0], 0xff); assert.equal(full[1], 0xd8, 'full is a JPEG');
    const fm = await sharp(full).metadata();
    assert.equal(Math.max(fm.width, fm.height), 640, 'full longest side is 640');
    assert.ok(fm.width <= 640 && fm.height <= 640, 'full fits inside the box');
    assert.equal(fm.height, Math.round((120 / 300) * 640), 'aspect preserved');

    const blur = await fullFrame(src, 'blur');
    assert.equal(blur[0], 0xff); assert.equal(blur[1], 0xd8, 'blur is a JPEG');
    const bm = await sharp(blur).metadata();
    assert.equal(bm.width, 640); assert.equal(bm.height, 640, 'blur is square');
});

test('uploadToImgbb posts key+image+expiration and maps the CDN response', async () => {
    const realFetch = global.fetch;
    let captured = null;
    global.fetch = async (url, opts) => {
        captured = { url, body: String(opts.body) };
        return {
            ok: true,
            json: async () => ({
                success: true, status: 200,
                data: { url: 'https://i.ibb.co/abc/x.jpg', display_url: 'https://i.ibb.co/def/x.jpg', delete_url: 'https://ibb.co/abc/h', id: 'abc', width: '640', height: '480' }
            })
        };
    };
    try {
        const out = await uploadToImgbb('data:image/png;base64,QUJDREVG', { key: 'TESTKEY', expiration: 600 });
        assert.equal(captured.url, 'https://api.imgbb.com/1/upload');
        assert.match(captured.body, /key=TESTKEY/);
        assert.match(captured.body, /image=QUJDREVG/, 'data-URL prefix stripped to raw base64');
        assert.match(captured.body, /expiration=600/);
        assert.equal(out.url, 'https://i.ibb.co/abc/x.jpg');
        assert.equal(out.display_url, 'https://i.ibb.co/def/x.jpg');
        assert.equal(out.delete_url, 'https://ibb.co/abc/h');
    } finally { global.fetch = realFetch; }
});

test('uploadToImgbb rejects empty / malformed input before any network call', async () => {
    const realFetch = global.fetch;
    let called = false;
    global.fetch = async () => { called = true; return { ok: true, json: async () => ({}) }; };
    try {
        await assert.rejects(() => uploadToImgbb('', { key: 'K' }), (e) => e.status === 400);
        await assert.rejects(() => uploadToImgbb(';;;not-base64;;;', { key: 'K' }), (e) => e.status === 400);
        await assert.rejects(() => uploadToImgbb('QUJD', {}), (e) => e.status === 500, 'missing key');
        assert.equal(called, false, 'no fetch for invalid input');
    } finally { global.fetch = realFetch; }
});

test('uploadToImgbb surfaces an ImgBB failure as 502', async () => {
    const realFetch = global.fetch;
    global.fetch = async () => ({ ok: false, status: 400, json: async () => ({ success: false, error: { message: 'Invalid image' } }) });
    try {
        await assert.rejects(() => uploadToImgbb('QUJD', { key: 'K' }), (e) => e.status === 502 && /Invalid image/.test(e.message));
    } finally { global.fetch = realFetch; }
});

test('fetchImageBuffer downloads and enforces the size cap', async () => {
    const realFetch = global.fetch;
    const payload = new Uint8Array([0xff, 0xd8, 1, 2, 3]).buffer;
    global.fetch = async () => ({ ok: true, arrayBuffer: async () => payload });
    try {
        const buf = await fetchImageBuffer('https://i.ibb.co/abc/x.jpg');
        assert.equal(buf[0], 0xff); assert.equal(buf.length, 5);
        await assert.rejects(() => fetchImageBuffer('https://i.ibb.co/abc/x.jpg', 2), /too large/);
    } finally { global.fetch = realFetch; }
});
