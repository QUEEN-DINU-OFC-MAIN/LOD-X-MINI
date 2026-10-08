import { B } from '../../shared/wa.js';
import * as M from '../lib/aimedia.js';
import { getBuffer } from '../lib/http.js';

const cat = 'aiimage';
const quotedOf = (ctx) => ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
const unwrap = (q) => q?.viewOnceMessageV2?.message || q?.viewOnceMessage?.message || q;

async function inputImage(ctx) {
    const q = unwrap(quotedOf(ctx));
    const own = ctx.msg.message?.imageMessage ? ctx.msg.message : unwrap(ctx.msg.message);
    const m = q?.imageMessage || q?.stickerMessage || own?.imageMessage;
    if (!m) return null;
    if (Number(m.fileLength) > 12 * 1048576) throw new Error('image is too big (max 12 MB)');
    let buf = Buffer.alloc(0);
    for await (const c of await B.downloadContentFromMessage(m, 'image')) { buf = Buffer.concat([buf, c]); if (buf.length > 12 * 1048576) throw new Error('image is too big (max 12 MB)'); }
    return { buf, mime: m.mimetype || 'image/jpeg' };
}
const needImage = (ctx, name) => ctx.reply(`ℹ️ Reply to a *photo* with ${ctx.prefix}${name}  (or send a photo with ${ctx.prefix}${name} as its caption)`);
const nowSL = () => new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', hour12: false });
const FOOT = '';

const edit = (name, aliases, desc, react, fn, label) => ({
    cat, name, aliases, desc, react, timeoutMs: 150_000,
    async run(ctx) {
        const img = await inputImage(ctx);
        if (!img) return needImage(ctx, name);
        await ctx.reply(`⏳ ${label}… (≈ 15–40 s)`);
        const out = await M.withPublicUrl(img.buf, { mime: img.mime, name: 'photo.jpg' }, fn);
        await ctx.sock.sendMessage(ctx.jid, { image: { url: out }, caption: `✅ ${label} done${FOOT}` }, { quoted: ctx.msg });
        if (name === 'removebg') await ctx.sock.sendMessage(ctx.jid, { document: { url: out }, mimetype: 'image/png', fileName: 'removebg.png', caption: '📎 PNG with transparent background' }, { quoted: ctx.msg });
    }
});

export default [
    {
        cat, name: 'image', aliases: ['imagine', 'flux'], desc: 'AI image from a prompt  (.image cute robot in space)', react: '🎨', timeoutMs: 120_000,
        async run(ctx) {
            if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}image a cute robot in space`);
            await ctx.reply('🎨 Creating your image…');
            let url, last;
            for (const f of [() => M.pollinations(ctx.text, 'flux'), () => M.pollinations(ctx.text, 'turbo'), () => M.dream(ctx.text, 'Cinematic')]) { try { url = await f(); break; } catch (e) { last = e; } }
            if (!url) throw last || new Error('image services are busy');
            await ctx.sock.sendMessage(ctx.jid, { image: { url }, caption: `🎨 ${ctx.text.slice(0, 200)}${FOOT}` }, { quoted: ctx.msg });
        }
    },
    {
        cat, name: 'dream', aliases: ['aiart'], desc: 'AI art in a style  (.dream anime | a girl under cherry trees)', react: '🌈', timeoutMs: 120_000,
        async run(ctx) {
            const [a, ...rest] = ctx.text.split('|');
            const wanted = rest.length ? a.trim().toLowerCase() : '';
            const style = M.DREAM_STYLES.find((s) => s.toLowerCase() === wanted || s.toLowerCase().replace(/ /g, '') === wanted.replace(/ /g, '')) || (rest.length ? null : 'Anime');
            const prompt = (rest.length ? rest.join('|') : ctx.text).trim();
            if (!prompt || !style) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}dream <style> | <prompt>\nStyles: ${M.DREAM_STYLES.join(', ')}\nExample: ${ctx.prefix}dream cinematic | a lone bus in the Sri Lankan hills`);
            await ctx.reply(`🌈 Painting in *${style}* style…`);
            const url = await M.dream(prompt, style);
            await ctx.sock.sendMessage(ctx.jid, { image: { url }, caption: `🌈 ${style}\n${prompt.slice(0, 180)}${FOOT}` }, { quoted: ctx.msg });
        }
    },
    {
        cat, name: 'animeart', aliases: ['pixai'], desc: 'Anime-style AI image  (.animeart girl with umbrella)', react: '🌸', timeoutMs: 90_000,
        async run(ctx) {
            if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}animeart girl with an umbrella`);
            await ctx.reply('🌸 Drawing…');
            const url = await M.pixai(ctx.text);
            await ctx.sock.sendMessage(ctx.jid, { image: { url }, caption: `🌸 ${ctx.text.slice(0, 200)}${FOOT}` }, { quoted: ctx.msg });
        }
    },
    edit('removebg', ['rmbg', 'nobg'], 'Remove the background of a photo (reply to it)', '✂️', M.removeBg, 'Removing background'),
    edit('remini', ['hd', 'upscale', 'enhance'], 'HD upscale / sharpen a photo (reply to it)', '✨', async (u) => { try { return await M.remini(u); } catch { return M.enhance(u); } }, 'Enhancing to HD'),
    {
        cat, name: 'text2video', aliases: ['aivideo', 't2v', 'vgen', 'genvideo'], desc: 'Generate a video from text  (.text2video a bus in Sri Lanka)', react: '🎬', timeoutMs: 230_000,
        async run(ctx) {
            if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}text2video a red bus driving through Sri Lankan tea hills`);
            await ctx.reply('🎬 Generating your video… this takes ~1–2 minutes. I will send it when it is ready.');
            ctx.background(async () => {
                const url = await M.text2video(ctx.text);
                await ctx.sock.sendMessage(ctx.jid, { video: { url }, mimetype: 'video/mp4', caption: `🎬 ${ctx.text.slice(0, 200)}${FOOT}` }, { quoted: ctx.msg });
            }, 'text2video');
        }
    },
    {
        cat, name: 'iqc', aliases: ['iphonequote', 'iquote', 'iq'], desc: 'iPhone-style chat screenshot  (.iqc 17:01 | 11:02 | hello)', react: '📱', timeoutMs: 60_000,
        async run(ctx) {
            const q = unwrap(quotedOf(ctx));
            const quotedText = q?.conversation || q?.extendedTextMessage?.text || q?.imageMessage?.caption || '';
            const parts = ctx.text.split('|').map((x) => x.trim());
            const isTime = (x) => /^\d{1,2}:\d{2}$/.test(x || '');
            let status = nowSL(), chat = status, text;
            if (parts.length >= 3 && isTime(parts[0]) && isTime(parts[1])) { status = parts[0]; chat = parts[1]; text = parts.slice(2).join(' | '); }
            else if (parts.length >= 2 && isTime(parts[0])) { chat = status = parts[0]; text = parts.slice(1).join(' | '); }
            else text = ctx.text;
            text = (text || quotedText || '').trim();
            if (!text) return ctx.reply(`ℹ️ Usage:\n${ctx.prefix}iqc hello there   (uses the current time)\n${ctx.prefix}iqc 11:02 | hello   (chat time)\n${ctx.prefix}iqc 17:01 | 11:02 | hello   (status-bar time | chat time | text)\n…or reply to a message with ${ctx.prefix}iqc`);
            const buf = await M.iqc({ text: text.slice(0, 400), chatTime: chat, statusBarTime: status });
            await ctx.sock.sendMessage(ctx.jid, { image: buf, caption: `📱 ${chat}${FOOT}` }, { quoted: ctx.msg });
        }
    }
];
