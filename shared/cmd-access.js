const LOCKED_NAMES = new Set(['aireply', 'setgeminikey', 'setprompt', 'kickall', 'debug', 'addreply', 'delreply', 'listreply']);
const LOCKED_CATS = new Set(['settings', 'privacy', 'channel']);

export const isLocked = (c) => Boolean(c.devOnly || c.selfOnly || c.locked || LOCKED_NAMES.has(c.name) || LOCKED_CATS.has(c.cat));

export function ownerRequired(cmd, access) {
    if (isLocked(cmd)) return true;
    const a = access?.[cmd.name];
    if (a === 'owner') return true;
    if (a === 'public') return false;
    return Boolean(cmd.ownerOnly);
}

export function cleanAccess(src) {
    const out = {};
    if (!src || typeof src !== 'object') return out;
    for (const [k, v] of Object.entries(src).slice(0, 500)) {
        const name = String(k).toLowerCase();
        if (/^[a-z0-9]{1,24}$/.test(name) && (v === 'owner' || v === 'public')) out[name] = v;
    }
    return out;
}
