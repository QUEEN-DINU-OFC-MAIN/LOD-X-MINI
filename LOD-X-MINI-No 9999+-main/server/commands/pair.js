import QRCode from 'qrcode';
import { normalizePhone } from '../lib/phone.js';
import { BoundedCache } from '../../shared/cache.js';
import { BOT_NAME } from '../lib/ui.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const recent = new BoundedCache({ max: 2000, ttlMs: 10 * 60_000, shared: true });
const busyChats = new Set();
const MAX_PER_10_MIN = 4;

async function run(ctx, mode, number) {
    const who = ctx.sender;
    const used = recent.get(who) || 0;
    if (used >= MAX_PER_10_MIN && !ctx.isOwner) return ctx.reply('⏳ Too many link attempts. Please wait a few minutes.');
    if (busyChats.has(ctx.jid)) return ctx.reply('⏳ A link request is already running in this chat.');
    recent.set(who, used + 1);

    let token;
    try { token = await ctx.platform.pairing.start({ mode, number }); }
    catch (e) { return ctx.reply(`❌ ${e.http ? e.message : 'Could not start linking, try again.'}`); }

    busyChats.add(ctx.jid);
    try {
        let shownCode = false; let qrCount = 0; let lastQr = null;
        for (let i = 0; i < 130; i++) {
            await sleep(1500);
            const s = ctx.platform.pairing.status(token);
            if (!s) break;
            if (s.status === 'code' && s.code && !shownCode) {
                shownCode = true;
                const raw = s.code.replace(/-/g, '');
                await ctx.sendButtons({
                    text: `🔑 *Pair code for +${number}*\n\n*${s.code}*\n\n1️⃣ Open WhatsApp on that phone\n2️⃣ *Linked devices* → *Link a device*\n3️⃣ *Link with phone number instead*\n4️⃣ Enter the code above\n\n⏳ The code expires in about 3 minutes.`,
                    copy: [{ label: '📋 COPY CODE', code: raw }],
                    quick: [{ id: `${ctx.prefix}pair ${number}`, label: '🔁 NEW CODE' }], header: false
                });
            }
            if (s.status === 'qr' && s.qr && s.qr !== lastQr && qrCount < 3) {
                lastQr = s.qr; qrCount++;
                const png = Buffer.from(s.qr.split(',')[1], 'base64');
                await ctx.sock.sendMessage(ctx.jid, { image: png, caption: `🔳 *Scan this QR* (${qrCount}/3)\n\nWhatsApp → *Linked devices* → *Link a device* → scan.\n⏳ QR refreshes every ~20s; a new one follows if needed.` }, { quoted: ctx.msg });
            }
            if (s.status === 'done') {
                return ctx.sendButtons({ text: `✅ *+${s.number} linked!*\n\n⚙️ ${BOT_NAME} is installing — please wait *5 minutes*, then send ${ctx.prefix}menu from that number.\n\nඔයාගේ bot එක install වෙමින් පවතී — විනාඩි 5ක් ඉන්න.`, quick: [{ id: `${ctx.prefix}menu`, label: '📜 MENU' }], header: false });
            }
            if (['failed', 'expired', 'cancelled'].includes(s.status)) return ctx.reply(`❌ ${s.error || 'Linking failed or expired.'}\nTry again: ${ctx.prefix}pair ${number}`);
        }
        await ctx.platform.pairing.cancel(token);
        await ctx.reply('⌛ Linking timed out. Send the command again.');
    } finally { busyChats.delete(ctx.jid); }
}

export default [
    {
        name: 'pair', aliases: ['v2'], cat: 'main', desc: 'Link a new number as a bot  (.pair 0753262213)',
        async run(ctx) {
            const n = normalizePhone(ctx.text);
            if (!n) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}pair 0753262213\nAny format works: 0753262213 / 94753262213 / +94 75 326 2213`);
            await ctx.sendButtons({
                text: `🔗 *Link +${n}*\n\nHow do you want to connect?\n\n🔑 *Pair code* — type an 8-character code on the phone\n🔳 *QR code* — scan from another phone`,
                quick: [{ id: `${ctx.prefix}pairgo code ${n}`, label: '🔑 PAIR CODE' }, { id: `${ctx.prefix}pairgo qr ${n}`, label: '🔳 QR CODE' }],
                header: false
            });
        }
    },
    {
        name: 'pairgo', cat: 'main', hidden: true, desc: 'internal: start pairing', timeoutMs: 230_000,
        async run(ctx) {
            const mode = ctx.args[0] === 'qr' ? 'qr' : 'pair';
            const n = normalizePhone(ctx.args[1]);
            if (!n) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}pair 0753262213`);
            ctx.background(() => run(ctx, mode, n), 'pair', { queued: false });
        }
    }
];
