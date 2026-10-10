
export const CF_ACCOUNT = process.env.CF_ACCOUNT_ID || 'fbdc2697754312e06da7613153a6b6c8';
export const CF_TOKEN =
    process.env.CF_AI_TOKEN || 'cfut_18OfRjJZYdqNkrBP4hXWEAWtYavUEoyuIMhnoFhoc5b48fc6';

export const EDIT_DAILY_LIMIT = Number(process.env.EDIT_DAILY_LIMIT || 3);

const TEXT_MODEL_PREFS = [
    '@cf/meta/llama-4-scout-17b-16e-instruct',
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    '@cf/aisingapore/gemma-sea-lion-v4-27b-it'
];

const EDIT_MODEL_PREFS = [
    process.env.EDIT_MODEL || '@cf/black-forest-labs/flux-2-klein-9b',
    '@cf/black-forest-labs/flux-2-klein-9b',
    '@cf/black-forest-labs/flux-2-klein-4b',
    '@cf/black-forest-labs/flux-2-dev'
].filter(Boolean);

const API = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai`;

let modelsCache = { at: 0, list: [] };
export async function cfImageModels() {
    if (modelsCache.list.length && Date.now() - modelsCache.at < 10 * 60_000) return modelsCache.list;
    const r = await fetch(`${API}/models/search?search=image&per_page=60`, {
        headers: { Authorization: `Bearer ${CF_TOKEN}` },
        signal: AbortSignal.timeout(9000)
    });
    const j = await r.json().catch(() => ({}));
    if (!j.success || !Array.isArray(j.result)) throw new Error(j.errors?.[0]?.message || 'CF models fetch failed');
    modelsCache = {
        at: Date.now(),
        list: j.result.map((m) => ({ id: m.id, name: m.name, task: m.task?.name || '' }))
    };
    return modelsCache.list;
}

export async function resolveEditModel(preferred = '') {
    try {
        const names = new Set((await cfImageModels()).map((m) => m.name));
        if (preferred && names.has(preferred)) return { model: preferred, live: true };
        for (const pref of EDIT_MODEL_PREFS) if (names.has(pref)) return { model: pref, live: true };
    } catch { }
    return { model: preferred || EDIT_MODEL_PREFS[0], live: false };
}

const dayKey = () => new Date().toISOString().slice(0, 10);

async function readJson(storage, key) {
    try {
        const b = await storage.get(key);
        if (b) return JSON.parse(b.toString('utf8'));
    } catch { }
    return {};
}

export async function reserveEditSlot(storage, owner) {
    if (!storage) return { ok: true, used: 1, left: EDIT_DAILY_LIMIT - 1 };
    const u = await readJson(storage, 'ai/edit-usage.json');
    const k = dayKey();
    let e = u[owner];
    if (!e || e.date !== k) e = { date: k, count: 0 };
    if (e.count >= EDIT_DAILY_LIMIT) return { ok: false, used: e.count, left: 0 };
    e.count += 1;
    u[owner] = e;
    await storage.put('ai/edit-usage.json', JSON.stringify(u));
    return { ok: true, used: e.count, left: EDIT_DAILY_LIMIT - e.count };
}

export async function refundEditSlot(storage, owner) {
    if (!storage) return;
    const u = await readJson(storage, 'ai/edit-usage.json');
    const k = dayKey();
    const e = u[owner];
    if (e && e.date === k && e.count > 0) {
        e.count -= 1;
        u[owner] = e;
        await storage.put('ai/edit-usage.json', JSON.stringify(u));
    }
}

export async function peekEditUsage(storage, owner) {
    if (!storage) return { date: dayKey(), used: 0, left: EDIT_DAILY_LIMIT };
    const u = await readJson(storage, 'ai/edit-usage.json');
    const k = dayKey();
    const e = u[owner];
    const used = e && e.date === k ? Number(e.count) || 0 : 0;
    return { date: k, used, left: Math.max(0, EDIT_DAILY_LIMIT - used) };
}

export async function editUsageMap(storage) {
    const u = storage ? await readJson(storage, 'ai/edit-usage.json') : {};
    const k = dayKey();
    const today = Object.entries(u)
        .filter(([, e]) => e && e.date === k)
        .map(([owner, e]) => ({ owner, count: Number(e.count) || 0, limit: EDIT_DAILY_LIMIT }))
        .sort((a, b) => b.count - a.count);
    return { date: k, limit: EDIT_DAILY_LIMIT, today, raw: u };
}

export async function editStats(storage) {
    if (!storage) return { total: 0, days: {}, models: {} };
    const d = await readJson(storage, 'ai/edit-stats.json');
    return { total: Number(d.total) || 0, days: d.days || {}, models: d.models || {}, last: d.last || null };
}

export async function bumpEditStats(storage, { owner = '', model = '' } = {}) {
    if (!storage) return;
    const d = await readJson(storage, 'ai/edit-stats.json');
    const k = dayKey();
    d.total = (Number(d.total) || 0) + 1;
    d.days = d.days || {};
    d.days[k] = (Number(d.days[k]) || 0) + 1;
    d.models = d.models || {};
    if (model) d.models[model] = (Number(d.models[model]) || 0) + 1;
    d.last = { at: Date.now(), owner, model };
    await storage.put('ai/edit-stats.json', JSON.stringify(d));
}

export async function cfUsageSummary(storage) {
    const u = storage ? await readJson(storage, 'ai/cf-usage.json') : {};
    const days = Object.entries(u)
        .map(([date, v]) => ({ date, calls: Number(v.calls) || 0, neurons: Number(v.neurons) || 0, byOwner: v.byOwner || {} }))
        .sort((a, b) => (a.date < b.date ? 1 : -1));
    return { today: days.find((d) => d.date === dayKey()) || { date: dayKey(), calls: 0, neurons: 0, byOwner: {} }, days: days.slice(0, 14) };
}

export async function recordCfUsage(storage, { owner = '', model = '', neurons = 0 } = {}) {
    if (!storage) return;
    const u = await readJson(storage, 'ai/cf-usage.json');
    const k = dayKey();
    if (!u[k]) u[k] = { calls: 0, neurons: 0, byOwner: {} };
    u[k].calls += 1;
    u[k].neurons += Number(neurons) || 0;
    if (owner) u[k].byOwner[owner] = (u[k].byOwner[owner] || 0) + 1;
    const cut = Date.now() - 14 * 86_400_000;
    for (const d of Object.keys(u)) if (new Date(`${d}T00:00:00Z`).getTime() < cut) delete u[d];
    await storage.put('ai/cf-usage.json', JSON.stringify(u));
}

const TRANSLATE_SYS = `You convert a Sri Lankan user's casual Sinhala, Singlish (Sinhala typed in English letters) or English photo-edit request into ONE short English image-editing instruction for an AI photo editor.
Rules:
- The instruction edits the SAME photo: keep the same subject (person, animal or object), the same pose, framing, background and composition. Only change the style, colours, lighting, mood or setting the user asked for.
- If the user asks for "more" / "another" / "improve" / "same but better" / "thawa" with no other change, describe it as a gentle enhancement of the exact same photo.
- Never invent a new subject, a new person, a new animal or a new scene.
- Answer with ONLY the English instruction, no quotes, no explanation, maximum 35 words.`;

async function cfText(messages, { maxTokens = 120, vision = false } = {}) {
    let lastErr = null;
    for (const model of TEXT_MODEL_PREFS) {
        if (vision && model !== TEXT_MODEL_PREFS[0]) break;
        try {
            const r = await fetch(`${API}/run/${model}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages, max_tokens: maxTokens, temperature: 0.2 }),
                signal: AbortSignal.timeout(25_000)
            });
            const j = await r.json().catch(() => ({}));
            const out = j?.result?.response ?? j?.result?.choices?.[0]?.message?.content ?? '';
            if (out && String(out).trim()) return { text: String(out).trim(), model };
            lastErr = new Error(j?.errors?.[0]?.message || 'empty response');
        } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('text model unavailable');
}

