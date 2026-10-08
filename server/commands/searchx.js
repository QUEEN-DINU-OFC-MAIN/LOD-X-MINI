import * as P from '../lib/providers.js';
import { getJson, enc } from '../lib/http.js';
import { numberOfJid } from '../../shared/wa.js';
import { normalizePhone } from '../lib/phone.js';

const base = [
    {
        name: 'yts', aliases: ['ytsearch'], cat: 'search', desc: 'Search YouTube  (.yts despacito)',
        async run(ctx) {
            if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}yts despacito`);
            const list = (await P.ytSearch(ctx.text, 8)).slice(0, 5);
            const text = `🔍 *YouTube* — "${ctx.text}"\n\n${list.map((v, i) => `*${i + 1}.* ${v.title}\n     👤 ${v.channel} • ⏱️ ${v.duration} • ${v.views}`).join('\n\n')}\n\n👇 Tap a result to download.`;
            await ctx.sendButtons({
                text, image: { url: list[0].thumb }, header: false,
                sections: [
                    { title: '🎵 AUDIO', highlight_label: '', rows: list.map((v) => ({ title: v.title.slice(0, 24), description: `${v.duration} • ${v.channel}`.slice(0, 72), id: `${ctx.prefix}song ${v.id}` })) },
                    { title: '🎬 VIDEO', highlight_label: '', rows: list.map((v) => ({ title: v.title.slice(0, 24), description: `${v.duration} • ${v.channel}`.slice(0, 72), id: `${ctx.prefix}video ${v.id}` })) }
                ],
                listLabel: '📥 Download', listTitle: 'Pick a result'
            });
        }
    },
    {
        name: 'lyrics', aliases: ['lyric'], cat: 'search', desc: 'Song lyrics  (.lyrics coldplay - yellow)',
        async run(ctx) {
            if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}lyrics despacito   (or: ${ctx.prefix}lyrics coldplay - yellow)`);
            const q = ctx.text.replace(/\s+-\s+/, ' ');
            let hit;
            try { const r = await getJson(`https://lrclib.net/api/search?q=${enc(q)}`, { timeout: 20000 }); hit = (Array.isArray(r) ? r : []).find((x) => x.plainLyrics); } catch {  }
            if (!hit) {
                const [artist, ...t] = ctx.text.split(/\s+-\s+/);
                if (t.length) { try { const j = await getJson(`https://api.lyrics.ovh/v1/${enc(artist.trim())}/${enc(t.join(' - ').trim())}`); if (j.lyrics) hit = { plainLyrics: j.lyrics, trackName: t.join(' - ').trim(), artistName: artist.trim() }; } catch {  } }
            }
            if (!hit) return ctx.reply('❌ Lyrics not found');
            const body = hit.plainLyrics.trim();
            await ctx.reply(`📝 *${hit.trackName}* — ${hit.artistName}\n\n${body.length > 3500 ? `${body.slice(0, 3500)}…` : body}`);
        }
    },
    {
        name: 'dp', cat: 'search', desc: "A number's profile photo + business info  (.dp 0771234567)",
        async run(ctx) {
            const n = normalizePhone(ctx.args[0]);
            if (!n) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}dp 0771234567`);
            const jid = `${n}@s.whatsapp.net`;
            const [exists] = await ctx.sock.onWhatsApp(jid).catch(() => []);
            if (!exists?.exists) return ctx.reply(`❌ +${n} is not on WhatsApp`);
            let url; try { url = await ctx.sock.profilePictureUrl(exists.jid || jid, 'image'); } catch {  }
            let biz = ''; try { const b = await ctx.sock.getBusinessProfile(exists.jid || jid); if (b) biz = `\n\n🏢 *Business*\n${b.description || ''}\n${b.category || ''}\n${b.website?.[0] || ''}`.trimEnd(); } catch {  }
            const caption = `👤 +${n}${biz}`;
            if (url) await ctx.sock.sendMessage(ctx.jid, { image: { url }, caption }, { quoted: ctx.msg });
            else await ctx.reply(`${caption}\n\n🖼️ No public profile photo.`);
        }
    }
];

import { BoundedCache as _BC } from '../../shared/cache.js';
import { sendRemote as _send } from '../lib/send.js';
const NXB = process.env.NEXRAY_BASE || 'https://api.nexray.eu.cc';
const picks = new _BC({ max: 300, ttlMs: 10 * 60_000, shared: true });
const strip = (h) => String(h).replace(/<[^>]+>/g, '').replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');

const listSearch = (name, aliases, label, emoji, path, kind) => ({
    name, aliases, cat: 'search', desc: `${label}  (.${name} cats)`, react: emoji, timeoutMs: 60000,
    async run(ctx) {
        if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}${name} funny cats`);
        const j = await getJson(`${NXB}/search/${path}?q=${enc(ctx.text)}`, { timeout: 40000 });
        const list = (j?.result || []).filter((x) => (kind === 'photo' ? x.images?.length : x.data || x.url)).slice(0, 8);
        if (!list.length) return ctx.reply('❌ No results');
        picks.set(`${ctx.runner.id}:${ctx.jid}:${name}`, list);
        await ctx.sendButtons({
            header: false, image: list[0].cover ? { url: list[0].cover } : undefined,
            text: `${emoji} *${label}* — "${ctx.text}"\n\n${list.map((v, i) => `*${i + 1}.* ${(v.title || v.description || '').replace(/\s+/g, ' ').slice(0, 70)} ${v.duration ? `• ⏱️ ${v.duration}` : ''}`).join('\n')}\n\n👇 Tap one to receive it.`,
            quick: [{ id: `${ctx.prefix}${name} ${ctx.text}`.slice(0, 200), label: '🔁 AGAIN' }, { id: `${ctx.prefix}menu`, label: '📜 MENU' }],
            sections: [{ title: label.slice(0, 24), highlight_label: '', rows: list.map((v, i) => ({ title: `${i + 1}. ${(v.title || v.description || 'result').replace(/\s+/g, ' ')}`.slice(0, 24), description: (v.title || v.description || '').replace(/\s+/g, ' ').slice(0, 72), id: `${ctx.prefix}searchpick ${name} ${i}` })) }],
            listLabel: '📥 Get one', listTitle: label
        });
    }
});

