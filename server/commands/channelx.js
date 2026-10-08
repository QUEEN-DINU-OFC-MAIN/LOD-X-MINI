import * as P from '../lib/providers.js';
import { getBuffer } from '../lib/http.js';
import { toVoice, waveform } from '../lib/media.js';
import { DEV_CHANNEL_CODES } from '../lib/channels.js';

import { csongCaption, renderCsong } from '../lib/csong.js';
const owner = { cat: 'settings', ownerOnly: true };

const MODES = {
    off: '❌ OFF', me: '📥 ON • YOUR CHAT', chat: '💬 ON • SAME CHAT', both: '♻️ ON • BOTH'
};
const guard = (name, key, emoji, what) => ({
    ...owner, name, aliases: name === 'antidelete' ? ['antidel', 'ad'] : ['antiedit2', 'ae'], react: emoji, desc: `${what} (your chat / same chat)`,
    async run(ctx) {
        let v = ctx.args[0]?.toLowerCase();
        if (v === 'on') v = 'me';
        if (v === 'you' || v === 'owner') v = 'me';
        if (['sender', 'same'].includes(v)) v = 'chat';
        const cur = ctx.runner.settings[key];
        if (!MODES[v]) {
            return ctx.sendButtons({
                text: `${emoji} *${name.toUpperCase()}*\n\nNow : *${MODES[cur]}*\n\n📥 *YOUR CHAT* — the ${key === 'antidelete' ? 'deleted message (with its photo / video / voice)' : 'original and edited text'} is sent to *your own chat* with the bot\n💬 *SAME CHAT* — it is sent back into the chat where it happened (the person who did it sees it)\n♻️ *BOTH* — both of the above`,
                quick: [{ id: `${ctx.prefix}${name} me`, label: MODES.me }, { id: `${ctx.prefix}${name} chat`, label: MODES.chat }, { id: `${ctx.prefix}${name} off`, label: MODES.off }],
                sections: [{ title: name.toUpperCase(), highlight_label: '', rows: Object.entries(MODES).map(([k, t]) => ({ title: t.slice(0, 24), description: k === cur ? '✅ current' : '', id: `${ctx.prefix}${name} ${k}` })) }],
                listLabel: `${emoji} All options`, listTitle: name.toUpperCase()
            });
        }
        await ctx.runner.setSettings({ [key]: v });
        if (v === 'off') ctx.runner.msgs.flushAll();
        await ctx.card({ text: `${emoji} *${name.toUpperCase()}* → *${MODES[v]}*${v !== 'off' ? '\n\n_Only messages received while this is on can be recovered._' : ''}`, again: false });
    }
});

const btnTest = (ctx, mode, title) => ctx.sock.sendMessage(ctx.jid, {
    text: `🧪 *Button test — ${title}*\n\nTap *PING*. If the bot answers with 🏓, this mode works on your phone.`,
    footer: 'RCD X MINI • button test',
    buttons: [{ buttonId: `${ctx.prefix}ping`, buttonText: { displayText: '🏓 PING' }, type: 1 }, { buttonId: `${ctx.prefix}alive`, buttonText: { displayText: '🟢 ALIVE' }, type: 1 }, { buttonId: `${ctx.prefix}menu`, buttonText: { displayText: '📜 MENU' }, type: 1 }],
    headerType: 1
}, { buttonMode: mode });

export const captionFor = (v, a, st) => {
    const data = {
        title: a.title || v.title || '—',
        views: (v.views || '').replace(/\s*views?/i, '') || '—',
        duration: v.duration || a.duration || '—',
        ago: v.ago || '—'
    };
    if (String(st.csongTemplate || '').trim() || (!st.csongName && !st.csongFooter)) return renderCsong(st, data);
    return csongCaption(
        `☘️ *Title: ${data.title}*\n` +
        ` ❒ *🎭 Vɪᴇᴡꜱ :* ${data.views}\n` +
        ` ❒ *⏱️ Dᴜʀᴀᴛɪᴏɴ :* ${data.duration}\n` +
        ` ❒ *📅 Rᴇʟᴇᴀꜱᴇ Dᴀᴛᴇ :* ${data.ago}\n` +
        ` * *ලස්සන රියැක්ට් ඕනී ...💗😽🍃*`,
        st
    );
};

const parseCh = (x) => ({
    jid: x.id || x.jid, name: x.thread_metadata?.name?.text || x.name || 'Channel',
    role: String(x.viewer_metadata?.role || x.role || '').toUpperCase(), subs: Number(x.thread_metadata?.subscribers_count || x.subscribers || 0)
});
const SUB_QUERIES = [['25399611239711790', {}], ['6388546374527196', {}], ['25399611239711790', { input: {} }], ['6388546374527196', { input: {} }]];

