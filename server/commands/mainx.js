import { numberOfJid, B } from '../../shared/wa.js';
import { fullFrame } from '../lib/dp.js';

const owner = { cat: 'privacy', ownerOnly: true };
const toJid = (ctx) => {
    const ci = ctx.msg.message?.extendedTextMessage?.contextInfo;
    if (ci?.mentionedJid?.[0]) return ci.mentionedJid[0];
    if (ci?.participant) return ci.participant;
    const n = (ctx.args[0] || '').replace(/\D/g, '');
    if (n.length >= 8 && n.length <= 15) return `${n}@s.whatsapp.net`;
    return ctx.jid.endsWith('@g.us') ? null : ctx.jid;
};

const priv = (name, aliases, key, label, emoji, values, call) => ({
    ...owner, name, aliases, desc: `${label} privacy  (${values.join(' / ')})`, react: emoji,
    async run(ctx) {
        const v = (ctx.args[0] || '').toLowerCase();
        if (!values.includes(v)) {
            return ctx.sendButtons({
                text: `${emoji} *${label}*\n\nChoose who can see this:`, header: false,
                quick: [{ id: `${ctx.prefix}privacy`, label: '🔐 ALL SETTINGS' }],
                sections: [{ title: label.slice(0, 24), highlight_label: '', rows: values.map((x) => ({ title: x.toUpperCase().slice(0, 24), description: `${label}: ${x}`, id: `${ctx.prefix}${name} ${x}` })) }],
                listLabel: `${emoji} Choose`, listTitle: label
            });
        }
        await call(ctx.sock, v);
        await ctx.card({ text: `✅ *${label}* → *${v}*`, again: false, quick: [{ id: `${ctx.prefix}privacy`, label: '🔐 PRIVACY' }] });
    }
});

const DISAPPEAR = { off: 0, '24h': 86400, '7d': 604800, '90d': 7776000 };

