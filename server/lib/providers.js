import { getJson, getText, enc } from './http.js';

const NX = process.env.NEXRAY_BASE || 'https://api.nexray.eu.cc';
const ANA = process.env.ANABOT_BASE || 'https://anabot.my.id/api';
const ANA_KEY = process.env.ANABOT_KEY || 'freeApikey';
const BK9 = 'https://api.bk9.dev';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const isUrl = (s) => /^https?:\/\/\S+$/i.test(s || '');
export const ytId = (u) => /(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/.exec(u || '')?.[1];
export const ytLink = (id) => `https://youtu.be/${id}`;
export const fmtSec = (n) => { n = Number(n) || 0; return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };

export async function ytSearch(q, limit = 8) {
    const html = await getText(`https://www.youtube.com/results?search_query=${enc(q)}&hl=en`, { headers: { 'accept-language': 'en-US,en;q=0.9', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' } });
    const m = /var ytInitialData = (\{.*?\});<\/script>/s.exec(html);
    if (!m) throw new Error('YouTube search unavailable');
    const out = [];
    const walk = (n) => {
        if (!n || out.length >= limit) return;
        if (Array.isArray(n)) return n.forEach(walk);
        if (typeof n !== 'object') return;
        if (n.videoRenderer?.videoId) {
            const v = n.videoRenderer;
            out.push({
                id: v.videoId, title: v.title?.runs?.[0]?.text || '', channel: v.ownerText?.runs?.[0]?.text || '',
                duration: v.lengthText?.simpleText || 'LIVE', views: v.viewCountText?.simpleText || '', ago: v.publishedTimeText?.simpleText || '',
                thumb: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`
            });
            return;
        }
        Object.values(n).forEach(walk);
    };
    walk(JSON.parse(m[1]));
    if (!out.length) throw new Error('No results');
    return out;
}

export async function resolveVideo(input) {
    if (isUrl(input)) {
        const id = ytId(input);
        if (!id) throw new Error('Only YouTube links are supported here');
        return { id, title: '', thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
    }
    return (await ytSearch(input, 1))[0];
}

async function anabotPoll(taskId) {
    for (let i = 0; i < 28; i++) {
        await sleep(3000);
        const st = await getJson(`${ANA}/download/status?id=${taskId}&apikey=${ANA_KEY}`).catch(() => null);
        if (st?.data?.urls) return { url: st.data.urls, mime: st.data.mimetype || 'audio/mpeg', title: st.data.metadata?.title };
        if (st && !st.success && !st.status) break;
    }
    throw new Error('provider timed out');
}

export async function probeUrl(url, { minBytes = 2000 } = {}) {
    if (!url || /googlevideo\.com|redirector\./i.test(url)) return false;
    try {
        const r = await fetch(url, { headers: { range: 'bytes=0-1023', 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000), redirect: 'follow' });
        const ct = r.headers.get('content-type') || '';
        const len = Number((r.headers.get('content-range') || '').split('/')[1] || r.headers.get('content-length') || 0);
        await r.body?.cancel().catch(() => {});
        return r.ok && !/text\/html|json/i.test(ct) && (!len || len > minBytes);
    } catch { return false; }
}
async function firstValid(tries, fail) {
    for (const t of tries) { try { const r = await t(); if (r?.url && await probeUrl(r.url)) return r; } catch {  } }
    throw new Error(fail);
}
async function anabotTask(path, link, extra = '') {
    const s = await getJson(`${ANA}/download/${path}?url=${enc(link)}${extra}&apikey=${ANA_KEY}`, { timeout: 25000 });
    if (!s?.data?.taskId) { const u = s?.data?.result?.urls || s?.data?.result?.url; if (u) return { url: u, mime: s.data.result.mimetype, title: s.data.result.metadata?.title }; throw new Error('anabot returned no task or url'); }
    return anabotPoll(s.data.taskId);
}

export async function ytAudio(link) {
    return raceValid([
        async () => { const j = (await getJson(`${NX}/downloader/savetube?url=${enc(link)}&quality=mp3`, { timeout: 45000 })).result; return j?.url && { url: j.url, mime: 'audio/mpeg', title: j.title, duration: j.duration, thumb: j.thumbnail }; },
        () => anabotTask('ytmp3', link),
        async () => { const j = (await getJson(`${BK9}/download/ytmp3?url=${enc(link)}`, { timeout: 30000 })).BK9; return j?.downloadUrl && { url: j.downloadUrl, mime: 'audio/mp4', title: j.title }; },
        async () => { const r = (await getJson(`${ANA}/download/aio?url=${enc(link)}&apikey=${ANA_KEY}`, { timeout: 45000 }))?.data?.result; return r?.urls && { url: r.urls, mime: r.mimetype || 'video/mp4', title: r.metadata?.title, isVideo: true }; }
    ], 'All audio providers failed, try again later');
}

async function raceValid(tries, fail) {
    try { return await Promise.any(tries.map(async (t) => { const r = await t(); if (r?.url && await probeUrl(r.url)) return r; throw new Error('bad'); })); }
    catch { throw new Error(fail); }
}
export async function ytVideo(link, quality = '360') {
    return raceValid([
        async () => { const j = (await getJson(`${NX}/downloader/savetube?url=${enc(link)}&quality=${quality}`, { timeout: 50000 })).result; return j?.url && { url: j.url, mime: 'video/mp4', title: j.title, quality: j.quality }; },
        async () => { const r = await anabotTask('ytmp4', link, `&quality=${quality}`); return { ...r, mime: 'video/mp4', quality }; },
        async () => { const r = (await getJson(`${ANA}/download/aio?url=${enc(link)}&apikey=${ANA_KEY}`, { timeout: 45000 }))?.data?.result; return r?.urls && { url: r.urls, mime: r.mimetype || 'video/mp4', title: r.metadata?.title, quality: 'best' }; }
    ], 'All video providers failed, try again later');
}

export async function tiktok(link) {
    try {
        const r = (await getJson(`${ANA}/download/tiktok?url=${enc(link)}&apikey=${ANA_KEY}`, { timeout: 30000 }))?.data?.result;
        const video = r?.nowatermark || r?.video;
        if (video || r?.audio) return { video, audio: r.audio, user: r.username, text: r.description };
    } catch {  }
    const r = (await getJson(`${NX}/downloader/tiktok?url=${enc(link)}`, { timeout: 30000 }))?.result;
    const video = r?.video || r?.play || r?.nowm;
    if (!video) throw new Error('Could not fetch that TikTok');
    return { video, audio: r.music || r.audio, user: r.author, text: r.title };
}

export async function aio(link) {
    const r = (await getJson(`${ANA}/download/aio?url=${enc(link)}&apikey=${ANA_KEY}`, { timeout: 60000 }))?.data?.result;
    const url = r?.urls || r?.url;
    if (!r?.success && !url) throw new Error('Could not fetch that link (is it public?)');
    if (typeof url !== 'string') throw new Error('Could not fetch that link');
    return { url, mime: r.mimetype || '', title: r.metadata?.title || '' };
}
const firstOf = (...fns) => async (...a) => {
    let last;
    for (const f of fns) { try { return await f(...a); } catch (e) { last = e; } }
    throw last || new Error('all providers failed');
};

export const facebook = firstOf(
    async (link) => {
        const r = (await getJson(`${NX}/downloader/facebook?url=${enc(link)}`, { timeout: 30000 }))?.result;
        const url = r?.video_hd || r?.video_sd || r?.hd || r?.sd;
        if (!url) throw new Error('empty');
        return { url, title: r.title, hd: Boolean(r.video_hd) };
    },
    aio
);
export const pinterest = firstOf(
    async (link) => {
        const r = (await getJson(`${NX}/downloader/pinterest?url=${enc(link)}`, { timeout: 30000 }))?.result;
        const url = r?.url || r?.video || r?.image || r?.media?.[0]?.url || r?.medias?.[0]?.url;
        if (typeof url !== 'string') throw new Error('empty');
        return { url, title: r.title };
    },
    async (link) => {
        for (const host of ['https://api.delirius.store', 'https://api.delirius.online']) {
            try {
                const d = (await getJson(`${host}/download/pinterestdl?url=${enc(link)}`, { timeout: 25000 }))?.data;
                const url = d?.download?.url || d?.download || d?.url;
                if (typeof url === 'string') return { url, title: d.title };
            } catch {  }
        }
        throw new Error('empty');
    },
    aio
);
export const mediafire = firstOf(
    async (link) => {
        const r = (await getJson(`${NX}/downloader/mediafire?url=${enc(link)}`, { timeout: 30000 }))?.result;
        const url = r?.download_url || r?.download || r?.url || r?.link;
        if (typeof url !== 'string') throw new Error('empty');
        return { url, name: r.filename || r.name, size: r.filesize || r.size, type: r.filetype || r.mime };
    },
    async (link) => {
        const r = (await getJson(`${ANA}/download/mediafire?url=${enc(link)}&apikey=${ANA_KEY}`, { timeout: 30000 }))?.data?.result;
        const url = r?.download || r?.directUrl;
        if (!url) throw new Error('No downloadable file found');
        return { url, name: r.filename, size: r.filesize, type: r.filetype };
    }
);
export async function mega(link) {
    const r = (await getJson(`${NX}/downloader/mega?url=${enc(link)}`, { timeout: 60000 }))?.result;
    const f = Array.isArray(r) ? r[0] : r;
    const url = f?.download_url || f?.download || f?.url || f?.link || f?.files?.[0]?.url;
    if (typeof url !== 'string') throw new Error('Could not read that MEGA link (public file links only)');
    return { url, name: f.filename || f.name || f.title, size: f.filesize || f.size };
}
export async function gdrive(link) {
    const r = (await getJson(`${ANA}/download/gDrive?url=${enc(link)}&apikey=${ANA_KEY}`, { timeout: 30000 }))?.data?.result;
    if (!r?.download) throw new Error('No downloadable file found (is the link public?)');
    return { url: r.download, name: r.name };
}
export const apk = firstOf(
    async (query) => {
        const j = await getJson(`https://ws75.aptoide.com/api/7/apps/search?query=${enc(query)}&limit=1`, { timeout: 20000 });
        const a = j?.datalist?.list?.[0];
        if (!a?.file?.path) throw new Error('No APK found for that name');
        return { url: a.file.path, name: a.name, size: a.size, pkg: a.package, icon: a.icon, version: a.file.vername };
    },
    async (query) => {
        for (const host of ['https://api.delirius.store', 'https://api.delirius.online']) {
            try {
                const d = (await getJson(`${host}/download/apk?query=${enc(query)}`, { timeout: 25000 }))?.data;
                if (d?.download) return { url: d.download, name: d.name, size: d.size, pkg: d.package, icon: d.image };
            } catch {  }
        }
        throw new Error('No APK found for that name');
    }
);

export async function ssweb(url) {
    try { const r = (await getJson(`${NX}/tools/ssweb?url=${enc(url)}`, { timeout: 40000 }))?.result; if (r?.file_url) return { url: r.file_url, title: r.title }; } catch {  }
    return { url: `https://image.thum.io/get/width/1280/${url}`, title: url };
}
export async function transcript(link) {
    const id = ytId(link);
    const r = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST', signal: AbortSignal.timeout(30000),
        headers: { 'content-type': 'application/json', 'user-agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip' },
        body: JSON.stringify({ context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 34, hl: 'en' } }, videoId: id })
    });
    const j = await r.json();
    const tracks = j.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    if (!tracks.length) throw new Error('No transcript (the video has no captions)');
    const tr = tracks.find((t) => t.languageCode === 'en' && t.kind !== 'asr') || tracks.find((t) => t.languageCode === 'en') || tracks[0];
    const xml = await (await fetch(tr.baseUrl, { signal: AbortSignal.timeout(30000) })).text();
    const dec = (x) => x.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
    const lines = [...xml.matchAll(/<p [^>]*>([\s\S]*?)<\/p>/g)].map((m) => dec(m[1].replace(/<[^>]+>/g, '')).trim()).filter(Boolean);
    if (!lines.length) throw new Error('Empty transcript');
    return `[${tr.name?.simpleText || tr.languageCode}]\n\n${lines.join('\n')}`;
}

const cleanAi = (t) => (typeof t === 'string' ? t.replace(/\*\*/g, '*').trim() : '');
const engines = {
    claude: async (p) => (await getJson(`${NX}/ai/claude?text=${enc(p)}`, { timeout: 45000 }))?.result,
    gpt35: async (p) => (await getJson(`${NX}/ai/gpt-3.5-turbo?text=${enc(p)}`, { timeout: 45000 }))?.result,
    chatgpt: async (p) => (await getJson(`${ANA}/ai/chatgpt?prompt=${enc(p)}&apikey=${ANA_KEY}`, { timeout: 60000 }))?.data?.result?.chat,
    claude2: async (p) => (await getJson(`https://api.nexray.web.id/ai/claude?text=${enc(p)}`, { timeout: 45000 }))?.result,
    pollinations: async (p) => getText(`https://text.pollinations.ai/${enc(p)}?model=openai`, { timeout: 40000 })
};
export const MODEL_CHAIN = {
    default: ['claude', 'chatgpt', 'gpt35', 'claude2', 'pollinations'],
    claude: ['claude', 'claude2', 'chatgpt'],
    gpt: ['gpt35', 'chatgpt', 'claude'],
    chatgpt: ['chatgpt', 'gpt35', 'claude'],
    math: ['chatgpt', 'claude', 'gpt35']
};
export async function aiAsk(prompt, { system, chain = 'default' } = {}) {
    const full = system ? `${system}\n\nUser: ${prompt}` : prompt;
    for (const name of MODEL_CHAIN[chain] || MODEL_CHAIN.default) {
        try {
            const t = cleanAi(await engines[name](full));
            if (t && !t.startsWith('{"error"')) return { text: t, engine: name };
        } catch {  }
    }
    throw new Error('AI is busy, try again in a minute');
}
export async function geminiAsk(prompt, { system, key }) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(30000),
        body: JSON.stringify({ ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), contents: [{ role: 'user', parts: [{ text: prompt }] }] })
    });
    const j = await r.json(); const t = j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('');
    if (!t) throw new Error(j?.error?.message || 'Gemini returned nothing');
    return t.trim();
}
export async function aiText(prompt, { system, geminiKey, chain } = {}) {
    if (geminiKey) { try { return await geminiAsk(prompt, { system, key: geminiKey }); } catch {  } }
    return (await aiAsk(prompt, { system, chain })).text;
}
export const aiImageUrl = (prompt) => `https://image.pollinations.ai/prompt/${enc(prompt)}?width=768&height=768&nologo=true&seed=${Math.floor(Math.random() * 1e6)}`;

