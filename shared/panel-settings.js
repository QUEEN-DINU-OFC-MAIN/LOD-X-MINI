import config from '../config.js';

const bool = (key, label, desc, group) => ({ key, label, desc, group, type: 'bool' });
const select = (key, label, desc, group, options) => ({ key, label, desc, group, type: 'select', options });

const STATIC_DEFAULTS = {
    prefix: '.',
    mode: 'public',
    buttons: false,
    btntext: false,
    btnmode: 'swipe',
    menuStyle: 'carousel',
    cardmenu: true,
    theme: 'random',
    react: true,
    typing: false,
    recording: false,
    online: false,
    aireply: 'off',
    hearts: false,
    autovo: true,
    antidelete: 'off',
    antiedit: 'off',
    autoreadstatus: true,
    autoreactstatus: true,
    reactEmojis: '',
    statusreply: 'off',
    statusreplytext: 'Thanks for sharing!',
    statussend: false,
    autopost: true,
    autofollow: true,
    csongName: '',
    csongTemplate: '',
    csongFooter: ''
};

export const defaultSettings = () => ({ ...STATIC_DEFAULTS, lang: config.defaultLang, botName: config.botName });
const text = (key, label, desc, group, max) => ({ key, label, desc, group, type: 'text', max });
const area = (key, label, desc, group, max) => ({ key, label, desc, group, type: 'textarea', max });
const soon = (f) => ({ ...f, soon: true });

export const LANGS = [
    ['auto', 'Automatic (by my number)'], ['en', 'English'], ['si', 'සිංහල'], ['ta', 'தமிழ்'], ['hi', 'हिन्दी'], ['bn', 'বাংলা'], ['ur', 'اردو'],
    ['ar', 'العربية'], ['id', 'Bahasa Indonesia'], ['ms', 'Bahasa Melayu'], ['es', 'Español'], ['pt', 'Português'], ['fr', 'Français'],
    ['de', 'Deutsch'], ['ru', 'Русский'], ['tr', 'Türkçe'], ['ne', 'नेपाली'], ['th', 'ไทย'], ['vi', 'Tiếng Việt'], ['it', 'Italiano']
];

export const SCHEMA = [
    text('botName', 'Bot name', 'Shown in the menu header', 'General', 24),
    text('prefix', 'Command prefix', 'The symbol before every command, e.g. .', 'General', 3),
    select('lang', 'Language', 'Language of every bot message', 'General', LANGS.map(([v, l]) => [v, l])),
    select('mode', 'Who can use the bot', 'Public = everyone, Private = only you', 'General', [['public', 'Public – everyone'], ['private', 'Private – only me']]),
    bool('buttons', 'Buttons', 'Off = numbered menus (reply with a number)', 'Look & feel'),
    bool('btntext', 'Button text fallback', 'Also send the choices as a numbered text list, so iOS / PC users who cannot see buttons can still reply', 'Look & feel'),
    select('btnmode', 'Button mode', 'Choose the menu/button layout', 'Look & feel', [['swipe', 'Swipe card'], ['list', 'Button list'], ['menu', 'Menu button + quick reply'], ['quick', 'Quick-reply buttons only']]),
    select('menuStyle', 'Menu layout', 'Carousel = swipeable image cards, Buttons = classic list', 'Look & feel', [['carousel', 'Carousel cards'], ['buttons', 'Button list']]),
    bool('cardmenu', 'Swipe card menu', 'Show .menu as swipeable image cards (needs Buttons on). Off = button / numbered list', 'Look & feel'),
    select('theme', 'Menu picture', 'Colour of the menu picture', 'Look & feel', [['random', 'Random'], ['yellow', 'Yellow'], ['green', 'Green'], ['pink', 'Pink'], ['blue', 'Blue']]),
    bool('react', 'Reactions', 'React to commands with an emoji', 'Look & feel'),
    bool('online', 'Always online', 'Show as online', 'Presence'),
    bool('typing', 'Typing…', 'Show typing while working', 'Presence'),
    bool('recording', 'Recording…', 'Show recording while downloading songs', 'Presence'),
    select('aireply', 'AI auto-reply', 'AI persona answers every private message (remembers each user)', 'Smart', [['off', 'Off'], ['girl', 'Girl — warm & caring'], ['boy', 'Boy — caring & protective'], ['play', 'Play — playful best friend']]),
    bool('hearts', 'Heart reactions', 'React to every chat message with a random emoji', 'Smart'),
    bool('autovo', 'Anti view-once', 'Auto-forward view-once media to your chat', 'Protection'),
    select('antidelete', 'Anti-delete', 'Recover deleted messages', 'Protection', [['off', 'Off'], ['me', 'Send to my chat'], ['chat', 'Same chat'], ['both', 'Both']]),
    select('antiedit', 'Anti-edit', 'Show the original of edited messages', 'Protection', [['off', 'Off'], ['me', 'Send to my chat'], ['chat', 'Same chat'], ['both', 'Both']]),
    bool('autoreadstatus', 'Auto-view status', 'View contacts\u2019 statuses automatically', 'Status'),
    bool('autoreactstatus', 'Auto-react to status', 'Heart every status you view', 'Status'),
    text('reactEmojis', 'Reaction emoji set', 'Random emoji used for status hearts and channel auto-reactions (space separated)', 'Status', 240),
    select('statusreply', 'Status auto-reply', 'Reply to a status with text, a voice note or both', 'Status', [['off', 'Off'], ['text', 'Text'], ['voice', 'Voice note'], ['both', 'Text + voice']]),
    area('statusreplytext', 'Status reply text', 'Sent with the footer. Voice notes are uploaded below', 'Status', 200),
    bool('statussend', 'Send my status on request', 'When someone replies to your status with \u201csend\u201d, they get that status', 'Status'),
    text('csongName', 'Channel song name', 'Name line at the end of .csong captions', 'Channel songs', 40),
    area('csongTemplate', 'Channel song message (.csong)', 'The FULL caption posted with your channel songs. Placeholders: {title} {views} {duration} {ago} {bot} {footer} — leave empty for the music-player design', 'Channel songs', 1500),
    text('csongFooter', 'Channel song footer', 'Link or text under the name (.csong)', 'Channel songs', 120)
];

const BY_KEY = Object.fromEntries(SCHEMA.map((f) => [f.key, f]));

export function sanitize(patch) {
    const out = {};
    for (const [k, v] of Object.entries(patch || {})) {
        const f = BY_KEY[k];
        if (!f) continue;
        if (f.soon) continue;
        if (f.type === 'bool') out[k] = v === true || v === 'true';
        else if (f.type === 'select') { if (f.options.some(([o]) => o === v)) out[k] = v; }
        else if (f.type === 'text' || f.type === 'textarea') {
            const t = String(v ?? '').replace(f.type === 'text' ? /[\r\n\t*_~`]/g : /[\r\t]/g, ' ').trim().slice(0, f.max);
            if (!t && !(f.max >= 40)) continue;
            if (k === 'prefix' && /[\w\s]/.test(t)) continue;
            out[k] = t;
        }
    }
    return out;
}
