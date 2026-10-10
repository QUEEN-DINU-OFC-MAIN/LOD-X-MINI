import { numberOfJid } from '../../shared/wa.js';
import { isAdminOf } from '../lib/groupguard.js';

async function guard(ctx, { botAdmin = true, userAdmin = true } = {}) {
    const g = await ctx.groupMeta();
    if (userAdmin && !ctx.isOwner && !isAdminOf(g, ctx.ids)) { await ctx.reply('🛡️ Only group admins can use this.'); return null; }
    if (botAdmin && !isAdminOf(g, [ctx.ownerNumber, ctx.myLid].filter(Boolean))) { await ctx.reply('🤖 Make me a group admin first, then try again.'); return null; }
    return g;
}
const targets = (ctx) => {
    const ci = ctx.msg.message?.extendedTextMessage?.contextInfo;
    const t = new Set(ci?.mentionedJid || []);
    if (!t.size && ci?.participant) t.add(ci.participant);
    for (const a of ctx.args) { const n = a.replace(/\D/g, ''); if (n.length >= 8 && n.length <= 15) t.add(`${n}@s.whatsapp.net`); }
    return [...t];
};
const num = (j) => numberOfJid(j);
const onoff = (b) => (b ? '🟢 ON' : '🔴 OFF');
const DUR = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
const parseDur = (x) => { const m = /^(\d{1,4})([smhd])$/i.exec(x || ''); return m ? Number(m[1]) * DUR[m[2].toLowerCase()] : null; };

const protect = (name, aliases, key, label, emoji, desc, { actions = true, extra } = {}) => ({
    name, aliases, cat: 'group', groupOnly: true, desc, react: emoji,
    async run(ctx) {
        if (!await guard(ctx, { botAdmin: false })) return;
        const [a, b] = ctx.args.map((x) => x?.toLowerCase());
        const cur = ctx.runner.group(ctx.jid)[key] || {};
        const p = ctx.prefix;
        if (a === 'on' || a === 'off') { await ctx.runner.setGroup(ctx.jid, (g) => { g[key] = { ...(g[key] || {}), enabled: a === 'on' }; }); }
        else if (a === 'set' && actions && ['delete', 'warn', 'kick'].includes(b)) await ctx.runner.setGroup(ctx.jid, (g) => { g[key] = { ...(g[key] || {}), action: b }; });
        else if (a === 'limit' && Number(b) >= 1 && Number(b) <= 10) await ctx.runner.setGroup(ctx.jid, (g) => { g[key] = { ...(g[key] || {}), warnLimit: Number(b) }; });
        else if (extra && await extra(ctx, a, b)) {  }
        const n = ctx.runner.group(ctx.jid)[key] || {};
        await ctx.sendButtons({
            text: `${emoji} *${label}*\n\n▫️ Status : ${onoff(n.enabled)}${actions ? `\n▫️ Action : *${n.action || 'warn'}*  _(delete / warn / kick)_\n▫️ Warn limit : *${n.warnLimit || 3}*` : ''}${n.codes ? `\n▫️ Allowed codes : ${n.codes.join(', ')}` : ''}${n.words?.length ? `\n▫️ Extra words : ${n.words.length}` : ''}\n\n_Admins are never punished. Kick / delete need me to be admin._`,
            header: false,
            quick: [{ id: `${p}${name} on`, label: '✅ ON' }, { id: `${p}${name} off`, label: '⛔ OFF' }, { id: `${p}groupsettings`, label: '⚙️ ALL' }],
            sections: actions ? [{ title: 'ACTION', highlight_label: '', rows: ['delete', 'warn', 'kick'].map((x) => ({ title: x.toUpperCase(), description: `${label}: ${x}`, id: `${p}${name} set ${x}` })) }] : undefined,
            listLabel: '🎯 Action', listTitle: label
        });
    }
});