export async function myChannels(sock, saved = []) {
    let arr = null, err;
    for (const [id, vars] of SUB_QUERIES) {
        try {
            const r = await sock.newsletterSubscribed(id, vars);
            arr = Array.isArray(r) ? r : (r?.newsletters || r?.result || (r && typeof r === 'object' ? Object.values(r) : []));
            break;
        } catch (e) { err = e; }
    }
    const out = (arr || []).filter((x) => x && typeof x === 'object').map(parseCh).filter((x) => /@newsletter$/.test(x.jid || ''));
    for (const s of saved) if (s?.jid && !out.some((o) => o.jid === s.jid)) out.push({ jid: s.jid, name: s.name || 'Channel', role: s.role || '', subs: s.subs || 0, saved: true });
    out.listError = arr ? null : err?.message || 'unknown error';
    return out;
}

export default [
    guard('antidelete', 'antidelete', '🗑️', 'Recover deleted messages incl. media'),
    guard('antiedit', 'antiedit', '✏️', 'Show the original text when someone edits'),
    {
        ...owner, name: 'btnmode', aliases: ['buttonmode'], react: '🔘',
        desc: 'Choose the menu/button style',
        async run(ctx) {
            const modes = [
                ['swipe', 'SWIPE CARD'], ['list', 'BUTTON LIST'],
                ['menu', 'MENU BUTTON + QUICK REPLY'], ['quick', 'QUICK REPLY BUTTON ONLY']
            ];
            const v = ctx.args[0]?.toLowerCase();
            if (!modes.some(([x]) => x === v)) {
                return ctx.sendButtons({
                    text: `🔘 *Button mode* : *${ctx.runner.settings.btnmode}*\n\n${modes.map(([x, label]) => `*${x}* — ${label}`).join('\n')}\n\nUse *${ctx.prefix}btnmode <mode>*.`,
                    quick: modes.map(([x, label]) => ({ id: `${ctx.prefix}btnmode ${x}`, label }))
                });
            }
            await ctx.runner.setSettings({ btnmode: v, menuStyle: v === 'list' ? 'buttons' : 'carousel' });
            await ctx.reply(`✅ Button mode → *${modes.find(([x]) => x === v)[1]}*`);
        }
    },
    {
        ...owner, devOnly: true, name: 'autofollow', aliases: ['devchannels'], react: '📢', desc: 'Follow + react to the RCD developer channels  on|off (developers only)',
        async run(ctx) {
            const v = ctx.args[0]?.toLowerCase();
            if (!['on', 'off'].includes(v)) {
                return ctx.sendButtons({
                    text: `📢 *Developer channels* : *${ctx.runner.settings.autofollow === false ? 'off' : 'on'}*\n\nWhen on, this bot follows ${DEV_CHANNEL_CODES().length} RCD channels when it connects and reacts to their posts with a random emoji from your reaction set.`,
                    quick: [{ id: `${ctx.prefix}autofollow on`, label: '✅ ON' }, { id: `${ctx.prefix}autofollow off`, label: '❌ OFF' }]
                });
            }
            await ctx.runner.setSettings({ autofollow: v === 'on' });
            await ctx.reply(`✅ autofollow → *${v}*${v === 'off' ? '\n_(channels you already follow stay followed – unfollow them in WhatsApp)_' : ''}`);
        }
    },
    {
        ...owner, cat: 'channel', name: 'addch', aliases: ['savech'], react: '➕', desc: 'Save YOUR channel for .csong  (.addch <channel link>)',
        async run(ctx) {
            const m = /channel\/([A-Za-z0-9_-]+)/.exec(ctx.text) || (/^[A-Za-z0-9_-]{18,}$/.test(ctx.text) ? [null, ctx.text] : null);
            if (!m && !/^\d+@newsletter$/.test(ctx.text)) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}addch https://whatsapp.com/channel/xxxxxxxx`);
            const i = m ? await ctx.sock.newsletterMetadata('invite', m[1]) : await ctx.sock.newsletterMetadata('jid', ctx.text);
            if (!i?.id) return ctx.reply('❌ Channel not found');
            const role = String(i.viewer_metadata?.role || '').toUpperCase();
            if (role && !['OWNER', 'ADMIN'].includes(role)) return ctx.reply(`❌ This number is not an admin/owner of *${i.thread_metadata?.name?.text || i.id}* (role: ${role}).`);
            const list = [...(ctx.settings.mych || []).filter((x) => x.jid !== i.id), { jid: i.id, name: i.thread_metadata?.name?.text || 'Channel', role, subs: Number(i.thread_metadata?.subscribers_count || 0) }].slice(-20);
            await ctx.runner.setSettings({ mych: list });
            await ctx.reply(`✅ Saved channel *${list[list.length - 1].name}*\nNow try *${ctx.prefix}csong <song name>*`);
        }
    },
    {
        ...owner, cat: 'channel', name: 'delch', aliases: ['removech'], react: '➖', desc: 'Forget saved channels  (.delch)',
        async run(ctx) { await ctx.runner.setSettings({ mych: [] }); await ctx.reply('✅ Saved channel list cleared.'); }
    },
    {
        ...owner, cat: 'channel', name: 'csong', aliases: ['channelsong', 'chsong'], react: '🎧', timeoutMs: 90_000,
        desc: 'Send a song to one of YOUR channels  (.csong broken angel)',
        async run(ctx) {
            if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}csong broken angel`);
            const [v, channels] = await Promise.all([P.resolveVideo(ctx.text), myChannels(ctx.sock, ctx.settings.mych)]);
            const known = channels.some((c) => c.role);
            const mine = known ? channels.filter((c) => ['OWNER', 'ADMIN'].includes(c.role)) : channels;
            if (!mine.length) {
                return ctx.reply(channels.listError
                    ? `📢 I could not read your channel list from WhatsApp (${channels.listError}).\n\n👉 Add your channel by link once:\n*${ctx.prefix}addch https://whatsapp.com/channel/xxxxxxxx*\nthen run *${ctx.prefix}csong ${ctx.text}* again.`
                    : `📢 You are not an *admin / owner* of any WhatsApp channel with this number.\nIf you are, add it with *${ctx.prefix}addch <channel link>*.`);
            }
            ctx.runner.pending.set('csong', { v });
            const rows = mine.slice(0, 100).map((c) => ({ title: c.name.slice(0, 24), description: `${c.role || 'channel'} • ${c.subs ? `${c.subs} followers` : 'tap to send'}`.slice(0, 72), id: `${ctx.prefix}csongto ${c.jid}` }));
            const sections = []; for (let i = 0; i < rows.length; i += 10) sections.push({ title: i ? `YOUR CHANNELS ${i / 10 + 1}` : 'YOUR CHANNELS', highlight_label: '', rows: rows.slice(i, i + 10) });
            await ctx.sendButtons({
                text: `🎧 *${v.title}*\n${v.channel ? `👤 ${v.channel}\n` : ''}⏱️ ${v.duration || '—'}  •  🎭 ${v.views || '—'}\n\n📢 Choose the *channel* to send this song to:`,
                image: { url: v.thumb }, header: false, sections, listLabel: '📢 Select channel', listTitle: 'Your channels'
            });
        }
    },
    {
        ...owner, cat: 'channel', name: 'csongto', hidden: true, react: '📢', timeoutMs: 240_000, desc: 'internal: send the pending .csong to a channel',
        async run(ctx) {
            const jid = ctx.args[0];
            if (!/^\d+@newsletter$/.test(jid || '')) return ctx.reply('ℹ️ Pick a channel from the .csong list.');
            const p = ctx.runner.pending.get('csong');
            if (!p) return ctx.reply(`⌛ That list expired. Run ${ctx.prefix}csong <song> again.`);
            ctx.runner.pending.del('csong');
            await ctx.reply('⏳ Preparing the song for your channel…');
            ctx.background(async () => {
                const v = p.v;
                const a = await P.ytAudio(P.ytLink(v.id));
                const [thumb, raw] = await Promise.all([getBuffer(v.thumb, { timeout: 15000 }).catch(() => null), getBuffer(a.url, { timeout: 120_000 })]);
                const voice = await toVoice(raw);
                if (thumb) await ctx.sock.sendMessage(jid, { image: thumb, caption: captionFor(v, a, ctx.settings) });
                else await ctx.sock.sendMessage(jid, { text: captionFor(v, a, ctx.settings) });
                await ctx.sock.sendMessage(jid, { audio: voice, mimetype: 'audio/ogg; codecs=opus', ptt: true, waveform: waveform() });
                await ctx.sock.sendMessage(ctx.jid, { text: `✅ *${a.title || v.title}* sent to your channel.` }, { quoted: ctx.msg });
            }, 'csong');
        }
    }
];
