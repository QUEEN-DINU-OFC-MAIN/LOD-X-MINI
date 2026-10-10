
export async function fullFrame(buf, style = 'full', size = 640) {
    const { default: sharp } = await import('sharp');
    const inner = await sharp(buf, { failOn: 'none' }).rotate().resize(size, size, { fit: 'inside', withoutEnlargement: false }).jpeg({ quality: 92 }).toBuffer();
    if (style === 'full') return inner;
    const bg = style === 'white' ? sharp({ create: { width: size, height: size, channels: 3, background: '#ffffff' } }).jpeg().toBuffer()
        : style === 'black' ? sharp({ create: { width: size, height: size, channels: 3, background: '#000000' } }).jpeg().toBuffer()
        : sharp(buf, { failOn: 'none' }).rotate().resize(size, size, { fit: 'cover' }).blur(28).modulate({ brightness: 0.8 }).jpeg().toBuffer();
    return sharp(await bg).composite([{ input: inner, gravity: 'centre' }]).jpeg({ quality: 92 }).toBuffer();
}

export function safeImgUrl(u) {
    try {
        const x = new URL(String(u || ''));
        if (x.protocol !== 'https:') return null;
        return /^(i\.)?ibb\.co$/i.test(x.hostname) ? x.href : null;
    } catch { return null; }
}

export async function uploadToImgbb(image, { key, expiration = 3600 } = {}) {
    if (!key) throw Object.assign(new Error('Image upload is not configured.'), { status: 500 });
    let img = String(image || '').trim();
    const dataUrl = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/s.exec(img);
    if (dataUrl) img = dataUrl[1];
    const isUrl = /^https?:\/\//i.test(img);
    if (!img) throw Object.assign(new Error('No image provided.'), { status: 400 });
    if (!isUrl && !/^[A-Za-z0-9+/=\s]+$/.test(img)) throw Object.assign(new Error('Unsupported image data.'), { status: 400 });

    const form = new URLSearchParams({ key, image: img });
    if (expiration > 0) form.set('expiration', String(expiration));
    const r = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.success || !j?.data?.url) {
        throw Object.assign(new Error(j?.error?.message || j?.status_txt || 'Image upload failed.'), { status: 502 });
    }
    return {
        url: j.data.url,
        display_url: j.data.display_url || j.data.url,
        delete_url: j.data.delete_url,
        id: j.data.id, width: j.data.width, height: j.data.height
    };
}

export async function fetchImageBuffer(url, maxBytes = 10 * 1024 * 1024) {
    const r = await fetch(url, { signal: AbortSignal.timeout(25_000) });
    if (!r.ok) throw new Error(`image fetch failed (HTTP ${r.status})`);
    const ab = await r.arrayBuffer();
    if (!ab.byteLength) throw new Error('empty image');
    if (ab.byteLength > maxBytes) throw new Error('image too large');
    return Buffer.from(ab);
}