export async function translateEditPrompt(text) {
    const { text: english, model } = await cfText([
        { role: 'system', content: TRANSLATE_SYS },
        { role: 'user', content: String(text).slice(0, 400) }
    ]);
    return { english: english.replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 300), model };
}

const DESCRIBE_SYS = `You describe a photo for an AI image editor in ONE short factual English sentence (max 30 words).
Say: how many main subjects there are, what they are, their pose and position, and the setting or background.
Describe only what is visible. No opinions, no camera talk.`;

const GENERIC_SUBJECT =
    'the same subject, or the same number of subjects, as in the original photo, in the same pose and position';

export async function describeImage(buf, mime = 'image/jpeg') {
    const { text } = await cfText(
        [
            { role: 'system', content: DESCRIBE_SYS },
            {
                role: 'user',
                content: [
                    { type: 'text', text: 'Describe this photo.' },
                    { type: 'image_url', image_url: { url: `data:${mime};base64,${buf.toString('base64')}` } }
                ]
            }
        ],
        { maxTokens: 110, vision: true }
    );
    return text.replace(/^here.*?:/i, '').replace(/^["\s]+|["\s]+$/g, '').slice(0, 240);
}

export async function buildEditPrompt(text, { image = null, mime = 'image/jpeg' } = {}) {
    const { presetPrompt, sinhalaPrompt, looksSinhala } = await import('./cfedit-presets.js');

    let change = '';
    let source = 'raw';
    let via = null;

    const preset = presetPrompt(text);
    const si = preset ? null : sinhalaPrompt(text);

    if (preset) {
        change = preset;
        source = 'preset';
    } else if (si) {
        change = si.prompt;
        source = 'sinhala';
        via = si.key;
    } else if (looksSinhala(text) || !/^[\x00-\x7F]+$/.test(text)) {
        try {
            const t = await translateEditPrompt(text);
            change = t.english;
            source = 'translated';
            via = t.model;
        } catch {
            change = text;
        }
    } else {
        change = text;
    }

    let subject = GENERIC_SUBJECT;
    let seenBy = null;
    if (image) {
        try {
            subject = await describeImage(image, mime);
            seenBy = TEXT_MODEL_PREFS[0];
        } catch { }
    }

    const prompt =
        `Edit this exact photo. The photo shows: ${subject}. ` +
        `Apply only this change: ${change}. ` +
        `Keep the same subject${/\b(two|three|four|five|several|multiple|group|couple|pair)\b/i.test(subject) ? 's' : ''} — ` +
        `the same face, pose, framing, background and composition as the original photo. ` +
        `Never replace, remove or invent a subject. Photorealistic, natural detail, high quality.`;

    return { prompt, change, subject, seenBy, english: change, source, via };
}

