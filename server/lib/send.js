import { getBuffer } from './http.js';

const MAX = { audio: 40, video: 60, document: 150 };

const BUFFER_MB = Number(process.env.DL_BUFFER_MB ?? 8);

export async function remoteSize(url) {
    try {
        const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000), redirect: 'follow' });
        const n = Number(r.headers.get('content-length'));
        return Number.isFinite(n) && n > 0 ? n : 0;
    } catch { return 0; }
}

export async function sendRemote(ctx, kind, url, { mimetype, fileName, caption, ptt } = {}) {
    const size = await remoteSize(url);
    const cap = MAX[kind];
    if (cap && size > cap * 1048576) throw new Error(`file is ${(size / 1048576).toFixed(0)} MB – limit is ${cap} MB`);

    let media = { url };
    if (BUFFER_MB > 0 && size && size <= BUFFER_MB * 1048576) {
        try { media = await getBuffer(url, { timeout: 120_000 }); }
        catch { media = { url }; }
    }

    const content = kind === 'audio' ? { audio: media, mimetype: mimetype || 'audio/mpeg', ptt: !!ptt }
        : kind === 'video' ? { video: media, mimetype: mimetype || 'video/mp4', caption }
            : kind === 'image' ? { image: media, caption }
                : { document: media, mimetype: mimetype || 'application/octet-stream', fileName: fileName || 'file', caption };
    return ctx.sock.sendMessage(ctx.jid, content, { quoted: ctx.msg });
}
export const safeName = (s, ext) => `${String(s || 'file').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80)}.${ext}`;
