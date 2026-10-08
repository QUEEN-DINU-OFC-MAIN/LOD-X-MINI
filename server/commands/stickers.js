import { getMedia, getSharp, ffmpegBin, textPng } from '../lib/media.js';
import { getJson, enc } from '../lib/http.js';

const cat = { cat: 'sticker' };
async function makeSticker(buf, { pack, author, type = 'full', quality = 50 }) {
    await ffmpegBin();
    await getSharp();
    const { Sticker } = await import('wa-sticker-formatter');
    return new Sticker(buf, { pack, author, type, quality, id: 'rcdxmini' }).toBuffer();
}
const meta = (ctx) => {
    const [p, a] = ctx.text.split('|').map((x) => x.trim());
    return { pack: p || ctx.settings.botName, author: a || 'RCD X MINI' };
};
const sendSticker = (ctx, buf) => ctx.sock.sendMessage(ctx.jid, { sticker: buf }, { quoted: ctx.msg });
const cp = (e) => [...e].map((c) => c.codePointAt(0).toString(16)).filter((x) => x !== 'fe0f').join('-');
const fetchBuf = async (url, ms = 20000) => { const r = await fetch(url, { signal: AbortSignal.timeout(ms) }); if (!r.ok) throw new Error(`download failed (${r.status})`); return Buffer.from(await r.arrayBuffer()); };

const pack = (name, aliases, desc, type) => ({
    ...cat, name, aliases, desc, react: '🖼️', timeoutMs: 90000,
    async run(ctx) {
        const m = await getMedia(ctx, { kinds: ['imageMessage', 'videoMessage', 'stickerMessage'], maxMB: 10 });
        if (!m) return ctx.reply(`ℹ️ Reply to an image / video / GIF with ${ctx.prefix}${name}\n_Pack name: ${ctx.prefix}${name} My pack | My name_`);
        if (m.type === 'video' && m.seconds > 12) return ctx.reply('❌ Video is longer than 12 seconds.');
        await sendSticker(ctx, await makeSticker(m.buffer, { ...meta(ctx), type }));
    }
});

export default [
    pack('sticker', ['s', 'stk'], 'Image / video → sticker', 'full'),
    pack('steal', ['take'], 'Re-pack a sticker with your name  (.steal Pack | Author)', 'full'),
    pack('circle', ['round'], 'Circle sticker from an image', 'circle'),
    pack('cropsticker', ['scrop', 'stickercrop'], 'Square-cropped sticker', 'crop'),
    {
        ...cat, name: 'toimg', aliases: ['stickertoimg', 'toimage', 'unsticker'], desc: 'Sticker → image', react: '🖼️',
        async run(ctx) {
            const m = await getMedia(ctx, { kinds: ['stickerMessage'], maxMB: 5 });
            if (!m) return ctx.reply(`ℹ️ Reply to a sticker with ${ctx.prefix}toimg`);
            const sharp = await getSharp();
            const png = await sharp(m.buffer, { pages: 1 }).png().toBuffer();
            await ctx.sock.sendMessage(ctx.jid, { image: png, caption: m.animated ? '🖼️ First frame of the animated sticker' : '🖼️ Done' }, { quoted: ctx.msg });
        }
    },
    {
        ...cat, name: 'smoji', aliases: ['bigemoji'], desc: 'Emoji → big sticker  (.smoji 😎)', react: '😎', timeoutMs: 40000,
        async run(ctx) {
            const e = [...ctx.text.trim()].slice(0, 4).join('') ? ctx.text.trim().split(/\s+/)[0] : '';
            if (!e) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}smoji 😎`);
            const png = await fetchBuf(`https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/${cp(e)}.png`).catch(() => { throw new Error('that emoji is not supported'); });
            const sharp = await getSharp();
            const big = await sharp(png).resize(512, 512, { kernel: 'lanczos3' }).png().toBuffer();
            await sendSticker(ctx, await makeSticker(big, { pack: ctx.settings.botName, author: 'RCD X MINI', type: 'full' }));
        }
    },
    {
        ...cat, name: 'emojimix', aliases: ['mixemoji', 'mix'], desc: 'Mix two emojis into one sticker  (.emojimix 😎+😍)', react: '🧬', timeoutMs: 40000,
        async run(ctx) {
            const em = [...ctx.text.matchAll(/\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*/gu)].map((x) => x[0]);
            if (em.length < 2) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}emojimix 😎+😍`);
            const png = await fetchBuf(`https://emojik.vercel.app/s/${enc(em[0])}_${enc(em[1])}?size=512`).catch(() => { throw new Error('those two emojis can not be mixed'); });
            await sendSticker(ctx, await makeSticker(png, { pack: ctx.settings.botName, author: 'RCD X MINI', type: 'full' }));
        }
    },
    {
        ...cat, name: 'ttp', aliases: ['textsticker'], desc: 'Text → sticker  (.ttp hello)', react: '🔤', timeoutMs: 40000,
        async run(ctx) {
            if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}ttp Hello 😎`);
            await sendSticker(ctx, await makeSticker(await textPng(ctx.text.slice(0, 80)), { ...{ pack: ctx.settings.botName, author: 'RCD X MINI' }, type: 'full' }));
        }
    },
    {
        ...cat, name: 'attp', aliases: ['animtext'], desc: 'Animated colour-cycling text sticker  (.attp hello)', react: '🌈', timeoutMs: 60000,
        async run(ctx) {
            if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}attp Hello`);
            const sharp = await getSharp();
            const frames = [];
            for (const c of ['#ff3b6b', '#ffd400', '#2ee6a6', '#38b6ff', '#b86bff']) frames.push(await textPng(ctx.text.slice(0, 60), c));
            const webp = await sharp(frames, { join: { animated: true } }).webp({ loop: 0, delay: frames.map(() => 220), quality: 55 }).toBuffer();
            const { Sticker } = await import('wa-sticker-formatter');
            await sendSticker(ctx, await new Sticker(webp, { pack: ctx.settings.botName, author: 'RCD X MINI', type: 'full', quality: 55 }).toBuffer());
        }
    }
];
