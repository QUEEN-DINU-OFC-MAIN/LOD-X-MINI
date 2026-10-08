import { LANGS } from './panel-settings.js';

export const LANG_CODES = LANGS.map(([c]) => c).filter((c) => c !== 'auto');
export const LANG_NAMES = Object.fromEntries(LANGS);

const COUNTRY = {
    94: 'si', 91: 'hi', 92: 'ur', 880: 'bn', 977: 'ne', 62: 'id', 60: 'ms', 66: 'th', 84: 'vi', 39: 'it',
    971: 'ar', 966: 'ar', 20: 'ar', 212: 'ar', 213: 'ar', 216: 'ar', 218: 'ar', 249: 'ar', 964: 'ar', 962: 'ar', 961: 'ar', 965: 'ar', 968: 'ar', 974: 'ar', 973: 'ar', 967: 'ar', 963: 'ar', 970: 'ar',
    34: 'es', 52: 'es', 54: 'es', 56: 'es', 57: 'es', 58: 'es', 51: 'es', 593: 'es', 591: 'es', 595: 'es', 598: 'es', 502: 'es', 503: 'es', 504: 'es', 505: 'es', 506: 'es', 507: 'es',
    55: 'pt', 351: 'pt', 244: 'pt', 258: 'pt', 33: 'fr', 32: 'fr', 225: 'fr', 221: 'fr', 237: 'fr', 243: 'fr', 49: 'de', 43: 'de', 41: 'de', 7: 'ru', 375: 'ru', 998: 'ru', 996: 'ru', 90: 'tr'
};

export function langFromNumber(number) {
    const n = String(number || '').replace(/\D/g, '');
    for (const len of [3, 2, 1]) { const l = COUNTRY[n.slice(0, len)]; if (l) return l; }
    return 'en';
}

export function resolveLang(setting, number) {
    const s = String(setting || 'auto').toLowerCase();
    return s !== 'auto' && LANG_CODES.includes(s) ? s : langFromNumber(number);
}

const STOP = new Set(['whatsapp', 'youtube', 'tiktok', 'facebook', 'instagram', 'twitter', 'spotify', 'telegram', 'google', 'gemini', 'openai', 'chatgpt', 'github', 'node', 'ram', 'cpu', 'mp3', 'mp4', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'url', 'api', 'qr', 'ai', 'vip', 'id', 'ok', 'hd', 'sd', 'rcd', 'mini', 'nexus', 'legacy', 'dexter', 'baileys', 'pm2', 'ffmpeg', 'sinhala', 'english', 'wifi', 'sms', 'otp', 'gb', 'mb', 'kb', 'rcd x md', 'rcd x mini', 'md', 'free', 'connected', 'free rcd connected']);
const SMALL = new Set(['of', 'the', 'and', 'a', 'an', 'in', 'on', 'to', 'for', 'at', 'by', 'with', 'x', 'vs', 'feat', 'ft', 'from', 'is']);
const TARGET_LATIN = new Set(['en', 'id', 'ms', 'es', 'pt', 'fr', 'de', 'tr', 'it', 'vi']);

