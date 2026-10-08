import { getMedia, getSharp, ffmpeg, codePng } from '../lib/media.js';
import { getJson, enc } from '../lib/http.js';

const cat = { cat: 'tools' };

const ranges = (upper, lower, digit) => (s) => [...s].map((c) => {
    const n = c.codePointAt(0);
    if (n >= 65 && n <= 90 && upper) return String.fromCodePoint(upper + n - 65);
    if (n >= 97 && n <= 122 && lower) return String.fromCodePoint(lower + n - 97);
    if (n >= 48 && n <= 57 && digit) return String.fromCodePoint(digit + n - 48);
    return c;
}).join('');
const mapChars = (from, to) => (s) => [...s].map((c) => { const i = from.indexOf(c); return i < 0 ? c : [...to][i]; }).join('');
const FANCY = [
    ['Bold', ranges(0x1d400, 0x1d41a, 0x1d7ce)], ['Italic', ranges(0x1d434, 0x1d44e)], ['Bold italic', ranges(0x1d468, 0x1d482)],
    ['Script', ranges(0x1d4d0, 0x1d4ea)], ['Gothic', ranges(0x1d56c, 0x1d586)], ['Double-struck', ranges(0x1d538, 0x1d552, 0x1d7d8)],
    ['Monospace', ranges(0x1d670, 0x1d68a, 0x1d7f6)], ['Sans bold', ranges(0x1d5d4, 0x1d5ee, 0x1d7ec)], ['Circled', ranges(0x24b6, 0x24d0)],
    ['Squared', ranges(0x1f130)], ['Small caps', mapChars('abcdefghijklmnopqrstuvwxyz', 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ')],
    ['Upside-down', (s) => [...mapChars('abcdefghijklmnopqrstuvwxyz', 'ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz')(s.toLowerCase())].reverse().join('')]
];
const MORSE = { a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', '/': '-..-.', '@': '.--.-.', '-': '-....-' };
const UNMORSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

function parseColor(t) {
    t = t.trim().toLowerCase();
    let m = /^#?([0-9a-f]{6})$/.exec(t); if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    m = /^#?([0-9a-f]{3})$/.exec(t); if (m) return [...m[1]].map((c) => parseInt(c + c, 16));
    m = /^(?:rgb\()?\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\)?$/.exec(t); if (m) return [m[1], m[2], m[3]].map((x) => Math.min(255, Number(x)));
    const NAMES = { red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255], yellow: [255, 255, 0], orange: [255, 165, 0], purple: [128, 0, 128], pink: [255, 192, 203], black: [0, 0, 0], white: [255, 255, 255], gray: [128, 128, 128], cyan: [0, 255, 255], magenta: [255, 0, 255], brown: [165, 42, 42], gold: [255, 215, 0], teal: [0, 128, 128] };
    return NAMES[t] || null;
}
const hsl = ([r, g, b]) => {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const l = (mx + mn) / 2; let h = 0; let s = 0;
    if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
};

async function postForm(url, fields, ms = 40000) {
    const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, v.blob ? v.blob : v, v.name);
    const r = await fetch(url, { method: 'POST', body: f, signal: AbortSignal.timeout(ms) });
    return r.json();
}

export default [
    {
        ...cat, name: 'fancy', aliases: ['font', 'fonts'], desc: 'Stylish text fonts  (.fancy Hello)', react: '🔤',
        async run(ctx) {
            if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}fancy Hello`);
            const t = ctx.text.slice(0, 60);
            await ctx.card({ text: `🔤 *Fancy text*\n\n${FANCY.map(([n, f]) => `▫️ _${n}_\n${f(t)}`).join('\n\n')}` });
        }
    },
    {
        ...cat, name: 'flip', aliases: ['reverse', 'upsidedown'], desc: 'Reverse text  (.flip hello)', react: '🙃',
        async run(ctx) { if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}flip hello`); await ctx.card({ text: `🙃 ${[...ctx.text].reverse().join('')}` }); }
    },
    {
        ...cat, name: 'binary', aliases: ['bin2text', 'text2bin'], desc: 'Text ⇄ binary  (.binary hi / .binary 01101000)', react: '💻',
        async run(ctx) {
            if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}binary hello   or   ${ctx.prefix}binary 01101000 01101001`);
            const out = /^[01\s]+$/.test(ctx.text) && ctx.text.replace(/\s/g, '').length % 8 === 0
                ? Buffer.from(ctx.text.replace(/\s/g, '').match(/.{8}/g).map((b) => parseInt(b, 2))).toString('utf8')
                : [...Buffer.from(ctx.text, 'utf8')].map((b) => b.toString(2).padStart(8, '0')).join(' ');
            await ctx.card({ text: `💻 *Binary*\n\n${out.slice(0, 3500)}` });
        }
    },
    {
        ...cat, name: 'morse', aliases: ['morsecode'], desc: 'Text ⇄ Morse code', react: '📡',
        async run(ctx) {
            if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}morse sos   or   ${ctx.prefix}morse ... --- ...`);
            const out = /^[.\-/\s]+$/.test(ctx.text)
                ? ctx.text.trim().split(/\s*\/\s*|\s{3,}/).map((w) => w.trim().split(/\s+/).map((c) => UNMORSE[c] || '?').join('')).join(' ')
                : ctx.text.toLowerCase().split(/\s+/).map((w) => [...w].map((c) => MORSE[c] || '').filter(Boolean).join(' ')).join(' / ');
            await ctx.card({ text: `📡 *Morse*\n\n${out.slice(0, 3500)}` });
        }
    },
    {
        ...cat, name: 'color', aliases: ['hex', 'colorinfo', 'colour'], desc: 'Colour info + swatch  (.color #ff0066)', react: '🎨',
        async run(ctx) {
            const rgb = parseColor(ctx.text || ''); if (!rgb) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}color #ff0066   (hex, rgb 255 0 102, or a name)`);
            const sharp = await getSharp();
            const img = await sharp({ create: { width: 400, height: 400, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).png().toBuffer();
            const hex = `#${rgb.map((x) => x.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
            await ctx.sock.sendMessage(ctx.jid, { image: img, caption: `🎨 *${hex}*\n\n▫️ RGB : rgb(${rgb.join(', ')})\n▫️ HSL : ${hsl(rgb)}` }, { quoted: ctx.msg });
        }
    },
    {
        ...cat, name: 'timestamp', aliases: ['ts', 'unixtime'], desc: 'Unix time ⇄ date  (.timestamp 1700000000)', react: '🕒',
        async run(ctx) {
            const t = ctx.text.trim(); let d;
            if (!t) d = new Date(); else if (/^\d{9,13}$/.test(t)) d = new Date(t.length > 10 ? Number(t) : Number(t) * 1000); else d = new Date(t);
            if (Number.isNaN(d.getTime())) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}timestamp 1700000000   or   ${ctx.prefix}timestamp 2026-10-01 12:00`);
            await ctx.card({ text: `🕒 *Timestamp*\n\n▫️ Unix : *${Math.floor(d / 1000)}*\n▫️ Millis : ${d.getTime()}\n▫️ UTC : ${d.toUTCString()}\n▫️ Sri Lanka : ${new Date(d.getTime() + 19_800_000).toISOString().replace('T', ' ').slice(0, 19)} (UTC+5:30)`, again: false });
        }
    },
    {
        ...cat, name: 'count', aliases: ['wc', 'wordcount'], desc: 'Count words / characters', react: '🔢',
        async run(ctx) {
            const q = ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage; const t = ctx.text || q?.conversation || q?.extendedTextMessage?.text;
            if (!t) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}count your text   (or reply to a message)`);
            await ctx.card({ text: `🔢 *Count*\n\n▫️ Characters : ${[...t].length}\n▫️ Without spaces : ${[...t.replace(/\s/g, '')].length}\n▫️ Words : ${t.trim().split(/\s+/).length}\n▫️ Lines : ${t.split('\n').length}`, again: false });
        }
    },
    {
        ...cat, name: 'snap', aliases: ['codesnap', 'code'], desc: 'Code → pretty image  (.snap <code>)', react: '📸', timeoutMs: 40000,
        async run(ctx) {
            const q = ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage; const t = ctx.text || q?.conversation || q?.extendedTextMessage?.text;
            if (!t) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}snap console.log("hi")   (or reply to a code message)`);
            await ctx.sock.sendMessage(ctx.jid, { image: await codePng(t), caption: '📸 Code snapshot' }, { quoted: ctx.msg });
        }
    },
    {
        ...cat, name: 'readqr', aliases: ['scanqr', 'qrscan'], desc: 'Read a QR code from an image', react: '🔍', timeoutMs: 60000,
        async run(ctx) {
            const m = await getMedia(ctx, { kinds: ['imageMessage'], maxMB: 8 }); if (!m) return ctx.reply(`ℹ️ Reply to a QR image with ${ctx.prefix}readqr`);
            const j = await postForm('https://api.qrserver.com/v1/read-qr-code/', { file: { blob: new Blob([m.buffer], { type: 'image/png' }), name: 'qr.png' } });
            const d = j?.[0]?.symbol?.[0]?.data; if (!d) return ctx.reply('❌ No QR code found in that image.');
            await ctx.card({ text: `🔍 *QR content*\n\n${d}`, copy: [{ label: '📋 COPY', code: d.slice(0, 1000) }], again: false });
        }
    },
    {
        ...cat, name: 'ocr', aliases: ['imagetext', 'readimg', 'imgtotext'], desc: 'Read text from an image', react: '📝', timeoutMs: 90000,
        async run(ctx) {
            const m = await getMedia(ctx, { kinds: ['imageMessage'], maxMB: 8 }); if (!m) return ctx.reply(`ℹ️ Reply to an image with ${ctx.prefix}ocr`);
            const key = process.env.OCR_SPACE_KEY || 'helloworld';
            const j = await postForm('https://api.ocr.space/parse/image', { apikey: key, language: ctx.args[0] && /^[a-z]{3}$/.test(ctx.args[0]) ? ctx.args[0] : 'eng', file: { blob: new Blob([m.buffer], { type: m.mime || 'image/jpeg' }), name: 'image.jpg' } }, 70000);
            const t = j?.ParsedResults?.[0]?.ParsedText?.trim();
            if (!t) return ctx.reply(`❌ No text found${j?.ErrorMessage ? ` (${[].concat(j.ErrorMessage)[0]})` : ''}.`);
            await ctx.card({ text: `📝 *Text in image*\n\n${t.slice(0, 3500)}`, copy: [{ label: '📋 COPY TEXT', code: t.slice(0, 1000) }], again: false });
        }
    },
    {
        ...cat, name: 'compress', aliases: ['resize', 'compressimg'], desc: 'Shrink an image  (.compress 60  = quality)', react: '🗜️', timeoutMs: 60000,
        async run(ctx) {
            const m = await getMedia(ctx, { kinds: ['imageMessage'], maxMB: 15 }); if (!m) return ctx.reply(`ℹ️ Reply to an image with ${ctx.prefix}compress 60`);
            const q = Math.min(95, Math.max(10, Number(ctx.args[0]) || 60));
            const sharp = await getSharp();
            const out = await sharp(m.buffer).rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: q, mozjpeg: true }).toBuffer();
            await ctx.sock.sendMessage(ctx.jid, { image: out, caption: `🗜️ ${(m.buffer.length / 1024).toFixed(0)} KB → *${(out.length / 1024).toFixed(0)} KB* (quality ${q})` }, { quoted: ctx.msg });
        }
    },
    {
        ...cat, name: 'toaudio', aliases: ['tomp3', 'extractaudio'], desc: 'Video / voice note → MP3', react: '🎧', timeoutMs: 120000,
        async run(ctx) {
            const m = await getMedia(ctx, { kinds: ['videoMessage', 'audioMessage'], maxMB: 30 }); if (!m) return ctx.reply(`ℹ️ Reply to a video or voice note with ${ctx.prefix}toaudio`);
            const mp3 = await ffmpeg(['-vn', '-acodec', 'libmp3lame', '-b:a', '128k'], m.buffer, m.type === 'video' ? 'mp4' : 'ogg', 'mp3');
            await ctx.sock.sendMessage(ctx.jid, { audio: mp3, mimetype: 'audio/mpeg' }, { quoted: ctx.msg });
        }
    },
    {
        name: 'meme', aliases: ['randommeme'], cat: 'fun', desc: 'Random meme  (.meme / .meme wholesomememes)', react: '😂', timeoutMs: 40000,
        async run(ctx) {
            const sub = /^[a-z0-9_]{3,25}$/i.test(ctx.args[0] || '') ? ctx.args[0] : '';
            for (let i = 0; i < 4; i++) {
                const j = await getJson(`https://meme-api.com/gimme/${sub}`, { timeout: 15000 });
                if (j.nsfw || !j.url) continue;
                return ctx.sendButtons({ text: `😂 *${j.title}*\n\nr/${j.subreddit} • 👍 ${j.ups}`, image: { url: j.url }, header: false, quick: [{ id: `${ctx.prefix}meme ${sub}`.trim(), label: '🔁 NEXT MEME' }, { id: `${ctx.prefix}menu`, label: '📜 MENU' }] });
            }
            await ctx.reply('❌ No safe meme found, try again.');
        }
    },
    {
        name: 'pokemon', aliases: ['pokedex', 'poke'], cat: 'fun', desc: 'Pokédex  (.pokemon pikachu)', react: '⚡', timeoutMs: 40000,
        async run(ctx) {
            const q = (ctx.text || String(1 + Math.floor(Math.random() * 1025))).toLowerCase().replace(/\s+/g, '-');
            const d = await getJson(`https://pokeapi.co/api/v2/pokemon/${enc(q)}`, { timeout: 15000 }).catch(() => null);
            if (!d?.id) return ctx.reply('❌ Pokémon not found');
            const sp = await getJson(`https://pokeapi.co/api/v2/pokemon-species/${d.id}`, { timeout: 15000 }).catch(() => null);
            const flavor = sp?.flavor_text_entries?.find((x) => x.language.name === 'en')?.flavor_text?.replace(/[\n\f]/g, ' ') || '';
            const img = d.sprites?.other?.['official-artwork']?.front_default || d.sprites?.front_default;
            const stats = d.stats.map((s) => `${s.stat.name.replace('special-', 'sp.')} ${s.base_stat}`).join(' • ');
            await ctx.sendButtons({
                header: false, image: img ? { url: img } : undefined,
                text: `⚡ *#${d.id} ${d.name.toUpperCase()}*\n\n🔷 Type : ${d.types.map((t) => t.type.name).join(', ')}\n📏 ${d.height / 10} m • ⚖️ ${d.weight / 10} kg\n✨ ${d.abilities.map((a) => a.ability.name).join(', ')}\n📊 ${stats}\n\n${flavor}`,
                quick: [{ id: `${ctx.prefix}pokemon`, label: '🎲 RANDOM' }, { id: `${ctx.prefix}menu`, label: '📜 MENU' }]
            });
        }
    }
];