export async function cfEditImage(buf, prompt, { mime = 'image/jpeg', storage = null, owner = '', model: wantModel = '' } = {}) {
    const { model, live } = await resolveEditModel(wantModel);
    const finalPrompt = String(prompt).startsWith('Edit this exact photo')
        ? String(prompt)
        : `Edit this exact photo. Apply only this change: ${prompt}. ` +
          'Keep exactly the same subject, face, pose, framing, background and composition as the original photo. ' +
          'Never replace, remove or invent a subject. Photorealistic, natural detail, high quality.';

    const form = new FormData();
    form.append('prompt', finalPrompt);
    form.append('image', new Blob([buf], { type: mime }), 'photo.jpg');
    form.append('steps', '4');
    form.append('width', '1024');
    form.append('height', '1024');

    const r = await fetch(`${API}/run/${model}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${CF_TOKEN}` },
        body: form,
        signal: AbortSignal.timeout(170_000)
    });
    const neurons = Number(r.headers.get('cf-aig-neurons-used') || 0);
    const j = await r.json().catch(() => ({}));
    if (!j.success || !j.result?.image) throw new Error(j.errors?.[0]?.message || 'AI image edit failed');

    recordCfUsage(storage, { owner, model, neurons }).catch(() => { });
    return { buf: Buffer.from(j.result.image, 'base64'), model, live, neurons };
}
