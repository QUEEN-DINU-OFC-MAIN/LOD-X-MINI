import * as P from '../lib/providers.js';
import { sendRemote, safeName } from '../lib/send.js';
import { getBuffer } from '../lib/http.js';
import { toVoice, waveform } from '../lib/media.js';
import { B, waLogger } from '../../shared/wa.js';
import { menuImageFor } from '../lib/ui.js';

const IP = B.proto.Message.InteractiveMessage;

async function songCarousel(ctx, results) {
    const sock = ctx.sock; const upload = sock.waUploadToServer;
    const cards = await Promise.all(results.map(async (v, i) => {
        let media;
        try { media = await B.prepareWAMessageMedia({ image: { url: v.thumb } }, { upload, logger: waLogger }); }
        catch { media = await B.prepareWAMessageMedia({ image: menuImageFor('download') }, { upload, logger: waLogger }); }
        const meta = `👤 ${v.channel || '—'} · ⏱️ ${v.duration || '—'}`;
        return {
            header: IP.Header.create({ ...media, title: `🎵 ${i + 1}`, subtitle: (v.channel || 'YouTube').slice(0, 60), hasMediaAttachment: true }),
            body: IP.Body.create({ text: `${i + 1}. ${v.title}\n${meta} · ${v.views || ''}` }),
            nativeFlowMessage: IP.NativeFlowMessage.create({ buttons: [] })
        };
    }));
    const content = {
        viewOnceMessage: { message: { interactiveMessage: IP.create({
            body: IP.Body.create({ text: `🎵 *SONG — ${results.length} results*\n\n👉 Swipe a thumbnail, tap how you want it.` }),
            footer: IP.Footer.create({ text: 'RCD X MINI • YOUTUBE' }),
            carouselMessage: IP.CarouselMessage.create({ cards, messageVersion: 1 })
        }) } }
    };
    const msg = B.generateWAMessageFromContent(ctx.jid, content, { logger: waLogger });
    await sock.relayMessage(ctx.jid, msg.message, { messageId: msg.key.id });
}

const LONG = 240_000;
const looksId = (x) => /^[A-Za-z0-9_-]{11}$/.test(x || '') && /[0-9A-Z_-]/.test(x);
const usage = (ctx, u) => ctx.reply(`ℹ️ Usage: ${ctx.prefix}${u}`);

async function songJob(ctx, id, mode) {
    const a = await P.ytAudio(P.ytLink(id));
    const name = safeName(a.title || id, a.mime.includes('mp4') ? 'm4a' : 'mp3');
    if (mode === 'doc') return sendRemote(ctx, 'document', a.url, { mimetype: a.mime, fileName: name });
    if (mode === 'voice') {
        const raw = await getBuffer(a.url, { timeout: 120_000 });
        const voice = await toVoice(raw, a.mime.includes('mp4') ? 'm4a' : 'mp3');
        return ctx.sock.sendMessage(ctx.jid, { audio: voice, mimetype: 'audio/ogg; codecs=opus', ptt: true, waveform: waveform() }, { quoted: ctx.msg });
    }
    return sendRemote(ctx, 'audio', a.url, { mimetype: a.mime });
}
const idOf = async (ctx, text) => P.ytId(text) || (looksId(text) ? text : (await P.resolveVideo(text)).id);
export { songCarousel };

