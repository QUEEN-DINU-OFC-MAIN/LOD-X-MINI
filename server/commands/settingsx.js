import { THEMES } from '../lib/ui.js';
const owner = { cat: 'settings', ownerOnly: true };
const toggle = (name, key, desc, extra = '') => ({
    ...owner, name, desc: `${desc}  on|off`,
    async run(ctx) {
        const v = ctx.args[0]?.toLowerCase();
        if (!['on', 'off'].includes(v)) return ctx.sendButtons({ text: `⚙️ *${name}* is *${ctx.runner.settings[key] ? 'on' : 'off'}*${extra}`, quick: [{ id: `${ctx.prefix}${name} on`, label: '✅ ON' }, { id: `${ctx.prefix}${name} off`, label: '⛔ OFF' }] });
        await ctx.runner.setSettings({ [key]: v === 'on' });
        if (key === 'online') ctx.sock.sendPresenceUpdate(v === 'on' ? 'available' : 'unavailable').catch(() => {});
        await ctx.reply(`✅ ${name} → *${v}*`);
    }
});

export default [
    toggle('online', 'online', 'Always-online presence'),
    toggle('typing', 'typing', 'Show "typing…" before replies'),
    toggle('recording', 'recording', 'Show "recording…" before audio'),
    toggle('react', 'react', 'Emoji reactions on commands'),
    toggle('hearts', 'hearts', 'React to every chat message with a random emoji'),
    toggle('autovo', 'autovo', 'Auto-forward every view-once media to your chat (no command needed)'),
    toggle('autoreadstatus', 'autoreadstatus', "Auto-read contacts' statuses"),
    {
        ...owner, name: 'theme', aliases: ['logo'], desc: 'Menu logo colour  (yellow|green|pink|blue|random)',
        async run(ctx) {
            const v = ctx.args[0]?.toLowerCase();
            if (![...THEMES, 'random'].includes(v)) {
                return ctx.sendButtons({
                    text: `🎨 *Menu theme* : ${ctx.runner.settings.theme}\n\nPick a logo colour:`,
                    quick: [{ id: `${ctx.prefix}theme yellow`, label: '🟡 YELLOW' }, { id: `${ctx.prefix}theme green`, label: '🟢 GREEN' }, { id: `${ctx.prefix}theme pink`, label: '🩷 PINK' }],
                    sections: [{ title: 'THEMES', highlight_label: '', rows: [...THEMES, 'random'].map((t) => ({ title: t.toUpperCase(), description: 'Menu & alive logo', id: `${ctx.prefix}theme ${t}` })) }],
                    listLabel: '🎨 All themes', listTitle: 'Themes'
                });
            }
            await ctx.runner.setSettings({ theme: v });
            await ctx.sock.sendMessage(ctx.jid, { image: ctx.menuImage(), caption: `✅ Theme → *${v}*` }, { quoted: ctx.msg });
        }
    },
    {
        ...owner, name: 'setbotname', aliases: ['botname'], desc: 'Bot name shown in menus  (.setbotname MY BOT)',
        async run(ctx) {
            if (!ctx.text || ctx.text.length > 30) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}setbotname MY BOT  (max 30 chars)`);
            await ctx.runner.setSettings({ botName: ctx.text.trim() });
            await ctx.reply(`✅ Bot name → *${ctx.text.trim()}*`);
        }
    }
];
