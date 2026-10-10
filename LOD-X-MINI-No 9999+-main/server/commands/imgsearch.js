import * as P from '../lib/providers.js';
import { B, waLogger } from '../../shared/wa.js';
import { menuImageFor } from '../lib/ui.js';

const IP = B.proto.Message.InteractiveMessage;
const LONG = 120_000;

async function imgCarousel(ctx, results, q) {
    const sock = ctx.sock; const upload = sock.waUploadToServer;
    const cards = await Promise.all(results.map(async (r, i) => {
        let media;
        try { media = await B.prepareWAMessageMedia({ image: { url: r.url } }, { upload, logger: waLogger }); }
        catch { media = await B.prepareWAMessageMedia({ image: menuImageFor('search') }, { upload, logger: waLogger }); }
        return {
            header: IP.Header.create({ ...media, title: `🖼️ ${i + 1}`, subtitle: 'IMAGE SEARCH', hasMediaAttachment: true }),
            body: IP.Body.create({ text: `🖼️ ${q}\n${r.url.split('/').pop().slice(0, 40)}` }),
            nativeFlowMessage: IP.NativeFlowMessage.create({ buttons: [] })
        };
    }));
    const content = {
        viewOnceMessage: { message: { interactiveMessage: IP.create({
            body: IP.Body.create({ text: `🖼️ *IMAGE — ${results.length} results for “${q}”*\n\n👉 Swipe the photos.` }),
            footer: IP.Footer.create({ text: 'RCD X MINI • IMAGE SEARCH' }),
            carouselMessage: IP.CarouselMessage.create({ cards, messageVersion: 1 })
        }) } }
    };
    const msg = B.generateWAMessageFromContent(ctx.jid, content, { logger: waLogger });
    await sock.relayMessage(ctx.jid, msg.message, { messageId: msg.key.id });
}
export { imgCarousel };

export default [
    {
        name: 'img', aliases: ['imgsearch', 'imagesearch', 'gimage'], cat: 'search', desc: 'Image search as a swipe menu  (.img car)', timeoutMs: LONG,
        async run(ctx) {
            if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}img car`);
            await ctx.react('🖼️');
            const results = await P.imgSearch(ctx.text, 6);
            try { return await imgCarousel(ctx, results, ctx.text); }
            catch {
                for (const r of results.slice(0, 4)) {
                    await ctx.sock.sendMessage(ctx.jid, { image: { url: r.url }, caption: `🖼️ *${ctx.text}*` }, { quoted: ctx.msg }).catch(() => {});
                }
            }
        }
    }
];
