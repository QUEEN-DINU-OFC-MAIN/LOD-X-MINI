const UA = { 'user-agent': 'LOD-X-MINI/1.0 (+whatsapp mini bot)' };
async function req(url, { timeout = 9000, headers, retry = 1 } = {}) {
    let r;
    for (let i = 0; ; i++) {
        try { r = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { ...UA, ...headers }, redirect: 'follow' }); }
        catch (e) { if (i < retry && e.name !== 'TimeoutError') { await new Promise((x) => setTimeout(x, 1200)); continue; } throw new Error(e.name === 'TimeoutError' ? 'service timeout, try again' : 'service unreachable'); }
        if ([429, 502, 503, 504].includes(r.status) && i < retry) { await new Promise((x) => setTimeout(x, 1500 + i * 1000)); continue; }
        break;
    }
    if (!r.ok) {
        let why = '';
        try { const j = JSON.parse((await r.text()).slice(0, 2000)); why = String(j.error?.message || j.error || j.message || '').slice(0, 90); } catch {  }
        throw new Error(`service error (${r.status})${why ? `: ${why}` : ''}`);
    }
    return r;
}
export const getJson = async (url, o) => (await req(url, o)).json();
export const getText = async (url, o) => (await req(url, o)).text();
export const getBuffer = async (url, o) => {
    const r = await req(url, o);
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length > 16 * 1024 * 1024) throw new Error('file too large');
    return b;
};
export const enc = encodeURIComponent;
