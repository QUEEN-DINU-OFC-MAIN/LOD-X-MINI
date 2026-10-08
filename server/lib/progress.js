const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function createProgress({ sock, jid, brand }) {
    let key = null, label = 'working…', pct = null, n = 0, timer = null, closed = false;
    const frame = () => FRAMES[(n = (n + 1) % FRAMES.length)];
    const bar = () => {
        const cells = 12, ratio = Math.max(0, Math.min(1, pct.done / pct.total));
        return `${'▰'.repeat(Math.round(ratio * cells))}${'▱'.repeat(cells - Math.round(ratio * cells))} ${Math.round(ratio * 100)}%`;
    };
    const body = () => `⏳ *${String(brand).toUpperCase()}*\n\n${frame()} ${label}${pct ? `\n${bar()}` : ''}`;
    const paint = () => { if (key && !closed) sock.sendMessage(jid, { text: body(), edit: key }).catch(() => {}); };
    return {
        get started() { return Boolean(key); },
        async start(initial) {
            if (key) return key;
            if (initial) label = String(initial);
            const out = await sock.sendMessage(jid, { text: body() });
            key = out?.key || null;
            if (key) timer = setInterval(paint, 1100);
            return key;
        },
        set(text, { done, total } = {}) {
            label = String(text);
            if (Number.isFinite(done) && Number.isFinite(total) && total > 0) pct = { done, total };
        },
        async end(emoji, text) {
            if (closed) return; closed = true;
            clearInterval(timer);
            if (key) await sock.sendMessage(jid, { text: `${emoji} ${text}`, edit: key }).catch(() => {});
        },
        done(text) { return this.end('✅', text); },
        fail(text) { return this.end('❌', text); }
    };
}
