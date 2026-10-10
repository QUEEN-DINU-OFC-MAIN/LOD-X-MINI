import os from 'node:os';
import { richWidget } from './richmsg.js';

const esc = (v, max = 40) => String(v ?? '').replace(/[&<>"'`$\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

const CSS = `
* { -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; box-sizing: border-box; margin: 0; padding: 0; }
body { background: transparent; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #fff; overflow: hidden; }
.wrap { width: 100%; max-width: 480px; margin: auto; padding: 12px; }
.card { position: relative; overflow: hidden; border-radius: 22px; padding: 16px; border: 1.5px solid rgba(52,211,153,.55); background: radial-gradient(120% 90% at 0% 0%, rgba(16,185,129,.22), transparent 55%), radial-gradient(100% 80% at 100% 100%, rgba(139,92,246,.20), transparent 55%), linear-gradient(180deg, #0d131b, #080b11); box-shadow: 0 16px 48px rgba(0,0,0,.75), inset 0 0 40px rgba(52,211,153,.05); }
.top { display: flex; align-items: center; gap: 12px; }
.logo { width: 46px; height: 46px; flex: none; }
.name { font-size: 18px; font-weight: 900; letter-spacing: 1.5px; }
.tag { font-size: 9px; letter-spacing: 3px; font-weight: 800; color: #34d399; margin-top: 2px; }
.live { margin-left: auto; display: flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 99px; background: rgba(16,185,129,.14); border: 1px solid rgba(52,211,153,.45); font-size: 10px; font-weight: 800; letter-spacing: 1.5px; color: #6ee7b7; }
.live i { width: 7px; height: 7px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981; animation: pulse 1.3s infinite; }
@keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(.8); } }
.hero { display: flex; align-items: center; gap: 16px; margin: 16px 0 14px; padding: 14px; border-radius: 16px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); }
.ring { position: relative; width: 74px; height: 74px; flex: none; }
.ring svg { width: 74px; height: 74px; transform: rotate(-90deg); }
.ring .bg { fill: none; stroke: rgba(255,255,255,.09); stroke-width: 6; }
.ring .fg { fill: none; stroke: url(#g); stroke-width: 6; stroke-linecap: round; stroke-dasharray: 201; stroke-dashoffset: 40; animation: spin 3.2s ease-in-out infinite alternate; transform-origin: center; }
@keyframes spin { from { stroke-dashoffset: 150; } to { stroke-dashoffset: 20; } }
.ring b { position: absolute; inset: 0; display: grid; place-items: center; font-size: 13px; font-weight: 900; color: #6ee7b7; }
.up-l { font-size: 9px; letter-spacing: 2px; color: #64748b; font-weight: 800; }
.up-v { font-size: 28px; font-weight: 900; font-variant-numeric: tabular-nums; letter-spacing: 1px; background: linear-gradient(90deg, #6ee7b7, #67e8f9); -webkit-background-clip: text; background-clip: text; color: transparent; }
.eq { display: flex; align-items: flex-end; gap: 3px; height: 18px; margin-top: 6px; }
.eq span { width: 4px; border-radius: 2px; background: linear-gradient(180deg, #34d399, #0ea5e9); animation: eq 1s ease-in-out infinite; }
.eq span:nth-child(1) { animation-delay: 0s; } .eq span:nth-child(2) { animation-delay: .15s; } .eq span:nth-child(3) { animation-delay: .3s; } .eq span:nth-child(4) { animation-delay: .45s; } .eq span:nth-child(5) { animation-delay: .6s; } .eq span:nth-child(6) { animation-delay: .75s; } .eq span:nth-child(7) { animation-delay: .9s; }
@keyframes eq { 0%,100% { height: 4px; } 50% { height: 18px; } }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.pill { padding: 9px 6px; border-radius: 12px; text-align: center; background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.09); }
.pill .l { font-size: 8px; letter-spacing: 1.4px; color: #64748b; font-weight: 800; text-transform: uppercase; }
.pill .v { margin-top: 3px; font-size: 14px; font-weight: 900; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hello { margin-top: 12px; text-align: center; font-size: 12px; color: #cbd5e1; }
.hello b { color: #6ee7b7; }
.foot { margin-top: 12px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,.14); text-align: center; font-size: 9px; letter-spacing: 2px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
.foot span { color: #34d399; }
`;

const LOGO = `<svg class="logo" viewBox="0 0 48 48"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6ee7b7"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><path d="M24 2.8 41.4 12.9v20.2L24 43.2 6.6 33.1V12.9Z" fill="url(#lg)"/><path d="M16.6 15.5h6.2l-3.4 6h5.1l-8.6 11 2.6-6.4h-4.7Z" fill="#052e22"/><path d="M31.4 15.5h3.6l-5.4 8 5.4 8.4h-3.7L28 26.8l-1.2 2-1.4-3.4 3.2-4.7Z" fill="#052e22" opacity=".92"/></svg>`;

export function aliveHtml(d) {
    const pill = (l, v) => `<div class="pill"><div class="l">${l}</div><div class="v">${esc(v)}</div></div>`;
    return `<style>${CSS}</style>
<body><div class="wrap"><div class="card">
<div class="top">${LOGO}<div><div class="name">${esc(d.name, 24)}</div><div class="tag">MINI BOT</div></div><div class="live"><i></i>ONLINE</div></div>
<div class="hero">
<div class="ring"><svg viewBox="0 0 74 74"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><circle class="bg" cx="37" cy="37" r="32"/><circle class="fg" cx="37" cy="37" r="32"/></svg><b>${esc(d.ping, 6)}ms</b></div>
<div><div class="up-l">UPTIME</div><div class="up-v" id="up">00:00:00</div><div class="eq"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div></div>
</div>
<div class="grid">${pill('Mode', d.mode)}${pill('Prefix', d.prefix)}${pill('Commands', d.commands)}${pill('Memory', d.memory)}${pill('Language', d.lang)}${pill('Node', d.node)}</div>
<div class="hello">Hello <b>${esc(d.user, 24)}</b>, your bot is awake. Send <b>${esc(d.prefix, 3)}menu</b> to begin.</div>
<div class="foot">Powered by <span>LOD X MINI</span><div style="margin-top:4px;color:#34d399;letter-spacing:1px;text-transform:none">FREE LOD CONNECTED &gt; https://rcdxmini.dexterid.org</div></div>
</div></div>
<script>
(function () {
  var s = ${Math.max(0, Math.floor(Number(d.uptimeSec) || 0))};
  var el = document.getElementById('up');
  function p(n) { return n < 10 ? '0' + n : '' + n; }
  function draw() { var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); el.textContent = p(h) + ':' + p(m) + ':' + p(s % 60); }
  draw();
  setInterval(function () { s++; draw(); }, 1000);
})();
</script>
</body></html>`;
}

export function aliveMessage(ctx, { botName, powered }) {
    const pingMs = Math.max(0, Date.now() - Number(ctx.msg.messageTimestamp) * 1000);
    const up = Date.now() - (ctx.runner.openedAt || Date.now());
    const data = {
        name: botName,
        powered,
        ping: pingMs > 9999 ? 9999 : pingMs,
        mode: ctx.settings.mode,
        prefix: ctx.prefix,
        commands: ctx.platform.commands.unique().size,
        memory: `${Math.round(process.memoryUsage().rss / 1048576)} MB`,
        lang: String(ctx.lang || 'en').toUpperCase(),
        node: process.version,
        user: ctx.msg.pushName || 'friend',
        uptimeSec: up / 1000
    };
    return richWidget({ html: aliveHtml(data), fallback: `${botName} is alive` });
}

