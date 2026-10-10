import { uploadPublic } from '../lib/aimedia.js';
import * as P from '../lib/providers.js';
import { getJson, enc } from '../lib/http.js';
import { numberOfJid } from '../../shared/wa.js';

const quotedText = (ctx) => { const q = ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage; return q?.conversation || q?.extendedTextMessage?.text || q?.imageMessage?.caption; };

export default [
    {
        name: 'tr', aliases: ['translate'], cat: 'tools', desc: 'Translate — Sinhala by default, or .tr <lang> text',
        async run(ctx) {
            let to = 'si'; let q = ctx.text;
            if (/^[a-z]{2}(-[A-Za-z]{2})?$/.test(ctx.args[0] || '') && ctx.args.length > 1) { to = ctx.args[0]; q = ctx.args.slice(1).join(' '); }
            q ||= quotedText(ctx);
            if (!q) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}tr hello my friend\n${ctx.prefix}tr ta good morning`);
            const j = await getJson(`https://api.mymemory.translated.net/get?q=${enc(q.slice(0, 450))}&langpair=autodetect|${enc(to)}`);
            await ctx.reply(`🌐 *→ ${to}*\n\n${j.responseData?.translatedText || 'no result'}`);
        }
    },
    {
        name: 'ss', aliases: ['screenshot', 'webss'], cat: 'tools', desc: 'Screenshot a website  (.ss https://example.com)', timeoutMs: 60000,
        async run(ctx) {
            if (!P.isUrl(ctx.args[0])) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}ss https://example.com`);
            await ctx.react('📸');
            const r = await P.ssweb(ctx.args[0]);
            await ctx.sock.sendMessage(ctx.jid, { image: { url: r.url }, caption: `📸 ${r.title || ctx.args[0]}` }, { quoted: ctx.msg });
        }
    },
    {
        name: 'transcript', aliases: ['ytxt'], cat: 'tools', desc: "YouTube video transcript  (.transcript <link>)", timeoutMs: 90000,
        async run(ctx) {
            if (!P.ytId(ctx.args[0])) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}transcript https://youtu.be/dQw4w9WgXcQ`);
            const t = await P.transcript(ctx.args[0]);
            if (t.length <= 3500) return ctx.reply(`📝 *Transcript*\n\n${t}`);
            await ctx.sock.sendMessage(ctx.jid, { document: Buffer.from(t), mimetype: 'text/plain', fileName: 'transcript.txt', caption: '📝 Transcript' }, { quoted: ctx.msg });
        }
    },
    {
        name: 'url', aliases: ['upload'], cat: 'tools', desc: 'Upload replied media to Catbox → public link', timeoutMs: 90000,
        async run(ctx) {
            const { B } = await import('../../shared/wa.js');
            const q = ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const key = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].find((k) => q?.[k]);
            if (!key) return ctx.reply(`ℹ️ Reply to a photo / video / audio / file with ${ctx.prefix}url`);
            const m = q[key]; if (Number(m.fileLength) > 20 * 1048576) return ctx.reply('❌ Max 20 MB');
            let buf = Buffer.alloc(0);
            for await (const c of await B.downloadContentFromMessage(m, key.replace('Message', ''))) { buf = Buffer.concat([buf, c]); if (buf.length > 20 * 1048576) return ctx.reply('❌ Max 20 MB'); }
            const t = await uploadPublic(buf, { mime: m.mimetype || 'application/octet-stream', name: m.fileName || `file.${(m.mimetype || 'bin').split('/')[1]?.split(';')[0] || 'bin'}` });
            await ctx.sendButtons({ text: `🔗 ${t}`, copy: [{ label: '📋 COPY LINK', code: t }] });
        }
    },
    {
        name: 'quted', aliases: ['inspect', 'dump', 'dbg', 'debugmsg'], cat: 'tools', desc: 'Inspect the technical payload of a replied message', ownerOnly: true,
        async run(ctx) {
            const ci = ctx.msg.message?.extendedTextMessage?.contextInfo;
            if (!ci?.quotedMessage) return ctx.reply(`ℹ️ Reply to a message with ${ctx.prefix}quted`);
            const type = Object.keys(ci.quotedMessage)[0];
            await ctx.reply(`🧪 *Message inspector*\n\n▫️ Type : ${type}\n▫️ From : ${ci.participant || '-'}\n▫️ ID : ${ci.stanzaId || '-'}\n\n\`\`\`${JSON.stringify(ci.quotedMessage[type], (k, v) => (v?.type === 'Buffer' || v instanceof Uint8Array ? '[bytes]' : v), 1).slice(0, 2500)}\`\`\``);
        }
    }
];
