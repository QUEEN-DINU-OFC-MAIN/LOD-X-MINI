import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import config from '../../config.js';

export const BOT_NAME = config.botName;
export const POWERED = config.poweredBy;
export const SECTION_TITLE = config.listTitle;
export const FOOTER = config.footer;
export const footerLine = () => config.footerStyle.replace('{footer}', config.footer);

const SKIP = ['react', 'delete', 'edit', 'forward', 'pin', 'disappearingMessagesInChat', 'groupInvite', 'buttons', 'interactiveMessage', 'poll', 'contacts', 'location', 'sticker', 'audio', 'listMessage', 'templateButtons'];
const prettyUsage = (t) => t.replace(/^ℹ️ Usage: ?/, 'ℹ️ *Usage*\n\n✨ ').replace(/\n(Example|Examples|Styles|Tip)/g, '\n\n$1');
export function dress(jid, content) {
    if (!content || typeof content !== 'object' || /@newsletter$|status@broadcast$/.test(jid || '')) return content;
    if (SKIP.some((k) => k in content)) return content;
    const key = typeof content.text === 'string' ? 'text' : typeof content.caption === 'string' && (content.image || content.video || content.document) ? 'caption' : null;
    if (!key) return content;
    let t = content[key];
    if (key === 'text') t = prettyUsage(t);
    if (t.includes(config.footer)) return { ...content, [key]: t };
    return { ...content, [key]: `${t}${t ? '\n\n' : ''}${footerLine()}` };
}

const assets = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'themes');
export const THEMES = ['yellow', 'green', 'pink', 'blue'];
const _imgs = new Map();
const img = (t) => { if (!_imgs.has(t)) _imgs.set(t, readFileSync(path.join(assets, `${t}.jpg`))); return _imgs.get(t); };
export const menuImage = (theme = 'random') => img(THEMES.includes(theme) ? theme : THEMES[Math.floor(Math.random() * THEMES.length)]);

const menuDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'menu');
const _menuImgs = new Map();
const CAT_IMG = {
    main: 'main', download: 'download', search: 'search', fun: 'fun', ai: 'ai', aiimage: 'aiimage',
    education: 'education', tools: 'tools', sticker: 'sticker', media: 'media', group: 'group',
    privacy: 'privacy', channel: 'channel', reply: 'reply', settings: 'settings', movie: 'movie'
};
export function menuImageFor(cat = 'main') {
    const key = CAT_IMG[cat] || 'main';
    if (!_menuImgs.has(key)) {
        try { _menuImgs.set(key, readFileSync(path.join(menuDir, `${key}.jpg`))); }
        catch { _menuImgs.set(key, img('random')); }
    }
    return _menuImgs.get(key);
}
export function checkCategoryImages(cats) {
    const bad = []; const seen = new Map();
    for (const c of cats) {
        const key = CAT_IMG[c] || 'main';
        if (seen.has(key)) { bad.push(`${c} shares ${key}.jpg with ${seen.get(key)}`); continue; }
        seen.set(key, c);
        if (!existsSync(path.join(menuDir, `${key}.jpg`))) bad.push(`${c} -> missing ${key}.jpg`);
    }
    return bad;
}

export const CATS = [
    ['download', '📥', 'DOWNLOAD'], ['search', '🔎', 'SEARCH'], ['fun', '🎭', 'FUN'], ['ai', '🤖', 'AI'], ['aiimage', '🎨', 'AI IMAGE'], ['education', '🎓', 'EDUCATION'],
    ['tools', '🛠️', 'TOOLS'], ['sticker', '🖼️', 'STICKER'], ['media', '🎞️', 'MEDIA'], ['group', '👥', 'GROUP'],
    ['privacy', '🔐', 'PRIVACY'], ['channel', '📢', 'CHANNEL'], ['reply', '💬', 'AUTO-REPLY'], ['settings', '⚙️', 'SETTINGS'], ['movie', '🎬', 'MOVIE • SOON'], ['main', '🏠', 'MAIN']
];

export const CAT_EMOJI = Object.fromEntries(CATS.map(([k, i]) => [k, i]));
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

