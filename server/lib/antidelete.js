import { B, waLogger, selfJid, numberOfJid } from '../../shared/wa.js';
import { resolvePN, senderIds, pretty } from './pn.js';
import { BOT_NAME } from './ui.js';

const MAX_MEDIA = 25 * 1024 * 1024;
const LINE = '━━━━━━━━━━━━━━━━━━';
const clock = (sec) => new Date(Number(sec || 0) * 1000 || Date.now()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Colombo' });
const KINDS = { imageMessage: 'image', videoMessage: 'video', audioMessage: 'audio', stickerMessage: 'sticker', documentMessage: 'document', ptvMessage: 'video' };

export function describe(message) {
    const c = B.normalizeMessageContent(message) || {};
    const type = B.getContentType(c);
    const body = c.conversation || c.extendedTextMessage?.text || c[type]?.caption || '';
    const kind = KINDS[type];
    return { c, type, kind, body, label: kind ? (type === 'audioMessage' && c.audioMessage?.ptt ? 'voice note' : kind) : type === 'conversation' || type === 'extendedTextMessage' ? 'text' : (type || 'message').replace(/Message$/, '') };
}

function targets(runner, sock, mode, chatJid) {
    const t = new Set();
    if (mode === 'me' || mode === 'both') t.add(selfJid(sock));
    if (mode === 'chat' || mode === 'both') t.add(chatJid);
    return [...t];
}

async function whoIs(runner, sock, m) {
    const gm = m.key.remoteJid.endsWith('@g.us') ? await runner.platform.groupCache.get(m.key.remoteJid) : null;
    const s = await senderIds(sock, m, { participants: gm?.participants });
    return { ...s, name: m.pushName || '', group: gm?.subject || (m.key.remoteJid.endsWith('@g.us') ? 'Group' : null) };
}

async function sendInfo(runner, sock, to, who, head, extra, mentions) {
    return sock.sendMessage(to, { text: `${head}\n${LINE}\n${extra}\n${LINE}\n_${BOT_NAME} • LOD X MINI_\n> FREE LOD CONNECTED > https://lodxmini.vercel.app`, mentions }, {});
}

export async function recoverDeleted(runner, sock, stored, byKey) {
    const mode = runner.settings.antidelete;
    const m = stored.m;
    const who = await whoIs(runner, sock, m);
    const d = describe(m.message);
    const delBy = byKey?.participant && numberOfJid(byKey.participant) !== numberOfJid(m.key.participant || '') ? await resolvePN(sock, byKey.participant, { alts: [byKey.participantAlt] }) : null;
    const mention = who.pn ? `${who.pn}@s.whatsapp.net` : who.jid;
    const meta =
        `👤 *From* : @${who.pn || numberOfJid(who.jid)}${who.name ? ` (${who.name})` : ''}\n` +
        `💬 *Chat* : ${who.group ? `${who.group}` : 'Private chat'}\n` +
        `🕒 *Sent* : ${clock(m.messageTimestamp)}   🗑️ *Deleted* : ${clock(Date.now() / 1000)}\n` +
        `📎 *Type* : ${d.label}` + (delBy ? `\n🛡️ *Deleted by admin* : +${delBy}` : '');
    const head = '🗑️ *ANTI DELETE*';
    runner.l.info({ what: `${d.label} from ${pretty(who.pn, who.jid)}` }, 'antidelete');
    for (const to of targets(runner, sock, mode, m.key.remoteJid)) {
        try {
            if (d.kind && d.kind !== 'sticker' && d.kind !== 'audio') {
                const buf = await grab(sock, m, d);
                if (buf) {
                    const caption = `${head}\n${LINE}\n${meta}${d.body ? `\n${LINE}\n💭 ${d.body}` : ''}\n${LINE}\n_${BOT_NAME} • LOD X MINI_\n> FREE LOD CONNECTED > https://lodxmini.vercel.app`;
                    const base = d.kind === 'document' ? { document: buf, mimetype: d.c.documentMessage?.mimetype, fileName: d.c.documentMessage?.fileName || 'file', caption } : { [d.kind]: buf, caption };
                    await sock.sendMessage(to, { ...base, mentions: [mention] });
                    continue;
                }
            }
            await sendInfo(runner, sock, to, who, head, `${meta}${d.body ? `\n${LINE}\n💭 ${d.body}` : ''}${d.kind && !d.body ? '' : ''}`, [mention]);
            if (d.kind) {
                const buf = await grab(sock, m, d);
                if (buf) {
                    if (d.kind === 'audio') await sock.sendMessage(to, { audio: buf, mimetype: d.c.audioMessage?.mimetype || 'audio/ogg; codecs=opus', ptt: !!d.c.audioMessage?.ptt });
                    else if (d.kind === 'sticker') await sock.sendMessage(to, { sticker: buf });
                    else await sock.sendMessage(to, { forward: m, force: true }).catch(() => {});
                } else await sock.sendMessage(to, { text: '⚠️ _The media could not be recovered (expired or too large)._' });
            }
        } catch (e) { runner.l.warn({ err: e.message }, 'anti-delete send failed'); }
    }
}

async function grab(sock, m, d) {
    try {
        const len = Number(d.c[d.type]?.fileLength || 0);
        if (len > MAX_MEDIA) return null;
        return await B.downloadMediaMessage(m, 'buffer', {}, { logger: waLogger, reuploadRequest: sock.updateMediaMessage });
    } catch { return null; }
}

export async function recoverEdited(runner, sock, stored, newMessage) {
    const mode = runner.settings.antiedit;
    const m = stored.m;
    const who = await whoIs(runner, sock, m);
    const before = describe(m.message), after = describe(newMessage);
    if (before.body === after.body) return;
    const mention = who.pn ? `${who.pn}@s.whatsapp.net` : who.jid;
    const text =
        `👤 *From* : @${who.pn || numberOfJid(who.jid)}${who.name ? ` (${who.name})` : ''}\n` +
        `💬 *Chat* : ${who.group || 'Private chat'}\n` +
        `🕒 *Sent* : ${clock(m.messageTimestamp)}   ✏️ *Edited* : ${clock(Date.now() / 1000)}\n${LINE}\n` +
        `❌ *Before*\n${before.body || '_(no text)_'}\n\n✅ *After*\n${after.body || '_(no text)_'}`;
    runner.l.info({ what: `edit from ${pretty(who.pn, who.jid)}` }, 'antiedit');
    for (const to of targets(runner, sock, mode, m.key.remoteJid)) {
        await sendInfo(runner, sock, to, who, '✏️ *ANTI EDIT*', text, [mention]).catch((e) => runner.l.warn({ err: e.message }, 'anti-edit send failed'));
    }
}
