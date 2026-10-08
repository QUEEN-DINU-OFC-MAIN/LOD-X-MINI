import test from 'node:test';
import assert from 'node:assert/strict';
import { cszSearch, cszDownload } from '../server/lib/cinesubz.js';
import { loadCommands } from '../server/commands/index.js';

function stubFetch(routes) {
    const real = globalThis.fetch;
    globalThis.fetch = async (url, opts = {}) => {
        const u = String(url);
        for (const [match, body, status = 200] of routes) {
            if (u.includes(match)) {
                return { ok: status < 400, status, url: u, headers: new Headers({ 'content-type': 'application/json' }), text: async () => JSON.stringify(body), json: async () => body, arrayBuffer: async () => new Uint8Array(0).buffer, body: { cancel: async () => {} } };
            }
        }
        throw new Error('no route for ' + u);
    };
    return () => { globalThis.fetch = real; };
}

const SEARCH = { success: true, results: [
    { title: 'Housefull 5', url: 'https://cinesubz.co/movies/housefull-5', image: 'https://x/p1.jpg', year: '2025', quality: 'HD' },
    { title: 'Housefull 4', poster: 'https://x/p2.jpg', link: 'https://cinesubz.co/movies/housefull-4' }
] };

test('cszSearch: normalises mixed field names and caps the list', async () => {
    const done = stubFetch([['/search?', SEARCH]]);
    try {
        const r = await cszSearch('house full', 10);
        assert.equal(r.length, 2);
        assert.equal(r[0].title, 'Housefull 5'); assert.equal(r[0].image, 'https://x/p1.jpg');
        assert.equal(r[1].url, 'https://cinesubz.co/movies/housefull-4'); assert.equal(r[1].image, 'https://x/p2.jpg', 'poster mapped to image');
    } finally { done(); }
});

test('cszSearch: empty results -> clear error', async () => {
    const done = stubFetch([['/search?', { success: true, results: [] }]]);
    try { await assert.rejects(cszSearch('zzz'), /no results/); } finally { done(); }
});

test('cszDownload: collects nested episode/link URLs and de-dups', async () => {
    const body = { title: 'Housefull 5', metadata: { quality_tag: '1080p', language: 'Sinhala' },
        episodes: [
            { episode: 'E1', links: [{ url: 'https://cdn/a.mp4', quality: '1080p' }, { url: 'https://cdn/a2.mp4' }] },
            { episode: 'E2', links: [{ url: 'https://cdn/a.mp4' }] }
        ] };
    const done = stubFetch([['/download?', body]]);
    try {
        const d = await cszDownload('https://cinesubz.co/movies/housefull-5');
        assert.equal(d.title, 'Housefull 5');
        assert.equal(d.metadata.quality_tag, '1080p');
        const urls = d.links.map((l) => l.url);
        assert.deepEqual(urls, ['https://cdn/a.mp4', 'https://cdn/a2.mp4'], 'dups removed, order kept');
    } finally { done(); }
});

test('cszDownload: API error surfaces as a thrown message', async () => {
    const done = stubFetch([['/download?', { error: 'Post ID not found', metadata: {} }, 404]]);
    try { await assert.rejects(cszDownload('https://x'), /Post ID not found/); } finally { done(); }
});

const mkCtx = (id = '94760000001') => {
    const sent = []; const replies = [];
    return {
        sent, replies,
        prefix: '.', args: [], text: 'house full', isOwner: true,
        jid: '9476@s.whatsapp.net', sender: '9476@s.whatsapp.net',
        msg: { pushName: 'Owner', messageTimestamp: Math.floor(Date.now() / 1000) },
        runner: { id, uptime: () => '0d', settings: { prefix: '.', botName: 'RCD X MINI' } },
        sock: { waUploadToServer: async () => ({ mediaUrl: 'https://mmg/x', directPath: '/x' }), relayMessage: async () => 'id' },
        sendButtons: async (o) => sent.push(o),
        reply: async (t) => replies.push(t),
        react: async () => {}
    };
};

test('.cinesubz is owner-only + limited to 2 per hour, relays a results carousel', async () => {
    const cmds = await loadCommands();
    const cmd = cmds.get('cinesubz');
    assert.equal(cmd.ownerOnly, true, 'must be owner-only');
    const done = stubFetch([['/search?', SEARCH]]);
    try {
        const relayed = [];
        const ctx = mkCtx('ratelimit-test-1');
        const realRelay = ctx.sock.relayMessage;
        ctx.sock.relayMessage = async (...a) => { relayed.push(a); return realRelay(...a); };
        await cmd.run(ctx); await cmd.run(ctx);
        assert.equal(relayed.length, 2, 'two searches relay a carousel');
        await cmd.run(ctx);
        assert.match(ctx.replies.at(-1), /limit reached/, 'third call is rate-limited');
    } finally { done(); }
});
