import crypto from 'node:crypto';
import { getJson, enc } from '../lib/http.js';
const pick = (a) => a[crypto.randomInt(a.length)];
const BALL = ['It is certain ✅', 'Without a doubt ✅', 'Yes, definitely ✅', 'Most likely 👍', 'Ask again later 🤔', 'Cannot predict now 🔮', "Don't count on it ❌", 'My reply is no ❌', 'Very doubtful ❌'];

const again = (ctx, name) => [{ id: `${ctx.prefix}${name}`, label: '🔁 ANOTHER' }, { id: `${ctx.prefix}menu`, label: '📜 MENU' }];

export default [
    {
        name: 'joke', aliases: ['jokes', 'dadjoke'], cat: 'fun', desc: 'Random joke',
        async run(ctx) {
            const j = await getJson('https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,religious,political,racist,sexist,explicit');
            await ctx.sendButtons({ text: `😂 ${j.joke || `${j.setup}\n\n${j.delivery}`}`, quick: again(ctx, 'joke') });
        }
    },
    {
        name: 'fact', cat: 'fun', desc: 'Random fact',
        async run(ctx) { const j = await getJson('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en'); await ctx.sendButtons({ text: `💡 ${j.text}`, quick: again(ctx, 'fact') }); }
    },
    {
        name: 'quote', aliases: ['quotes', 'inspire'], cat: 'fun', desc: 'Inspirational quote',
        async run(ctx) { const [j] = await getJson('https://zenquotes.io/api/random'); await ctx.sendButtons({ text: `💬 _${j.q}_\n\n— *${j.a}*`, quick: again(ctx, 'quote') }); }
    },
    {
        name: 'advice', cat: 'fun', desc: 'Random advice',
        async run(ctx) { const j = JSON.parse(await (await fetch('https://api.adviceslip.com/advice', { signal: AbortSignal.timeout(8000) })).text()); await ctx.sendButtons({ text: `🧠 ${j.slip.advice}`, quick: again(ctx, 'advice') }); }
    },
    {
        name: 'cat', cat: 'fun', desc: 'Random cat photo 🐱',
        async run(ctx) { const [j] = await getJson('https://api.thecatapi.com/v1/images/search'); await ctx.sock.sendMessage(ctx.jid, { image: { url: j.url }, caption: '🐱 Meow!' }, { quoted: ctx.msg }); }
    },
    {
        name: 'dog', cat: 'fun', desc: 'Random dog photo 🐶',
        async run(ctx) { const j = await getJson('https://dog.ceo/api/breeds/image/random'); await ctx.sock.sendMessage(ctx.jid, { image: { url: j.message }, caption: '🐶 Woof!' }, { quoted: ctx.msg }); }
    },
    {
        name: 'dice', aliases: ['roll', 'rolldice'], cat: 'fun', desc: 'Roll a dice 🎲',
        async run(ctx) { await ctx.sendButtons({ text: `🎲 You rolled *${crypto.randomInt(1, 7)}*`, quick: again(ctx, 'dice') }); }
    },
    {
        name: 'coin', aliases: ['coinflip', 'toss'], cat: 'fun', desc: 'Flip a coin 🪙',
        async run(ctx) { await ctx.sendButtons({ text: `🪙 *${pick(['HEADS', 'TAILS'])}*`, quick: again(ctx, 'coin') }); }
    },
    {
        name: '8ball', cat: 'fun', desc: 'Ask the magic 8-ball',
        async run(ctx) { if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}8ball will I win?`); await ctx.reply(`🎱 *${ctx.text}*\n\n${pick(BALL)}`); }
    },
    {
        name: 'rate', cat: 'fun', desc: 'Rate anything out of 100',
        async run(ctx) { if (!ctx.text) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}rate my cooking`); await ctx.reply(`⭐ *${ctx.text}*\n\nRating : *${crypto.randomInt(0, 101)}/100*`); }
    },
    {
        name: 'pick', aliases: ['choose'], cat: 'fun', desc: 'Pick one  (.pick tea | coffee)',
        async run(ctx) { const o = ctx.text.split(/[|,]/).map((x) => x.trim()).filter(Boolean); if (o.length < 2) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}pick tea | coffee`); await ctx.reply(`🎯 I choose: *${pick(o)}*`); }
    },
    {
        name: 'trivia', cat: 'fun', desc: 'Trivia question (tap an answer!)',
        async run(ctx) {
            const q = (await getJson('https://opentdb.com/api.php?amount=1&type=multiple&encode=url3986')).results?.[0];
            if (!q) return ctx.reply('❌ No question right now');
            const d = decodeURIComponent; const correct = d(q.correct_answer);
            const opts = [correct, ...q.incorrect_answers.map(d)].sort(() => Math.random() - 0.5);
            ctx.runner.trivia = { answer: correct, jid: ctx.jid, at: Date.now() };
            await ctx.sendButtons({
                text: `🧩 *Trivia* (${d(q.category)})\n\n${d(q.question)}`,
                quick: opts.map((o, i) => ({ id: `${ctx.prefix}answer ${o.slice(0, 40)}`, label: `${'ABCD'[i]}. ${o}`.slice(0, 25) }))
            });
        }
    },
    {
        name: 'answer', cat: 'fun', hidden: true, desc: 'Answer the trivia',
        async run(ctx) {
            const t = ctx.runner.trivia;
            if (!t || t.jid !== ctx.jid || Date.now() - t.at > 300_000) return ctx.reply(`⌛ No active trivia. Send ${ctx.prefix}trivia`);
            const ok = ctx.text.trim().toLowerCase() === t.answer.slice(0, 40).toLowerCase();
            ctx.runner.trivia = null;
            await ctx.sendButtons({ text: ok ? '✅ *Correct!* 🎉' : `❌ Wrong. Answer: *${t.answer}*`, quick: again(ctx, 'trivia') });
        }
    }
];