export default [
    {
        name: 'song', aliases: ['play', 'ytmp3'], cat: 'download', desc: 'Search a song, then pick Voice note / Audio / Document  (.song despacito)', timeoutMs: LONG,
        async run(ctx) {
            if (!ctx.text) return usage(ctx, 'song despacito');
            if (ctx.settings.buttons) {
                try {
                    const list = await P.ytSearch(ctx.text, 6);
                    if (list.length > 1) {
                        await songCarousel(ctx, list).catch(() => {});
                        const p = ctx.prefix;
                        return ctx.sendButtons({
                            text: `🎵 *${ctx.text}* — ${list.length} results\n👇 Pick one to download as audio:`,
                            sections: [{ title: 'RESULTS', highlight_label: '', rows: list.map((v, i) => ({ title: `${i + 1}. ${v.title}`.slice(0, 24), description: `${v.channel || ''} · ${v.duration || ''}`.slice(0, 60), id: `${p}songdl audio ${v.id}` })) }],
                            listLabel: '🎵 Pick a song', listTitle: 'Choose'
                        });
                    }
                } catch { }
            }
            const v = await P.resolveVideo(ctx.text);
            const p = ctx.prefix;
            await ctx.sendButtons({
                text: `🎵 *${v.title || 'Song'}*\n\n${v.channel ? `👤 ${v.channel}\n` : ''}${v.duration ? `⏱️ ${v.duration}\n` : ''}${v.views ? `🎭 ${String(v.views).replace(/\s*views?/i, '')} views\n` : ''}\n👇 *How do you want it?*`,
                image: { url: v.thumb }, header: false,
                quick: [{ id: `${p}songdl voice ${v.id}`, label: '🎙️ VOICE NOTE' }, { id: `${p}songdl audio ${v.id}`, label: '🎵 AUDIO' }, { id: `${p}songdl doc ${v.id}`, label: '📄 DOCUMENT' }],
                sections: [{
                    title: 'DOWNLOAD AS', highlight_label: '', rows: [
                        { title: '🎙️ Voice note', description: 'plays like a WhatsApp voice message', id: `${p}songdl voice ${v.id}` },
                        { title: '🎵 Audio', description: 'normal music player', id: `${p}songdl audio ${v.id}` },
                        { title: '📄 Document', description: 'save the mp3 file', id: `${p}songdl doc ${v.id}` },
                        { title: '🎬 Video 360p', description: 'mp4', id: `${p}video ${v.id} 360` },
                        { title: '🎬 Video 720p', description: 'mp4 HD', id: `${p}video ${v.id} 720` }
                    ]
                }],
                listLabel: '⬇️ More options', listTitle: 'Download'
            });
        }
    },
    {
        name: 'songdl', hidden: true, cat: 'download', desc: 'internal: send the chosen song format', timeoutMs: LONG,
        async run(ctx) {
            const mode = ['voice', 'audio', 'doc'].includes(ctx.args[0]) ? ctx.args[0] : 'audio';
            const q = ctx.args.slice(1).join(' ');
            if (!q) return usage(ctx, 'songdl voice <id>');
            const label = { voice: '🎙️ voice note', audio: '🎵 audio', doc: '📄 document' }[mode];
            await ctx.reply(`⏳ Preparing your ${label}…`);
            const id = await idOf(ctx, q);
            ctx.background(() => songJob(ctx, id, mode), 'song');
        }
    },
    {
        name: 'songdoc', cat: 'download', desc: 'Song as a document file  (.songdoc name)', timeoutMs: LONG,
        async run(ctx) {
            if (!ctx.text) return usage(ctx, 'songdoc despacito');
            const id = await idOf(ctx, ctx.text);
            ctx.background(() => songJob(ctx, id, 'doc'), 'songdoc');
        }
    },
    {
        name: 'songvn', aliases: ['voicesong', 'vsong'], cat: 'download', desc: 'Song as a voice note  (.songvn name)', timeoutMs: LONG,
        async run(ctx) {
            if (!ctx.text) return usage(ctx, 'songvn despacito');
            const id = await idOf(ctx, ctx.text);
            ctx.background(() => songJob(ctx, id, 'voice'), 'songvn');
        }
    },
    {
        name: 'video', aliases: ['ytmp4'], cat: 'download', desc: 'Download a video, then pick quality  (.video baby shark)', timeoutMs: LONG,
        async run(ctx) {
            const [first, q] = [ctx.args[0], ctx.args[1]];
            const quality = ['144', '240', '360', '480', '720', '1080'].includes(q) ? q : null;
            const rest = quality ? ctx.args.slice(0, -1).join(' ') : ctx.text;
            if (!rest) return usage(ctx, 'video baby shark');
            const v = looksId(first) && ctx.args.length <= 2 ? { id: first, title: '', thumb: `https://i.ytimg.com/vi/${first}/hqdefault.jpg` } : await P.resolveVideo(rest);
            if (!quality) {
                const row = (qq) => ({ title: `🎬 ${qq}p`, description: 'MP4', id: `${ctx.prefix}video ${v.id} ${qq}` });
                return ctx.sendButtons({
                    text: `🎬 *${v.title || 'Video'}*\n${v.duration ? `⏱️ ${v.duration}\n` : ''}\n👇 Choose a quality`,
                    image: { url: v.thumb }, header: false,
                    quick: [{ id: `${ctx.prefix}video ${v.id} 360`, label: '360p' }, { id: `${ctx.prefix}video ${v.id} 720`, label: '720p' }],
                    sections: [{ title: 'VIDEO QUALITY', highlight_label: '', rows: ['144', '240', '360', '480', '720', '1080'].map(row) }],
                    listLabel: '🎞️ All qualities', listTitle: 'Quality'
                });
            }
            await ctx.reply(`⏳ Downloading ${quality}p…`);
            ctx.background(async () => {
                const r = await P.ytVideo(P.ytLink(v.id), quality);
                await sendRemote(ctx, 'video', r.url, { caption: `🎬 ${r.title || v.title || ''}\n_${quality}p_` });
            }, 'video');
        }
    },
    {
        name: 'tiktok', aliases: ['tt'], cat: 'download', desc: 'TikTok video / audio  (.tiktok <link>)', timeoutMs: LONG,
        async run(ctx) {
            const mode = ['v', 'a'].includes(ctx.args[0]) ? ctx.args[0] : null;
            const link = P.isUrl(ctx.args[mode ? 1 : 0]) ? ctx.args[mode ? 1 : 0] : null;
            if (!link) return usage(ctx, 'tiktok https://vt.tiktok.com/xxxx');
            if (!mode) return ctx.sendButtons({ text: '📱 *TikTok* — choose a format', quick: [{ id: `${ctx.prefix}tiktok v ${link}`, label: '🎬 VIDEO' }, { id: `${ctx.prefix}tiktok a ${link}`, label: '🎵 AUDIO' }] });
            ctx.background(async () => {
                const r = await P.tiktok(link);
                if (mode === 'a') { if (!r.audio) throw new Error('no audio track'); await sendRemote(ctx, 'audio', r.audio); }
                else { if (!r.video) throw new Error('no video'); await sendRemote(ctx, 'video', r.video, { caption: `📱 ${r.user || ''}\n${(r.text || '').slice(0, 200)}` }); }
            }, 'tiktok');
            await ctx.react('⏳');
        }
    },
    {
        name: 'fb', aliases: ['facebook'], cat: 'download', desc: 'Facebook video  (.fb <link>)', timeoutMs: LONG,
        async run(ctx) {
            if (!P.isUrl(ctx.args[0])) return usage(ctx, 'fb https://www.facebook.com/…');
            await ctx.react('⏳');
            ctx.background(async () => { const r = await P.facebook(ctx.args[0]); await sendRemote(ctx, 'video', r.url, { caption: `📘 ${r.title || 'Facebook video'}` }); }, 'fb');
        }
    },
    {
        name: 'mediafire', aliases: ['mf'], cat: 'download', desc: 'MediaFire file  (.mediafire <link>)', timeoutMs: LONG,
        async run(ctx) {
            if (!P.isUrl(ctx.args[0])) return usage(ctx, 'mediafire https://www.mediafire.com/file/…');
            await ctx.react('⏳');
            ctx.background(async () => { const r = await P.mediafire(ctx.args[0]); await sendRemote(ctx, 'document', r.url, { fileName: r.name, caption: `📦 ${r.name || ''}\n${r.size || ''}` }); }, 'mediafire');
        }
    },
    {
        name: 'gdrive', aliases: ['gdl', 'drive'], cat: 'download', desc: 'Google Drive file  (.gdrive <link>)', timeoutMs: LONG,
        async run(ctx) {
            if (!P.isUrl(ctx.args[0])) return usage(ctx, 'gdrive https://drive.google.com/file/d/…');
            await ctx.react('⏳');
            ctx.background(async () => { const r = await P.gdrive(ctx.args[0]); await sendRemote(ctx, 'document', r.url, { fileName: r.name, caption: `📁 ${r.name || ''}` }); }, 'gdrive');
        }
    },
    {
        name: 'apk', aliases: ['app'], cat: 'download', desc: 'Android APK  (.apk telegram)', timeoutMs: LONG,
        async run(ctx) {
            if (!ctx.text) return usage(ctx, 'apk telegram');
            await ctx.react('⏳');
            ctx.background(async () => { const r = await P.apk(ctx.text); await sendRemote(ctx, 'document', r.url, { mimetype: 'application/vnd.android.package-archive', fileName: safeName(r.name, 'apk'), caption: `📱 ${r.name}\n${r.size || ''}\n${r.pkg || ''}` }); }, 'apk');
        }
    }
    ,{
        name: 'mega', cat: 'download', desc: 'MEGA public file  (.mega <link>)', timeoutMs: LONG,
        async run(ctx) {
            if (!/mega\.nz|mega\.io/i.test(ctx.args[0] || '')) return usage(ctx, 'mega https://mega.nz/file/…');
            await ctx.react('⏳');
            ctx.background(async () => { const r = await P.mega(ctx.args[0]); await sendRemote(ctx, 'document', r.url, { fileName: r.name, caption: `☁️ ${r.name || 'MEGA file'}` }); }, 'mega');
        }
    },
    {
        name: 'pinterest', aliases: ['pin', 'pindl'], cat: 'download', desc: 'Pinterest image / video  (.pinterest <link>)', timeoutMs: LONG,
        async run(ctx) {
            if (!P.isUrl(ctx.args[0])) return usage(ctx, 'pinterest https://pin.it/…');
            await ctx.react('⏳');
            ctx.background(async () => {
                const r = await P.pinterest(ctx.args[0]);
                const video = /\.(mp4|mov|webm)(\?|$)/i.test(r.url);
                await sendRemote(ctx, video ? 'video' : 'image', r.url, { caption: `📌 ${r.title || 'Pinterest'}` });
            }, 'pinterest');
        }
    },
    {
        name: 'aio', aliases: ['dl', 'download', 'instagram', 'ig', 'twitter', 'threads'], cat: 'download', desc: 'Any social link: Instagram, X, Facebook, Threads…', timeoutMs: LONG,
        async run(ctx) {
            if (!P.isUrl(ctx.args[0])) return usage(ctx, 'aio https://www.instagram.com/reel/…');
            await ctx.react('⏳');
            ctx.background(async () => {
                const r = await P.aio(ctx.args[0]);
                const kind = /^image\//.test(r.mime) ? 'image' : /^audio\//.test(r.mime) ? 'audio' : 'video';
                await sendRemote(ctx, kind, r.url, { mimetype: r.mime || undefined, caption: `📥 ${r.title || ''}` });
            }, 'aio');
        }
    }
];
