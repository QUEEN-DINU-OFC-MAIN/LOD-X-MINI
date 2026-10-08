import os from 'node:os';
import { BOT_NAME, POWERED, FOOTER, commandSections, categorySections, textMenu, CATS, menuImageFor } from '../lib/ui.js';
import { sendCarouselMenu } from '../lib/menu.js';

const all = (ctx) => [...ctx.platform.commands.unique()].filter((c) => !c.ownerMenu || ctx.isSelf).sort((a, b) => a.name.localeCompare(b.name));
const mb = (n) => `${(n / 1048576).toFixed(0)} MB`;
const greet = () => { const h = (new Date().getUTCHours() + 5.5 + 24) % 24; return h < 12 ? 'Good Morning 🌅' : h < 17 ? 'Good Afternoon ☀️' : h < 20 ? 'Good Evening 🌇' : 'Good Night 🌙'; };

const header = (ctx) => {
    const NAME = ctx.settings.botName || BOT_NAME;
    const cmds = all(ctx);
    return `╭━━━━❮ *${NAME}* ❯━━━━╮
┃
┃ 👋 ${greet()}
┃ 🙍 *${ctx.msg.pushName || 'User'}*
┃
┃ 🔰 Prefix   ➜  *${ctx.prefix}*
┃ 🌐 Mode     ➜  *${ctx.settings.mode}*
┃ 🔘 Buttons  ➜  *${ctx.settings.buttons ? 'on' : 'off'}*
┃ ⏱️ Uptime   ➜  *${ctx.runner.uptime()}*
┃ 📦 Commands ➜  *${cmds.length}*
┃
╰━━━━━━━━━━━━━━━━━━━━╯`;
};