const CHUNK = /[A-Za-z][A-Za-z0-9'\u2019]*(?:(?:[ ]+|[ ]?[,;!?&\-\u2013()/]+[ ]?)[A-Za-z0-9][A-Za-z0-9'\u2019]*)*[.!?\u2026]*/g;
const PROTECT = [/^>.*$/gm, /`[^`\n]*`/g, /https?:\/\/\S+/g, /(?<![\w])[.#/!$][A-Za-z][\w-]*/g, /@\S+/g, /\b\w+_\w+(?:_\w+)*\b/g, /\b[\w.-]+@[\w.-]+\.\w+\b/g, /\b[\w-]+\.(?:js|json|mp3|mp4|png|jpg|pdf|zip)\b/gi, /\b[A-Za-z]+\d+[A-Za-z0-9]*\b/g];

function mask(text, args) {
    let m = text;
    const blank = (s, e) => { m = m.slice(0, s) + '\u0000'.repeat(e - s) + m.slice(e); };
    for (const re of PROTECT) for (const x of text.matchAll(re)) blank(x.index, x.index + x[0].length);
    const a = String(args || '').trim();
    if (a.length >= 2) {
        const low = text.toLowerCase(), al = a.toLowerCase();
        for (let i = low.indexOf(al); i !== -1; i = low.indexOf(al, i + al.length)) blank(i, i + al.length);
        for (const w of a.split(/\s+/)) if (w.length >= 3) { const wl = w.toLowerCase(); for (let i = low.indexOf(wl); i !== -1; i = low.indexOf(wl, i + wl.length)) blank(i, i + wl.length); }
    }
    return m;
}

function translatable(chunk, before, after) {
    const t = chunk.replace(/[.!?\u2026]+$/, '');
    const words = t.split(/[^A-Za-z0-9'\u2019]+/).filter(Boolean);
    const letters = t.replace(/[^A-Za-z]/g, '');
    if (letters.length < 3 || !words.length) return false;
    if (words.every((w) => STOP.has(w.toLowerCase()) || /^[A-Z0-9]{1,3}$/.test(w) || /^\d+$/.test(w))) return false;
    if (STOP.has(t.toLowerCase())) return false;
    if (words.length <= 6 && words.every((w) => SMALL.has(w.toLowerCase()) || /^[A-Z][a-z0-9'\u2019]*$/.test(w) || /^\d+$/.test(w)) && /[a-z]/.test(t) && !/^[*_~]*[ ]*[:\u279c\u2192\u00bb]/.test(after || '')) return false;
    if (before && /[.#/@$`]/.test(before)) return false;
    return true;
}

export function segments(text, args) {
    const masked = mask(text, args);
    const out = [];
    for (const x of masked.matchAll(CHUNK)) {
        const s = x.index, e = s + x[0].length;
        const piece = text.slice(s, e);
        if (piece.includes('\u0000')) continue;
        if (translatable(piece, text[s - 1], text.slice(e, e + 6))) out.push({ s, e, src: piece });
    }
    return out;
}

const cache = new Map();
const CACHE_MAX = 6000;
const remember = (k, v) => { if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value); cache.set(k, v); };
const inflight = new Map();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

async function google(list, lang) {
    const q = list.map((s) => `&q=${encodeURIComponent(s)}`).join('');
    const r = await fetch(`https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=${lang}${q}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`google ${r.status}`);
    const j = await r.json();
    const arr = (Array.isArray(j) ? j : []).map((x) => (Array.isArray(x) ? x[0] : x));
    if (arr.length !== list.length || arr.some((x) => typeof x !== 'string')) throw new Error('google shape');
    return arr;
}

async function myMemory(list, lang) {
    const out = [];
    for (const s of list.slice(0, 12)) {
        const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(s)}&langpair=en|${lang}`, { signal: AbortSignal.timeout(5000) });
        const j = await r.json();
        const t = j?.responseData?.translatedText;
        out.push(j?.responseStatus === 200 && typeof t === 'string' && !/MYMEMORY|QUERY LENGTH/i.test(t) ? t : s);
    }
    return out;
}

async function fetchBatch(list, lang) {
    const groups = [];
    let cur = [], len = 0;
    for (const s of list) { if (len + s.length > 1500 || cur.length >= 40) { groups.push(cur); cur = []; len = 0; } cur.push(s); len += s.length + 5; }
    if (cur.length) groups.push(cur);
    await Promise.all(groups.map(async (g) => {
        let res;
        try { res = await google(g, lang); } catch { try { res = await myMemory(g, lang); } catch { res = null; } }
        if (res) g.forEach((s, i) => { if (res[i] && res[i] !== s) remember(`${lang}|${s}`, res[i]); });
    }));
}

function lookup(list, lang) {
    const need = [...new Set(list.filter((s) => !cache.has(`${lang}|${s}`)))];
    if (!need.length) return null;
    const key = `${lang}|${need.join('\u0001')}`;
    if (!inflight.has(key)) inflight.set(key, fetchBatch(need, lang).catch(() => {}).finally(() => inflight.delete(key)));
    return inflight.get(key);
}

