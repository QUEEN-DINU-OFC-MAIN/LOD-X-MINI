import test from 'node:test';
import assert from 'node:assert/strict';
import { sendRemote, safeName, remoteSize } from '../server/lib/send.js';

const ctxWith = (sent) => ({
    jid: '9477@s.whatsapp.net',
    msg: { key: { id: 'k1' } },
    sock: { sendMessage: async (jid, content, opts) => { sent.push({ jid, content, opts }); return { key: { id: 'sent' } }; } }
});

function stubFetch(bytes, { ok = true } = {}) {
    const real = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, opts = {}) => {
        calls.push({ url, method: opts.method || 'GET' });
        const headers = new Headers({ 'content-length': String(bytes), 'content-type': 'audio/mpeg' });
        return {
            ok, status: ok ? 200 : 500, url, headers,
            body: { cancel: async () => {} },
            arrayBuffer: async () => new Uint8Array(Math.min(bytes, 1024)).buffer,
            text: async () => ''
        };
    };
    return () => { globalThis.fetch = real; return calls; };
}

test('sendRemote: a small file is fetched here and sent as a Buffer (not a WhatsApp-side URL)', async () => {
    const sent = [];
    const done = stubFetch(2 * 1024 * 1024);
    try {
        await sendRemote(ctxWith(sent), 'audio', 'https://cdn.example/a.mp3', { mimetype: 'audio/mpeg' });
    } finally { done(); }
    assert.equal(sent.length, 1);
    assert.ok(Buffer.isBuffer(sent[0].content.audio), `expected a Buffer, got ${typeof sent[0].content.audio}`);
    assert.equal(sent[0].content.mimetype, 'audio/mpeg');
    assert.deepEqual(sent[0].opts, { quoted: { key: { id: 'k1' } } });
});

test('sendRemote: a big file stays a remote URL (no RAM spike) and respects the per-kind cap', async () => {
    const sent = [];
    const done = stubFetch(30 * 1024 * 1024);
    try {
        await sendRemote(ctxWith(sent), 'video', 'https://cdn.example/v.mp4', { caption: 'hi' });
    } finally { done(); }
    assert.deepEqual(sent[0].content.video, { url: 'https://cdn.example/v.mp4' }, 'video over the buffer threshold stays a URL');
    assert.equal(sent[0].content.caption, 'hi');
});

test('sendRemote: over the WhatsApp limit -> clear error instead of a broken send', async () => {
    const sent = [];
    const done = stubFetch(90 * 1024 * 1024);
    try {
        await assert.rejects(sendRemote(ctxWith(sent), 'audio', 'https://cdn.example/big.mp3'), /limit is 40 MB/);
    } finally { done(); }
    assert.equal(sent.length, 0, 'nothing was sent');
});

test('sendRemote: if the local download fails it still sends the URL (no user-visible failure)', async () => {
    const sent = [];
    const real = globalThis.fetch;
    let head = true;
    globalThis.fetch = async (url, opts = {}) => {
        if ((opts.method || 'GET') === 'HEAD') { head = false; return { ok: true, status: 200, headers: new Headers({ 'content-length': '1000' }) }; }
        throw new Error('provider went away');
    };
    try {
        await sendRemote(ctxWith(sent), 'audio', 'https://cdn.example/a.mp3');
    } finally { globalThis.fetch = real; }
    assert.equal(head, false);
    assert.deepEqual(sent[0].content.audio, { url: 'https://cdn.example/a.mp3' });
});

test('remoteSize: 0 when the server gives no usable content-length', async () => {
    const real = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, status: 200, headers: new Headers({}) });
    try { assert.equal(await remoteSize('https://x/y'), 0); } finally { globalThis.fetch = real; }
});

test('safeName: strips path/quote characters and caps the length', () => {
    assert.equal(safeName('a/b:c*d?"e<f>g|h', 'mp3'), 'a b c d e f g h.mp3');
    assert.equal(safeName('x'.repeat(200), 'mp3').length, 84);
    assert.equal(safeName(undefined, 'apk'), 'file.apk');
});