export default [
    {
        name: 'menu', aliases: ['help', 'start'], cat: 'main', desc: 'Main menu with buttons',
        async run(ctx) {
            const cmds = all(ctx);
            const isCat = CATS.some(([c]) => c === ctx.args[0]?.toLowerCase());
            if (!ctx.settings.buttons && !isCat) {
                return ctx.sendButtons({
                    text: `${header(ctx)}\n\n👇 Reply a number to open a category.`,
                    textOff: header(ctx),
                    image: ctx.menuImage(),
                    sections: categorySections(ctx.prefix, cmds),
                    listLabel: '📂 Menu Options', listTitle: 'Click Here ❏'
                });
            }
            if (!isCat && ctx.settings.btnmode === 'swipe' && ctx.settings.cardmenu !== false) {
                try { return await sendCarouselMenu(ctx); }
                catch (e) { }
            }
            const cat = CATS.find(([c]) => c === ctx.args[0]?.toLowerCase());
            if (cat) {
                const [key, icon, label] = cat;
                const list = cmds.filter((c) => c.cat === key && !c.hidden);
                return ctx.sendButtons({
                    text: `╭──❮ ${icon} *${label} MENU* ❯──╮\n┃\n┃ 📦 *${list.length}* commands\n┃\n${list.map((c) => `┃ ➤ *${ctx.prefix}${c.name}*${c.ownerOnly ? ' 🔒' : ''}\n┃     ↳ _${c.desc.slice(0, 48)}_`).join('\n┃\n')}\n┃\n╰──────────────╯\n Tap or reply a number.`,
                    textOff: `╭──❮ ${icon} *${label} MENU* ❯──╮\n┃ 📦 *${list.length}* commands\n╰──────────────╯`,
                    image: ctx.menuImage(), header: false,
                    quick: [{ id: `${ctx.prefix}menu`, label: '⬅️ MAIN MENU' }],
                    sections: commandSections(ctx.prefix, cmds, { only: key }),
                    listLabel: `${icon} ${label}`, listTitle: `${label} Commands`
                });
            }
            await ctx.sendButtons({
                text: `${header(ctx)}\n\n${CATS.map(([, i, l]) => `${i} ${l}`).join('   ')}\n\n👇 Tap *Menu Options* to open a category.`,
                textOff: header(ctx), image: ctx.menuImage(),
                quick: [{ id: `${ctx.prefix}alive`, label: '🟢 ALIVE' }, { id: `${ctx.prefix}owner`, label: '👑 OWNER' }],
                sections: categorySections(ctx.prefix, cmds),
                listLabel: '📂 Menu Options', listTitle: 'Click Here ❏'
            });
        }
    },
    {
        name: 'menu2', aliases: ['textmenu', 'allmenu', 'list'], cat: 'main', desc: 'Plain-text menu (no buttons)',
        async run(ctx) { await ctx.sock.sendMessage(ctx.jid, { image: ctx.menuImage(), caption: textMenu({ prefix: ctx.prefix, commands: all(ctx), header: header(ctx) }) }, { quoted: ctx.msg }); }
    },
    {
        name: 'alive', aliases: ['bot'], cat: 'main', desc: 'Check bot status',
        async run(ctx) {
            await ctx.sendButtons({
                text: `╭━━━❲ ${BOT_NAME} ❳━━━❑
┃
┃ 🟢 *ONLINE & AWAKE*
┃
 ⏱️ ᴘᴛɪᴍᴇ  ❯  *${ctx.runner.uptime()}*
┃ 🔰 ʀᴇɪx  ❯  *${ctx.prefix}*
┃ 🌐 ᴍᴏᴇ    ❯  *${ctx.settings.mode.toUpperCase()}*
┃ 📦 ᴄᴍᴅꜱ    ❯  *${[...ctx.platform.commands.unique()].length}*
┃
╰━━━━━━━━━━━━━━━❑

⚡ *${POWERED}*`,
                image: menuImageFor('main'), header: false,
                quick: [{ id: `${ctx.prefix}menu`, label: '📜 MENU' }, { id: `${ctx.prefix}ping`, label: '🏓 PING' }, { id: `${ctx.prefix}owner`, label: '👑 OWNER' }]
            });
        }
    },
    {
        name: 'ping', aliases: ['speed'], cat: 'main', desc: 'Latency check',
        async run(ctx) {
            const t = Math.max(0, Date.now() - Number(ctx.msg.messageTimestamp) * 1000);
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            const frames = ['◍○○○○', '◍◍○○○', '◍◍◍○○', '◍◍◍◍○', '◍◍◍◍◍'];
            const out = await ctx.sock.sendMessage(ctx.jid, { text: frames[0] }, { quoted: ctx.msg }).catch(() => null);
            for (const f of frames.slice(1)) {
                await sleep(260);
                if (out?.key) await ctx.sock.sendMessage(ctx.jid, { text: f, edit: out.key }).catch(() => {});
            }
            await sleep(220);
            const final = `🏓 *Pong!*  ${t} ms`;
            if (out?.key) await ctx.sock.sendMessage(ctx.jid, { text: final, edit: out.key }).catch(() => {});
            else await ctx.reply(final);
        }
    },
    {
        name: 'owner', aliases: ['creator'], cat: 'main', desc: 'Bot owner contact',
        async run(ctx) {
            const n = ctx.ownerNumber;
            const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${BOT_NAME} Owner\nTEL;type=CELL;type=VOICE;waid=${n}:+${n}\nEND:VCARD`;
            await ctx.sock.sendMessage(ctx.jid, { contacts: { displayName: `${BOT_NAME} Owner`, contacts: [{ vcard }] } }, { quoted: ctx.msg });
            await ctx.sendButtons({ text: `👑 *Owner* : +${n}\nhttps://wa.me/${n}`, quick: [{ id: `${ctx.prefix}menu`, label: '📜 MENU' }] });
        }
    },
    { name: 'runtime', aliases: ['uptime'], cat: 'main', desc: 'Bot uptime', async run(ctx) { await ctx.reply(`⏱️ *Uptime* : ${ctx.runner.uptime()}`); } },
    {
        name: 'system', aliases: ['botinfo', 'sysinfo'], cat: 'main', desc: 'Server / bot info',
        async run(ctx) {
            const m = process.memoryUsage();
            await ctx.reply(`🖥️ *${BOT_NAME} — System*\n\n▫️ Node : ${process.version}\n▫️ Platform : ${os.platform()} ${os.arch()}\n▫️ RAM (process) : ${mb(m.rss)}\n▫️ Heap : ${mb(m.heapUsed)}\n▫️ Sessions on this worker : ${ctx.platform.sessionCount?.() ?? '-'}\n▫️ Commands : ${all(ctx).length}\n▫️ Uptime : ${ctx.runner.uptime()}\n\n_${FOOTER}_`);
        }
    },
    { name: 'jid', aliases: ['id'], cat: 'main', desc: 'Show chat / sender JID', async run(ctx) { await ctx.reply(`💬 Chat : ${ctx.jid}\n👤 Sender : ${ctx.sender}`); } },
    {
        name: 'bots', aliases: ['activebots', 'botcount', 'livebots'], cat: 'main', desc: 'How many bots are live right now',
        async run(ctx) {
            const beats = (await ctx.runner.store.listStats()).filter((b) => Date.now() - b.at < 120_000);
            const open = beats.reduce((n, b) => n + (b.states?.open || 0), 0);
            await ctx.reply(`🤖 *${BOT_NAME}* — live bots : *${open}*\n🖥️ Workers online : ${beats.length}`);
        }
    },
    {
        name: 'search', aliases: ['find', 'cmd'], cat: 'main', desc: 'Search bot commands  (.search song)',
        async run(ctx) {
            const q = ctx.text.toLowerCase();
            if (!q) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}search song`);
            const hits = all(ctx).filter((c) => !c.hidden && `${c.name} ${c.aliases?.join(' ')} ${c.desc}`.toLowerCase().includes(q)).slice(0, 10);
            if (!hits.length) return ctx.reply('❌ No command found');
            await ctx.sendButtons({
                text: `🔎 *${hits.length}* result(s) for "${q}"`,
                sections: [{ title: 'RESULTS', highlight_label: '', rows: hits.map((c) => ({ title: `${ctx.prefix}${c.name}`.slice(0, 24), description: c.desc.slice(0, 72), id: `${ctx.prefix}${c.name}` })) }],
                listLabel: '🔎 Results', listTitle: 'Commands'
            });
        }
    },
    {
        name: 'testbuttons', cat: 'main', desc: 'Test whether buttons render on your WhatsApp',
        async run(ctx) {
            await ctx.sendButtons({
                text: '🔘 Button test — tap one below:',
                quick: [{ id: `${ctx.prefix}menu`, label: '📋 Menu' }, { id: `${ctx.prefix}ping`, label: '🏓 Ping' }, { id: `${ctx.prefix}alive`, label: 'ℹ️ About' }]
            });
        }
    }
];
