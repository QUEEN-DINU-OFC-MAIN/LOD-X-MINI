import { examResult } from '../lib/results.js';
import { readFileSync } from 'node:fs';
import { getJson, enc } from '../lib/http.js';
import { BoundedCache } from '../../shared/cache.js';

const ELEMENTS = JSON.parse(readFileSync(new URL('../data/elements.json', import.meta.url), 'utf8'));
const SL_FACTS = JSON.parse(readFileSync(new URL('../data/slfacts.json', import.meta.url), 'utf8'));
const quizState = new BoundedCache({ max: 500, ttlMs: 5 * 60_000, shared: true });
const cat = { cat: 'education' };
const decode = (t) => String(t).replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&eacute;/g, 'é').replace(/&ldquo;|&rdquo;/g, '"').replace(/&hellip;/g, '…').replace(/&shy;/g, '').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
const strip = (h) => decode(String(h).replace(/<[^>]+>/g, ''));
const gradeEmoji = (g) => ({ A: '🌟', B: '✅', C: '📗', S: '📙', D: '📙', W: '❌', F: '❌', AB: '⚠️' }[String(g || '').toUpperCase().replace('+', '').trim()] || '📝');

const U = {
    length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mile: 1609.344, miles: 1609.344, mi: 1609.344, ft: 0.3048, feet: 0.3048, foot: 0.3048, in: 0.0254, inch: 0.0254, inches: 0.0254, yd: 0.9144, yard: 0.9144, yards: 0.9144, nm: 1852 },
    weight: { g: 1, kg: 1000, mg: 0.001, lb: 453.592, lbs: 453.592, oz: 28.3495, ounce: 28.3495, ton: 1e6, tonne: 1e6 },
    data: { b: 1, byte: 1, bytes: 1, kb: 1024, mb: 1048576, gb: 1073741824, tb: 1099511627776 },
    time: { s: 1, sec: 1, second: 1, seconds: 1, min: 60, minute: 60, minutes: 60, h: 3600, hr: 3600, hour: 3600, hours: 3600, day: 86400, days: 86400, week: 604800, weeks: 604800, month: 2592000, months: 2592000, year: 31536000, years: 31536000 },
    volume: { l: 1, liter: 1, litre: 1, ml: 0.001, gal: 3.78541, gallon: 3.78541, cup: 0.24, cups: 0.24 }
};
export function convertUnit(v, from, to) {
    const T = { c: 'c', celsius: 'c', f: 'f', fahrenheit: 'f', k: 'k', kelvin: 'k' };
    if (T[from] && T[to]) {
        const c = T[from] === 'c' ? v : T[from] === 'f' ? (v - 32) * 5 / 9 : v - 273.15;
        return T[to] === 'c' ? c : T[to] === 'f' ? (c * 9) / 5 + 32 : c + 273.15;
    }
    for (const g of Object.values(U)) if (g[from] !== undefined && g[to] !== undefined) return (v * g[from]) / g[to];
    return null;
}

