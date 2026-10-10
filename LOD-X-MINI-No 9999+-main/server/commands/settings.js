import { BOT_NAME } from '../lib/ui.js';
import { SCHEMA, sanitize } from '../../shared/panel-settings.js';
import { issuePanel, panelLink } from '../../shared/panel-auth.js';
import config from '../../config.js';

const onoff = (v) => (v ? 'on' : 'off');
const show = (v) => (v === true ? 'on' : v === false ? 'off' : String(v ?? '—'));

function groupedRows(ctx) {
    const s = ctx.runner.settings;
    const groups = new Map();
    for (const f of SCHEMA) {
        if (!groups.has(f.group)) groups.set(f.group, []);
        groups.get(f.group).push(`${f.key} ❯ ${show(s[f.key] !== undefined ? s[f.key] : null)}`);
    }
    let out = '';
    for (const [g, rows] of groups) out += `\n╭─❖ *${g.toUpperCase()}*\n${rows.map((r) => `┃ • ${r}`).join('\n')}\n╰──────────────`;
    return out;
}

async function panelAccess(ctx) {
    const r = ctx.runner;
    let password = r.meta?.panel?.password || null;
    if (!r.meta?.panel?.ver || !password) {
        const issued = issuePanel(r.meta?.panel?.ver || 0);
        await r.setPanel(issued.panel);
        password = issued.password;
    }
    const link = panelLink(config.webUrl, r.id, r.meta.panel.ver);
    return { link, password };
}

const panel = async (ctx, note = '') => {
    const s = ctx.runner.settings; const p = s.prefix;
    let access = { link: '', password: '' };
    try { access = await panelAccess(ctx); } catch (e) { ctx.runner?.l?.warn?.({ err: e.message }, 'panel access'); }
    const text = `${note ? `${note}\n\n` : ''}╭━━━❲ ${BOT_NAME} — SETTINGS ❳━━━❑\n 🙍 *${ctx.msg.pushName || 'Owner'}*\n┃ ⚙️  *${SCHEMA.length}* settings — all ${BOT_NAME} only\n╰━━━━━━━━━━━━━━━━━━━━━❑\n${groupedRows(ctx)}\n\n🌐 *WEB PANEL*\n┃ 🔗 ${access.link}\n┃ 🔑 Password : *${access.password}*\n┃ 📱 Number : *${ctx.runner.id}*\n╰──────────────\n\n✏️ Change any: *${p}set <key> <value>*\n   e.g. *${p}set mode private* · *${p}set react off*\n\n⚠️ Keep the link + password private — anyone with them can change your bot.`;
    await ctx.sendButtons({
        text, textOff: text,
        quick: [
            { id: `${p}mode ${s.mode === 'public' ? 'private' : 'public'}`, label: s.mode === 'public' ? '🔒 PRIVATE' : '🌐 PUBLIC' },
            { id: `${p}buttons ${s.buttons ? 'off' : 'on'}`, label: s.buttons ? '🔘 BUTTONS OFF' : '🔘 BUTTONS ON' },
            { id: `${p}menu`, label: '📜 MENU' }
        ],
        copy: access.link ? [{ label: '📋 COPY LINK', code: access.link }] : []
    });
};

const parseValue = (f, raw) => {
    if (f.type === 'bool') return ['on', 'true', 'yes', '1'].includes(raw) ? 'true' : ['off', 'false', 'no', '0'].includes(raw) ? 'false' : null;
    return raw;
};

