export const DEFAULT_NAME = 'LOD X MINI 💚';
export const DEFAULT_FOOTER = 'FREE LOD CONNECTED > https://lodxmini.vercel.app';

export const DEFAULT_TEMPLATE = [
    '🎼  ─── ⋆⋅💖⋅⋆ ───  🎶',
    '',
    '   🎼  *ᴛɪᴛʟᴇ : {title}*',
    '',
    '              🎼  ─── ⋆⋅💖⋅⋆ ───  🎶',
    '',
    '  ─── ⋆⋅☆⋅⋆ ── 💿 ─── ⋆⋅☆⋅⋆ ───',
    '',
    '   .ılılılllıılılıllllıılılllıllıılılllı.',
    '',
    '   *⊚━━━━━━━━━━━━━━ {duration}*',
    '',
    '          *↻      ◁     ||     ▷       ↺*',
    '',
    '  ✨ *𝖤𝗇𝗃𝗈𝗒 𝖸𝗈𝗎𝗋 𝖬𝗎𝗌𝗂𝖼* 🎧',
    '',
    '🎼  ─── ⋆⋅💖⋅⋆ ───  🎶',
    '',
    '             *𝄞──────💘──────𝄞*',
    '',
    '> *{bot}',
    '{footer}*'
].join('\n');

export const TEMPLATE_PLACEHOLDERS = ['title', 'views', 'duration', 'ago', 'bot', 'footer'];

const clean = (v, max, fallback) => {
    const t = String(v ?? '').replace(/[\r\n\t*_~`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
    return t || fallback;
};

export const csongTail = (st = {}) => `> *${clean(st.csongName, 40, DEFAULT_NAME)}\n${clean(st.csongFooter, 120, DEFAULT_FOOTER)}*`;

export const csongCaption = (body, st) => `${String(body).trimEnd()}\n\n${csongTail(st)}`;

export const renderCsong = (st = {}, data = {}) => {
    const tpl = String(st?.csongTemplate ?? '').trim() || DEFAULT_TEMPLATE;
    const vals = {
        title: data.title ?? '—', views: data.views ?? '—', duration: data.duration ?? '—', ago: data.ago ?? '—',
        bot: clean(st?.botName, 40, DEFAULT_NAME), footer: clean(st?.csongFooter, 120, DEFAULT_FOOTER)
    };
    return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vals ? vals[k] : m)).slice(0, 2000);
};
