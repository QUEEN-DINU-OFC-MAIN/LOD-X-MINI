import { BoundedCache } from '../../shared/cache.js';
import { numberOfJid } from '../../shared/wa.js';

const lid2pn = new BoundedCache({ max: 6000, ttlMs: 24 * 3600_000, shared: true });
const isPn = (j) => /@s\.whatsapp\.net$/.test(j || '');
const isLid = (j) => /@lid$/.test(j || '');
export const isPnJid = isPn;
export const isLidJid = isLid;

export async function resolvePN(sock, jid, { alts = [], participants } = {}) {
    for (const j of [jid, ...alts]) if (isPn(j)) return numberOfJid(j);
    const lids = [jid, ...alts].filter(isLid);
    for (const l of lids) {
        const key = numberOfJid(l);
        const hit = lid2pn.get(key);
        if (hit) return hit;
        const p = participants?.find((x) => numberOfJid(x.id) === key || numberOfJid(x.lid) === key);
        const pj = p?.phoneNumber || (isPn(p?.id) ? p.id : null);
        if (pj) { lid2pn.set(key, numberOfJid(pj)); return numberOfJid(pj); }
        try {
            const got = await sock.signalRepository?.lidMapping?.getPNForLID?.(l.includes(':') ? l : `${key}@lid`);
            if (got) { const n = numberOfJid(got); lid2pn.set(key, n); return n; }
        } catch {  }
    }
    return null;
}
export function learn(jid, alt) {
    if (isLid(jid) && isPn(alt)) lid2pn.set(numberOfJid(jid), numberOfJid(alt));
    else if (isLid(alt) && isPn(jid)) lid2pn.set(numberOfJid(alt), numberOfJid(jid));
}
export async function senderIds(sock, m, { participants } = {}) {
    const k = m.key;
    const from = k.participant || (k.fromMe ? sock.user?.id : k.remoteJid);
    const alts = [k.participantAlt, k.remoteJidAlt].filter(Boolean);
    learn(from, alts[0]);
    const pn = await resolvePN(sock, from, { alts, participants });
    const ids = new Set([from, ...alts].filter(Boolean).map(numberOfJid));
    if (pn) ids.add(pn);
    const lid = [from, ...alts].find(isLid);
    return { jid: from, pn, lid: lid ? numberOfJid(lid) : null, ids };
}
export const pretty = (pn, fallback) => (pn ? `+${pn}` : fallback ? `+${numberOfJid(fallback)}` : 'unknown');

export async function selfIdentity(sock) {
    const me = sock?.user || {};
    const rawId = me.id || '';
    const lidRaw = me.lid || (isLid(rawId) ? rawId : null);
    let pn = null;
    if (isPn(rawId)) pn = numberOfJid(rawId);
    if (!pn && me.pn && isPn(me.pn)) pn = numberOfJid(me.pn);
    if (!pn && lidRaw) {
        const key = numberOfJid(lidRaw);
        const cached = lid2pn.get(key);
        if (cached) pn = cached;
        else {
            try {
                const got = await sock.signalRepository?.lidMapping?.getPNForLID?.(lidRaw.includes(':') ? lidRaw : `${key}@lid`);
                if (got && isPn(got)) { pn = numberOfJid(got); lid2pn.set(key, pn); }
            } catch { }
        }
    }
    return { pn, lid: lidRaw ? numberOfJid(lidRaw) : null, rawId, isLid: isLid(rawId) };
}

export async function rememberSelfMapping(sock, { pn, lid }) {
    const p = numberOfJid(pn), l = numberOfJid(lid);
    if (!/^\d{6,16}$/.test(p) || !/^\d{6,16}$/.test(l) || p === l) return false;
    lid2pn.set(l, p);
    try {
        await sock?.signalRepository?.lidMapping?.storeLIDPNMappings?.([{ lid: `${l}@lid`, pn: `${p}@s.whatsapp.net` }]);
        return true;
    } catch { return false; }
}
