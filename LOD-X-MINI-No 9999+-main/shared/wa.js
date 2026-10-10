import pino from 'pino';
export * as B from '../vendor/baileys/lib/index.js';
import * as B from '../vendor/baileys/lib/index.js';

export const waLogger = pino({ level: 'silent' });

export const normalizeNumber = (raw) => {
    const n = String(raw || '').replace(/[^\d]/g, '');
    return n.length >= 8 && n.length <= 15 ? n : null;
};

export const mediaKit = {
    async buffer(msg, type, cap = 30 * 1024 * 1024) {
        let buf = Buffer.alloc(0);
        for await (const c of await B.downloadContentFromMessage(msg, type)) {
            buf = Buffer.concat([buf, c]);
            if (buf.length > cap) throw new Error('media too large');
        }
        return buf;
    }
};
export const numberOfJid = (jid) => String(jid || '').split('@')[0].split(':')[0];
export const selfJid = (sock) => {
    const [user, domain] = String(sock.user?.id || '').split('@');
    return `${String(user || '').split(':')[0]}@${domain || 's.whatsapp.net'}`;
};

export function statusCodeOf(lastDisconnect) {
    return lastDisconnect?.error?.output?.statusCode ?? lastDisconnect?.error?.data?.attrs?.code ?? 0;
}
export const DR = () => B.DisconnectReason;
