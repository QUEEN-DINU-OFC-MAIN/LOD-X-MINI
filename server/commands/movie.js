import * as CSZ from '../lib/cinesubz.js';
import { sendRemote } from '../lib/send.js';
import { menuImageFor } from '../lib/ui.js';
import { B, waLogger } from '../../shared/wa.js';

const P = B.proto.Message.InteractiveMessage;

const HOUR = 3600_000;
const hits = new Map();
function rateLimited(runnerId) {
    const now = Date.now();
    const arr = (hits.get(runnerId) || []).filter((t) => now - t < HOUR);
    const limited = arr.length >= 2;
    if (!limited) { arr.push(now); hits.set(runnerId, arr); }
    return { limited, left: Math.max(0, 2 - arr.length), resetMin: limited ? Math.ceil((HOUR - (now - arr[0])) / 60000) : 0 };
}

const enc = encodeURIComponent; const dec = decodeURIComponent;

async function resultsCarousel(ctx, results) {
    const sock = ctx.sock; const upload = sock.waUploadToServer;
    const cards = [];
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        let media;
        try {
            if (r.image) media = await B.prepareWAMessageMedia({ image: { url: r.image } }, { upload, logger: waLogger });
            else media = await B.prepareWAMessageMedia({ image: menuImageFor('movie') }, { upload, logger: waLogger });
        } catch { media = await B.prepareWAMessageMedia({ image: menuImageFor('movie') }, { upload, logger: waLogger }); }
        cards.push({
            header: P.Header.create({ ...media, title: `${i + 1}. ${r.title}${r.meta ? `\n${r.meta}` : ''}`, subtitle: 'CINESUBZ', hasMediaAttachment: true }),
            body: P.Body.create({ text: `${i + 1}. ${r.title}` }),
            nativeFlowMessage: P.NativeFlowMessage.create({ buttons: [
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '⬇️ DOWNLOAD', id: `${ctx.prefix}cszdl ${enc(r.url)}` }) },
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📄 TEXT', id: `${ctx.prefix}menu2` }) }
            ] })
        });
    }
    const content = {
        viewOnceMessage: { message: { interactiveMessage: P.create({
            body: P.Body.create({ text: `🎬 *CINESUBZ — ${results.length} result(s)*\n\n👉 Swipe a poster, tap ⬇️ DOWNLOAD.` }),
            footer: P.Footer.create({ text: 'LOD X MINI • CINESUBZ' }),
            carouselMessage: P.CarouselMessage.create({ cards, messageVersion: 1 })
        }) } }
    };
    const msg = B.generateWAMessageFromContent(ctx.jid, content, { logger: waLogger });
    await sock.relayMessage(ctx.jid, msg.message, { messageId: msg.key.id });
}

async function sendMovie(ctx, url) {
    try { return await sendRemote(ctx, 'video', url, { caption: `🎬 ${ctx.text ? '' : ''}` }); }
    catch (e) {
        if (/limit is/.test(e.message)) return sendRemote(ctx, 'document', url, { fileName: 'movie.mp4', caption: '🎬 (sent as document – too big for video)' });
        throw e;
    }
}

export default [
    {
        name: 'cinesubz', aliases: ['movie', 'cine'], cat: 'movie', ownerOnly: true, timeoutMs: 120_000,
        desc: '🔜 Soon — CineSubz movie search (Sinhala subs) via swipe menu  (.cinesubz house full)',
        async run(ctx) {
            if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}cinesubz house full`);
            const rl = rateLimited(ctx.runner.id);
            if (rl.limited) return ctx.reply(`⏳ CineSubz limit reached (2/hour). Resets in ~${rl.resetMin} min.`);
            await ctx.react('🎬');
            const results = await CSZ.cszSearch(ctx.text);
            try { return await resultsCarousel(ctx, results); }
            catch {
                ctx.choicesNote = results;
                const lines = results.map((r, i) => `${i + 1}. ${r.title}`).join('\n');
                return ctx.sendButtons({
                    text: `🎬 *CINESUBZ — ${results.length} result(s)*\n\n${lines}\n\n↩️ Reply a number to download.`,
                    sections: [{ title: 'RESULTS', highlight_label: '', rows: results.map((r, i) => ({ title: `${i + 1}. ${r.title}`.slice(0, 24), description: r.meta || '', id: `${ctx.prefix}cszdl ${enc(r.url)}` })) }],
                    listLabel: '🎬 Results', listTitle: 'Pick a movie'
                });
            }
        }
    },
    {
        name: 'cszdl', hidden: true, cat: 'movie', ownerOnly: true, timeoutMs: 120_000,
        desc: 'internal: open a CineSubz post and offer its download links',
        async run(ctx) {
            const url = dec(ctx.args[0] || '');
            if (!/^https?:\/\//i.test(url)) return ctx.reply('❌ Bad link');
            await ctx.react('⏳');
            const d = await CSZ.cszDownload(url);
            if (!d.links.length) return ctx.reply(`❌ No download links yet for *${d.title || 'that post'}*.`);
            if (d.links.length === 1) return sendMovie(ctx, d.links[0].url);
            await ctx.sendButtons({
                text: `🎬 *${d.title || 'CineSubz'}*\n${d.metadata.quality_tag ? `🎞️ ${d.metadata.quality_tag}\n` : ''}${d.metadata.language ? `🗣️ ${d.metadata.language}\n` : ''}\n👇 Pick a link / episode:`,
                sections: [{ title: 'LINKS', highlight_label: '', rows: d.links.slice(0, 30).map((l, i) => ({ title: `${i + 1}. ${l.label}`.slice(0, 24), description: 'Download', id: `${ctx.prefix}cszget ${enc(l.url)}` })) }],
                listLabel: '⬇️ Links', listTitle: 'Choose'
            });
        }
    },
    {
        name: 'cszget', hidden: true, cat: 'movie', ownerOnly: true, timeoutMs: 240_000,
        desc: 'internal: send a chosen CineSubz file',
        async run(ctx) {
            const url = dec(ctx.args[0] || '');
            if (!/^https?:\/\//i.test(url)) return ctx.reply('❌ Bad link');
            await ctx.reply('⏳ Sending…');
            await sendMovie(ctx, url);
        }
    }
];
