import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const secret = () => process.env.SESSION_ENC_KEY || process.env.PANEL_SECRET || 'rcd-x-mini-panel';

export const newPassword = (len = 8) => Array.from({ length: len }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');

const hashOf = (password, salt) => crypto.scryptSync(String(password).trim().toUpperCase(), salt, 32).toString('hex');

export function issuePanel(prevVer = 0) {
    const password = newPassword();
    const salt = crypto.randomBytes(8).toString('hex');
    return { password, panel: { salt, hash: hashOf(password, salt), ver: prevVer + 1, password } };
}

export function verifyPassword(password, panel) {
    if (!panel?.hash || !password) return false;
    const a = Buffer.from(hashOf(password, panel.salt), 'hex');
    const b = Buffer.from(panel.hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const tokenFor = (number, ver) => crypto.createHmac('sha256', secret()).update(`${number}.${ver}`).digest('hex').slice(0, 40);

export function verifyToken(number, token, panel) {
    if (!panel?.ver || typeof token !== 'string' || token.length !== 40) return false;
    const a = Buffer.from(tokenFor(number, panel.ver));
    const b = Buffer.from(token);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const panelLink = (webUrl, number, ver) => `${webUrl}/panel#n=${number}&k=${tokenFor(number, ver)}`;
