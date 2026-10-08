const NOISE = [
    /Failed to decrypt message/i,
    /Session error/i,
    /Bad MAC/i,
    /No matching sessions found/i,
    /Closing open session in favor/i,
    /Decrypted message with closed session/i,
    /SessionEntry|_chains|currentRatchet|indexInfo/
];

export function installSignalQuiet(log, { flushMs = 5000 } = {}) {
    if (globalThis.__signalQuietInstalled) return;
    globalThis.__signalQuietInstalled = true;
    let pending = 0;
    let timer = null;
    const flush = () => {
        timer = null;
        if (pending > 0) {
            log?.warn?.({ undecrypted: pending }, 'signal: some messages could not be decrypted – WhatsApp retries with a fresh session automatically');
            pending = 0;
        }
    };
    const isNoise = (args) => args.some((a) => {
        const s = typeof a === 'string' ? a : (a?.message || a?.stack || '');
        return NOISE.some((r) => r.test(s));
    });
    for (const level of ['error', 'warn', 'log', 'info']) {
        const orig = console[level].bind(console);
        console[level] = (...args) => {
            if (isNoise(args)) {
                pending += 1;
                if (!timer) { timer = setTimeout(flush, flushMs); timer.unref?.(); }
                return undefined;
            }
            return orig(...args);
        };
        console[level].__orig = orig;
    }
}
