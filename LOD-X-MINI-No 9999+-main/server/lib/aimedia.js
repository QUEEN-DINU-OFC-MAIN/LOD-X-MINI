import { getJson, getBuffer, enc } from './http.js';
import { probeUrl } from './providers.js';

const ANA = process.env.ANABOT_BASE || 'https://anabot.my.id/api';
const KEY = process.env.ANABOT_KEY || 'freeApikey';
const sig = (ms) => AbortSignal.timeout(ms);

const HOSTS = {
    catbox: async (mk) => { const f = mk('fileToUpload'); f.set('reqtype', 'fileupload'); const t = (await (await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: f, signal: sig(40000) })).text()).trim(); if (!/^https?:\/\//.test(t)) throw new Error(t.slice(0, 60)); return t; },
    quax: async (mk, ext) => { const j = await (await fetch('https://qu.ax/upload.php', { method: 'POST', body: mk('files[]'), signal: sig(40000) })).json(); const u = j?.files?.[0]?.url; if (!u) throw new Error('no url'); return /\.\w{2,4}$/.test(u) ? u : `${u}.${ext}`; },
    tmpfiles: async (mk) => { const j = await (await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: mk('file'), signal: sig(40000) })).json(); const u = j?.data?.url; if (!u) throw new Error('no url'); return u.replace('tmpfiles.org/', 'tmpfiles.org/dl/'); },
    uguu: async (mk) => { const j = await (await fetch('https://uguu.se/upload', { method: 'POST', body: mk('files[]'), signal: sig(40000) })).json(); const u = j?.files?.[0]?.url; if (!u) throw new Error('no url'); return u; }
};
const ORDER_LINK = ['catbox', 'quax', 'uguu', 'tmpfiles'];
const ORDER_AI = ['uguu', 'catbox', 'tmpfiles', 'quax'];

export async function uploadPublic(buf, { mime = 'application/octet-stream', name = 'file.bin', order = ORDER_LINK, use } = {}) {
    const ext = (name.split('.').pop() || 'bin').toLowerCase().slice(0, 5);
    const mk = (field) => { const f = new FormData(); f.set(field, new Blob([buf], { type: mime }), `file_${Date.now().toString(36)}.${ext}`); return f; };
    let last;
    for (const h of order) {
        try { const url = await HOSTS[h](mk, ext); return use ? await use(url) : url; } catch (e) { last = e; }
    }
    throw new Error(`upload failed (${last?.message || 'all hosts down'})`);
}
export const withPublicUrl = (buf, meta, use) => uploadPublic(buf, { ...meta, order: ORDER_AI, use });

const anaResult = (j) => { const r = j?.data?.result; return typeof r === 'string' ? r : r?.imageUrl || r?.url || r?.ImageUrl || null; };
async function anaUrl(path, params, { timeout = 90000, minBytes = 3000 } = {}) {
    const q = Object.entries(params).map(([k, v]) => `${k}=${enc(v)}`).join('&');
    const j = await getJson(`${ANA}/${path}?${q}&apikey=${KEY}`, { timeout });
    const url = anaResult(j);
    if (!url || !/^https?:\/\//.test(url)) throw new Error(j?.error?.message || (typeof j?.error === 'string' ? j.error : '') || 'the AI service returned nothing');
    if (!(await probeUrl(url, { minBytes }))) throw new Error('the AI service returned an empty file');
    return url;
}

export const removeBg = (imageUrl) => anaUrl('ai/removebg', { imageUrl });
export const remini = (imageUrl) => anaUrl('ai/remini', { imageUrl }, { timeout: 110000 });
export const enhance = (imageUrl) => anaUrl('ai/toEnhance', { imageUrl });

export const DREAM_STYLES = ['Anime', 'Cinematic', 'Photo Realistic', 'Fantasy', 'Watercolor', 'Logo', 'Minimalist', 'Isometric', 'Single Portrait', 'Group Portrait'];
export const dream = (prompt, style = 'Anime') => anaUrl('ai/dreamImage', { prompt, models: style }, { timeout: 100000 });
export const pixai = (prompt) => anaUrl('ai/pixai', { prompt }, { timeout: 60000 });

export async function pollinations(prompt, model = 'flux') {
    const url = `https://image.pollinations.ai/prompt/${enc(prompt)}?width=768&height=768&nologo=true&model=${model}&seed=${Math.floor(Math.random() * 1e6)}`;
    if (!(await probeUrl(url, { minBytes: 3000 }))) throw new Error('image service busy – try again');
    return url;
}

export async function text2video(prompt) { return anaUrl('ai/text2video', { prompt }, { timeout: 170000, minBytes: 20000 }); }

export async function iqc({ text, chatTime, statusBarTime, signalName = 'Dialog', dark = true }) {
    const p = new URLSearchParams({
        text, chatTime, statusBarTime, fontName: 'Arial', signalName, apikey: KEY,
        ...(dark ? { bubbleColor: '#272a2f', menuColor: '#272a2f', textColor: '#FFFFFF' } : { bubbleColor: '#ffffff', menuColor: '#f2f2f7', textColor: '#000000' })
    });
    const buf = await getBuffer(`${ANA}/maker/iqc?${p}`, { timeout: 60000 });
    if (buf.length < 5000 || buf[0] !== 0x89) throw new Error('the iPhone-quote service failed – try again');
    return buf;
}