export default [
    {
        name: 'debug', aliases: ['status', 'diag'], cat: 'main', ownerOnly: true, desc: 'Bot health: memory, state, sessions', react: '🧰',
        async run(ctx) {
            const m = process.memoryUsage(); const mb = (n) => `${(n / 1048576).toFixed(0)} MB`;
            await ctx.card({ text: `🧰 *Debug*\n\n▫️ Session : +${ctx.ownerNumber}\n▫️ State : ${ctx.runner.state}\n▫️ Uptime : ${ctx.runner.uptime()}\n▫️ Worker RAM : ${mb(m.rss)} (heap ${mb(m.heapUsed)})\n▫️ Sessions on this worker : ${ctx.platform.sessionCount?.() ?? '?'}\n▫️ Queue : ${ctx.platform.cmdQueue.pending} running / ${ctx.platform.cmdQueue.size} waiting\n▫️ Downloads : ${ctx.platform.dlQueue.pending} running / ${ctx.platform.dlQueue.size} waiting\n▫️ Node : ${process.version}`, again: true });
        }
    },
    {
        ...owner, name: 'privacy', aliases: ['privacyinfo'], desc: 'Show & change all privacy settings', react: '🔐',
        async run(ctx) {
            const p = await ctx.sock.fetchPrivacySettings(true);
            const x = ctx.prefix;
            await ctx.sendButtons({
                header: false,
                text: `🔐 *PRIVACY SETTINGS*\n\n👀 Last seen : *${p.last || '?'}*\n🟢 Online : *${p.online || '?'}*\n🖼️ Profile photo : *${p.profile || '?'}*\n📸 Status : *${p.status || '?'}*\n✔️ Read receipts : *${p.readreceipts || '?'}*\n👥 Add to groups : *${p.groupadd || '?'}*\n📞 Calls : *${p.calladd || '?'}*\n💬 Messages : *${p.messages || '?'}*`,
                quick: [{ id: `${x}blocklist`, label: '🚫 BLOCKLIST' }, { id: `${x}menu privacy`, label: '📜 ALL COMMANDS' }],
                sections: [{ title: 'CHANGE', highlight_label: '', rows: [['lastseen', 'Last seen'], ['onlineprivacy', 'Online'], ['profileprivacy', 'Profile photo'], ['statusprivacy', 'Status'], ['readprivacy', 'Read receipts'], ['groupaddprivacy', 'Who can add me to groups'], ['callprivacy', 'Calls'], ['messagesprivacy', 'Messages']].map(([c, d]) => ({ title: `${x}${c}`, description: d, id: `${x}${c}` })) }],
                listLabel: '⚙️ Change', listTitle: 'Privacy'
            });
        }
    },
    priv('lastseen', ['setlastseen'], 'last', 'Last seen', '👀', ['all', 'contacts', 'contact_blacklist', 'none'], (s, v) => s.updateLastSeenPrivacy(v)),
    priv('onlineprivacy', ['setonlineprivacy'], 'online', 'Online', '🟢', ['all', 'match_last_seen'], (s, v) => s.updateOnlinePrivacy(v)),
    priv('profileprivacy', ['ppprivacy'], 'profile', 'Profile photo', '🖼️', ['all', 'contacts', 'contact_blacklist', 'none'], (s, v) => s.updateProfilePicturePrivacy(v)),
    priv('statusprivacy', ['setstatusprivacy'], 'status', 'Status', '📸', ['all', 'contacts', 'contact_blacklist', 'none'], (s, v) => s.updateStatusPrivacy(v)),
    priv('readprivacy', ['readreceipts'], 'readreceipts', 'Read receipts', '✔️', ['all', 'none'], (s, v) => s.updateReadReceiptsPrivacy(v)),
    priv('groupaddprivacy', ['groupadd'], 'groupadd', 'Groups add', '👥', ['all', 'contacts', 'contact_blacklist'], (s, v) => s.updateGroupsAddPrivacy(v)),
    priv('callprivacy', ['calladd'], 'calladd', 'Calls', '📞', ['all', 'known'], (s, v) => s.updateCallPrivacy(v)),
    priv('messagesprivacy', ['msgprivacy'], 'messages', 'Messages', '💬', ['all', 'contacts'], (s, v) => s.updateMessagesPrivacy(v)),
    {
        ...owner, name: 'linkpreview', desc: 'Disable / enable link previews  on|off', react: '🔗',
        async run(ctx) { const v = ctx.args[0]?.toLowerCase(); if (!['on', 'off'].includes(v)) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}linkpreview on|off`); await ctx.sock.updateDisableLinkPreviewsPrivacy(v === 'off'); await ctx.reply(`✅ Link previews *${v}*`); }
    },
    {
        ...owner, name: 'disappear', aliases: ['setdisappear', 'disappearmode'], desc: 'Default disappearing messages  off|24h|7d|90d', react: '⏳',
        async run(ctx) {
            const v = (ctx.args[0] || '').toLowerCase();
            if (!(v in DISAPPEAR)) return ctx.sendButtons({ text: '⏳ *Default disappearing mode*', header: false, sections: [{ title: 'DURATION', highlight_label: '', rows: Object.keys(DISAPPEAR).map((x) => ({ title: x.toUpperCase(), description: 'For new chats', id: `${ctx.prefix}disappear ${x}` })) }], listLabel: '⏳ Choose', listTitle: 'Disappearing' });
            await ctx.sock.updateDefaultDisappearingMode(DISAPPEAR[v]);
            await ctx.reply(`✅ Default disappearing mode → *${v}*`);
        }
    },
    {
        ...owner, name: 'setbio', aliases: ['bio', 'setstatus'], desc: 'Change your WhatsApp bio (About)', react: '📝',
        async run(ctx) { if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}setbio your text`); await ctx.sock.updateProfileStatus(ctx.text.slice(0, 139)); await ctx.reply('✅ Bio updated.'); }
    },
    {
        ...owner, name: 'setname', aliases: ['profilename', 'updatename'], desc: 'Change your WhatsApp profile name', react: '👤',
        async run(ctx) { if (!ctx.text || ctx.text.length > 25) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}setname New Name  (max 25 chars)`); await ctx.sock.updateProfileName(ctx.text); await ctx.reply('✅ Profile name updated.'); }
    },
    {
        ...owner, name: 'setpp', aliases: ['setprofilepic', 'setbotpp', 'fullpp', 'setfullpp', 'fulldp', 'setfulldp'], react: '🖼️', timeoutMs: 60000,
        desc: 'Set your profile photo at its own size, no cropping (reply to an image)  ·  .setpp square | white | black | crop',
        async run(ctx) {
            const q = ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage || ctx.msg.message?.imageMessage;
            if (!q) return ctx.reply(`ℹ️ Reply to an image with ${ctx.prefix}setpp\n\n🖼️ Full picture, nothing cut off. Options: ${ctx.prefix}setpp square | white | black | crop`);
            let buf = Buffer.alloc(0); for await (const c of await B.downloadContentFromMessage(q, 'image')) buf = Buffer.concat([buf, c]);
            const style = (ctx.args[0] || 'full').toLowerCase();
            const me = ctx.sock.user.id;
            if (style === 'crop') { await ctx.sock.updateProfilePicture(me, buf); return ctx.reply('✅ Profile photo updated (cropped).'); }
            const mode = ['square', 'blur', 'white', 'black'].includes(style) ? (style === 'square' ? 'blur' : style) : 'full';
            try {
                await ctx.sock.updateProfilePicture(me, await fullFrame(buf, mode), { raw: true });
            } catch (e) {
                if (mode !== 'full') throw e;
                await ctx.sock.updateProfilePicture(me, await fullFrame(buf, 'blur'), { raw: true });
                return ctx.reply('✅ Profile photo updated — WhatsApp wanted a square, so your full picture sits on a blurred background.');
            }
            await ctx.reply(mode === 'full' ? '✅ Profile photo updated — your picture at its own size, nothing cut off! 🖼️' : '✅ Profile photo updated — the full picture, no cropping! 🖼️');
        }
    },
    { ...owner, name: 'delpp', aliases: ['removepp'], desc: 'Remove your profile photo', react: '🗑️', async run(ctx) { await ctx.sock.removeProfilePicture(ctx.sock.user.id); await ctx.reply('✅ Profile photo removed.'); } },
    {
        ...owner, name: 'block', desc: 'Block a number / replied user', react: '🚫',
        async run(ctx) { const j = toJid(ctx); if (!j) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}block 94771234567`); await ctx.sock.updateBlockStatus(j, 'block'); await ctx.reply(`🚫 Blocked +${numberOfJid(j)}`); }
    },
    {
        ...owner, name: 'unblock', desc: 'Unblock a number / replied user', react: '✅',
        async run(ctx) { const j = toJid(ctx); if (!j) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}unblock 94771234567`); await ctx.sock.updateBlockStatus(j, 'unblock'); await ctx.reply(`✅ Unblocked +${numberOfJid(j)}`); }
    },
    {
        ...owner, name: 'blocklist', aliases: ['blocked'], desc: 'Your blocked numbers', react: '📋',
        async run(ctx) {
            const l = await ctx.sock.fetchBlocklist();
            await ctx.reply(l?.length ? `🚫 *Blocked (${l.length})*\n\n${l.slice(0, 60).map((j) => `▫️ +${numberOfJid(j)}`).join('\n')}${l.length > 60 ? '\n…' : ''}` : '✅ Nobody is blocked.');
        }
    },
    {
        ownerOnly: true, name: 'statusof', aliases: ['about', 'bioof'], cat: 'privacy', desc: "Read a number's WhatsApp bio  (.statusof 9477…)", react: '📝',
        async run(ctx) {
            const j = toJid(ctx); if (!j) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}statusof 94771234567`);
            const r = await ctx.sock.fetchStatus(j).catch(() => null); const s = Array.isArray(r) ? r[0]?.status : r;
            await ctx.reply(s?.status ? `📝 *+${numberOfJid(j)}*\n\n${s.status}\n\n🕒 ${s.setAt ? new Date(s.setAt).toDateString() : ''}` : '❌ No public bio (or it is private).');
        }
    },
    {
        ownerOnly: true, name: 'disappearof', aliases: ['dmode'], cat: 'privacy', desc: "A number's disappearing-message setting", react: '⏳',
        async run(ctx) {
            const j = toJid(ctx); if (!j) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}disappearof 94771234567`);
            const r = await ctx.sock.fetchDisappearingDuration(j).catch(() => null); const d = r?.[0]?.disappearingMode?.duration ?? r?.[0]?.duration;
            await ctx.reply(`⏳ +${numberOfJid(j)} : *${d ? `${Math.round(d / 86400)} day(s)` : 'off / unknown'}*`);
        }
    },
    {
        ownerOnly: true, name: 'bizinfo', aliases: ['business'], cat: 'privacy', desc: "A WhatsApp Business account's profile", react: '🏢',
        async run(ctx) {
            const j = toJid(ctx); if (!j) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}bizinfo 94771234567`);
            const b = await ctx.sock.getBusinessProfile(j).catch(() => null);
            if (!b) return ctx.reply('❌ Not a business account.');
            await ctx.reply(`🏢 *Business profile*\n\n▫️ Category : ${b.category || '-'}\n▫️ Email : ${b.email || '-'}\n▫️ Website : ${(b.website || []).join(', ') || '-'}\n▫️ Address : ${b.address || '-'}\n\n${b.description || ''}`);
        }
    },
    ...[['star', true, '⭐'], ['unstar', false, '☆']].map(([name, on, e]) => ({
        ...owner, name, desc: `${on ? 'Star' : 'Unstar'} the replied message`, react: e,
        async run(ctx) {
            const ci = ctx.msg.message?.extendedTextMessage?.contextInfo;
            if (!ci?.stanzaId) return ctx.reply(`ℹ️ Reply to a message with ${ctx.prefix}${name}`);
            await ctx.sock.star(ctx.jid, [{ id: ci.stanzaId, fromMe: !!ci.participant && numberOfJid(ci.participant) === ctx.ownerNumber }], on);
            await ctx.reply(on ? '⭐ Starred.' : '☆ Unstarred.');
        }
    }))
];