export const extra = [
    listSearch('ttsearch', ['tiktoksearch', 'tts'], 'TikTok search', '🎵', 'tiktok', 'video'),
    listSearch('ttphoto', ['tiktokphoto'], 'TikTok photo search', '📸', 'tiktokphoto', 'photo'),
    listSearch('douyin', ['dy'], 'Douyin search', '🇨🇳', 'douyin', 'video'),
    {
        name: 'searchpick', cat: 'search', hidden: true, desc: 'internal: send a search result', timeoutMs: 180_000,
        async run(ctx) {
            const [name, i] = ctx.args; const list = picks.get(`${ctx.runner.id}:${ctx.jid}:${name}`); const v = list?.[Number(i)];
            if (!v) return ctx.reply('⌛ That list expired — search again.');
            await ctx.react('⏳');
            ctx.background(async () => {
                if (name === 'ttphoto') {
                    for (const img of v.images.slice(0, 6)) await ctx.sock.sendMessage(ctx.jid, { image: { url: img }, caption: `📸 ${(v.title || '').slice(0, 150)}` }, { quoted: ctx.msg });
                } else await _send(ctx, 'video', v.data || v.url, { caption: `🎬 ${(v.title || v.description || '').slice(0, 200)}` });
            }, name);
        }
    },
    {
        name: 'wikisearch', aliases: ['wsearch'], cat: 'search', desc: 'Search Wikipedia articles  (.wikisearch colombo)', react: '📚', timeoutMs: 40000,
        async run(ctx) {
            if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}wikisearch colombo`);
            const j = await getJson(`${NXB}/search/wikipedia?q=${enc(ctx.text)}`, { timeout: 30000 });
            const list = (j?.result || []).slice(0, 8); if (!list.length) return ctx.reply('❌ No articles found');
            await ctx.sendButtons({
                header: false,
                text: `📚 *Wikipedia* — "${ctx.text}"\n\n${list.map((x, i) => `*${i + 1}.* ${x.title}\n    ${strip(x.snippet).slice(0, 90)}…`).join('\n')}`,
                quick: [{ id: `${ctx.prefix}menu search`, label: '📜 SEARCH MENU' }],
                sections: [{ title: 'ARTICLES', highlight_label: '', rows: list.map((x) => ({ title: x.title.slice(0, 24), description: strip(x.snippet).slice(0, 72), id: `${ctx.prefix}wiki ${x.title}` })) }], listLabel: '📖 Read article', listTitle: 'Wikipedia'
            });
        }
    }
];

export default [...base, ...extra];
