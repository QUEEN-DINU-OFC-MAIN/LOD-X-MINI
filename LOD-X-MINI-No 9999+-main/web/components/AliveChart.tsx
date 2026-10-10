"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Users, TrendingUp, TrendingDown, Wifi } from "lucide-react";

type Point = { t: number; on: number; re: number; tot: number };
type Stats = { totalSessions: number | null; workersOnline: number; connected: number; reconnecting: number; at: number };

const RANGES = [
  { key: "1H", ms: 3_600_000 },
  { key: "24H", ms: 86_400_000 },
  { key: "3D", ms: 3 * 86_400_000 },
] as const;

const W = 860;
const H = 250;
const PAD = { l: 40, r: 16, t: 14, b: 26 };

function niceMax(v: number) {
  const m = Math.max(5, Math.ceil(v * 1.15));
  const step = m > 400 ? 100 : m > 160 ? 50 : m > 60 ? 20 : 10;
  return Math.ceil(m / step) * step;
}

function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx.toFixed(1)} ${p0.y.toFixed(1)}, ${cx.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return d;
}

function Countdown({ secs }: { secs: number }) {
  const [n, setN] = useState(secs);
  useEffect(() => {
    setN(secs);
    const t = setInterval(() => setN((x) => (x > 0 ? x - 1 : secs)), 1000);
    return () => clearInterval(t);
  }, [secs]);
  return <span className="tabular-nums text-emerald-300">{secs - n}s</span>;
}