const kyio = { blockedUntil: 0 };
const kyioBlocked = (msg) => /percobaan|berbayar|limit|quota|upgrade/i.test(String(msg || ''));

export async function kyioAsk(prompt, { timeoutMs = 15_000 } = {}) {
    if (Date.now() < kyio.blockedUntil) throw new Error('kyio quota paused');
    const res = await fetch(`https://api.kyio.web.id/api/v2/ai/gemini?q=${encodeURIComponent(prompt)}`, {
        signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'RCD-X-MINI-BOT', Accept: 'application/json' }
    });
    const j = await res.json().catch(() => null);
    const t = j?.result?.result;
    if (!res.ok || !j?.status || !t) {
        const msg = j?.error?.message || j?.message || 'kyio failed';
        if (kyioBlocked(msg)) kyio.blockedUntil = Date.now() + 30 * 60_000;
        throw new Error(msg);
    }
    return String(t).trim();
}

export async function kyioVision(buf, prompt, mime = 'image/jpeg', { timeoutMs = 25_000 } = {}) {
    if (Date.now() < kyio.blockedUntil) throw new Error('kyio quota paused');
    const fd = new FormData();
    fd.append('url', new Blob([buf], { type: mime }), 'photo.jpg');
    fd.append('file', 'rcdxmini');
    fd.append('prompt', prompt);
    fd.append('web_access', 'false');
    const res = await fetch('https://api.kyio.web.id/api/v2/ai/vision', { method: 'POST', body: fd, signal: AbortSignal.timeout(timeoutMs) });
    const j = await res.json().catch(() => null);
    const t = j?.result?.result;
    if (!res.ok || !j?.status || !t) {
        const msg = j?.error?.message || j?.message || 'vision failed';
        if (kyioBlocked(msg)) kyio.blockedUntil = Date.now() + 30 * 60_000;
        throw new Error(msg);
    }
    return String(t).trim();
}

export async function imgSearch(q, limit = 6) {
    const html = await getText(`https://www.bing.com/images/search?q=${enc(q)}&first=1`, {
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'accept-language': 'en-US,en;q=0.9' }
    });
    const dec = html.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const urls = [...dec.matchAll(/"murl":"(https?:\/\/[^"]+?)"/g)].map((m) => m[1]);
    const out = [];
    for (const u of urls) {
        if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(u) && !out.includes(u)) out.push(u);
        if (out.length >= limit) break;
    }
    if (!out.length) throw new Error('No images found');
    return out.map((url, i) => ({ url, title: `${q} ${i + 1}` }));
}
