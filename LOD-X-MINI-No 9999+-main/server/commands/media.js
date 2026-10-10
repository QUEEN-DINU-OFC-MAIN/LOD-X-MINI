import { mediaKit } from '../../shared/wa.js';
import { extractViewOnce } from '../../shared/viewonce.js';

const quotedOf = (ctx) => ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
const unwrapVO = (q) => extractViewOnce(q);

const dl = (media, type) => mediaKit.buffer(media, type);

export default [
    {
        name: 'vv', aliases: ['viewonce', 'reveal'], cat: 'media', desc: 'Reveal a view-once photo / video / file — sent to the owner chat (reply to it)',
        async run(ctx) {
            const q = unwrapVO(quotedOf(ctx));
            if (!q) return ctx.reply(`ℹ️ Reply to a view-once message with ${ctx.prefix}vv`);
            const key = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].find((k) => q[k]);
            if (!key) return ctx.reply('❌ That is not a photo / video / voice / file.');
            const type = key.replace('Message', '');
            const buf = await dl(q[key], type);
            const m = q[key];
            const me = `${ctx.ownerNumber}@s.whatsapp.net`;
            const content = type === 'audio' ? { audio: buf, mimetype: m.mimetype, ptt: Boolean(m.ptt) }
                : type === 'document' ? { document: buf, mimetype: m.mimetype || 'application/octet-stream', fileName: m.fileName || 'file', caption: m.caption || '' }
                : type === 'sticker' ? { sticker: buf }
                : { [type]: buf, caption: m.caption || '' };
            await ctx.sock.sendMessage(me, content);
            await ctx.reply('📤 View-once revealed — media sent to the owner chat ✅');
        }
    },
    {
        name: 'getpp', aliases: ['pp'], cat: 'media', desc: 'Profile picture (reply / @mention / number)',
        async run(ctx) {
            const ci = ctx.msg.message?.extendedTextMessage?.contextInfo;
            const num = ctx.args[0]?.replace(/\D/g, '');
            const target = ci?.mentionedJid?.[0] || ci?.participant || (num?.length >= 8 ? `${num}@s.whatsapp.net` : ctx.isGroup ? ctx.jid : ctx.sender);
            let url; try { url = await ctx.sock.profilePictureUrl(target, 'image'); } catch {  }
            if (!url) return ctx.reply('❌ No profile picture (or it is private).');
            await ctx.sock.sendMessage(ctx.jid, { image: { url }, caption: '🖼️ Profile picture' }, { quoted: ctx.msg });
        }
    },
    {
        name: 'save', cat: 'media', desc: 'Save a replied photo/video to your own chat', ownerOnly: true,
        async run(ctx) {
            const q = unwrapVO(quotedOf(ctx));
            const key = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'].find((k) => q?.[k]);
            if (!key) return ctx.reply(`ℹ️ Reply to a photo / video / audio / file with ${ctx.prefix}save`);
            const type = key.replace('Message', '');
            const buf = await dl(q[key], type);
            const me = `${ctx.ownerNumber}@s.whatsapp.net`;
            const m = q[key];
            await ctx.sock.sendMessage(me, type === 'document' ? { document: buf, mimetype: m.mimetype, fileName: m.fileName || 'file' } : type === 'audio' ? { audio: buf, mimetype: m.mimetype } : { [type]: buf, caption: m.caption || '' });
            await ctx.reply('✅ Saved to your chat.');
        }
    }
];
