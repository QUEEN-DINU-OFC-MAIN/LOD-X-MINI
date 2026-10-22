import cfg from '../../config.js';
import { DEV_NUMBERS } from '../lib/channels.js';

const H = { 'User-Agent': 'LOD-X-MINI-BOT', Accept: 'application/vnd.github+json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const COMMIT_MSG = '𝗟𝗢𝗗 𝗫 𝗠𝗜𝗡𝗜 𝗕𝗢𝗧 𝗕𝗬 🤍';
const mine = { cat: 'tools', selfOnly: true, ownerMenu: true };
const codeOf = (s) => /channel\/([A-Za-z0-9_-]+)/.exec(s || '');
const stamp = () => { const n = new Date(); return { time: n.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), date: n.toLocaleDateString('en-GB') }; };
const MEDIA_EXT = { image: '.jpg', video: '.mp4', audio: '.ogg', sticker: '.webp' };

async function gh(token, path, opts = {}) {
    const res = await fetch(`https://api.github.com${path}`, {
        ...opts, signal: AbortSignal.timeout(15_000),
        headers: { ...H, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || `GitHub error ${res.status}`);
    return { res, body };
}

const fixSsl = (url) => {
    try {
        const u = new URL(url);
        u.searchParams.delete('channel_binding');
        if (['require', 'prefer', 'verify-ca'].includes(u.searchParams.get('sslmode'))) u.searchParams.set('sslmode', 'verify-full');
        return u.toString();
    } catch { return url; }
};

const quotedOf = (ctx) => ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

async function dl(media, type) {
    const { B } = await import('../../shared/wa.js');
    let buf = Buffer.alloc(0);
    for await (const c of await B.downloadContentFromMessage(media, type)) {
        buf = Buffer.concat([buf, c]);
        if (buf.length > 30 * 1024 * 1024) throw new Error('file too large (max 30 MB)');
    }
    return buf;
}

async function upFile(token, repo, path, buf, message) {
    const enc = path.split('/').map(encodeURIComponent).join('/');
    let sha;
    try { const { body } = await gh(token, `/repos/${repo}/contents/${enc}`); sha = body.sha; } catch { }
    const { body } = await gh(token, `/repos/${repo}/contents/${enc}`, {
        method: 'PUT',
        body: JSON.stringify({ message, content: buf.toString('base64'), ...(sha ? { sha } : {}) })
    });
    return body;
}

async function pgCheck(url) {
    const pg = (await import('pg')).default;
    const pool = new pg.Pool({ connectionString: fixSsl(url), max: 1, connectionTimeoutMillis: 8000, statement_timeout: 8000, query_timeout: 8000 });
    try {
        const t0 = Date.now();
        const v = await pool.query('select version() as v, current_database() as db, current_user as u');
        const ms = Date.now() - t0;
        const t = await pool.query("select count(*)::int as n from pg_tables where schemaname = 'public'").catch(() => ({ rows: [{ n: '—' }] }));
        const s = await pool.query('select pg_size_pretty(pg_database_size(current_database())) as s').catch(() => ({ rows: [{ s: '—' }] }));
        return `🐘 *Engine* : PostgreSQL — ${String(v.rows[0].v).split(',')[0]}\n📁 Database : ${v.rows[0].db}  ·  👤 ${v.rows[0].u}\n⚡ Latency : ${ms} ms\n💾 Size : ${s.rows[0].s}\n📋 Public tables : ${t.rows[0].n}`;
    } finally { pool.end().catch(() => {}); }
}

async function mongoCheck(url) {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(url, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
    try {
        const t0 = Date.now();
        await client.connect();
        await client.db('admin').command({ ping: 1 });
        const ms = Date.now() - t0;
        const bi = await client.db('admin').command({ buildInfo: 1 }).catch(() => ({}));
        const list = await client.db('admin').admin().listDatabases().catch(() => ({ databases: [], totalSize: 0 }));
        const mb = (list.totalSize ? `${(list.totalSize / 1048576).toFixed(1)} MB` : '—');
        const names = (list.databases || []).slice(0, 5).map((d) => d.name).join(', ') || '—';
        return `🍃 *Engine* : MongoDB — ${bi.version || '?'}\n📁 Databases : ${(list.databases || []).length}  (${names})\n⚡ Latency : ${ms} ms\n💾 Total size : ${mb}`;
    } finally { await client.close().catch(() => {}); }
}

async function mysqlCheck(url) {
    const mysql = await import('mysql2/promise');
    const u = new URL(url);
    const conn = await mysql.createConnection({
        host: u.hostname, port: Number(u.port || 3306),
        user: decodeURIComponent(u.username || 'root'), password: decodeURIComponent(u.password || ''),
        database: u.pathname.replace(/^\//, '') || undefined, connectTimeout: 8000,
        ssl: /ssl(mode)?=(true|1|require|verify|prefer)/i.test(u.search) ? {} : undefined
    });
    try {
        const t0 = Date.now();
        const [v] = await conn.query('select VERSION() as v, DATABASE() as db, CURRENT_USER() as u');
        const ms = Date.now() - t0;
        const [t] = await conn.query('select COUNT(*) as n from information_schema.tables where table_schema = DATABASE()').catch(() => [[{ n: '—' }]]);
        return `🐬 *Engine* : MySQL — ${v[0].v}\n📁 Database : ${v[0].db || '—'}  ·  👤 ${v[0].u}\n⚡ Latency : ${ms} ms\n📋 Tables : ${t[0].n}`;
    } finally { await conn.end().catch(() => {}); }
}

export default [
    {
        ...mine, name: 'setgh', react: '🔑', desc: 'Set YOUR GitHub token  (.setgh ghp_… / .setgh off)',
        async run(ctx) {
            const t = ctx.args[0];
            if (!t || ['off', 'remove', 'clear'].includes(t.toLowerCase())) {
                const has = Boolean(ctx.settings.ghToken);
                if (has) await ctx.runner.setSettings({ ghToken: null, ghRepo: null, ghBranch: null });
                return ctx.reply(has ? '🗑️ Your GitHub token removed.' : `ℹ️ No GitHub token set yet.\n\n${ctx.prefix}setgh ghp_…\n${ctx.prefix}setrepo owner/repo\n${ctx.prefix}push — reply to a file / zip / media`);
            }
            const prog = ctx.progress('SETGH — checking token…');
            try {
                const { res, body } = await gh(t, '/user');
                const scopes = res.headers.get('x-oauth-scopes') || '—';
                await ctx.runner.setSettings({ ghToken: t });
                await prog.done(`GITHUB — @${body.login} linked`);
                await ctx.card({
                    text: `🔑 *GitHub linked!*\n\n👤 User : *@${body.login}*\n🏷️ Name : ${body.name || '—'}\n🔓 Scopes : ${scopes}\n\n📦 Next : ${ctx.prefix}setrepo owner/repo\n⬆️ Then reply to a file / zip / media with ${ctx.prefix}push`,
                    again: false
                });
            } catch (e) { await prog.fail('SETGH — invalid token'); await ctx.reply(`❌ GitHub rejected that token.\n\n💬 ${String(e.message).slice(0, 140)}`).catch(() => {}); }
        }
    },
    {
        ...mine, name: 'setrepo', aliases: ['ghrepo'], react: '📦', desc: 'Target repo for .push  (.setrepo owner/repo)',
        async run(ctx) {
            const v = ctx.args[0];
            if (!v || !/^[\w.-]+\/[\w.-]+$/.test(v)) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}setrepo owner/repo\n\nExample: ${ctx.prefix}setrepo dexterfree0101/my-files`);
            if (!ctx.settings.ghToken) return ctx.reply(`⚠️ Link your GitHub token first:\n\n${ctx.prefix}setgh ghp_…`);
            const prog = ctx.progress('SETREPO — checking repo…');
            try {
                const { body } = await gh(ctx.settings.ghToken, `/repos/${v}`);
                if (!body.permissions?.push) throw new Error('your token has no push access to this repo');
                await ctx.runner.setSettings({ ghRepo: v, ghBranch: body.default_branch || 'main' });
                await prog.done(`REPO — ${v} saved`);
                await ctx.card({
                    text: `📦 *Target repo saved!*\n\n🔗 Repo : ${v}\n🌿 Default branch : ${body.default_branch}\n🔒 Private : ${body.private ? 'yes' : 'no'}\n\n⬆️ Now reply to a file / zip / media with ${ctx.prefix}push`,
                    again: false
                });
            } catch (e) { await prog.fail('SETREPO — failed'); await ctx.reply(`❌ Could not set that repo.\n\n💬 ${String(e.message).slice(0, 140)}`).catch(() => {}); }
        }
    },
    {
        ...mine, name: 'push', react: '⬆️', desc: 'Push a replied file / zip / media to your repo  (.push)',
        async run(ctx) {
            const st = ctx.settings;
            if (!st.ghToken) return ctx.reply(`⚠️ Link your GitHub token first:\n\n${ctx.prefix}setgh ghp_…`);
            if (!st.ghRepo) return ctx.reply(`⚠️ Pick a repo first:\n\n${ctx.prefix}setrepo owner/repo`);
            const q = quotedOf(ctx);
            const mkey = ['documentMessage', 'imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage'].find((k) => q?.[k]);
            if (!mkey) return ctx.reply(`ℹ️ Reply to a file, a .zip or any media with ${ctx.prefix}push`);
            const m = q[mkey];
            const type = mkey.replace('Message', '');
            let buf;
            try { buf = await dl(m, type); } catch (e) { return ctx.reply(`❌ Download failed — ${String(e.message).slice(0, 120)}`); }
            const files = [];
            let name = m.fileName || (MEDIA_EXT[type] ? `media_${Date.now()}${MEDIA_EXT[type]}` : 'file.bin');
            if (/\.zip$/i.test(name) || (buf[0] === 0x50 && buf[1] === 0x4b)) {
                let AdmZip;
                try { AdmZip = (await import('adm-zip')).default; } catch { return ctx.reply('❌ Zip support is not installed on this worker.'); }
                let zip;
                try { zip = new AdmZip(buf); } catch { return ctx.reply('❌ That zip is broken / password protected.'); }
                for (const e of zip.getEntries()) {
                    if (e.isDirectory) continue;
                    const p = e.entryName.replace(/\\/g, '/').replace(/^\/+/, '');
                    if (!p || p.startsWith('__MACOSX') || /(^|\/)\.(DS_Store|git)\b/.test(p)) continue;
                    const data = e.getData();
                    if (data.length > 20 * 1024 * 1024) return ctx.reply(`❌ ${p} is bigger than 20 MB.`);
                    files.push([p, data]);
                    if (files.length > 300) return ctx.reply('❌ Too many files (max 300).');
                }
                if (!files.length) return ctx.reply('❌ That zip has no files.');
            } else {
                files.push([name.replace(/\\/g, '/').replace(/^\/+/, '') || 'file.bin', buf]);
            }
            const prog = ctx.progress(`PUSH — 0/${files.length} files`, { done: 0, total: files.length });
            let ok = 0, lastUrl = '';
            try {
                for (const [p, data] of files) {
                    const r = await upFile(st.ghToken, st.ghRepo, p, data, COMMIT_MSG);
                    ok++; lastUrl = r?.commit?.html_url || lastUrl;
                    prog.set(`PUSH — ${ok}/${files.length} files`, { done: ok, total: files.length });
                }
                const branch = st.ghBranch || 'main';
                const when = stamp();
                const encPath = files[0][0].split('/').map(encodeURIComponent).join('/');
                const rawLink = files.length === 1 ? `https://raw.githubusercontent.com/${st.ghRepo}/${branch}/${encPath}` : '';
                const repoFile = files.length === 1 ? `https://github.com/${st.ghRepo}/blob/${branch}/${encPath}` : `https://github.com/${st.ghRepo}`;
                await prog.done(`PUSHED ${ok}/${files.length} → ${st.ghRepo}`);
                await ctx.card({
                    text: `⬆️ *Pushed to GitHub!*\n\n📦 Repo : ${st.ghRepo}\n📄 Files : ${ok}/${files.length}\n💬 Commit : ${COMMIT_MSG}\n${lastUrl ? `🔗 Commit : ${lastUrl}\n` : ''}🌐 File : ${repoFile}\n${rawLink ? `🧬 Raw : ${rawLink}\n` : ''}🕒 Time : ${when.time}  ·  📅 Date : ${when.date}`,
                    copy: [
                        ...(rawLink ? [{ label: '🧬 COPY RAW LINK', code: rawLink }] : []),
                        { label: '🔗 COPY REPO LINK', code: repoFile },
                        ...(lastUrl ? [{ label: '📌 COPY COMMIT', code: lastUrl }] : [])
                    ],
                    again: false
                });
            } catch (e) {
                await prog.fail(`PUSH FAILED — ${ok}/${files.length} done`);
                await ctx.reply(`❌ Push stopped at ${ok}/${files.length} files.\n\n💬 ${String(e.message).slice(0, 140)}`).catch(() => {});
            }
        }
    },
    {
        ...mine, name: 'dbcheck', aliases: ['dbping', 'pgcheck', 'dbtest'], react: '🗄️', desc: 'Check any database — Postgres / MongoDB / MySQL  (.dbcheck [url])',
        async run(ctx) {
            const url = ctx.args[0] || process.env.DATABASE_URL;
            if (!url) return ctx.reply(`ℹ️ This worker has no DATABASE_URL — send one:\n\n${ctx.prefix}dbcheck postgres://user:pass@host/db\n${ctx.prefix}dbcheck mongodb+srv://user:pass@cluster/db\n${ctx.prefix}dbcheck mysql://user:pass@host/db`);
            const scheme = (url.split('://')[0] || '').toLowerCase();
            const checker = ['postgres', 'postgresql', 'pgsql'].includes(scheme) ? pgCheck
                : ['mongodb', 'mongodb+srv'].includes(scheme) ? mongoCheck
                : ['mysql', 'mysql2'].includes(scheme) ? mysqlCheck : null;
            if (!checker) return ctx.reply(`❌ That URL type is not supported yet.\n\n✅ Supported:\n▫️ postgres://…\n▫️ mongodb://… / mongodb+srv://…\n▫️ mysql://…`);
            const prog = ctx.progress('DB CHECK — connecting…');
            const host = (() => { try { return new URL(url).hostname; } catch { return '—'; } })();
            try {
                const info = await checker(url);
                await prog.done('DB — CONNECTED ✅');
                await ctx.card({ text: `🗄️ *Database check — OK ✅*\n\n🌐 Host : ${host}\n${info}`, again: false });
            } catch (e) {
                await prog.fail('DB CHECK FAILED');
                await ctx.reply(`❌ Could not reach that database.\n\n🌐 Host : ${host}\n💬 ${String(e.message).slice(0, 160)}`).catch(() => {});
            }
        }
    },
    {
        ...mine, name: 'api', aliases: ['apicheck', 'req', 'http'], react: '🌐', desc: 'Test an API — status, latency & body  (.api <url> / .api post <url> <json>)',
        async run(ctx) {
            const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
            let method = 'GET', url = ctx.args[0], bodyArg = ctx.args.slice(1).join(' ');
            if (METHODS.includes((ctx.args[0] || '').toLowerCase()) && ctx.args[1]) {
                method = ctx.args[0].toUpperCase();
                url = ctx.args[1];
                bodyArg = ctx.args.slice(2).join(' ');
            }
            if (!url || !/^https?:\/\//.test(url)) return ctx.reply(`ℹ️ Usage: ${ctx.prefix}api <url>\n${ctx.prefix}api post <url> {"key":"value"}`);
            const prog = ctx.progress(`API — ${method}…`);
            const opts = { method, headers: { 'User-Agent': 'LOD-X-MINI-BOT', Accept: '*/*' }, signal: AbortSignal.timeout(15_000) };
            if (['POST', 'PUT', 'PATCH'].includes(method) && bodyArg) {
                try { JSON.parse(bodyArg); } catch { await prog.fail('API — bad JSON body'); return ctx.reply('❌ That body is not valid JSON:\n\n.api post https://… {"key":"value"}'); }
                opts.headers['Content-Type'] = 'application/json';
                opts.body = bodyArg;
            }
            try {
                const t0 = Date.now();
                const res = await fetch(url, opts);
                const ms = Date.now() - t0;
                const raw = await res.arrayBuffer();
                const ct = res.headers.get('content-type') || '—';
                let pretty = Buffer.from(raw).toString('utf8');
                if (/json/i.test(ct) || /^\s*[{[]/.test(pretty)) { try { pretty = JSON.stringify(JSON.parse(pretty), null, 1); } catch { } }
                const size = raw.byteLength < 1024 ? `${raw.byteLength} B` : `${(raw.byteLength / 1024).toFixed(1)} KB`;
                await prog.done(`API — ${res.status} in ${ms}ms`);
                await ctx.card({
                    text: `${res.ok ? '✅' : '⚠️'} *${method}* ${url}\n\n🔢 Status : *${res.status}* ${res.statusText}\n⚡ Latency : ${ms} ms\n📦 Type : ${ct}\n💾 Size : ${size}\n\n📄 *Body*\n\`\`\`${pretty.slice(0, 1200)}${pretty.length > 1200 ? '\n…' : ''}\`\`\``,
                    copy: [{ label: '📋 COPY BODY', code: pretty.slice(0, 3000) }], again: false
                });
            } catch (e) {
                await prog.fail('API FAILED');
                await ctx.reply(`❌ ${method} request failed.\n\n💬 ${String(e.message).slice(0, 160)}`).catch(() => {});
            }
        }
    },
    {
        name: 'lod', aliases: ['lodx', 'devteam'], cat: 'main', react: '🖤', desc: 'LOD X MINI dev team & channels',
        async run(ctx) {
            const frames = [
                '《 █▒▒▒▒▒▒▒▒▒▒▒ 》10%', '《 ████▒▒▒▒▒▒▒▒ 》30%', '《 ███████▒▒▒▒▒ 》50%',
                '《 ██████████▒▒ 》80%', '《 ████████████ 》100%', '🖥️ LOD X MINI — loading dev team…'
            ];
            const out = await ctx.sock.sendMessage(ctx.jid, { text: frames[0] });
            for (const f of frames.slice(1)) {
                await sleep(320);
                await ctx.sock.sendMessage(ctx.jid, { text: f, edit: out?.key }).catch(() => {});
            }
            const links = cfg.devChannels.map((c) => ({ raw: c, m: codeOf(c), jid: /^\d+@newsletter$/.test(c) ? c : null }));
            const got = await Promise.all(links.map(async (l) => {
                try {
                    const info = l.jid
                        ? await ctx.sock.newsletterMetadata('jid', l.jid)
                        : await ctx.sock.newsletterMetadata('invite', l.m[1]);
                    const tm = info?.thread_metadata || {};
                    return { name: tm.name?.text || '', link: tm.invite_code ? `https://whatsapp.com/channel/${tm.invite_code}` : l.raw };
                } catch { return { name: '', link: l.raw }; }
            }));
            const dark = got.findIndex((c) => /dark/i.test(c.name));
            const rest = got.filter((_, i) => i !== dark);
            const nums = [...DEV_NUMBERS];
            const i225 = nums.indexOf('94753262213');
            const first = i225 >= 0 ? nums.splice(i225, 1)[0] : null;
            const body = [
                `╭━━━━━━━━━━━━━━━━━━━━╮`,
                `     🖤 *𝗟𝗢𝗗 𝗫 𝗠𝗜𝗡𝗜* — DEV TEAM`,
                `╰━━━━━━━━━━━━━━━━━━━━╯`,
                '',
                dark >= 0 ? `🌑 *LOD PROJECT*\n🔗 ${got[dark].link}\n` : '',
                first ? `👑 *225*\n📱 +${first}\n🔗 https://wa.me/${first}\n` : '',
                nums.length ? `━━━━━━━━━━━━━━━━━━━━\n👥 *DEV TEAM*\n\n${nums.map((n) => `▫️ +${n}  →  https://wa.me/${n}`).join('\n')}\n` : '',
                rest.length ? `━━━━━━━━━━━━━━━━━━━━\n📢 *OUR CHANNELS*\n\n${rest.map((c) => `▫️ ${c.name || 'Channel'}\n    ${c.link}`).join('\n')}\n` : '',
                `━━━━━━━━━━━━━━━━━━━━`,
                `🤖 *Bot* : ${ctx.settings.botName || 'LOD X MINI'}  ·  ⚡ Powered by *LOD X MINI*`,
                `🔗 *FREE LOD CONNECTED > https://lodxmini.vercel.app*`
            ].filter(Boolean).join('\n');
            await ctx.sock.sendMessage(ctx.jid, { text: body, edit: out?.key }).catch(async () => { await ctx.reply(body).catch(() => {}); });
        }
    }
];
