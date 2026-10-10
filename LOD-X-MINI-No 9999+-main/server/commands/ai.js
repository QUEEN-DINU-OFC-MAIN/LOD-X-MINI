import * as P from '../lib/providers.js';
import { mediaKit } from '../../shared/wa.js';
import { extractViewOnce } from '../../shared/viewonce.js';
import { AI_PERSONAS } from '../lib/personas.js';

const quotedOfMsg = (ctx) => ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
import { BOT_NAME } from '../lib/ui.js';

const NAMES = { claude: 'Claude', claude2: 'Claude', gpt35: 'GPT-3.5', chatgpt: 'ChatGPT', pollinations: 'OpenAI' };
const SYS = (ctx) => ctx.runner.meta?.prompt || `You are ${ctx.runner.settings.botName}, a friendly WhatsApp assistant. Keep answers short and clear. Reply in the user's language.`;
const quotedOf = (ctx) => { const q = ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage; return q?.conversation || q?.extendedTextMessage?.text; };

const model = (name, aliases, label, emoji, chain, { useGemini = false, system } = {}) => ({
    name, aliases, cat: 'ai', desc: `${label} — ask anything`, react: emoji, timeoutMs: 90000,
    async run(ctx) {
        const q = ctx.text || quotedOf(ctx);
        if (!q) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}${name} what is the capital of Sri Lanka?\n_(or reply to a message with ${ctx.prefix}${name})_`);
        ctx.sock.sendPresenceUpdate('composing', ctx.jid).catch(() => {});
        const key = useGemini ? ctx.runner.meta?.geminiKey : undefined;
        let text; let engine;
        if (key) { try { text = await P.geminiAsk(q, { system: system || SYS(ctx), key }); engine = 'Gemini'; } catch {  } }
        if (!text) { const r = await P.aiAsk(q, { system: system || SYS(ctx), chain }); text = r.text; engine = NAMES[r.engine] || r.engine; }
        await ctx.card({ text: `${emoji} *${label}*\n\n${text.slice(0, 3500)}\n\n_via ${engine}_` });
    }
});

export default [
    model('ai', ['ask'], 'AI', '🤖', 'default', { useGemini: true }),
    model('gpt', ['chatgpt', 'gpt3'], 'GPT', '🟢', 'gpt'),
    model('gpt4', ['gpt-4', 'gpt4o'], 'GPT-4 class', '🌟', 'chatgpt'),
    model('claude', ['anthropic'], 'Claude', '🟣', 'claude'),
    model('gemini', ['bard', 'google'], 'Gemini', '🔵', 'default', { useGemini: true }),
    model('llama', ['llama3'], 'LLaMA (routed)', '🦙', 'default'),
    model('mistral', ['mixtral'], 'Mistral (routed)', '🌪️', 'default'),
    model('deepseek', ['ds'], 'DeepSeek (routed)', '🐋', 'default'),
    model('math', ['mathgpt', 'solve'], 'Math solver', '🔢', 'math', { system: 'You are a careful maths tutor. Solve step by step, show the final answer clearly. Use plain text, no LaTeX.' }),
    {
        name: 'aihelp', aliases: ['ailist', 'models'], cat: 'ai', desc: 'List of AI commands', react: '🤖',
        async run(ctx) {
            const p = ctx.prefix; const key = Boolean(ctx.runner.meta?.geminiKey);
            await ctx.sendButtons({
                header: false,
                text: `🤖 *AI commands*\n\n🤖 ${p}ai — best available (uses *your* Gemini key if set ${key ? '✅' : '❌'})\n🟢 ${p}gpt · 🌟 ${p}gpt4 · 🟣 ${p}claude · 🔵 ${p}gemini\n🦙 ${p}llama · 🌪️ ${p}mistral · 🐋 ${p}deepseek\n🔢 ${p}math — step-by-step maths\n🎨 ${p}image — AI pictures\n\n_Some model names are served by a similar free model — the footer of every answer tells you which engine really replied._\n\n🔑 ${p}setgeminikey • 🎭 ${p}setprompt • 💬 ${p}aireply on`,
                quick: [{ id: `${p}ai hello`, label: '🤖 TRY AI' }, { id: `${p}menu ai`, label: '📜 AI MENU' }]
            });
        }
    },
    {
        name: 'aireply', cat: 'ai', react: '💬', desc: 'AI auto-reply persona for private chats  (.aireply girl|boy|play|off)', ownerOnly: true,
        async run(ctx) {
            const v = (ctx.args[0] || '').toLowerCase();
            const cur = ctx.settings.aireply === true ? 'girl' : ctx.settings.aireply;
            if (!['girl', 'boy', 'play', 'off'].includes(v)) {
                const state = (k, e, d) => `${(cur || 'off') === k ? '✅' : '▫️'} ${e} *${k.toUpperCase()}* — ${d}`;
                const users = Object.keys(ctx.runner.meta?.aiMemory || {}).length;
                return ctx.sendButtons({
                    text: `💬 *AI AUTO REPLY*\n\nNow : *${(cur || 'off').toUpperCase()}*\n\nWhen ON, the bot answers *every private message* as an AI character and *remembers each user* for 7 days.\n\n${state('girl', '🌸', 'warm & caring girl')}\n${state('boy', '🖤', 'caring & protective boy')}\n${state('play', '😜', 'playful best friend')}\n\n🧠 Remembering : ${users} user(s)\n\n_Pick one:_`,
                    quick: [
                        { id: `${ctx.prefix}aireply girl`, label: '🌸 GIRL' }, { id: `${ctx.prefix}aireply boy`, label: '🖤 BOY' },
                        { id: `${ctx.prefix}aireply play`, label: '😜 PLAY' }, { id: `${ctx.prefix}aireply off`, label: '⛔ OFF' }
                    ]
                });
            }
            await ctx.runner.setSettings({ aireply: v === 'off' ? 'off' : v });
            await ctx.card({
                text: v === 'off' ? '⛔ *AI auto-reply OFF*\n\nKeyword auto-replies keep working.' : `✅ *AI auto-reply ON — ${(AI_PERSONAS[v] || {}).label}* ${(AI_PERSONAS[v] || {}).emoji}\n\nEvery private message now gets an AI reply with per-user memory.\n\n🧠 Memory auto-cleans after 7 days of silence.`,
                again: false
            });
        }
    },
    {
        name: 'aivision', aliases: ['vision', 'see'], cat: 'ai', react: '👁️', desc: 'Ask AI about a photo  (.aivision [question], reply to an image)', timeoutMs: 90_000,
        async run(ctx) {
            const q = extractViewOnce(quotedOfMsg(ctx));
            const img = q?.imageMessage || q?.stickerMessage;
            if (!img) return ctx.reply(`ℹ️ Reply to a photo with ${ctx.prefix}aivision [question]`);
            const prompt = ctx.text || 'Describe this image clearly and shortly.';
            const prog = ctx.progress('VISION — looking at the photo…');
            try {
                const type = img.mimetype?.includes('webp') ? 'sticker' : 'image';
                const buf = await mediaKit.buffer(img, type);
                let out;
                try { out = await P.kyioVision(buf, prompt, img.mimetype || 'image/jpeg'); } catch { }
                if (!out) out = await P.aiText(`${prompt}\n(The user attached a photo but it could not be sent to the vision model — ask them to describe it instead.)`);
                await prog.done('VISION — DONE');
                await ctx.card({ text: `👁️ *AI Vision*\n\n${String(out).slice(0, 3500)}`, again: false });
            } catch (e) {
                await prog.fail(`VISION FAILED — ${String(e.message).slice(0, 90)}`);
            }
        }
    },
    {
        name: 'setgeminikey', cat: 'ai', desc: 'Save your Google Gemini API key', ownerOnly: true,
        async run(ctx) {
            const k = ctx.args[0];
            if (!k) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}setgeminikey <key>   (or "off")`);
            ctx.sock.sendMessage(ctx.jid, { delete: ctx.msg.key }).catch(() => {});
            ctx.runner.meta = { ...(ctx.runner.meta || {}), geminiKey: k === 'off' ? undefined : k };
            await ctx.runner.store.saveMeta(ctx.runner.id, ctx.runner.meta);
            await ctx.reply(k === 'off' ? '🗑️ Gemini key removed.' : '🔑 Gemini key saved (stored encrypted).');
        }
    },
    {
        name: 'setprompt', cat: 'ai', desc: 'Set the AI persona / system prompt', ownerOnly: true,
        async run(ctx) {
            ctx.runner.meta = { ...(ctx.runner.meta || {}), prompt: ctx.text === 'off' ? undefined : ctx.text.slice(0, 800) };
            await ctx.runner.store.saveMeta(ctx.runner.id, ctx.runner.meta);
            await ctx.reply(ctx.text ? '✅ Persona saved.' : `ℹ️ Usage: ${ctx.prefix}setprompt You are a pirate…  (or "off")`);
        }
    }
];
