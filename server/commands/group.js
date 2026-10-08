import { numberOfJid } from '../../shared/wa.js';

const forms = (p) => [p.id, p.lid, p.phoneNumber].filter(Boolean).map(numberOfJid);
const isAdminOf = (g, ids) => g.participants.some((p) => p.admin && forms(p).some((f) => ids.includes(f)));

async function guard(ctx, { botAdmin = true, userAdmin = true } = {}) {
    const g = await ctx.groupMeta();
    if (userAdmin && !ctx.isOwner && !isAdminOf(g, ctx.ids)) { await ctx.reply('🛡️ Only group admins can use this.'); return null; }
    if (botAdmin) {
        const me = [ctx.ownerNumber, ctx.myLid].filter(Boolean);
        if (!isAdminOf(g, me)) { await ctx.reply('🤖 Make me a group admin first, then try again.'); return null; }
    }
    return g;
}
const targets = (ctx) => {
    const ci = ctx.msg.message?.extendedTextMessage?.contextInfo;
    const t = new Set(ci?.mentionedJid || []);
    if (!t.size && ci?.participant) t.add(ci.participant);
    for (const a of ctx.args) { const n = a.replace(/\D/g, ''); if (n.length >= 8) t.add(`${n}@s.whatsapp.net`); }
    return [...t];
};
const act = (name, desc, action, emoji, aliases = []) => ({
    name, aliases, cat: 'group', desc, groupOnly: true,
    async run(ctx) {
        if (!await guard(ctx)) return;
        const t = targets(ctx);
        if (!t.length) return ctx.reply(`ℹ️ Reply to / @mention the member.\nExample: ${ctx.prefix}${name} @user`);
        await ctx.sock.groupParticipantsUpdate(ctx.jid, t, action);
        await ctx.reply(`${emoji} Done (${t.length}).`);
    }
});

export default [
    {
        name: 'groupinfo', aliases: ['ginfo', 'gp', 'gpinfo'], cat: 'group', desc: 'Group details', groupOnly: true,
        async run(ctx) {
            const g = await ctx.groupMeta();
            const admins = g.participants.filter((p) => p.admin).length;
            await ctx.reply(`👥 *${g.subject}*\n\n▫️ Members : ${g.participants.length}\n▫️ Admins : ${admins}\n▫️ Created : ${new Date(g.creation * 1000).toDateString()}\n▫️ Announce-only : ${g.announce ? 'yes' : 'no'}\n\n📝 ${g.desc || '-'}`);
        }
    },
    {
        name: 'tagall', aliases: ['everyone', 'tag', 'all'], cat: 'group', desc: 'Mention everyone (admins)', groupOnly: true,
        async run(ctx) {
            const g = await guard(ctx, { botAdmin: false }); if (!g) return;
            const list = g.participants.map((p) => p.id);
            await ctx.sock.sendMessage(ctx.jid, { text: `📢 *${ctx.text || 'Attention!'}*\n\n${list.map((j) => `▫️ @${numberOfJid(j)}`).join('\n')}`, mentions: list }, { quoted: ctx.msg });
        }
    },
    {
        name: 'hidetag', aliases: ['ht', 'htag', 'silentag'], cat: 'group', desc: 'Silent mention everyone', groupOnly: true,
        async run(ctx) {
            const g = await guard(ctx, { botAdmin: false }); if (!g) return;
            if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}hidetag your message`);
            await ctx.sock.sendMessage(ctx.jid, { text: ctx.text, mentions: g.participants.map((p) => p.id) });
        }
    },
    {
        name: 'admins', cat: 'group', desc: 'List group admins', groupOnly: true,
        async run(ctx) {
            const g = await ctx.groupMeta(); const a = g.participants.filter((p) => p.admin).map((p) => p.id);
            await ctx.sock.sendMessage(ctx.jid, { text: `🛡️ *Admins*\n\n${a.map((j) => `▫️ @${numberOfJid(j)}`).join('\n')}`, mentions: a }, { quoted: ctx.msg });
        }
    },
    act('promote', 'Make member admin', 'promote', '⬆️', ['admin', 'makeadmin']),
    act('demote', 'Remove admin rights', 'demote', '⬇️', ['removeadmin']),
    act('kick', 'Remove a member', 'remove', '👢', ['remove', 'ban']),
    {
        name: 'mute', aliases: ['close', 'mutegroup', 'lock'], cat: 'group', desc: 'Only admins can send', groupOnly: true,
        async run(ctx) { if (!await guard(ctx)) return; await ctx.sock.groupSettingUpdate(ctx.jid, 'announcement'); await ctx.reply('🔇 Group closed (admins only).'); }
    },
    {
        name: 'unmute', aliases: ['open', 'unmutegroup', 'unlock'], cat: 'group', desc: 'Everyone can send', groupOnly: true,
        async run(ctx) { if (!await guard(ctx)) return; await ctx.sock.groupSettingUpdate(ctx.jid, 'not_announcement'); await ctx.reply('🔊 Group opened.'); }
    },
    {
        name: 'glink', aliases: ['invitelink', 'invite', 'gplink'], cat: 'group', desc: 'Group invite link', groupOnly: true,
        async run(ctx) { if (!await guard(ctx)) return; await ctx.reply(`🔗 https://chat.whatsapp.com/${await ctx.sock.groupInviteCode(ctx.jid)}`); }
    },
    {
        name: 'revoke', aliases: ['revokelink', 'resetlink'], cat: 'group', desc: 'Reset invite link', groupOnly: true,
        async run(ctx) { if (!await guard(ctx)) return; const c = await ctx.sock.groupRevokeInvite(ctx.jid); await ctx.reply(`♻️ New link: https://chat.whatsapp.com/${c}`); }
    },
    {
        name: 'setgname', aliases: ['changename', 'rename', 'gname'], cat: 'group', desc: 'Change group name', groupOnly: true,
        async run(ctx) { if (!await guard(ctx)) return; if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}setgname New name`); await ctx.sock.groupUpdateSubject(ctx.jid, ctx.text.slice(0, 90)); await ctx.reply('✅ Name updated.'); }
    },
    {
        name: 'setgdesc', aliases: ['changedesc', 'setdesc', 'groupdesc', 'desc'], cat: 'group', desc: 'Change group description', groupOnly: true,
        async run(ctx) { if (!await guard(ctx)) return; if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}setgdesc text`); await ctx.sock.groupUpdateDescription(ctx.jid, ctx.text.slice(0, 500)); await ctx.reply('✅ Description updated.'); }
    }
];
