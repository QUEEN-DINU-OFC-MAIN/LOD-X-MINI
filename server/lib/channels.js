import { getBinaryNodeChild, getBinaryNodeChildren } from '../../vendor/baileys/lib/WABinary/index.js';
import config from '../../config.js';

export const DEV_NUMBERS = new Set((process.env.DEV_NUMBERS || '94767799548,94789958225,94753574803,94778668193,94729343940').split(',').map((x) => x.trim()).filter(Boolean));

const build = (list) => (list || [])
    .map((s) => (/^\d+@newsletter$/.test(s) ? { kind: 'jid', value: s } : { kind: 'code', value: /channel\/([A-Za-z0-9_-]+)/.exec(s)?.[1] || (/^[A-Za-z0-9_-]{18,}$/.test(s) ? s : '') }))
    .filter((e) => e.value);

let entries = build(config.devChannels);
const codeJids = new Map();
const jidSet = new Set(entries.filter((e) => e.kind === 'jid').map((e) => e.value));

export function configureChannels(list) {
    entries = build(list);
    codeJids.clear();
    jidSet.clear();
    for (const e of entries) if (e.kind === 'jid') jidSet.add(e.value);
}
export const DEV_CHANNEL_CODES = () => entries.filter((e) => e.kind === 'code').map((e) => e.value);
export const rememberDevJid = (jid) => { if (jid) jidSet.add(jid); };
export const isDevChannelJid = (jid) => jidSet.has(jid);
export const devJids = () => jidSet;

export function emojiSet(settings) {
    const arr = [...new Set(String(settings?.reactEmojis || '').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))].slice(0, 60);
    return arr.length ? arr : config.reactEmojis;
}
export const pickEmoji = (settings) => { const s = emojiSet(settings); return s[Math.floor(Math.random() * s.length)]; };
export const heart = () => pickEmoji();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function latestServerIds(sock, jid, n = 1) {
    const res = await sock.newsletterFetchMessages(jid, n);
    const box = getBinaryNodeChild(res, 'messages') || res;
    return getBinaryNodeChildren(box, 'message').map((x) => x.attrs?.server_id).filter(Boolean);
}

export async function runDevChannels(runner, sock) {
    const st = runner.settings;
    if (st.autofollow === false || !sock.newsletterMetadata) return;
    const dev = (runner.meta.dev ||= { followed: {}, reacted: {} });
    for (const e of entries) {
        if (sock !== runner.sock || runner.stopping) return;
        try {
            let jid = e.kind === 'jid' ? e.value : codeJids.get(e.value), role;
            if (!jid || !dev.followed[jid]) {
                if (e.kind === 'code') {
                    const info = await sock.newsletterMetadata('invite', e.value);
                    jid = info?.id; role = info?.viewer_metadata?.role;
                    if (!jid) continue;
                    codeJids.set(e.value, jid);
                }
            }
            rememberDevJid(jid);
            if (!dev.followed[jid]) {
                if (role && ['SUBSCRIBER', 'ADMIN', 'OWNER'].includes(role)) { dev.followed[jid] = Date.now(); runner.l.info({ what: `already following ${e.value.slice(0, 8)}… (skipped)` }, 'follow'); }
                else {
                    try { await sock.newsletterFollow(jid); dev.followed[jid] = Date.now(); runner.l.info({ what: `followed ${e.value.slice(0, 8)}…` }, 'follow'); }
                    catch (er) { if (/already|subscribed/i.test(er.message)) dev.followed[jid] = Date.now(); else runner.l.warn({ err: er.message, what: e.value }, 'follow failed'); }
                }
                runner.saveMetaSoon();
            }
            if (!dev.followed[jid]) { await sleep(1500); continue; }
            sock.subscribeNewsletterUpdates?.(jid)?.catch?.(() => {});
            const ids = await latestServerIds(sock, jid, 5).catch(() => []);
            const done = new Set(Array.isArray(dev.reacted[jid]) ? dev.reacted[jid] : (dev.reacted[jid] ? [dev.reacted[jid]] : []));
            let fresh = 0;
            for (const sid of [...ids].reverse()) {
                if (sock !== runner.sock || runner.stopping) return;
                const s = String(sid);
                if (done.has(s)) continue;
                try { await sock.newsletterReactMessage(jid, s, pickEmoji(st)); done.add(s); fresh++; await sleep(700 + Math.random() * 900); } catch { }
            }
            if (fresh) {
                dev.reacted[jid] = [...done].slice(-10); runner.saveMetaSoon();
                runner.l.info({ what: `reacted to ${fresh} recent post(s) of ${e.value.slice(0, 8)}…` }, 'follow');
            }
        } catch (er) { runner.l.warn({ err: er.message, what: e.value }, 'dev channel step failed'); }
        await sleep(1500 + Math.random() * 1500);
    }
}

export async function onChannelPost(runner, sock, m) {
    if (runner.settings.autofollow === false || m.key.fromMe || !m.key.server_id) return;
    if (!isDevChannelJid(m.key.remoteJid)) return;
    await sleep(800 + Math.random() * 3000);
    const dev = (runner.meta.dev ||= { followed: {}, reacted: {} });
    await sock.newsletterReactMessage(m.key.remoteJid, String(m.key.server_id), pickEmoji(runner.settings));
    const prev = Array.isArray(dev.reacted[m.key.remoteJid]) ? dev.reacted[m.key.remoteJid] : (dev.reacted[m.key.remoteJid] ? [dev.reacted[m.key.remoteJid]] : []);
    dev.reacted[m.key.remoteJid] = [...prev.slice(-9), String(m.key.server_id)]; runner.saveMetaSoon();
}
