const MAX_RULES = 50;
const owner = { cat: 'reply', ownerOnly: true };

export default [
    {
        ...owner, name: 'addreply', desc: 'Add keyword auto-reply  (.addreply hi|Hello!)',
        async run(ctx) {
            const i = ctx.text.indexOf('|');
            const key = ctx.text.slice(0, i).trim().toLowerCase(); const val = ctx.text.slice(i + 1).trim();
            if (i < 1 || !val || key.length > 60 || val.length > 700) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}addreply hi|Hello! How can I help?\n(replies only in private chats)`);
            let full = false;
            await ctx.runner.setReplies((r) => { if (!(key in r) && Object.keys(r).length >= MAX_RULES) full = true; else r[key] = val; return r; });
            await ctx.reply(full ? `❌ Limit is ${MAX_RULES} rules.` : `✅ When someone sends *${key}* I will reply.`);
        }
    },
    {
        ...owner, name: 'delreply', desc: 'Remove an auto-reply  (.delreply hi)',
        async run(ctx) {
            const key = ctx.text.trim().toLowerCase(); let had = false;
            if (!key) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}delreply hi`);
            await ctx.runner.setReplies((r) => { had = key in r; delete r[key]; return r; });
            await ctx.reply(had ? '🗑️ Removed.' : '❌ No such rule.');
        }
    },
    {
        ...owner, name: 'listreply', desc: 'List all auto-replies',
        async run(ctx) {
            const r = ctx.runner.meta?.replies || {}; const k = Object.keys(r);
            if (!k.length) return ctx.reply(`💬 No auto-replies yet.\n${ctx.prefix}addreply hi|Hello!`);
            await ctx.sendButtons({
                text: `💬 *Auto-replies* (${k.length})\n\n${k.map((x) => `▫️ *${x}* → ${r[x].slice(0, 50)}`).join('\n')}`,
                quick: [{ id: `${ctx.prefix}menu reply`, label: '⬅️ BACK' }]
            });
        }
    }
];
