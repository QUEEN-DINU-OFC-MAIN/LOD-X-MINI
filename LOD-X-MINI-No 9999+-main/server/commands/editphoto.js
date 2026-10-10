import { B } from '../../shared/wa.js';
import { CF_PRESETS, presetPrompt } from '../lib/cfedit-presets.js';
import {
    cfEditImage,
    buildEditPrompt,
    reserveEditSlot,
    refundEditSlot,
    peekEditUsage,
    editStats,
    bumpEditStats,
    EDIT_DAILY_LIMIT
} from '../lib/cfedit.js';

const cat = 'aiimage';
const quotedOf = (ctx) => ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
const unwrap = (q) => q?.viewOnceMessageV2?.message || q?.viewOnceMessage?.message || q;
const MAX = 12 * 1048576;

async function inputImage(ctx) {
    const q = unwrap(quotedOf(ctx));
    const own = unwrap(ctx.msg.message);
    const m = q?.imageMessage || own?.imageMessage || own?.stickerMessage;
    if (!m) return null;
    if (Number(m.fileLength) > MAX) throw new Error('image is too big (max 12 MB)');
    let buf = Buffer.alloc(0);
    for await (const c of await B.downloadContentFromMessage(m, 'image')) {
        buf = Buffer.concat([buf, c]);
        if (buf.length > MAX) throw new Error('image is too big (max 12 MB)');
    }
    return { buf, mime: m.mimetype || 'image/jpeg' };
}

const storeOf = (ctx) => {
    const s = ctx.platform?.store || ctx.runner?.store;
    return s?.s || s || null;
};

const usageText = (prefix) =>
    `🖌️ *AI PHOTO EDIT* — owner only\n\n` +
    `📸 ෆොටෝ එකකට reply කරලා මෙහෙම ලියන්න (සිංහල, Singlish හෝ English — ඔක්කොම වැඩ):\n` +
    `• ${prefix}edit old vibe\n` +
    `• ${prefix}edit මේක පරණ ෆිල්ම් වගේ කරන්න\n` +
    `• ${prefix}edit thawa ha patavu EK karnna\n` +
    `• ${prefix}edit background එක වැස්ස රෑ පාරක් කරන්න\n\n` +
    `✨ Presets: ${prefix}edit list\n` +
    `🎟️ Limit: *${EDIT_DAILY_LIMIT} photos* per day · ෆොටෝ එකේ විෂය/මුහුණ කවදාවත් වෙනස් වෙන්නේ නෑ`;

const presetList = (prefix) =>
    `🖌️ *EDIT PRESETS*\n\n` +
    CF_PRESETS.map((p) => `• ${prefix}edit ${p.key} — ${p.label}`).join('\n') +
    `\n\n📝 Free text works too: ${prefix}edit a snowy mountain background`;

export default [
    {
        cat,
        name: 'edit',
        aliases: ['photoedit', 'editpic', 'cfedit', 'aiedit'],
        desc: `AI photo edit from a prompt — Sinhala / Singlish / English (reply to a photo, owner only, ${EDIT_DAILY_LIMIT}/day)`,
        react: '🖌️',
        ownerOnly: true,
        timeoutMs: 240_000,
        async run(ctx) {
            const storage = storeOf(ctx);
            const owner = ctx.ownerNumber || ctx.sender;
            const raw = (ctx.text || '').trim();

            if (/^(list|presets|styles)$/i.test(raw)) return ctx.reply(presetList(ctx.prefix));
            if (!raw) return ctx.reply(usageText(ctx.prefix));
            if (!storage) return ctx.reply('⚠️ Storage is unavailable, this feature is temporarily off.');

            const img = await inputImage(ctx).catch((e) => {
                ctx.reply(`⚠️ ${e.message}`).catch(() => { });
                return null;
            });
            if (!img) {
                return ctx.reply(
                    `ℹ️ Reply to a *photo* with your edit prompt:\n\n` +
                    `• ${ctx.prefix}edit old vibe\n` +
                    `• ${ctx.prefix}edit make it a rainy night in Colombo\n\n` +
                    `✨ ${ctx.prefix}edit list — all ready presets`
                );
            }

            const slot = await reserveEditSlot(storage, owner).catch(() => null);
            if (!slot) return ctx.reply('⚠️ Could not check your quota, please try again.');
            if (!slot.ok) {
                return ctx.reply(
                    `🚫 *Daily limit reached*\n\n` +
                    `You already used all *${EDIT_DAILY_LIMIT}* AI edits today.\n` +
                    `⏰ Resets at 12:00 AM (Sri Lanka time).\n` +
                    `🔓 Need more? Raise \`EDIT_DAILY_LIMIT\` on the server.`
                );
            }

            const built = await buildEditPrompt(raw, { image: img.buf, mime: img.mime });
            const label = built.change.length > 110 ? `${built.change.slice(0, 110)}…` : built.change;
            const seen = built.subject.length > 110 ? `${built.subject.slice(0, 110)}…` : built.subject;

            await ctx.reply(
                `🖌️ *EDITING PHOTO* — please wait (≈ 15–40 s)\n\n` +
                `📝 *ඔයා ඉල්ලපු දේ:* ${label}\n` +
                `👁️ *ඡායාරූපයේ තියෙන දේ:* ${seen}\n` +
                `🎟️ Today: *${slot.used}/${EDIT_DAILY_LIMIT}* used · *${slot.left}* left\n\n` +
                `🧠 එකම ඡායාරූපයේ විෂය, මුහුණ, මුහුණේ ඉරියව්ව වෙනස් නොවී රැක ගන්නවා…`
            );

            let out;
            try {
                out = await cfEditImage(img.buf, built.prompt, { mime: img.mime, storage, owner });
            } catch (e) {
                await refundEditSlot(storage, owner).catch(() => { });
                throw new Error(`AI edit failed — ${String(e.message).slice(0, 110)} (your daily slot was refunded)`);
            }

            await bumpEditStats(storage, { owner, model: out.model }).catch(() => { });

            await ctx.sock.sendMessage(
                ctx.jid,
                {
                    image: out.buf,
                    caption:
                        `✅ *EDIT DONE*\n\n` +
                        `📝 ${label}\n` +
                        `🎟️ Today: *${slot.used}/${EDIT_DAILY_LIMIT}* used · *${slot.left}* left\n` +
                        `🧠 ${out.model.replace('@cf/', '')}${built.source === 'translated' ? ' · Sinhala understood' : ''}${out.live ? ' · live model' : ''}`
                },
                { quoted: ctx.msg }
            );
        }
    },
    {
        cat,
        name: 'editquota',
        aliases: ['editleft', 'editinfo', 'editusage'],
        desc: 'Your remaining AI photo-edit quota for today',
        react: '🎟️',
        async run(ctx) {
            const storage = storeOf(ctx);
            const owner = ctx.ownerNumber || ctx.sender;
            const me = await peekEditUsage(storage, owner).catch(() => null);
            const db = await editStats(storage).catch(() => ({}));
            const today = new Date().toISOString().slice(0, 10);
            return ctx.reply(
                `🎟️ *AI EDIT QUOTA*\n\n` +
                `• Daily limit: *${EDIT_DAILY_LIMIT}* photos\n` +
                `• Used today: *${me?.used ?? 0}* · left: *${me?.left ?? EDIT_DAILY_LIMIT}*\n` +
                `• Bot-wide today: *${db?.days?.[today] || 0}* · all-time: *${db?.total || 0}*\n\n` +
                `🖌️ Reply to a photo with ${ctx.prefix}edit <prompt>`
            );
        }
    }
];
