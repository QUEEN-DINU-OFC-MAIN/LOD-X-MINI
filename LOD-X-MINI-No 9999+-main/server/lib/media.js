import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { B } from '../../shared/wa.js';

const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fonts');
let sharpP;
export function getSharp() {
    if (!sharpP) {
        sharpP = (async () => {
            if (!process.env.FONTCONFIG_FILE) {
                const conf = path.join(os.tmpdir(), 'rcd-fonts.conf');
                fs.writeFileSync(conf, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${FONT_DIR}</dir><cachedir>${path.join(os.tmpdir(), 'rcd-fc-cache')}</cachedir></fontconfig>`);
                process.env.FONTCONFIG_FILE = conf;
            }
            const sharp = (await import('sharp')).default;
            sharp.cache({ memory: 32, files: 0, items: 20 }); sharp.concurrency(1);
            return sharp;
        })();
    }
    return sharpP;
}
let ffmpegPath;
export async function ffmpegBin() {
    if (!ffmpegPath) { ffmpegPath = process.env.FFMPEG_PATH || (await import('ffmpeg-static')).default; process.env.FFMPEG_PATH = ffmpegPath; }
    return ffmpegPath;
}
export async function ffmpeg(args, input, ext = 'bin', outExt = 'mp3') {
    const bin = await ffmpegBin();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcd-ff-'));
    const inp = path.join(dir, `in.${ext}`); const out = path.join(dir, `out.${outExt}`);
    try {
        fs.writeFileSync(inp, input);
        await new Promise((res, rej) => {
            const p = spawn(bin, ['-y', '-loglevel', 'error', '-i', inp, ...args, out], { stdio: ['ignore', 'ignore', 'pipe'] });
            let err = ''; p.stderr.on('data', (d) => { err += d; });
            const t = setTimeout(() => { p.kill('SIGKILL'); rej(new Error('conversion timed out')); }, 60_000);
            p.on('close', (c) => { clearTimeout(t); c === 0 ? res() : rej(new Error(`ffmpeg: ${err.slice(0, 120)}`)); });
        });
        return fs.readFileSync(out);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

export const toVoice = (buf, ext = 'mp3') => ffmpeg(['-vn', '-c:a', 'libopus', '-b:a', '48k', '-ar', '48000', '-ac', '1', '-application', 'voip', '-f', 'ogg'], buf, ext, 'ogg');
export const waveform = () => { const w = new Uint8Array(64); let x = 40; for (let i = 0; i < 64; i++) { x = Math.max(8, Math.min(100, x + (Math.random() - 0.5) * 38)); w[i] = Math.round(x); } return w; };

const KINDS = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'];
const unwrap = (m) => m?.viewOnceMessage?.message || m?.viewOnceMessageV2?.message || m?.ephemeralMessage?.message || m || {};
export async function getMedia(ctx, { kinds = KINDS, maxMB = 20 } = {}) {
    const q = unwrap(ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage);
    const own = unwrap(ctx.msg.message);
    for (const src of [q, own]) {
        const key = KINDS.find((k) => src[k] && kinds.includes(k));
        if (!key) continue;
        const m = src[key];
        if (Number(m.fileLength) > maxMB * 1048576) throw new Error(`File is bigger than ${maxMB} MB`);
        let buffer = Buffer.alloc(0);
        for await (const c of await B.downloadContentFromMessage(m, key.replace('Message', ''))) { buffer = Buffer.concat([buffer, c]); if (buffer.length > maxMB * 1048576) throw new Error(`File is bigger than ${maxMB} MB`); }
        return { buffer, type: key.replace('Message', ''), mime: m.mimetype || '', animated: Boolean(m.isAnimated || m.gifPlayback), seconds: Number(m.seconds || 0) };
    }
    return null;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function wrapText(text, maxChars) {
    const lines = [];
    for (const para of String(text).split('\n')) {
        let line = '';
        for (const w of para.split(/\s+/)) {
            if (!w) continue;
            if ((line + ' ' + w).trim().length > maxChars) { if (line) lines.push(line); line = w.length > maxChars ? w.slice(0, maxChars) : w; } else line = (line + ' ' + w).trim();
        }
        lines.push(line);
    }
    return lines.slice(0, 8);
}
export async function textPng(text, color = '#ffffff') {
    const sharp = await getSharp();
    const lines = wrapText(text, 14);
    const longest = Math.max(...lines.map((l) => [...l].length), 1);
    const size = Math.max(40, Math.min(150, Math.floor(480 / Math.max(longest * 0.62, lines.length * 0.95))));
    const lh = size * 1.15; const y0 = 256 - ((lines.length - 1) * lh) / 2 + size * 0.3;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><style>text{font-family:'Noto Sans Sinhala','DejaVu Sans';font-weight:bold;font-size:${size}px;text-anchor:middle;fill:${color};stroke:#000;stroke-width:${Math.max(2, size / 14)}px;paint-order:stroke}</style>${lines.map((l, i) => `<text x="256" y="${y0 + i * lh}">${esc(l)}</text>`).join('')}</svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
}
export async function codePng(code) {
    const sharp = await getSharp();
    const lines = String(code).replace(/\t/g, '  ').split('\n').slice(0, 40).map((l) => l.slice(0, 90));
    const w = Math.max(480, Math.max(...lines.map((l) => l.length)) * 11 + 80); const h = lines.length * 22 + 90;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" rx="16" fill="#1e1e2e"/><circle cx="26" cy="26" r="7" fill="#ff5f56"/><circle cx="48" cy="26" r="7" fill="#ffbd2e"/><circle cx="70" cy="26" r="7" fill="#27c93f"/><style>text{font-family:'DejaVu Sans Mono';font-size:18px;fill:#cdd6f4;white-space:pre}</style>${lines.map((l, i) => `<text x="30" y="${70 + i * 22}" xml:space="preserve">${esc(l)}</text>`).join('')}</svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
}
