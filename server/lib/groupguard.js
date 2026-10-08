import { numberOfJid, B } from '../../shared/wa.js';
import { BoundedCache } from '../../shared/cache.js';

export const LINK_RE = /(?:https?:\/\/|www\.|chat\.whatsapp\.com\/|wa\.me\/|t\.me\/|[a-z0-9-]+\.(?:com|net|org|io|xyz|lk|me|gg|ly|tk|ml|cf)\b\/?)\S*/i;
export const BAD_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy', 'slut', 'whore', 'pakaya', 'huththa', 'hutta', 'ponnaya', 'wesi', 'kariya', 'gon haraka', 'pako', 'hukanna', 'ukkla'];

const forms = (p) => [p.id, p.lid, p.phoneNumber, p.jid].filter(Boolean).map(numberOfJid);
export const isAdminOf = (g, ids) => g.participants.some((p) => p.admin && forms(p).some((f) => ids.includes(f)));

export class Guard {
    constructor(runner) {
        this.r = runner;
        this.burst = new BoundedCache({ max: 400, ttlMs: 20_000 });
    }

    async #meta(sock, jid) {
        const c = this.r.platform.groupCache;
        let g = c.get(jid);
        if (!g) { g = await sock.groupMetadata(jid); c.set(jid, g); }
        return g;
    }

    async inspect(sock, m, text) {
        const jid = m.key.remoteJid;
        const gs = this.r.group(jid);
        const muted = gs.muted && Object.keys(gs.muted).length;
        if (!(gs.antilink?.enabled || gs.antispam?.enabled || gs.antitoxic?.enabled || gs.antiviewonce?.enabled || muted)) return;

        const sender = m.key.participant || '';
        const ids = [sender, m.key.participantAlt].filter(Boolean).map(numberOfJid);
        const myLid = numberOfJid(sock.user?.lid);
        if (ids.includes(this.r.id) || (myLid && ids.includes(myLid))) return;

        const vo = m.message?.viewOnceMessage?.message || m.message?.viewOnceMessageV2?.message || m.message?.viewOnceMessageV2Extension?.message;
        if (gs.antiviewonce?.enabled && vo) {
            const key = Object.keys(vo).find((k) => /imageMessage|videoMessage|audioMessage/.test(k));
            if (key) {
                try {
                    const type = key.replace('Message', '');
                    let buf = Buffer.alloc(0);
                    for await (const c of await B.downloadContentFromMessage(vo[key], type)) { buf = Buffer.concat([buf, c]); if (buf.length > 30 * 1048576) return; }
                    const cap = `👁️ *Anti view-once*\nFrom: @${ids[0]}\nGroup: ${jid.split('@')[0]}`;
                    const to = `${this.r.id}@s.whatsapp.net`;
                    await sock.sendMessage(to, type === 'audio' ? { audio: buf, mimetype: 'audio/mpeg' } : { [type]: buf, caption: cap, mentions: [sender] });
                } catch {  }
            }
        }

        const g = await this.#meta(sock, jid).catch(() => null);
        if (!g) return;
        const isAdmin = isAdminOf(g, ids);
        const botAdmin = isAdminOf(g, [this.r.id, myLid].filter(Boolean));

        const del = () => (botAdmin ? sock.sendMessage(jid, { delete: m.key }).catch(() => {}) : null);

        const until = gs.muted?.[ids[0]];
        if (until && !isAdmin) { if (Date.now() < until) return del(); this.r.setGroup(jid, (x) => { delete x.muted[ids[0]]; }); }
        if (isAdmin) return;

        let why = null; let action = 'warn'; let limit = 3;
        if (gs.antilink?.enabled && text && LINK_RE.test(text)) { why = '🔗 links are not allowed'; action = gs.antilink.action || 'warn'; limit = gs.antilink.warnLimit || 3; }
        if (!why && gs.antitoxic?.enabled && text) {
            const words = [...BAD_WORDS, ...(gs.antitoxic.words || [])];
            const low = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ')} `;
            if (words.some((w) => low.includes(` ${w} `))) { why = '🤬 bad language'; action = gs.antitoxic.action || 'warn'; limit = gs.antitoxic.warnLimit || 3; }
        }
        if (!why && gs.antispam?.enabled) {
            const k = `${jid}:${ids[0]}`; const arr = (this.burst.get(k) || []).filter((t) => Date.now() - t < 8000); arr.push(Date.now()); this.burst.set(k, arr);
            if (arr.length > (gs.antispam.max || 6)) { why = '🛡️ spam / flooding'; action = gs.antispam.action || 'warn'; limit = gs.antispam.warnLimit || 3; this.burst.set(k, []); }
        }
        if (!why) return;

        await del();
        const num = ids[0];
        if (action === 'delete') return;
        if (action === 'kick') {
            if (botAdmin) { await sock.groupParticipantsUpdate(jid, [sender], 'remove').catch(() => {}); await sock.sendMessage(jid, { text: `🚫 @${num} removed — ${why}.`, mentions: [sender] }); }
            return;
        }
        let n = 0;
        await this.r.setGroup(jid, (x) => { x.warns = { ...(x.warns || {}) }; n = (x.warns[num] || 0) + 1; if (n >= limit) delete x.warns[num]; else x.warns[num] = n; if (Object.keys(x.warns).length > 200) delete x.warns[Object.keys(x.warns)[0]]; });
        if (n >= limit) {
            if (botAdmin) await sock.groupParticipantsUpdate(jid, [sender], 'remove').catch(() => {});
            await sock.sendMessage(jid, { text: `🚫 @${num} reached ${limit}/${limit} warnings — ${botAdmin ? 'removed' : 'I need admin to remove them'}.`, mentions: [sender] });
        } else {
            await sock.sendMessage(jid, { text: `⚠️ @${num} warning *${n}/${limit}* — ${why}.`, mentions: [sender] });
        }
    }

    async onParticipants(sock, { id: jid, participants, action }) {
        const gs = this.r.group(jid);
        if (!gs.welcome?.enabled && !gs.left?.enabled && !gs.antiforeign?.enabled) return;
        const list = participants.map((p) => (typeof p === 'string' ? p : p.phoneNumber || p.id)).filter(Boolean);
        if (action === 'add' && gs.antiforeign?.enabled) {
            const codes = gs.antiforeign.codes || ['94'];
            const bad = list.filter((j) => { const n = numberOfJid(j); return /^\d+$/.test(n) && !codes.some((c) => n.startsWith(c)) && n !== this.r.id; });
            if (bad.length) {
                const g = await this.#meta(sock, jid).catch(() => null);
                if (g && isAdminOf(g, [this.r.id, numberOfJid(sock.user?.lid)].filter(Boolean))) {
                    await sock.groupParticipantsUpdate(jid, bad, 'remove').catch(() => {});
                    await sock.sendMessage(jid, { text: `🌍 Removed ${bad.length} member(s) with a non-allowed country code (allowed: ${codes.map((c) => `+${c}`).join(', ')}).` }).catch(() => {});
                    return;
                }
            }
        }
        const cfg = action === 'add' ? gs.welcome : action === 'remove' ? gs.left : null;
        if (!cfg?.enabled) return;
        const g = await this.#meta(sock, jid).catch(() => ({ subject: 'the group', participants: [] }));
        for (const j of list.slice(0, 5)) {
            const n = numberOfJid(j);
            const t = (cfg.text || (action === 'add' ? '👋 Welcome @user to *@group*!\n\nPlease read the rules and enjoy 🌸' : '👋 Goodbye @user — we will miss you!'))
                .replaceAll('@user', `@${n}`).replaceAll('@group', g.subject || 'the group').replaceAll('@count', String(g.participants?.length || ''));
            let img; try { img = await sock.profilePictureUrl(j.includes('@') ? j : `${j}@s.whatsapp.net`, 'image'); } catch {  }
            const mentions = [j.includes('@') ? j : `${j}@s.whatsapp.net`];
            await sock.sendMessage(jid, img ? { image: { url: img }, caption: t, mentions } : { text: t, mentions }).catch(() => {});
        }
    }
}
