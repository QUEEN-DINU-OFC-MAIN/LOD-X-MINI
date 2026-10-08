'use client';

import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Activity, Loader2 } from 'lucide-react';

type Point = { t: number; on: number; re: number; tot: number };
type ServerInfo = {
  id: string;
  name: string;
  region?: string;
  online: boolean;
  connected: number;
  totalSessions: number;
  latencyMs: number | null;
};
type Stats = {
  totalSessions: number | null;
  workersOnline: number;
  connected: number;
  reconnecting: number;
  serversOnline?: number;
  totalServers?: number;
  servers?: ServerInfo[];
  at: number;
};

const RANGES = [
  { key: '24h', label: '24H', ms: 86_400_000 },
  { key: '7d', label: '7D', ms: 7 * 86_400_000 },
  { key: '30d', label: '30D', ms: 30 * 86_400_000 }
];

function bucket(points: Point[], target: number) {
  if (points.length <= target) {
    return points.map((p) => ({
      t: p.t,
      online: p.on,
      total: Math.max(p.tot || 0, p.on)
    }));
  }
  const size = Math.ceil(points.length / target);
  const out: { t: number; online: number; total: number }[] = [];
  for (let i = 0; i < points.length; i += size) {
    const slice = points.slice(i, i + size);
    const on = Math.round(slice.reduce((a, p) => a + p.on, 0) / slice.length);
    const tot = Math.round(slice.reduce((a, p) => a + Math.max(p.tot || 0, p.on), 0) / slice.length);
    out.push({ t: slice[Math.floor(slice.length / 2)].t, online: on, total: tot });
  }
  return out;
}

export default function LiveAreaChart() {
  const [range, setRange] = React.useState('24h');
  const [hist, setHist] = React.useState<Point[]>([]);
  const [live, setLive] = React.useState<Stats | null>(null);

  React.useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const [h, s] = await Promise.all([fetch('/api/stats/history'), fetch('/api/stats')]);
        if (!h.ok || !s.ok) return;
        const hj = await h.json();
        const sj = await s.json();
        if (stop) return;
        const pts: Point[] = Array.isArray(hj.points) ? hj.points : [];
        setHist(pts);
        const last = pts[pts.length - 1];
        const online = Math.max(sj.connected ?? 0, last?.on ?? 0);
        const total = sj.totalSessions != null ? Math.max(sj.totalSessions, online) : Math.max(last?.tot ?? 0, online);
        setLive({ ...sj, connected: online, totalSessions: total });
      } catch {}
    };
    load();
    const t = setInterval(load, 15_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  const data = React.useMemo(() => {
    const r = RANGES.find((x) => x.key === range) ?? RANGES[0];
    const now = hist.length ? hist[hist.length - 1].t : Date.now();
    const filtered = hist.filter((p) => p.t >= now - r.ms);
    if (filtered.length >= 2) return bucket(filtered, 120);
    const curOn = live?.connected ?? 0;
    const curTot = live?.totalSessions ?? curOn;
    return [
      { t: now - 3600_000 * 4, online: curOn, total: curTot },
      { t: now - 3600_000 * 2, online: curOn, total: curTot },
      { t: now, online: curOn, total: curTot }
    ];
  }, [hist, range, live]);

  const peakBots = React.useMemo(() => {
    const maxHist = data.reduce((m, p) => Math.max(m, p.online, p.total), 0);
    return Math.max(maxHist, live?.totalSessions ?? 0, live?.connected ?? 0);
  }, [data, live]);

  return (
    <section className="glass-card gradient-ring reveal-on-scroll is-visible relative overflow-hidden rounded-3xl p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-white sm:text-lg">
            <Activity className="h-4 w-4 text-emerald-400" />
            Connected-bots trend
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Live overview · Combined across all active servers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-white/10 bg-white/[0.03] p-0.5">
            {RANGES.map((r) => {
              const active = range === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRange(r.key)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    active ? 'bg-emerald-400 text-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            LIVE CONNECTED
          </div>
          <div className="mt-1 text-xl font-extrabold text-emerald-400 sm:text-2xl">
            {live ? live.connected : '—'}
          </div>
          <div className="text-[10px] text-slate-500">active right now</div>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            TOTAL PAIRED
          </div>
          <div className="mt-1 text-xl font-extrabold text-cyan-300 sm:text-2xl">
            {live ? (live.totalSessions ?? live.connected) : '—'}
          </div>
          <div className="text-[10px] text-slate-500">all servers</div>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            SERVERS ONLINE
          </div>
          <div className="mt-1 text-xl font-extrabold text-white sm:text-2xl">
            {live ? `${live.serversOnline ?? 1} / ${live.totalServers ?? 1}` : '—'}
          </div>
          <div className="text-[10px] text-slate-500">cluster nodes</div>
        </div>
      </div>

      {!live ? (
        <div className="flex h-[200px] items-center justify-center text-xs text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-400" />
          Collecting live data…
        </div>
      ) : (
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="rcdLiveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="rcdTotalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="t"
                tickLine={false}
                axisLine={false}
                minTickGap={45}
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(v) =>
                  new Date(v).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                }
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fill: '#64748b', fontSize: 10 }}
                domain={[0, (max: number) => Math.max(5, Math.ceil(max * 1.15))]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(8, 12, 18, 0.95)',
                  borderColor: 'rgba(52, 211, 153, 0.3)',
                  borderRadius: '12px',
                  fontSize: '11px',
                  color: '#f1f5f9'
                }}
                labelFormatter={(label) =>
                  new Date(Number(label)).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })
                }
              />
              <Area
                type="monotone"
                dataKey="total"
                name="Total Bots"
                stroke="#22d3ee"
                strokeWidth={1.8}
                fill="url(#rcdTotalGrad)"
              />
              <Area
                type="monotone"
                dataKey="online"
                name="Bots Live"
                stroke="#34d399"
                strokeWidth={2.2}
                fill="url(#rcdLiveGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-3.5">
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 sm:text-[11px]">
            <span className="size-2 shrink-0 rounded-[3px] bg-emerald-400" />
            Bots live right now
          </span>
          <span className="text-lg font-semibold tracking-tight text-white sm:text-xl">
            {live ? live.connected : '—'}
          </span>
          <span className="text-[10px] text-slate-500">auto-refreshing / 15s</span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 sm:text-[11px]">
            <span className="size-2 shrink-0 rounded-[3px] bg-cyan-400" />
            Total bots
          </span>
          <span className="text-lg font-semibold tracking-tight text-white sm:text-xl">
            {live ? (live.totalSessions ?? live.connected) : '—'}
          </span>
          <span className="text-[10px] text-slate-500">{peakBots} peak</span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 sm:text-[11px]">
            <span className="size-2 shrink-0 rounded-[3px] bg-blue-400" />
            Active servers
          </span>
          <span className="text-lg font-semibold tracking-tight text-blue-300 sm:text-xl">
            {live ? (live.serversOnline ?? 1) : '—'}
          </span>
          <span className="text-[10px] text-slate-500">multi-server cluster</span>
        </div>
      </div>

      {live?.servers && live.servers.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-3">
          {live.servers.map((srv) => (
            <div
              key={srv.id}
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 text-[11px]"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  srv.online ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="font-semibold text-slate-200">{srv.name}</span>
              <span className="text-slate-500">·</span>
              <span className="font-mono font-bold text-emerald-300">{srv.connected} bots</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