export default [
    protect('antilink', ['antlink'], 'antilink', 'Anti-link', '🔗', 'Delete / warn / kick members who post links  on|off'),
    protect('antispam', ['antflood'], 'antispam', 'Anti-spam', '🛡️', 'Stop message flooding  on|off'),
    protect('antitoxic', ['antibadword', 'wordfilter'], 'antitoxic', 'Bad-word filter', '🤬', 'Bad word filter  on|off|add <word>', {
        async extra(ctx, a, b) {
            if (a === 'add' && b) { await ctx.runner.setGroup(ctx.jid, (g) => { const w = new Set([...(g.antitoxic?.words || []), b]); g.antitoxic = { ...(g.antitoxic || {}), words: [...w].slice(-100) }; }); return true; }
            if (a === 'clear') { await ctx.runner.setGroup(ctx.jid, (g) => { g.antitoxic = { ...(g.antitoxic || {}), words: [] }; }); return true; }
            return false;
        }
    }),
    protect('antiforeign', ['antifn'], 'antiforeign', 'Country filter', '🌍', 'Remove members with other country codes  on|off|allow 94,91', {
        actions: false,
        async extra(ctx, a) {
            if (a === 'allow') {
                const codes = (ctx.args[1] || '').split(',').map((c) => c.replace(/\D/g, '')).filter((c) => c && c.length <= 4);
                if (!codes.length) { await ctx.reply(`❌ Example: ${ctx.prefix}antiforeign allow 94,91`); return true; }
                await ctx.runner.setGroup(ctx.jid, (g) => { g.antiforeign = { ...(g.antiforeign || {}), codes: codes.slice(0, 15) }; }); return true;
            }
            return false;
        }
    }),
    protect('antiviewonce', ['antivo', 'antiview'], 'antiviewonce', 'Anti view-once', '👁️', 'Forward group view-once media to the owner  on|off', { actions: false }),
    {
        name: 'welcome', aliases: ['setwelcome'], cat: 'group', groupOnly: true, desc: 'Welcome new members  on|off|<text with @user @group>', react: '👋',
        async run(ctx) {
            if (!await guard(ctx, { botAdmin: false })) return;
            const a = ctx.args[0]?.toLowerCase();
            if (a === 'on' || a === 'off') await ctx.runner.setGroup(ctx.jid, (g) => { g.welcome = { ...(g.welcome || {}), enabled: a === 'on' }; });
            else if (ctx.text) await ctx.runner.setGroup(ctx.jid, (g) => { g.welcome = { enabled: true, text: ctx.text.slice(0, 600) }; });
            const w = ctx.runner.group(ctx.jid).welcome || {};
            await ctx.card({ text: `👋 *Welcome message* ${onoff(w.enabled)}\n\n${w.text || '_default text_'}\n\n_Custom: ${ctx.prefix}welcome Hi @user, welcome to @group!_`, quick: [{ id: `${ctx.prefix}welcome on`, label: '✅ ON' }, { id: `${ctx.prefix}welcome off`, label: '⛔ OFF' }], again: false });
        }
    },
    {
        name: 'left', aliases: ['setleft', 'goodbye'], cat: 'group', groupOnly: true, desc: 'Goodbye message  on|off|<text>', react: '👋',
        async run(ctx) {
            if (!await guard(ctx, { botAdmin: false })) return;
            const a = ctx.args[0]?.toLowerCase();
            if (a === 'on' || a === 'off') await ctx.runner.setGroup(ctx.jid, (g) => { g.left = { ...(g.left || {}), enabled: a === 'on' }; });
            else if (ctx.text) await ctx.runner.setGroup(ctx.jid, (g) => { g.left = { enabled: true, text: ctx.text.slice(0, 600) }; });
            const w = ctx.runner.group(ctx.jid).left || {};
            await ctx.card({ text: `👋 *Goodbye message* ${onoff(w.enabled)}\n\n${w.text || '_default text_'}`, quick: [{ id: `${ctx.prefix}left on`, label: '✅ ON' }, { id: `${ctx.prefix}left off`, label: '⛔ OFF' }], again: false });
        }
    },
    {
        name: 'gpstop', aliases: ['groupstop', 'botoff'], cat: 'group', groupOnly: true, desc: 'Switch the bot off in this group', react: '🛑',
        async run(ctx) { if (!await guard(ctx, { botAdmin: false })) return; await ctx.runner.setGroup(ctx.jid, (g) => { g.stopped = true; }); await ctx.card({ text: `🛑 Bot is now *off* in this group.\nOnly ${ctx.prefix}gprun works here.`, quick: [{ id: `${ctx.prefix}gprun`, label: '✅ TURN ON' }], again: false }); }
    },
    {
        name: 'gprun', aliases: ['grouprun', 'boton'], cat: 'group', groupOnly: true, desc: 'Switch the bot back on in this group', react: '✅',
        async run(ctx) { if (!await guard(ctx, { botAdmin: false })) return; await ctx.runner.setGroup(ctx.jid, (g) => { delete g.stopped; }); await ctx.card({ text: '✅ Bot is *on* in this group.', again: false }); }
    },
    {
        name: 'groupsettings', aliases: ['gpsettings', 'gpset'], cat: 'group', groupOnly: true, desc: 'All protection settings of this group', react: '⚙️',
        async run(ctx) {
            if (!await guard(ctx, { botAdmin: false })) return;
            const g = ctx.runner.group(ctx.jid); const p = ctx.prefix;
            const row = (k, label, cmd) => `${onoff(g[k]?.enabled ?? g[k] === true)}  ${label}  _(${p}${cmd})_`;
            await ctx.sendButtons({
                header: false,
                text: `⚙️ *Group settings*\n\n${row('antilink', '🔗 Anti-link', 'antilink')}${g.antilink?.enabled ? ` → ${g.antilink.action || 'warn'}` : ''}\n${row('antispam', '🛡️ Anti-spam', 'antispam')}\n${row('antitoxic', '🤬 Bad words', 'antitoxic')}\n${row('antiforeign', '🌍 Country filter', 'antiforeign')}\n${onoff(g.antiviewonce?.enabled)}  👁️ Anti view-once  _(${p}antiviewonce)_\n${row('welcome', '👋 Welcome', 'welcome')}\n${row('left', '👋 Goodbye', 'left')}\n${g.stopped ? '🔴' : '🟢'}  🤖 Bot in this group  _(${p}gpstop / ${p}gprun)_`,
                quick: [{ id: `${p}antilink on`, label: '🔗 LINK ON' }, { id: `${p}antispam on`, label: '🛡️ SPAM ON' }, { id: `${p}welcome on`, label: '👋 WELCOME ON' }],
                sections: [{ title: 'SETTINGS', highlight_label: '', rows: ['antilink', 'antispam', 'antitoxic', 'antiforeign', 'antiviewonce', 'welcome', 'left', 'warnlist'].map((x) => ({ title: `${p}${x}`, description: 'Open this setting', id: `${p}${x}` })) }],
                listLabel: '⚙️ Open setting', listTitle: 'Group settings'
            });
        }
    },
    {
        name: 'warn', aliases: ['addwarn'], cat: 'group', groupOnly: true, desc: 'Warn a member (3 warnings = kick)  @user', react: '⚠️',
        async run(ctx) {
            if (!await guard(ctx, { botAdmin: false })) return;
            const t = targets(ctx)[0]; if (!t) return ctx.reply(`ℹ️ Reply to / @mention the member: ${ctx.prefix}warn @user`);
            const limit = ctx.runner.group(ctx.jid).antilink?.warnLimit || 3; let n = 0;
            await ctx.runner.setGroup(ctx.jid, (g) => { g.warns = { ...(g.warns || {}) }; n = (g.warns[num(t)] || 0) + 1; if (n >= limit) delete g.warns[num(t)]; else g.warns[num(t)] = n; });
            if (n >= limit) { const ok = await ctx.sock.groupParticipantsUpdate(ctx.jid, [t], 'remove').then(() => true, () => false); return ctx.sock.sendMessage(ctx.jid, { text: `🚫 @${num(t)} reached ${limit}/${limit} — ${ok ? 'removed' : 'make me admin to remove them'}.`, mentions: [t] }, { quoted: ctx.msg }); }
            await ctx.sock.sendMessage(ctx.jid, { text: `⚠️ @${num(t)} warning *${n}/${limit}*`, mentions: [t] }, { quoted: ctx.msg });
        }
    },
    {
        name: 'unwarn', aliases: ['removewarn', 'clearwarn'], cat: 'group', groupOnly: true, desc: 'Clear warnings of a member', react: '✅',
        async run(ctx) {
            if (!await guard(ctx, { botAdmin: false })) return;
            const t = targets(ctx)[0]; if (!t) return ctx.reply(`ℹ️ Reply to / @mention the member: ${ctx.prefix}unwarn @user`);
            await ctx.runner.setGroup(ctx.jid, (g) => { if (g.warns) { g.warns = { ...g.warns }; delete g.warns[num(t)]; } });
            await ctx.sock.sendMessage(ctx.jid, { text: `✅ Warnings cleared for @${num(t)}`, mentions: [t] }, { quoted: ctx.msg });
        }
    },
    {
        name: 'warnlist', aliases: ['warns', 'warninfo'], cat: 'group', groupOnly: true, desc: 'Members with warnings', react: '📋',
        async run(ctx) {
            const w = Object.entries(ctx.runner.group(ctx.jid).warns || {});
            if (!w.length) return ctx.reply('✅ Nobody has warnings.');
            await ctx.sock.sendMessage(ctx.jid, { text: `⚠️ *Warnings*\n\n${w.map(([n, c]) => `▫️ @${n} — ${c}`).join('\n')}`, mentions: w.map(([n]) => `${n}@s.whatsapp.net`) }, { quoted: ctx.msg });
        }
    },
    {
        name: 'tempmute', aliases: ['tmute', 'usermute'], cat: 'group', groupOnly: true, desc: "Silence a member's messages for a while  @user 10m", react: '🔇',
        async run(ctx) {
            if (!await guard(ctx)) return;
            const t = targets(ctx)[0]; const ms = parseDur(ctx.args.find((a) => parseDur(a)));
            if (!t || !ms) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}tempmute @user 10m   (s / m / h / d)`);
            await ctx.runner.setGroup(ctx.jid, (g) => { g.muted = { ...(g.muted || {}), [num(t)]: Date.now() + Math.min(ms, 7 * 86_400_000) }; });
            await ctx.sock.sendMessage(ctx.jid, { text: `🔇 @${num(t)} muted for *${ctx.args.find((a) => parseDur(a))}* (their messages are deleted).`, mentions: [t] }, { quoted: ctx.msg });
        }
    },
    {
        name: 'tempunmute', aliases: ['tunmute', 'userunmute'], cat: 'group', groupOnly: true, desc: 'Unmute a member', react: '🔊',
        async run(ctx) {
            if (!await guard(ctx, { botAdmin: false })) return;
            const t = targets(ctx)[0]; if (!t) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}tempunmute @user`);
            await ctx.runner.setGroup(ctx.jid, (g) => { if (g.muted) { g.muted = { ...g.muted }; delete g.muted[num(t)]; } });
            await ctx.sock.sendMessage(ctx.jid, { text: `🔊 @${num(t)} can talk again.`, mentions: [t] }, { quoted: ctx.msg });
        }
    },
    {
        name: 'poll', aliases: ['vote', 'survey'], cat: 'group', desc: 'Create a poll  Question | option 1 | option 2', react: '📊',
        async run(ctx) {
            const parts = ctx.text.split('|').map((x) => x.trim()).filter(Boolean);
            if (parts.length < 3 || parts.length > 13) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}poll Best colour? | Red | Blue | Green`);
            await ctx.sock.sendMessage(ctx.jid, { poll: { name: parts[0].slice(0, 200), values: parts.slice(1).map((x) => x.slice(0, 100)), selectableCount: 1 } });
        }
    },
    {
        name: 'tagadmins', aliases: ['admintag'], cat: 'group', groupOnly: true, desc: 'Mention all admins', react: '👑',
        async run(ctx) {
            const g = await ctx.groupMeta(); const a = g.participants.filter((p) => p.admin).map((p) => p.id);
            await ctx.sock.sendMessage(ctx.jid, { text: `👑 *Admins*  ${ctx.text || ''}\n\n${a.map((j) => `▫️ @${num(j)}`).join('\n')}`, mentions: a }, { quoted: ctx.msg });
        }
    },
    {
        name: 'kickall', aliases: ['removeall'], cat: 'group', groupOnly: true, desc: 'Remove ALL non-admin members (owner only)', ownerOnly: true, react: '💣',
        async run(ctx) {
            if (ctx.args[0]?.toLowerCase() !== 'confirm') return ctx.reply(`⚠️ This removes every non-admin member.\nType *${ctx.prefix}kickall confirm* to continue.`);
            const g = await guard(ctx, { userAdmin: false }); if (!g) return;
            const me = [ctx.ownerNumber, ctx.myLid].filter(Boolean);
            const list = g.participants.filter((p) => !p.admin && !forms(p, me)).map((p) => p.id);
            for (let i = 0; i < list.length; i += 5) { await ctx.sock.groupParticipantsUpdate(ctx.jid, list.slice(i, i + 5), 'remove').catch(() => {}); await new Promise((r) => setTimeout(r, 1500)); }
            await ctx.reply(`💣 Removed ${list.length} member(s).`);
        },
        timeoutMs: 120_000
    },
    {
        name: 'add', aliases: ['addmember'], cat: 'group', groupOnly: true, desc: 'Add a number to the group  .add 947553262213', react: '➕',
        async run(ctx) {
            if (!await guard(ctx)) return;
            const t = targets(ctx).filter((j) => j.endsWith('@s.whatsapp.net'));
            if (!t.length) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}add 94753262213`);
            const r = await ctx.sock.groupParticipantsUpdate(ctx.jid, t, 'add');
            const st = r?.[0]?.status;
            await ctx.reply(st === '200' || st === 200 ? '➕ Added.' : st === '403' ? '📩 Their privacy blocks adding — an invite was needed.' : st === '409' ? 'ℹ️ Already in the group.' : `⚠️ Could not add (status ${st || 'unknown'}).`);
        }
    }
];
function forms(p, me) { return [p.id, p.lid, p.phoneNumber].filter(Boolean).map(numberOfJid).some((x) => me.includes(x)); }
