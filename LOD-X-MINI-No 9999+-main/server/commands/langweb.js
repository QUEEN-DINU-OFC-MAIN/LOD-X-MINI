import config from '../../config.js';
import { issuePanel, panelLink } from '../../shared/panel-auth.js';
import { LANGS } from '../../shared/panel-settings.js';
import { resolveLang, LANG_CODES, LANG_NAMES } from '../../shared/i18n.js';

const NAME_TO_CODE = Object.fromEntries(LANGS.flatMap(([c, n]) => [[c, c], [n.toLowerCase(), c]]));
Object.assign(NAME_TO_CODE, { sinhala: 'si', tamil: 'ta', hindi: 'hi', bengali: 'bn', urdu: 'ur', arabic: 'ar', indonesian: 'id', malay: 'ms', spanish: 'es', portuguese: 'pt', french: 'fr', german: 'de', russian: 'ru', turkish: 'tr', nepali: 'ne', thai: 'th', vietnamese: 'vi', italian: 'it', english: 'en' });

export default [
    {
        name: 'lang', aliases: ['language', 'bhasha'], cat: 'settings', ownerOnly: true, noTranslate: true, react: '🗣️',
        desc: 'Bot language  (.lang si | .lang en | .lang auto)',
        async run(ctx) {
            const cur = ctx.settings.lang || 'auto';
            const arg = ctx.args.join(' ').trim().toLowerCase();
            if (!arg) {
                const rows = LANG_CODES.map((c) => ({ title: LANG_NAMES[c], description: `${ctx.prefix}lang ${c}`, id: `${ctx.prefix}lang ${c}` }));
                return ctx.sendButtons({
                    text: `🗣️ *BOT LANGUAGE*\n\nNow : *${cur === 'auto' ? `Automatic → ${LANG_NAMES[ctx.runner.lang]}` : LANG_NAMES[cur]}*\n\nAutomatic follows the country of your number. Pick any language below — English is always available.\n\n👇 Tap *Languages*`,
                    textOff: `🗣️ *BOT LANGUAGE*\n\nNow : *${cur === 'auto' ? `Automatic → ${LANG_NAMES[ctx.runner.lang]}` : LANG_NAMES[cur]}*\n\nUse ${ctx.prefix}lang <code>\nCodes: ${LANG_CODES.join(', ')}  (or auto)`,
                    quick: [{ id: `${ctx.prefix}lang auto`, label: '🌍 AUTO' }, { id: `${ctx.prefix}lang en`, label: '🇬🇧 ENGLISH' }, { id: `${ctx.prefix}lang si`, label: '🇱🇰 සිංහල' }],
                    sections: [{ title: 'Languages', rows }], listLabel: '🗣️ Languages', listTitle: 'Choose language', header: false
                });
            }
            const code = NAME_TO_CODE[arg];
            if (!code) return ctx.reply(`❌ Unknown language "${arg}". Send ${ctx.prefix}lang to see the list.`);
            await ctx.runner.setSettings({ lang: code });
            const now = resolveLang(code, ctx.runner.id);
            const done = { si: '✅ භාෂාව *සිංහල* ලෙස වෙනස් කළා.', en: '✅ Language set to *English*.' }[now];
            const { translateText } = await import('../../shared/i18n.js');
            await ctx.sock.sendMessage(ctx.jid, { text: done || await translateText(`✅ Language changed. The bot will now talk in ${LANG_NAMES[now]}.`, now, { budgetMs: 5000 }) });
        }
    },
    {
        name: 'web', aliases: ['panel', 'dashboard'], cat: 'settings', ownerOnly: true, noTranslate: true, react: '🌐', selfOnly: true,
        desc: 'Your settings web panel link (no password)  ·  .web new = reset',
        async run(ctx) {
            if (!ctx.isSelf) return;
            if (ctx.isGroup) return ctx.reply('🔒 Please send this command in your private chat (or "Message yourself") — it contains your private link.');
            const r = ctx.runner;
            const fresh = ctx.args[0]?.toLowerCase() === 'new';
            let password = null;
            if (fresh || !r.meta?.panel) {
                const issued = issuePanel(r.meta?.panel?.ver || 0);
                await r.setPanel(issued.panel);
                if (fresh) password = issued.password;
            }
            const link = panelLink(config.webUrl, r.id, r.meta.panel.ver);
            const text = [
                `🌐 *${ctx.settings.botName} — SETTINGS PANEL*`,
                '',
                password ? '♻️ Your panel access was *reset*. Every old link and password has stopped working.' : '✅ Tap the link below — no password needed.',
                '',
                `🔗 ${link}`,
                ...(password ? ['', `📱 Number : *${r.id}*`, `🔑 New password : *${password}*`, `🌐 ${config.webUrl}/panel`] : []),
                '',
                '⚠️ Keep this private — anyone with the link can change your bot settings.',
                `♻️ \`${ctx.prefix}web new\` gives you a fresh link + password.`
            ].join('\n');
            await ctx.sendButtons({ text, header: false, quick: [{ id: `${ctx.prefix}web new`, label: '♻️ NEW LINK' }, { id: `${ctx.prefix}menu`, label: '📜 MENU' }], copy: [{ label: '📋 COPY LINK', code: link }].slice(0, 1) });
        }
    }
];