export async function translateText(text, lang, { args = '', budgetMs = 4000 } = {}) {
    if (!text || lang === 'en' || typeof text !== 'string' || text.length > 4000) return text;
    const segs = segments(text, args);
    if (!segs.length) return text;
    const p = lookup(segs.map((x) => x.src), lang);
    if (p) await Promise.race([p, new Promise((r) => setTimeout(r, budgetMs))]);
    return apply(text, segs, lang);
}

function apply(text, segs, lang) {
    let out = '', last = 0;
    for (const { s, e, src } of segs) {
        let dst = cache.get(`${lang}|${src}`);
        if (!dst) continue;
        const upper = src === src.toUpperCase() && TARGET_LATIN.has(lang);
        if (upper) dst = dst.toUpperCase();
        const trailing = /[.!?\u2026]$/.test(src) && !/[.!?\u2026\u0964\u06D4\u3002]$/.test(dst) ? '' : '';
        out += text.slice(last, s) + dst.trim() + trailing;
        last = e;
    }
    return out + text.slice(last);
}

const TEXT_KEYS = new Set(['text', 'caption', 'textOff', 'label', 'title', 'description', 'listLabel', 'listTitle', 'displayText']);

export async function translateDeep(obj, lang, { args = '' } = {}) {
    if (lang === 'en' || !obj) return obj;
    const refs = [];
    const walk = (o) => {
        if (!o || typeof o !== 'object') return;
        if (Buffer.isBuffer(o) || o instanceof Uint8Array) return;
        for (const [k, v] of Object.entries(o)) {
            if (typeof v === 'string' && TEXT_KEYS.has(k) && !/^[.#/!]\w+$/.test(v)) {
                const segs = segments(v, args);
                if (segs.length) refs.push({ o, k, v, segs });
            } else if (v && typeof v === 'object' && !['url', 'image', 'video', 'audio', 'document', 'buttons', 'quoted'].includes(k)) walk(v);
        }
    };
    walk(obj);
    if (!refs.length) return obj;
    const p = lookup(refs.flatMap((r) => r.segs.map((x) => x.src)), lang);
    if (p) await Promise.race([p, new Promise((r) => setTimeout(r, 4000))]);
    for (const r of refs) r.o[r.k] = apply(r.v, r.segs, lang);
    return obj;
}

const clone = (o) => (Array.isArray(o) ? o.map(clone) : o && typeof o === 'object' && !Buffer.isBuffer(o) && !(o instanceof Uint8Array) && Object.getPrototypeOf(o) === Object.prototype ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, clone(v)])) : o);

export const translateContent = (content, lang, opts) => (lang === 'en' ? content : translateDeep(clone(content), lang, opts));

const warmed = new Set();
export function warm(lang, strings) {
    if (lang === 'en' || warmed.has(lang)) return;
    warmed.add(lang);
    const segs = [...new Set(strings.flatMap((s) => segments(String(s), '').map((x) => x.src)))];
    (async () => {
        for (let i = 0; i < segs.length; i += 40) {
            await lookup(segs.slice(i, i + 40), lang);
            await new Promise((r) => setTimeout(r, 1500));
        }
    })().catch(() => {});
}

export const cacheSize = () => cache.size;

const NO_TRANSLATE = new Set(['ai', 'claude', 'deepseek', 'gemini', 'gpt', 'gpt4', 'llama', 'mistral', 'math', 'define', 'wiki', 'wikisi', 'wikisearch', 'lyrics', 'tr', 'transcript', 'ocr', 'quote', 'quted', 'advice', 'joke', 'fact', 'numfact', 'slfact', 'trivia', 'quiz', '8ball', 'csong', 'cfetch', 'cpost', 'cinfo', 'addreply', 'listreply', 'base64', 'unbase64', 'binary', 'morse', 'fancy', 'hash', 'text2video', 'dream', 'animeart', 'github', 'today', 'scholarship', 'lang', 'web']);
export const noTranslate = (cmd) => Boolean(cmd?.noTranslate) || NO_TRANSLATE.has(cmd?.name);