export function buildButtons({ prefix, quick, copy, sections, listLabel = '📂 Menu Options', listTitle = 'Click Here ❏', buttonMode = 'menu' }) {
    const out = (quick || []).map((q) => ({ buttonId: q.id, buttonText: { displayText: q.label }, type: 1 }));
    for (const c of copy || []) out.push({ text: c.label, code: c.code });
    if (sections?.length && buttonMode !== 'quick') {
        out.push({
            buttonId: 'action', buttonText: { displayText: listLabel }, type: 4,
            nativeFlowInfo: { name: 'single_select', paramsJson: JSON.stringify({ title: listTitle, sections }) }
        });
    }
    out.push({
        buttonId: 'web', buttonText: { displayText: '🌐 WEBSITE' }, type: 4,
        nativeFlowInfo: { name: 'cta_url', paramsJson: JSON.stringify({ display_text: '🌐 WEBSITE', url: config.webUrl }) }
    });
    return out;
}

export function commandSections(prefix, commands, { only } = {}) {
    const sections = [];
    for (const [cat, icon, label] of CATS) {
        if (only && only !== cat) continue;
        const list = commands.filter((c) => c.cat === cat && !c.hidden);
        chunk(list, 10).forEach((part, i, all) => sections.push({
            title: `${icon} ${label}${all.length > 1 ? ` ${i + 1}` : ''}`.slice(0, 24),
            highlight_label: '',
            rows: part.map((c) => ({ title: `${prefix}${c.name}`.slice(0, 24), description: (c.desc || '').slice(0, 72), id: `${prefix}${c.name}` }))
        }));
    }
    return sections;
}

export function categorySections(prefix, commands) {
    const rows = CATS.map(([key, icon, label]) => ({ key, icon, label, n: commands.filter((c) => c.cat === key && !c.hidden).length }))
        .filter((r) => r.n)
        .map((r) => ({ title: `${r.icon} ${r.label} MENU`.slice(0, 24), description: `${r.n} commands`, id: `${prefix}menu ${r.key}` }));
    return chunk(rows, 10).map((part, i) => ({ title: i ? `${SECTION_TITLE} • MORE`.slice(0, 24) : SECTION_TITLE, highlight_label: '', rows: part }));
}

export function textMenu({ prefix, commands, header }) {
    let t = `${header}\n`;
    for (const [cat, icon, label] of CATS) {
        const list = commands.filter((c) => c.cat === cat && !c.hidden);
        if (!list.length) continue;
        t += `\n╭──❮ ${icon} *${label}* ❯\n${list.map((c) => `│ ➤ ${prefix}${c.name}${c.ownerOnly ? ' 🔒' : ''}`).join('\n')}\n╰──────────────`;
    }
    return `${t}\n\n${footerLine()}`;
}

const NUM_FONTS = [
    ['𝟬','𝟭','𝟮','𝟯','𝟰','𝟱','𝟲','𝟳','𝟴','𝟵'],
    ['０','１','２','３','４','５','６','７','８','９'],
    ['𝟘','𝟙','𝟚','𝟛','𝟜','𝟝','𝟞','𝟟','𝟠','𝟡'],
    ['⓪','①','②','③','④','⑤','⑥','⑦','⑧','⑨'],
    ['𝟢','𝟣','𝟤','𝟥','𝟦','𝟧','𝟨','𝟩','𝟪','𝟫']
];
export const pickNumFont = () => NUM_FONTS[Math.floor(Math.random() * NUM_FONTS.length)];
const numIn = (font, n) => String(n).split('').map((d) => font[+d] || d).join('');
const numEmoji = (n) => numIn(NUM_FONTS[0], n);

export function numbered({ quick, sections }) {
    const map = {}, lines = [];
    let n = 0;
    for (const s of sections || []) {
        let first = true;
        for (const r of s.rows) {
            if (++n > 400) break;
            map[n] = r.id; lines.push({ n, title: r.title, desc: r.description, group: first && sections.length > 1 ? s.title : undefined }); first = false;
        }
    }
    for (const q of quick || []) { if (++n > 400) break; map[n] = q.id; lines.push({ n, title: q.label, group: null }); }
    return { map, lines };
}

export function textFromButtons({ text, copy, numbered: nb }) {
    let t = text;
    for (const c of copy || []) t += `\n\n📋 *${c.label}*\n${c.code}`;
    if (nb?.lines.length) {
        const font = pickNumFont();
        t += '\n\n╔══❖ *TAP OR REPLY* ❖══╗';
        for (const l of nb.lines) {
            if (l.group) t += `\n┠─❖ *${l.group}*`;
            t += `\n┃ ${numIn(font, l.n)}❯ ${l.title}`;
            if (l.desc && !/^\d+ commands$/.test(l.desc)) t += `\n┃      ↳ ${l.desc.slice(0, 40)}`;
        }
        t += '\n╚══❖❖❖❖❖❖❖❖❖❖❖❖╝\n↩️ _Reply with a number_';
    }
    return `${t}\n\n${footerLine()}`;
}
