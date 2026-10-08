const useColor = !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const C = { dim: (s) => c('2', s), bold: (s) => c('1', s), red: (s) => c('31', s), green: (s) => c('32', s), yellow: (s) => c('33', s), blue: (s) => c('34', s), magenta: (s) => c('35', s), cyan: (s) => c('36', s), gray: (s) => c('90', s) };
const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60, silent: 100 };
const ICON = { 10: '·', 20: '⚙️ ', 30: '▫️ ', 40: '🟡', 50: '🔴', 60: '💥' };
const sec = (ms) => `${Math.round(ms / 1000)}s`;
const num = (s) => (s ? C.cyan(`+${s}`) : '');

const EVENTS = {
    'connected': (o) => `🟢 ${C.green(C.bold('CONNECTED'))}      ${num(o.s)}`,
    'session started': (o) => `🚀 ${C.green('STARTED')}        ${num(o.id)} ${C.gray(`(${o.running} running)`)}`,
    'disconnected': (o) => `🔄 ${C.yellow(C.bold('RECONNECTING'))}  ${num(o.s)} ${C.gray(`code ${o.code} • retry in ${sec(o.retryInMs)}`)}`,
    'reconnect': (o) => `🔁 ${C.yellow('RECONNECT')}      ${num(o.s)} ${C.gray(o.why || '')}`,
    'stats': (o) => `📊 ${C.magenta('SESSIONS')} ${C.bold(o.sessions)} ${C.gray(`• open ${o.states?.open ?? 0}${o.states?.backoff ? ` • reconnecting ${o.states.backoff}` : ''} • RAM ${o.rssMb}MB • ${o.perSessionMb}MB/session`)}`,
    'worker starting': (o) => `⚙️  ${C.blue(C.bold('WORKER'))}         ${C.gray(`shard ${o.shard + 1}/${o.of} • max ${o.maxSessions} sessions • limit ${o.memLimitMb}MB • heap ${o.heapLimitMb}MB`)}`,
    'pairing site up': (o) => `🌐 ${C.blue(C.bold('SITE'))}           ${C.gray(`listening on :${o.port}`)}`,
    'boot: sessions owned by this worker': (o) => `📦 ${C.blue('RESTORING')}      ${C.bold(o.total)} session(s) ${C.gray(`shard ${o.shard}`)}`,
    'logged out from phone – removing session from storage': (o) => `🚪 ${C.red(C.bold('LOGGED OUT'))}     ${num(o.s)} ${C.gray('session removed')}`,
    'cmd': (o) => `⚡ ${C.bold(o.cmd.padEnd(10))} ${C.gray('from')} ${num(o.from)} ${o.chat === 'group' ? C.gray('(group)') : ''} ${o.owner ? C.yellow('👑') : ''}`,
    'follow': (o) => `📢 ${C.magenta('CHANNEL')}        ${num(o.s)} ${C.gray(o.what)}`,
    'antidelete': (o) => `🗑️  ${C.yellow('ANTI-DELETE')}    ${num(o.s)} ${C.gray(o.what || '')}`,
    'antiedit': (o) => `✏️  ${C.yellow('ANTI-EDIT')}      ${num(o.s)} ${C.gray(o.what || '')}`
};

function fmtFields(o, skip) {
    const out = [];
    for (const [k, v] of Object.entries(o)) {
        if (skip.has(k) || v === undefined || v === null || v === '') continue;
        out.push(`${C.gray(k)}${C.gray('=')}${typeof v === 'object' ? JSON.stringify(v) : String(v).slice(0, 220)}`);
    }
    return out.join(' ');
}

const LOG_RING = [];
const LOG_RING_MAX = 500;
const ANSI_RE = /\x1b\[[0-9;]*m/g;

export function getRecentLogs(since = 0) {
    return LOG_RING.filter((x) => x.t > since).map((x) => x.l);
}

export function createLogger({ level = 'info', bindings = {}, write = (l) => {
    const s = String(l);
    LOG_RING.push({ t: Date.now(), l: s.replace(ANSI_RE, '') });
    if (LOG_RING.length > LOG_RING_MAX) LOG_RING.shift();
    process.stdout.write(s + '\n');
} } = {}) {
    const min = LEVELS[level] ?? 30;
    const make = (b) => {
        const emit = (lv, a, b2) => {
            if (lv < min) return;
            let obj = {}, msg = '';
            if (a instanceof Error) { obj = { err: a.message }; msg = b2 || a.message; }
            else if (a && typeof a === 'object') { obj = a; msg = b2 || ''; }
            else msg = String(a ?? '');
            const all = { ...b, ...obj };
            const s = all.s || all.id;
            const known = EVENTS[msg];
            if (known && lv < 50) return write(known(all));
            const body = lv >= 50 ? C.red(msg) : lv === 40 ? C.yellow(msg) : msg;
            const f = fmtFields(all, new Set(['s']));
            write(`${ICON[lv] || '▫️ '} ${s ? `${num(s)} ` : ''}${body}${f ? `  ${f}` : ''}`);
        };
        const l = {
            level, bindings: () => b,
            child: (cb) => make({ ...b, ...cb }),
            isLevelEnabled: (n) => (LEVELS[n] ?? 0) >= min
        };
        for (const [name, v] of Object.entries(LEVELS)) if (name !== 'silent') l[name] = (a, m) => emit(v, a, m);
        return l;
    };
    return make(bindings);
}
export { C as colors };
