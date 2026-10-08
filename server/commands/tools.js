import crypto from 'node:crypto';
import { getJson, getText, enc } from '../lib/http.js';

function calc(expr) {
    const e = expr.replace(/\s+/g, '').replace(/\^/g, '**').replace(/x/gi, '*').replace(/,/g, '.');
    if (!/^[\d+\-*/%().*]+$/.test(e) || e.length > 80) throw new Error('only numbers and + - * / % ^ ( ) allowed');
    const v = Function(`"use strict";return (${e})`)();
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('invalid result');
    return v;
}
const need = (ctx, usage) => { if (!ctx.text) { ctx.reply(`ℹ️ Usage: ${ctx.prefix}${usage}`); return true; } };

export default [
    { name: 'calc', aliases: ['calculate'], cat: 'tools', desc: 'Calculator  (.calc 2*(3+4))', async run(ctx) { if (need(ctx, 'calc 2*(3+4)')) return; await ctx.reply(`🧮 ${ctx.text} = *${calc(ctx.text)}*`); } },
    {
        name: 'qr', aliases: ['qrcode'], cat: 'tools', desc: 'Text → QR code image',
        async run(ctx) {
            if (need(ctx, 'qr https://example.com')) return;
            await ctx.sock.sendMessage(ctx.jid, { image: { url: `https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=10&data=${enc(ctx.text)}` }, caption: '✅ QR ready' }, { quoted: ctx.msg });
        }
    },
    {
        name: 'shorturl', aliases: ['short', 'tiny', 'tinyurl', 'shorten'], cat: 'tools', desc: 'Shorten a link',
        async run(ctx) {
            if (need(ctx, 'shorturl https://example.com/long')) return;
            if (!/^https?:\/\//i.test(ctx.text)) return ctx.reply('❌ Give a full link starting with http(s)://');
            const j = await getJson(`https://is.gd/create.php?format=json&url=${enc(ctx.text)}`);
            await ctx.reply(j.shorturl ? `🔗 ${j.shorturl}` : `❌ ${j.errormessage || 'failed'}`);
        }
    },
    {
        name: 'time', aliases: ['clock'], cat: 'tools', desc: 'Time in a timezone  (.time Asia/Colombo)',
        async run(ctx) {
            const q = (ctx.text || 'Asia/Colombo').trim();
            const all = Intl.supportedValuesOf('timeZone');
            const key = q.toLowerCase().replace(/\s+/g, '_');
            const tz = all.find((z) => z.toLowerCase() === key) || all.find((z) => z.split('/').pop().toLowerCase() === key) || all.find((z) => z.toLowerCase().includes(key)) || (key === 'utc' ? 'UTC' : null);
            if (!tz) return ctx.reply('❌ Unknown timezone / city. Example: .time colombo, .time Europe/London, .time new york');
            await ctx.reply(`🕒 *${tz.replace(/_/g, ' ')}*\n${new Date().toLocaleString('en-GB', { timeZone: tz, dateStyle: 'full', timeStyle: 'medium' })}`);
        }
    },
    { name: 'base64', aliases: ['b64'], cat: 'tools', desc: 'Encode text to base64', async run(ctx) { if (need(ctx, 'base64 hello')) return; await ctx.reply(Buffer.from(ctx.text).toString('base64')); } },
    {
        name: 'unbase64', aliases: ['ub64'], cat: 'tools', desc: 'Decode base64 text',
        async run(ctx) { if (need(ctx, 'unbase64 aGVsbG8=')) return; await ctx.reply(Buffer.from(ctx.text, 'base64').toString('utf8')); }
    },
    {
        name: 'hash', cat: 'tools', desc: 'sha256 / md5  (.hash sha256 text)',
        async run(ctx) {
            const [algo, ...r] = ctx.args;
            if (!['sha256', 'md5', 'sha1', 'sha512'].includes(algo) || !r.length) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}hash sha256 hello`);
            await ctx.reply(`#️⃣ ${algo}\n${crypto.createHash(algo).update(r.join(' ')).digest('hex')}`);
        }
    },
    {
        name: 'password', aliases: ['pass', 'genpass', 'passgen'], cat: 'tools', desc: 'Strong password generator',
        async run(ctx) {
            const n = Math.min(Math.max(parseInt(ctx.args[0]) || 16, 8), 64);
            const set = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';
            let p = ''; for (let i = 0; i < n; i++) p += set[crypto.randomInt(set.length)];
            await ctx.reply(`🔐 \`${p}\``);
        }
    },
    {
        name: 'currency', aliases: ['fx', 'curr', 'exchange'], cat: 'tools', desc: 'Convert  (.currency 10 USD LKR)',
        async run(ctx) {
            const [a, from, to] = ctx.args; const amt = parseFloat(a);
            if (!amt || !from || !to) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}currency 10 USD LKR`);
            const j = await getJson(`https://open.er-api.com/v6/latest/${enc(from.toUpperCase())}`);
            const r = j.rates?.[to.toUpperCase()];
            await ctx.reply(r ? `💱 ${amt} ${from.toUpperCase()} = *${(amt * r).toFixed(2)} ${to.toUpperCase()}*` : '❌ Unknown currency code');
        }
    },
    {
        name: 'ip', aliases: ['iplookup', 'ipinfo'], cat: 'tools', desc: 'IP address info  (.ip 8.8.8.8)',
        async run(ctx) {
            if (need(ctx, 'ip 8.8.8.8')) return;
            let target = ctx.args[0];
            if (!/^[\d.:a-f]+$/i.test(target)) {
                const { lookup } = await import('node:dns/promises');
                try { target = (await lookup(target.replace(/^https?:\/\//, '').split('/')[0])).address; } catch { return ctx.reply('❌ Could not resolve that domain'); }
            }
            const j = await getJson(`https://ipwho.is/${enc(target)}`);
            if (!j.success) return ctx.reply('❌ Invalid IP');
            await ctx.reply(`🌍 *IP ${j.ip}*\n\n▫️ Country : ${j.country} ${j.flag?.emoji || ''}\n▫️ Region : ${j.region}\n▫️ City : ${j.city}\n▫️ ISP : ${j.connection?.isp}\n▫️ Timezone : ${j.timezone?.id}`);
        }
    }
];
