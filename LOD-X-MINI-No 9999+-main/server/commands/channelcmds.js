import { myChannels } from './channelx.js';
import { latestServerIds, heart } from '../lib/channels.js';

const own = { cat: 'channel', ownerOnly: true };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const codeOf = (s) => /channel\/([A-Za-z0-9_-]+)(?:\/(\d+))?/.exec(s || '');
async function resolve(sock, s) {
    if (/^\d+@newsletter$/.test(s)) return { jid: s };
    if (/^\d{10,}$/.test(s)) return { jid: `${s}@newsletter` };
    const m = codeOf(s) || (/^[A-Za-z0-9_-]{18,}$/.test(s) ? [null, s] : null);
    if (!m) return null;
    const info = await sock.newsletterMetadata('invite', m[1]);
    if (!info?.id) return null;
    return { jid: info.id, info, post: m[2] };
}
const nm = (i) => i?.thread_metadata?.name?.text || i?.name || '';
const need = (ctx, usage) => ctx.reply(`ℹ️ Usage: ${ctx.prefix}${usage}`);

export default [
    {
        ...own, name: 'nlhelp', aliases: ['channelhelp'], react: '📢', desc: 'Channel commands help',
        async run(ctx) {
            const p = ctx.prefix;
            await ctx.card({
                text: `📢 *CHANNEL COMMANDS*\n\n▫️ ${p}cinfo <link> — channel details\n▫️ ${p}followch <link> — follow 🔒\n▫️ ${p}unfollowch <link> — unfollow 🔒\n▫️ ${p}reactch <link/postid> <emoji> — react to a post 🔒\n▫️ ${p}mychannels — channels you follow / manage\n▫️ ${p}mutechannel · ${p}unmutechannel <link>\n▫️ ${p}cpost <jid> <text> — post text (admin)\n▫️ ${p}cfetch <link> [count] — latest post ids\n▫️ ${p}csong <song> — send a song to your channel\n▫️ ${p}cvote <link/postid> <count> <#> — poll votes 🔒\n\n🔒 = dev channels only (send the command inside a dev channel, from a dev number)`,
                again: false, quick: [{ id: `${p}mychannels`, label: '📋 MY CHANNELS' }]
            });
        }
    },
    {
        ...own, name: 'cinfo', aliases: ['channelinfo'], react: '📡', desc: 'Channel details  (.cinfo <link>)',
        async run(ctx) {
            if (!ctx.text) return need(ctx, 'cinfo https://whatsapp.com/channel/xxxx');
            const r = await resolve(ctx.sock, ctx.args[0]);
            if (!r) return ctx.reply('❌ Channel not found');
            const i = r.info || await ctx.sock.newsletterMetadata('jid', r.jid);
            const t = i?.thread_metadata || {};
            await ctx.card({
                text: `📡 *${nm(i) || r.jid}*\n\n▫️ JID : \`${r.jid}\`\n▫️ Followers : ${t.subscribers_count ?? '—'}\n▫️ Verified : ${t.verification === 'VERIFIED' ? '✅' : '—'}\n▫️ Created : ${t.creation_time ? new Date(Number(t.creation_time) * 1000).toLocaleDateString('en-GB') : '—'}\n▫️ Your role : ${i?.viewer_metadata?.role || '—'}\n\n${(t.description?.text || '').slice(0, 300)}`,
                copy: [{ label: '📋 COPY JID', code: r.jid }], again: false
            });
        }
    },
    {
        ...own, devOnly: true, devChannel: true, name: 'followch', aliases: ['followchannel', 'nlfollow'], react: '➕', desc: 'Follow a channel  (.followch <link>) — dev channels only',
        async run(ctx) {
            if (!ctx.text) return need(ctx, 'followch https://whatsapp.com/channel/xxxx');
            const r = await resolve(ctx.sock, ctx.args[0]); if (!r) return ctx.reply('❌ Channel not found');
            await ctx.sock.newsletterFollow(r.jid);
            await ctx.card({ text: `✅ Following *${nm(r.info) || r.jid}*`, again: false });
        }
    },
    {
        ...own, devOnly: true, devChannel: true, name: 'unfollowch', aliases: ['unfollowchannel', 'nlunfollow'], react: '➖', desc: 'Unfollow a channel — dev channels only',
        async run(ctx) {
            if (!ctx.text) return need(ctx, 'unfollowch https://whatsapp.com/channel/xxxx');
            const r = await resolve(ctx.sock, ctx.args[0]); if (!r) return ctx.reply('❌ Channel not found');
            await ctx.sock.newsletterUnfollow(r.jid);
            await ctx.card({ text: `✅ Unfollowed *${nm(r.info) || r.jid}*`, again: false });
        }
    },
    {
        ...own, devOnly: true, devChannel: true, name: 'reactch', aliases: ['rch', 'channelreact'], react: '💗', desc: 'React to a channel post  (.reactch <link/postid> 💗) — dev channels only',
        async run(ctx) {
            const [link, emoji = '💗'] = ctx.args;
            if (!link) return need(ctx, 'reactch https://whatsapp.com/channel/xxx/123 💗');
            const r = await resolve(ctx.sock, link);
            if (!r) return ctx.reply('❌ Channel not found');
            const post = r.post || (await latestServerIds(ctx.sock, r.jid, 1))[0];
            if (!post) return ctx.reply('❌ No post id – use a link that ends with /<postId>');
            await ctx.sock.newsletterReactMessage(r.jid, String(post), emoji);
            await ctx.card({ text: `${emoji} *Reacted* to post ${post}\n📡 ${nm(r.info) || r.jid}`, again: false });
        }
    },
    {
        ...own, name: 'mychannels', aliases: ['channels', 'followedch', 'mych'], react: '📋', desc: 'Channels you follow / manage',
        async run(ctx) {
            const list = await myChannels(ctx.sock, ctx.settings.mych);
            if (!list.length) return ctx.reply(list.listError ? `📋 Could not read your channel list (${list.listError}). Save a channel by link: ${ctx.prefix}addch <link>` : '📋 You do not follow any channel yet.');
            await ctx.card({
                text: `📋 *YOUR CHANNELS* (${list.length})\n\n${list.slice(0, 30).map((c, i) => `${i + 1}. *${c.name}*${c.role && c.role !== 'SUBSCRIBER' ? ` — ${c.role}` : ''}${c.subs ? ` • ${c.subs}` : ''}\n   \`${c.jid}\``).join('\n')}`,
                again: false
            });
        }
    },
    ...['mute', 'unmute'].map((a) => ({
        ...own, name: `${a}channel`, react: a === 'mute' ? '🔕' : '🔔', desc: `${a === 'mute' ? 'Mute' : 'Unmute'} a channel`,
        async run(ctx) {
            if (!ctx.text) return need(ctx, `${a}channel https://whatsapp.com/channel/xxxx`);
            const r = await resolve(ctx.sock, ctx.args[0]); if (!r) return ctx.reply('❌ Channel not found');
            await (a === 'mute' ? ctx.sock.newsletterMute(r.jid) : ctx.sock.newsletterUnmute(r.jid));
            await ctx.card({ text: `${a === 'mute' ? '🔕 Muted' : '🔔 Unmuted'} *${nm(r.info) || r.jid}*`, again: false });
        }
    })),
    {
        ...own, name: 'cpost', aliases: ['channelpost', 'npost'], react: '📝', desc: 'Post text to your channel  (.cpost <jid> <text>)',
        async run(ctx) {
            const [to, ...rest] = ctx.args; const text = rest.join(' ');
            if (!to || !text) return need(ctx, 'cpost 120363xxx@newsletter Hello!');
            const r = await resolve(ctx.sock, to); if (!r) return ctx.reply('❌ Channel not found');
            await ctx.sock.sendMessage(r.jid, { text });
            await ctx.card({ text: `📝 *Posted* to ${nm(r.info) || r.jid}\n\n${text.slice(0, 120)}`, again: false });
        }
    },
    {
        ...own, name: 'cfetch', aliases: ['fetchch', 'chmsgs'], react: '📩', desc: 'Latest post ids of a channel  (.cfetch <link> 5)',
        async run(ctx) {
            if (!ctx.args[0]) return need(ctx, 'cfetch https://whatsapp.com/channel/xxxx 5');
            const r = await resolve(ctx.sock, ctx.args[0]); if (!r) return ctx.reply('❌ Channel not found');
            const ids = await latestServerIds(ctx.sock, r.jid, Math.min(Number(ctx.args[1]) || 5, 20));
            await ctx.card({ text: `📩 *${nm(r.info) || r.jid}*\n\nLatest post ids:\n${ids.map((x) => `▫️ ${x}`).join('\n') || '—'}\n\n_React: ${ctx.prefix}reactch ${r.jid} ${heart()}_`, again: false });
        }
    },
    {
        ...own, devOnly: true, devChannel: true, name: 'cvote', aliases: ['chvote', 'pollvote'], react: '🗳️', desc: 'Vote on a channel poll with every connected bot  (.cvote <link/postid> <count> <option#>)', timeoutMs: 240_000,
        async run(ctx) {
            const [linkRaw, countRaw, optRaw] = ctx.args;
            if (!linkRaw || !countRaw) return need(ctx, 'cvote https://whatsapp.com/channel/xxxx/123 20 1');
            const count = Math.max(1, Math.min(500, Number(countRaw) || 1));
            const r = await resolve(ctx.sock, linkRaw);
            if (!r) return ctx.reply('❌ Channel not found');
            if (!r.post) return ctx.reply('❌ Add the poll post id to the link: …/channel/CODE/<postId>');
            const posts = (await ctx.sock.newsletterGetMessages?.(r.jid, 40).catch(() => [])) || [];
            const post = posts.find((p) => String(p.serverId) === String(r.post));
            const poll = post?.poll;
            if (!poll?.options?.length) return ctx.reply('❌ That post is not a poll, or the poll could not be read.');
            const idx = Math.max(1, Math.min(poll.options.length, Number(optRaw) || 1));
            const opt = poll.options[idx - 1];
            const bots = [...(ctx.platform.runners?.values?.() || [])].filter((b) => b?.state === 'open' && b.sock && !b.stopping);
            if (!bots.length) return ctx.reply('❌ No connected bots are available to vote.');
            const use = bots.slice(0, count);
            ctx.progress(`CVOTE “${opt.name}” — 0/${use.length}`);
            let ok = 0, fail = 0;
            for (let i = 0; i < use.length; i += 4) {
                const chunk = use.slice(i, i + 4);
                const res = await Promise.all(chunk.map(async (b) => {
                    try { await b.sock.newsletterVoteMessage(r.jid, String(r.post), opt.name); return true; }
                    catch { return false; }
                }));
                ok += res.filter(Boolean).length;
                fail += res.filter((x) => !x).length;
                ctx.progress(`CVOTE “${opt.name}” — ${ok}/${use.length}`, { done: ok + fail, total: use.length });
                if (i + 4 < use.length) await sleep(400);
            }
            ctx.progressEnd(`CVOTE — ${ok}/${use.length} voted`);
            await ctx.reply(`🗳️ *POLL VOTES SENT*\n\n📌 Poll : ${poll.name}\n✅ Option : ${idx}. ${opt.name}\n🤖 Voted : ${ok}/${use.length}${fail ? `\n⚠️ Failed : ${fail}` : ''}`);
        }
    }
];
