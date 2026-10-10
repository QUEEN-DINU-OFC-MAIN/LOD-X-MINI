import { DEFAULT_NAME, DEFAULT_FOOTER } from '../lib/csong.js';

const owner = { cat: 'settings', ownerOnly: true, noTranslate: true };

const textSetting = (name, key, desc, label, max, fallback) => ({
    ...owner, name, desc, react: '✏️',
    async run(ctx) {
        const v = ctx.text.replace(/[\r\n\t*_~`]/g, ' ').trim().slice(0, max);
        if (!v) return ctx.reply(`ℹ️ ${label}: *${ctx.settings[key] || fallback}*\n\nChange it: ${ctx.prefix}${name} your text\nReset: ${ctx.prefix}${name} reset`);
        if (v.toLowerCase() === 'reset') { await ctx.runner.setSettings({ [key]: '' }); return ctx.reply(`✅ ${label} reset.`); }
        await ctx.runner.setSettings({ [key]: v });
        await ctx.reply(`✅ ${label} → *${v}*`);
    }
});

export default [
    textSetting('csongname', 'csongName', 'Name line at the end of .csong captions', 'Channel song name', 40, DEFAULT_NAME),
    textSetting('csongfooter', 'csongFooter', 'Footer line (link) of .csong captions', 'Channel song footer', 120, DEFAULT_FOOTER),
    {
        ...owner, devOnly: true, name: 'autopost', desc: 'One-time welcome status on connect  on|off (developers only)', react: '📣',
        async run(ctx) {
            const v = ctx.args[0]?.toLowerCase();
            if (!['on', 'off'].includes(v)) return ctx.reply(`ℹ️ The bot posts one welcome status the first time it connects.\nNow: *${ctx.settings.autopost === false ? 'off' : 'on'}*\n\nUse ${ctx.prefix}autopost on|off`);
            await ctx.runner.setSettings({ autopost: v === 'on' });
            await ctx.reply(`✅ Welcome status post → *${v}*`);
        }
    },
    {
        ...owner, name: 'statusreply', desc: 'Auto-reply to statuses  off|text|voice|both', react: '💬',
        async run(ctx) {
            const v = ctx.args[0]?.toLowerCase();
            if (!['off', 'text', 'voice', 'both'].includes(v)) return ctx.reply(`ℹ️ Status auto-reply: *${ctx.settings.statusreply}*\n\n${ctx.prefix}statusreply off|text|voice|both\nChange the text or upload a voice note in your settings panel (${ctx.prefix}web).`);
            await ctx.runner.setSettings({ statusreply: v });
            await ctx.reply(`✅ Status auto-reply → *${v}*`);
        }
    },
    {
        ...owner, name: 'autoreactstatus', aliases: ['statusreact'], desc: 'Heart every status you view  on|off', react: '💚',
        async run(ctx) {
            const v = ctx.args[0]?.toLowerCase();
            if (!['on', 'off'].includes(v)) return ctx.reply(`ℹ️ Status auto-react: *${ctx.settings.autoreactstatus ? 'on' : 'off'}*\nUse ${ctx.prefix}autoreactstatus on|off`);
            await ctx.runner.setSettings({ autoreactstatus: v === 'on' });
            await ctx.reply(`✅ Status auto-react → *${v}*`);
        }
    },
    {
        ...owner, name: 'statussend', desc: 'Send my status to anyone who replies "send"  on|off', react: '📤',
        async run(ctx) {
            const v = ctx.args[0]?.toLowerCase();
            if (!['on', 'off'].includes(v)) return ctx.reply(`ℹ️ Status send: *${ctx.settings.statussend ? 'on' : 'off'}*\nWhen someone replies to your status with "send", they get that status.\nUse ${ctx.prefix}statussend on|off`);
            await ctx.runner.setSettings({ statussend: v === 'on' });
            await ctx.reply(`✅ Status send → *${v}*`);
        }
    }
];
