import { getJson } from './http.js';

const BASE = (process.env.CINESUBZ_BASE || 'https://cinesubz.dexterid.org').replace(/\/$/, '');

const pick = (o, keys) => { for (const k of keys) { const v = o?.[k]; if (typeof v === 'string' && v.trim()) return v.trim(); } return ''; };

function normResult(r) {
    if (!r || typeof r !== 'object') return null;
    const url = pick(r, ['url', 'link', 'href', 'post_url', 'permalink', 'p']);
    const title = pick(r, ['title', 'name', 'post_title', 'movie', 't']);
    if (!url && !title) return null;
    return {
        url, title: title || url,
        image: pick(r, ['image', 'poster', 'thumbnail', 'img', 'thumb', 'featured', 'i']),
        meta: [pick(r, ['year']), pick(r, ['quality', 'quality_tag']), pick(r, ['language'])].filter(Boolean).join(' · ')
    };
}

export async function cszSearch(q, limit = 10) {
    const j = await getJson(`${BASE}/search?q=${encodeURIComponent(q)}`, { timeout: 30000 });
    if (j?.error) throw new Error(j.error);
    const out = (Array.isArray(j?.results) ? j.results : []).map(normResult).filter(Boolean).slice(0, limit);
    if (!out.length) throw new Error(`CineSubz: no results for "${q}"`);
    return out;
}

function collectLinks(node, label, out, depth = 0) {
    if (!node || depth > 5) return;
    if (typeof node === 'string') { if (/^https?:\/\//i.test(node)) out.push({ url: node, label: label || 'Download' }); return; }
    if (Array.isArray(node)) { node.forEach((x, i) => collectLinks(x, label || `Part ${i + 1}`, out, depth + 1)); return; }
    if (typeof node === 'object') {
        const u = pick(node, ['url', 'link', 'href', 'download', 'src', 'file']);
        const l = pick(node, ['label', 'title', 'name', 'quality', 'episode', 'server']) || label;
        if (u && /^https?:\/\//i.test(u)) out.push({ url: u, label: l });
        for (const k of ['links', 'downloads', 'episodes', 'files', 'servers', 'parts']) collectLinks(node[k], l, out, depth + 1);
    }
}

export async function cszDownload(url) {
    const j = await getJson(`${BASE}/download?url=${encodeURIComponent(url)}`, { timeout: 45000 });
    if (!j || j.error) throw new Error(j?.error || 'CineSubz: no download data (is the post live?)');
    const md = j.metadata || {};
    const links = [];
    for (const k of ['links', 'downloads', 'episodes', 'files', 'data', 'result']) collectLinks(j[k], '', links);
    if (!links.length) collectLinks(j, '', links);
    const seen = new Set(); const uniq = links.filter((l) => (seen.has(l.url) ? false : (seen.add(l.url), true)));
    return { title: j.title || md.title || '', metadata: md, links: uniq };
}