const examCmd = (name, label, kind) => ({
    ...cat, name, desc: `${label}  (.${name} <index no> [year])`, react: '🎓', timeoutMs: 45000,
    async run(ctx) {
        const nums = ctx.args.filter((x) => /^\d+$/.test(x));
        const year = nums.find((x) => /^20\d\d$/.test(x) && nums.length > 1) || undefined;
        const index = nums.find((x) => x !== year);
        if (!index || !/^\d{3,12}$/.test(index)) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}${name} <index no>\nExample: ${ctx.prefix}${name} 1234567`);
        const r = await examResult(kind, index, year);
        const portal = 'results.exams.gov.lk';
        if (r.noExam) return ctx.card({ text: `❌ No published *${label}* found${year ? ` for ${year}` : ''} on the portal.\n\n🌐 ${portal}`, again: false });
        if (r.notFound) return ctx.card({ text: `❌ *Results not found*\n\n📘 ${r.title}\n🔢 Index : ${index}\n\n_Check the index number, or try ${portal} / SMS: exam <code> <index> to 1919._`, again: true });
        const body = r.rows.length ? r.rows.slice(0, 40).map((c) => (c.length === 1 ? `*${c[0]}*` : `${gradeEmoji(c[c.length - 1])} ${c.slice(0, -1).join(' · ')} — *${c[c.length - 1]}*`)).join('\n') : r.plain;
        await ctx.card({ text: `🎓 *${r.title}*\n🔢 Index : ${index}\n\n${body}\n\n🌐 ${portal}`, againText: index });
    }
});

export default [
    examCmd('ol', 'O/L results', 'ol'),
    examCmd('al', 'A/L results', 'al'),
    examCmd('scholarship', 'Grade 5 scholarship results', 'scholarship'),
    {
        ...cat, name: 'define', aliases: ['dict', 'meaning'], desc: 'English dictionary  (.define serendipity)', react: '📖',
        async run(ctx) {
            const w = ctx.args[0]?.toLowerCase(); if (!w) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}define serendipity`);
            let out = '';
            try {
                const d = (await getJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${enc(w)}`, { timeout: 12000 }))?.[0];
                out = `📖 *${d.word}* ${d.phonetic || ''}\n\n${d.meanings.slice(0, 3).map((m) => `▫️ _${m.partOfSpeech}_\n${m.definitions.slice(0, 2).map((x, i) => `   ${i + 1}. ${x.definition}${x.example ? `\n      _“${x.example}”_` : ''}`).join('\n')}`).join('\n\n')}`;
            } catch {
                const d = (await getJson(`https://en.wiktionary.org/api/rest_v1/page/definition/${enc(w)}`, { timeout: 15000 }).catch(() => null))?.en;
                if (d?.length) out = `📖 *${w}*\n\n${d.slice(0, 3).map((m) => `▫️ _${m.partOfSpeech}_\n${m.definitions.slice(0, 2).map((x, i) => `   ${i + 1}. ${strip(x.definition)}`).join('\n')}`).join('\n\n')}`;
            }
            if (!out) return ctx.reply(`❌ No definition found for *${w}*`);
            await ctx.card({ text: out });
        }
    },
    {
        ...cat, name: 'wikisi', aliases: ['siwiki', 'wikisinhala'], desc: 'Sinhala Wikipedia  (.wikisi ශ්‍රී ලංකාව)', react: '📚',
        async run(ctx) {
            if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}wikisi ශ්‍රී ලංකාව`);
            const s = await getJson(`https://si.wikipedia.org/w/api.php?action=opensearch&search=${enc(ctx.text)}&limit=1&format=json`, { timeout: 15000 });
            const title = s?.[1]?.[0]; if (!title) return ctx.reply('❌ සොයාගත නොහැක');
            const j = await getJson(`https://si.wikipedia.org/api/rest_v1/page/summary/${enc(title)}`, { timeout: 15000 });
            await ctx.card({ text: `📚 *${j.title}*\n\n${(j.extract || '').slice(0, 1500)}\n\n🔗 ${j.content_urls?.desktop?.page || ''}` });
        }
    },
    {
        ...cat, name: 'convert', aliases: ['unit', 'units'], desc: 'Unit converter  (.convert 10 km miles)', react: '📐',
        async run(ctx) {
            const v = Number(ctx.args[0]); const from = ctx.args[1]?.toLowerCase(); const to = (ctx.args[2] === 'to' ? ctx.args[3] : ctx.args[2])?.toLowerCase();
            if (!Number.isFinite(v) || !from || !to) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}convert 10 km miles\n\n📏 length · ⚖️ weight · 💾 data · ⏱️ time · 🌡️ c/f/k · 🧪 volume\nMoney: ${ctx.prefix}currency 100 usd lkr`);
            const r = convertUnit(v, from, to);
            if (r === null) return ctx.reply(`❌ Can't convert ${from} → ${to}`);
            await ctx.card({ text: `📐 *Converter*\n\n${v} ${from} = *${Number(r.toPrecision(10))} ${to}*` });
        }
    },
    {
        ...cat, name: 'country', aliases: ['nation', 'countryinfo'], desc: 'Country facts  (.country sri lanka)', react: '🌏', timeoutMs: 40000,
        async run(ctx) {
            if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}country sri lanka`);
            let c = null;
            for (const u of [`https://www.apicountries.com/name/${enc(ctx.text)}`, `https://restcountries.com/v3.1/name/${enc(ctx.text)}`]) { try { const j = await getJson(u, { timeout: 10000 }); c = Array.isArray(j) ? j[0] : null; if (c?.population !== undefined || c?.name) break; } catch {  } }
            if (c && (c.population !== undefined)) {
                const name = typeof c.name === 'string' ? c.name : c.name?.common; const langs = Array.isArray(c.languages) ? c.languages.map((l) => l.name).join(', ') : Object.values(c.languages || {}).join(', ');
                const cur = Array.isArray(c.currencies) ? c.currencies.map((x) => `${x.name} (${x.symbol || x.code})`).join(', ') : Object.values(c.currencies || {}).map((x) => `${x.name} (${x.symbol})`).join(', ');
                return ctx.card({ text: `🌏 *${name}* ${c.flag || c.flags?.emoji || ''}\n\n🏛️ Capital : ${[].concat(c.capital || '-').join(', ')}\n🌍 Region : ${c.region} • ${c.subregion || ''}\n👥 Population : ${Number(c.population).toLocaleString()}\n📐 Area : ${Number(c.area || 0).toLocaleString()} km²\n🗣️ Languages : ${langs || '-'}\n💰 Currency : ${cur || '-'}\n📞 Calling code : ${c.callingCodes?.[0] ? `+${c.callingCodes[0]}` : [c.idd?.root, c.idd?.suffixes?.[0]].filter(Boolean).join('')}` });
            }
            const j = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${enc(ctx.text)}`, { timeout: 15000 });
            await ctx.card({ text: `🌏 *${j.title}*\n\n${(j.extract || '').slice(0, 900)}` });
        }
    },
    {
        ...cat, name: 'element', aliases: ['periodic', 'chem'], desc: 'Periodic table  (.element Fe / 26 / gold)', react: '🧪',
        async run(ctx) {
            const q = ctx.text.toLowerCase(); if (!q) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}element Fe`);
            const e = ELEMENTS.find((x) => x.symbol.toLowerCase() === q || x.name.toLowerCase() === q || String(x.number) === q);
            if (!e) return ctx.reply(`❌ Not in my table (${ELEMENTS.length} common elements). Try: H, He, Fe, Au, 26…`);
            await ctx.card({ text: `🧪 *${e.name}* (${e.symbol})\n\n▫️ Atomic number : ${e.number}\n▫️ Atomic mass : ${e.mass}\n▫️ Category : ${e.category}\n▫️ Phase : ${e.phase}\n▫️ Discovered by : ${e.discoveredBy}\n▫️ Electron config : ${e.electronConfig}\n\n${e.summary || ''}` });
        }
    },
    {
        ...cat, name: 'quiz', aliases: ['question'], desc: 'Multiple-choice quiz — tap the answer!', react: '🧠',
        async run(ctx) {
            const j = await getJson('https://opentdb.com/api.php?amount=1&type=multiple', { timeout: 15000 });
            const q = j?.results?.[0]; if (!q) throw new Error('quiz service busy, try again');
            const opts = [...q.incorrect_answers, q.correct_answer].map(decode).sort(() => Math.random() - 0.5);
            const answer = opts.indexOf(decode(q.correct_answer));
            quizState.set(`${ctx.runner.id}:${ctx.jid}`, { answer, text: decode(q.correct_answer) });
            const L = ['A', 'B', 'C', 'D'];
            await ctx.sendButtons({
                header: false,
                text: `🧠 *QUIZ* — ${decode(q.category)} (${q.difficulty})\n\n${decode(q.question)}\n\n${opts.map((o, i) => `*${L[i]}.* ${o}`).join('\n')}`,
                quick: [{ id: `${ctx.prefix}quizans 0`, label: `A` }, { id: `${ctx.prefix}quizans 1`, label: 'B' }, { id: `${ctx.prefix}quizans 2`, label: 'C' }],
                sections: [{ title: 'ANSWER', highlight_label: '', rows: opts.map((o, i) => ({ title: `${L[i]}. ${o}`.slice(0, 24), description: o.slice(0, 72), id: `${ctx.prefix}quizans ${i}` })) }], listLabel: '✅ Choose answer', listTitle: 'Your answer'
            });
        }
    },
    {
        ...cat, name: 'quizans', hidden: true, desc: 'internal: quiz answer',
        async run(ctx) {
            const st = quizState.get(`${ctx.runner.id}:${ctx.jid}`); if (!st) return ctx.reply('⌛ That quiz expired. Send .quiz for a new one.');
            const n = Number(ctx.args[0]); quizState.del(`${ctx.runner.id}:${ctx.jid}`);
            await ctx.card({ text: n === st.answer ? `✅ *Correct!* 🎉\n\nAnswer: ${st.text}` : `❌ *Wrong*\n\nThe answer was: *${st.text}*`, quick: [{ id: `${ctx.prefix}quiz`, label: '🧠 NEXT QUIZ' }], again: false });
        }
    },
    {
        ...cat, name: 'today', aliases: ['onthisday', 'history'], desc: 'On this day in history', react: '📅',
        async run(ctx) {
            const now = new Date(Date.now() + 5.5 * 3600_000); const mm = String(now.getUTCMonth() + 1).padStart(2, '0'); const dd = String(now.getUTCDate()).padStart(2, '0');
            const j = await getJson(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/${mm}/${dd}`, { timeout: 20000 });
            const ev = (j.selected || []).sort(() => Math.random() - 0.5).slice(0, 5);
            await ctx.card({ text: `📅 *On this day — ${now.toUTCString().slice(5, 11)}*\n\n${ev.map((e) => `▫️ *${e.year}* — ${e.text}`).join('\n\n')}` });
        }
    },
    {
        ...cat, name: 'slfact', aliases: ['srilanka', 'lkfact'], desc: 'Random fact about Sri Lanka 🇱🇰', react: '🇱🇰',
        async run(ctx) { await ctx.card({ text: `🇱🇰 *Sri Lanka fact*\n\n${SL_FACTS[Math.floor(Math.random() * SL_FACTS.length)]}` }); }
    },
    {
        ...cat, name: 'numfact', aliases: ['number', 'numberfact'], desc: 'Interesting facts about a number', react: '🔢',
        async run(ctx) {
            const n = Number(ctx.args[0] ?? Math.floor(Math.random() * 1000)); if (!Number.isInteger(n) || Math.abs(n) > 1e12) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}numfact 42`);
            let t = null;
            try { const r = await fetch(`http://numbersapi.com/${n}`, { signal: AbortSignal.timeout(6000) }); if (r.ok) t = (await r.text()).trim(); } catch {  }
            if (!t) {
                const f = []; const a = Math.abs(n);
                f.push(`${n} is ${a % 2 ? 'odd' : 'even'}.`);
                if (a > 1) { let p = true; for (let i = 2; i * i <= a; i++) if (a % i === 0) { p = false; break; } f.push(p ? `${n} is a prime number.` : `${n} is composite.`); }
                const s = Math.sqrt(a); if (Number.isInteger(s)) f.push(`${n} is a perfect square (${s}²).`);
                f.push(`In binary it is ${a.toString(2)}, in hex 0x${a.toString(16).toUpperCase()}.`);
                t = f.join('\n');
            }
            await ctx.card({ text: `🔢 *${n}*\n\n${t}`, againText: String(Math.floor(Math.random() * 1000)) });
        }
    }
];