export default function AliveChart() {
  const [live, setLive] = useState<Stats | null>(null);
  const [hist, setHist] = useState<Point[]>([]);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("24H");
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const [s, h] = await Promise.all([fetch("/api/stats"), fetch("/api/stats/history")]);
        if (!s.ok || !h.ok) throw 0;
        const sj: Stats = await s.json();
        const hj = await h.json();
        if (stop) return;
        setLive(sj);
        setHist((old) => {
          const pts: Point[] = Array.isArray(hj.points) ? hj.points : [];
          const last = pts[pts.length - 1];
          if (!last || Date.now() - last.t > 90_000) {
            pts.push({ t: Date.now(), on: sj.connected, re: sj.reconnecting, tot: sj.totalSessions ?? 0 });
          }
          return pts.length ? pts : old;
        });
      } catch {
        if (!stop) setLive((v) => v);
      }
    };
    load();
    const t = setInterval(load, 15_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  const ms = RANGES.find((r) => r.key === range)!.ms;
  const view = useMemo(() => {
    const cut = Date.now() - ms;
    const pts = hist.filter((p) => p.t >= cut);
    const max = niceMax(Math.max(0, ...pts.map((p) => p.on)));
    const x = (t: number) => PAD.l + ((t - cut) / ms) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
    const coords = pts.map((p) => ({ x: x(p.t), y: y(p.on), p }));
    return { pts, coords, max, cut, x, y };
  }, [hist, ms]);

  const line = useMemo(() => smoothPath(view.coords), [view]);
  const area = line ? `${line} L ${view.coords[view.coords.length - 1].x.toFixed(1)} ${H - PAD.b} L ${view.coords[0].x.toFixed(1)} ${H - PAD.b} Z` : "";

  const histPeak = view.pts.length ? Math.max(...view.pts.map((p) => p.on)) : null;
  const peak = Math.max(histPeak ?? 0, live?.connected ?? 0) || histPeak;
  const low = view.pts.length ? Math.min(...view.pts.map((p) => p.on)) : (live?.connected ?? null);
  const online = live?.connected ?? view.pts[view.pts.length - 1]?.on ?? null;

  const onMove = (e: React.PointerEvent) => {
    const el = boxRef.current;
    if (!el || view.coords.length < 2) return;
    const r = el.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < view.coords.length; i++) {
      const d = Math.abs(view.coords[i].x - px);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    setHover(best);
  };

  const hv = hover != null ? view.coords[hover] : null;
  const gridYs = [0.25, 0.5, 0.75, 1].map((f) => view.y(view.max * f));
  const hourTicks = useMemo(() => {
    const out: number[] = [];
    const step = ms <= 3_600_000 ? 15 * 60_000 : ms <= 86_400_000 ? 4 * 3_600_000 : 12 * 3_600_000;
    const t0 = Math.ceil(view.cut / step) * step;
    for (let t = t0; t <= Date.now(); t += step) out.push(t);
    return out;
  }, [ms, view.cut]);

  const Tile = ({ Icon, label, value, accent }: { Icon: typeof Activity; label: string; value: React.ReactNode; accent?: string }) => (
    <div className="glass-card rounded-2xl p-4 sm:p-5">
      <Icon className={`h-5 w-5 ${accent || "text-emerald-300"}`} aria-hidden />
      <div className="mt-2.5 text-2xl font-black tabular-nums text-white sm:text-3xl">{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  );

  return (
    <div className="glass-card overflow-hidden rounded-3xl">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        <div>
          <div className="text-sm font-bold text-white">Network trend</div>
          <div className="text-[11px] text-slate-400">
            Live overview · updates every 15s (<Countdown secs={15} />)
          </div>
        </div>
        <div className="ml-auto flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                range === r.key ? "bg-emerald-400 text-black" : "border border-white/10 bg-white/[0.04] text-slate-300 hover:border-emerald-400/40"
              }`}
            >
              {r.key}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 px-5 pt-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <Tile
          Icon={Activity}
          label="Bots online now"
          value={
            online == null ? "—" : (
              <span className="inline-flex items-center gap-2">
                {online}
                <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">LIVE</span>
              </span>
            )
          }
        />
        <Tile Icon={Users} label="Numbers linked" value={live?.totalSessions ?? "—"} />
        <Tile Icon={TrendingUp} label={`Peak · ${range}`} value={peak ?? "—"} accent="text-sky-300" />
        <Tile Icon={TrendingDown} label={`Low · ${range}`} value={low ?? "—"} accent="text-violet-300" />
      </div>

      <div className="px-3 pb-4 pt-3 sm:px-4">
        <div ref={boxRef} className="relative" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {view.coords.length < 2 ? (
            <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-slate-500">
              <Wifi className="h-6 w-6 text-emerald-300/70" aria-hidden />
              <p className="text-sm">The trend line appears here as minutes pass.</p>
            </div>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Bots online over time">
              <defs>
                <linearGradient id="aliveFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.34" />
                  <stop offset="55%" stopColor="#22d3ee" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="aliveStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
              {gridYs.map((gy, i) => (
                <g key={i}>
                  <line x1={PAD.l} x2={W - PAD.r} y1={gy} y2={gy} stroke="rgba(148,163,184,0.10)" strokeDasharray="3 5" />
                  <text x={PAD.l - 8} y={gy + 3} textAnchor="end" fontSize="10" fill="#64748b">
                    {Math.round(view.max * [0.25, 0.5, 0.75, 1][i])}
                  </text>
                </g>
              ))}
              {hourTicks.map((t) => (
                <text key={t} x={view.x(t)} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748b">
                  {new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </text>
              ))}
              <path d={area} fill="url(#aliveFill)" className="chart-area" />
              <path d={line} fill="none" stroke="url(#aliveStroke)" strokeWidth="2.4" strokeLinecap="round" pathLength={1000} className="chart-line" />
              {hv && (
                <g>
                  <line x1={hv.x} x2={hv.x} y1={PAD.t} y2={H - PAD.b} stroke="rgba(110,231,183,0.35)" strokeWidth="1" />
                  <circle cx={hv.x} cy={hv.y} r="5" fill="#05070a" stroke="#6ee7b7" strokeWidth="2.4" />
                </g>
              )}
              <circle cx={view.coords[view.coords.length - 1].x} cy={view.coords[view.coords.length - 1].y} r="4.5" fill="#34d399" className="chart-dot" />
            </svg>
          )}
          {hv && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-white/10 bg-[#0c1420]/95 px-3 py-2 text-center shadow-xl"
              style={{ left: `${(hv.x / W) * 100}%`, top: `${Math.max(0, (hv.y / H) * 100 - 24)}%` }}
            >
              <div className="text-sm font-black tabular-nums text-emerald-300">{hv.p.on} online</div>
              <div className="text-[10px] text-slate-400">{new Date(hv.p.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