export default [
    { name: 'settings', aliases: ['setting', 'config'], cat: 'settings', desc: 'Full bot settings panel', ownerOnly: true, run: (ctx) => panel(ctx) },
    {
        name: 'set', cat: 'settings', desc: 'Change any setting by key  (.set mode private)', ownerOnly: true,
        async run(ctx) {
            const key = (ctx.args[0] || '').toLowerCase();
            const field = SCHEMA.find((f) => f.key.toLowerCase() === key);
            if (!field) {
                const keys = SCHEMA.map((f) => f.key).join(', ');
                return ctx.reply(`❌ Unknown key *${ctx.args[0]}*\n\nValid keys:\n${keys}`);
            }
            const raw = ctx.args.slice(1).join(' ').toLowerCase();
            if (!raw) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}set ${field.key} <value>\nType: ${field.type}${field.options ? ` — one of: ${field.options.map(([o]) => o).join(', ')}` : ' (on|off)'}`);
            const value = parseValue(field, raw);
            if (field.type === 'bool' && value === null) return ctx.reply(`ℹ️ *${field.key}* needs on | off`);
            if (field.type === 'select' && !field.options.some(([o]) => o === raw)) return ctx.reply(`ℹ️ *${field.key}* must be one of: ${field.options.map(([o]) => o).join(', ')}`);
            const patch = sanitize({ [field.key]: field.type === 'bool' ? value : raw });
            if (!(field.key in patch)) return ctx.reply(`❌ Could not apply that value to *${field.key}*`);
            await ctx.runner.setSettings(patch);
            await panel(ctx, `✅ *${field.key}* → *${show(ctx.runner.settings[field.key])}*`);
        }
    },
    {
        name: 'setprefix', cat: 'settings', desc: 'Change the prefix  (.setprefix !)', ownerOnly: true,
        async run(ctx) {
            const p = ctx.args[0];
            if (!p || p.length > 3 || /[\s\w]/.test(p)) return ctx.reply(`Usage: ${ctx.prefix}setprefix !\n(1–3 symbols, no letters / digits)`);
            await ctx.runner.setSettings({ prefix: p });
            await ctx.reply(`✅ Prefix changed to *${p}*  →  use ${p}menu`);
        }
    },
    {
        name: 'mode', cat: 'settings', desc: 'public / private (private = only you)', ownerOnly: true,
        async run(ctx) {
            const v = ctx.args[0]?.toLowerCase();
            if (!['public', 'private'].includes(v)) return panel(ctx, `Usage: ${ctx.prefix}mode public|private`);
            await ctx.runner.setSettings({ mode: v });
            await panel(ctx, `✅ Mode → *${v}*`);
        }
    },
    {
        name: 'buttons', aliases: ['button'], cat: 'settings', desc: 'Buttons on/off (off = plain text menus)', ownerOnly: true,
        async run(ctx) {
            const v = ctx.args[0]?.toLowerCase();
            if (!['on', 'off'].includes(v)) return ctx.reply(`Usage: ${ctx.prefix}buttons on|off\n_If you only see "unsupported message" instead of buttons, turn this off._`);
            await ctx.runner.setSettings({ buttons: v === 'on' });
            await ctx.reply(`✅ Buttons *${v}*`);
        }
    },
    {
        name: 'menustyle', aliases: ['menustyles', 'menulayout'], cat: 'settings', desc: 'Choose swipe card or button-list menu', ownerOnly: true,
        async run(ctx) {
            const v = ctx.args[0]?.toLowerCase();
            if (!['swipe', 'list'].includes(v)) return ctx.sendButtons({
                text: `📋 *Menu style* : *${ctx.runner.settings.btnmode === 'swipe' ? 'swipe card' : 'button list'}*\\n\\nChoose how the main menu opens.`,
                quick: [{ id: `${ctx.prefix}menustyle swipe`, label: 'SWIPE CARD' }, { id: `${ctx.prefix}menustyle list`, label: 'BUTTON LIST' }]
            });
            await ctx.runner.setSettings({ btnmode: v, menuStyle: v === 'list' ? 'buttons' : 'carousel' });
            await ctx.reply(`✅ Menu style → *${v === 'swipe' ? 'SWIPE CARD' : 'BUTTON LIST'}*`);
        }
    },
    {
        name: 'restart', aliases: ['reboot'], cat: 'settings', desc: 'Reconnect this bot', ownerOnly: true,
        async run(ctx) { await ctx.reply('♻️ Reconnecting…'); setTimeout(() => ctx.runner.reconnect('owner-request'), 500); }
    }
];
