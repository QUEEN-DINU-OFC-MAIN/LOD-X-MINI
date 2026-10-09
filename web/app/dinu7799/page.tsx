'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  Cpu,
  Gauge,
  HardDrive,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  Server,
  ShieldAlert,
  Timer,
  Users,
  Wand2,
  Wifi
} from 'lucide-react';

type ServerRow = {
  id: string;
  name: string;
  region?: string;
  online: boolean;
  latencyMs: number | null;
  uptimeSec: number;
  rssMb: number;
  heapUsedMb: number;
  node: string;
  shard: { index: number; count: number } | null;
  maxSessions: number;
  sessions: number;
  connected: number;
  reconnecting: number;
  editToday: number;
  aiToday: number;
  neuronsToday: number;
  blockedHits: number;
};

type SessionRow = {
  number: string;
  state: string;
  opened: number | null;
  welcomed: boolean;
  panel: boolean;
  groups: number;
  lang: string | null;
  server: string;
};

type Overview = {
  ok: boolean;
  at: number;
  cluster: {
    serversOnline: number;
    totalServers: number;
    rssMb: number;
    sessionsTotal: number;
    connected: number;
    reconnecting: number;
    capacity: number;
    blockedTotal: number;
  };
  servers: ServerRow[];
  sessions: { count: number; list: SessionRow[] };
  edit: {
    total: number;
    todayTotal: number;
    today: { owner: string; count: number; limit: number }[];
    models: { model: string; count: number }[];
    days: { date: string; count: number }[];
  };
  ai: {
    today: { calls: number; neurons: number };
    days: { date: string; calls: number; neurons: number }[];
  };
  limits: {
    blockedTotal: number;
    blockedList: { ip: string; hits: number; last: number; server: string }[];
    rates: { route: string; calls: number; errors: number; avgMs: number }[];
  };
};

const KEY_STORE = 'rcd-admin-key';
const fmtUptime = (s: number) => {
  if (!s) return '—';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d ? `${d}d ` : ''}${h}h ${m}m`;
};
const ago = (t: number) => {
  if (!t) return '—';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
};

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'emerald'
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'emerald' | 'cyan' | 'amber' | 'slate';
}) {
  const tones: Record<string, string> = {
    emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    cyan: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300',
    amber: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    slate: 'border-white/10 bg-white/[0.05] text-slate-300'
  };
  return (
    <div className="glass-card card-lift rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <div className="mt-2.5 text-xl font-extrabold text-white">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div> : null}
    </div>
  );
}

function Bar({ pct, tone = 'emerald' }: { pct: number; tone?: string }) {
  const tones: Record<string, string> = {
    emerald: 'from-emerald-400 to-cyan-400',
    amber: 'from-amber-400 to-orange-400',
    slate: 'from-slate-400 to-slate-500'
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${tones[tone] || tones.emerald}`}
        style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

export default function AdminOverviewPage() {
  const [key, setKey] = useState('');
  const [draft, setDraft] = useState('');
  const [needsKey, setNeedsKey] = useState(false);
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(true);
  const [tab, setTab] = useState<'servers' | 'sessions' | 'api' | 'ai'>('servers');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(KEY_STORE) || '' : '';
    const fromUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('key') || '' : '';
    setKey(fromUrl || saved);
    setDraft(fromUrl || saved);
  }, []);

  const load = useCallback(
    async (k: string, quiet = false) => {
      if (!k) {
        setNeedsKey(true);
        return;
      }
      if (!quiet) setBusy(true);
      try {
        const r = await fetch('/api/admin/overview', { headers: { 'x-admin-key': k }, cache: 'no-store' });
        const j = await r.json();
        if (r.status === 401 || j?.authRequired) {
          setNeedsKey(true);
          setErr('Admin key එක වැරදියි.');
          setData(null);
          return;
        }
        if (!j?.ok) throw new Error(j?.error || 'failed');
        setData(j as Overview);
        setNeedsKey(false);
        setErr('');
        window.localStorage.setItem(KEY_STORE, k);
      } catch (e: any) {
        setErr(e?.message || 'Could not load');
      } finally {
        if (!quiet) setBusy(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!key) return;
    load(key, true);
  }, [key, load]);

  useEffect(() => {
    if (!auto || !key) return;
    const t = setInterval(() => load(key, true), 10_000);
    return () => clearInterval(t);
  }, [auto, key, load]);

  if (needsKey || !key) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center">
        <div className="glass-card gradient-ring w-full rounded-3xl p-6 text-center">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
            <KeyRound className="h-6 w-6" />
          </span>
          <h1 className="mt-3 text-lg font-extrabold text-white">Admin access</h1>
          <p className="mt-1 text-xs text-slate-400">
            මේ page එක server owners සඳහා විතරයි. Admin key එක ඇතුළත් කරන්න.
          </p>
          <form
            className="mt-4 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setErr('');
              setKey(draft.trim());
            }}
          >
            <input
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Admin key"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-emerald-400/60"
            />
            <button
              type="submit"
              className="btn-shine inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-black"
            >
              <Lock className="h-3.5 w-3.5" /> Unlock dashboard
            </button>
          </form>
          {err ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" /> {err}
            </p>
          ) : null}
          <p className="mt-3 font-mono text-[10px] text-slate-500">
            default key: <span className="text-slate-400">dexter7739</span> · change with ADMIN_KEY env
          </p>
        </div>
      </div>
    );
  }

  const c = data?.cluster;

  return (
    <div className="flex flex-col gap-5">
      <section className="glass-card gradient-ring rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
              <Gauge className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">Server Control Center</h1>
              <p className="text-xs text-slate-400">
                Sessions · RAM · API limits · AI usage —{' '}
                {data ? `updated ${new Date(data.at).toLocaleTimeString()}` : 'loading…'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAuto((v) => !v)}
              className={`rounded-xl border px-3 py-2 text-[11px] font-bold transition ${
                auto
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-white/10 bg-white/[0.05] text-slate-300'
              }`}
            >
              <Timer className="mr-1 inline h-3.5 w-3.5" /> {auto ? 'Auto 10s' : 'Manual'}
            </button>
            <button
              type="button"
              onClick={() => load(key)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[11px] font-bold text-slate-200 transition hover:border-white/25"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                window.localStorage.removeItem(KEY_STORE);
                setKey('');
                setDraft('');
                setData(null);
                setNeedsKey(true);
              }}
              className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[11px] font-bold text-slate-300 transition hover:border-white/25"
            >
              Lock
            </button>
          </div>
        </div>

        {err ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" /> {err}
          </p>
        ) : null}
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat
          icon={Users}
          label="Sessions"
          value={c?.sessionsTotal ?? '—'}
          sub={`${c?.connected ?? 0} online · ${c?.reconnecting ?? 0} reconnecting`}
        />
        <Stat
          icon={Server}
          label="Servers online"
          value={`${c?.serversOnline ?? 0}/${c?.totalServers ?? 0}`}
          sub={`capacity ${c?.capacity ?? 0} sessions`}
          tone="cyan"
        />
        <Stat icon={HardDrive} label="Total RAM" value={`${c?.rssMb ?? 0} MB`} sub="RSS across all nodes" tone="amber" />
        <Stat
          icon={Wand2}
          label="AI edits today"
          value={data?.edit?.todayTotal ?? 0}
          sub={`${data?.edit?.total ?? 0} all-time · limit ${data?.edit?.today?.[0]?.limit ?? 3}/owner`}
          tone="slate"
        />
        <Stat icon={Brain} label="AI calls today" value={data?.ai?.today?.calls ?? 0} sub={`${data?.ai?.today?.neurons ?? 0} neurons used`} />
        <Stat
          icon={ShieldAlert}
          label="Rate-limited requests"
          value={data?.limits?.blockedTotal ?? 0}
          sub="blocked in last 10 min window"
          tone="amber"
        />
        <Stat
          icon={Activity}
          label="API routes tracked"
          value={data?.limits?.rates?.length ?? 0}
          sub={`total calls ${(data?.limits?.rates || []).reduce((n, r) => n + r.calls, 0)}`}
          tone="cyan"
        />
        <Stat
          icon={Wifi}
          label="Cluster latency"
          value={`${data?.servers?.length ? Math.round((data?.servers || []).filter((s) => s.online).reduce((n, s) => n + (s.latencyMs || 0), 0) / Math.max(1, (data?.servers || []).filter((s) => s.online).length)) : 0} ms`}
          sub="average server response"
          tone="slate"
        />
      </section>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['servers', 'Servers & RAM', Server],
            ['sessions', 'Sessions', Users],
            ['api', 'API usage & limits', Activity],
            ['ai', 'AI / .edit usage', ImageIcon]
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id as any)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[11px] font-bold transition ${
              tab === id
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/25'
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === 'servers' && (
        <section className="glass-card rounded-3xl p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-bold text-white">Bot servers</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(data?.servers || []).map((s) => (
              <div key={s.id} className="rounded-2xl border border-white/[0.07] bg-black/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${s.online ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    <span className="text-sm font-bold text-white">{s.name}</span>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      s.online
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-white/10 bg-white/[0.05] text-slate-400'
                    }`}
                  >
                    {s.online ? `${s.latencyMs ?? 0} ms` : 'offline'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-300 sm:grid-cols-3">
                  <div>
                    <div className="text-slate-500">Sessions</div>
                    <div className="font-bold text-white">
                      {s.sessions} / {s.maxSessions || '∞'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Online</div>
                    <div className="font-bold text-emerald-300">{s.connected}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Reconnecting</div>
                    <div className="font-bold text-amber-300">{s.reconnecting}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">RAM (RSS)</div>
                    <div className="font-bold text-white">{s.rssMb} MB</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Heap used</div>
                    <div className="font-bold text-white">{s.heapUsedMb} MB</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Uptime</div>
                    <div className="font-bold text-white">{fmtUptime(s.uptimeSec)}</div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[10px] text-slate-400">
                    <span>Session load</span>
                    <span>{s.maxSessions ? Math.round((s.sessions / s.maxSessions) * 100) : 0}%</span>
                  </div>
                  <Bar pct={s.maxSessions ? (s.sessions / s.maxSessions) * 100 : 5} tone={s.maxSessions && s.sessions / s.maxSessions > 0.8 ? 'amber' : 'emerald'} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-slate-400">
                  <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5">
                    <Cpu className="mr-1 inline h-3 w-3" />
                    {s.node || 'node'}
                  </span>
                  {s.shard && <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5">shard {s.shard.index + 1}/{s.shard.count}</span>}
                  <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5">region {s.region || '—'}</span>
                  <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5">.edit today {s.editToday}</span>
                  <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5">AI calls {s.aiToday}</span>
                  <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5">blocked {s.blockedHits}</span>
                </div>
              </div>
            ))}
            {!data?.servers?.length ? <p className="text-xs text-slate-400">No server data yet.</p> : null}
          </div>
        </section>
      )}

      {tab === 'sessions' && (
        <section className="glass-card rounded-3xl p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Linked sessions</h2>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-bold text-slate-300">
              {data?.sessions?.count ?? 0} total
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[11px]">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2">Number</th>
                  <th className="py-2">State</th>
                  <th className="py-2">Uptime</th>
                  <th className="py-2">Groups</th>
                  <th className="py-2">Panel</th>
                  <th className="py-2">Language</th>
                  <th className="py-2">Server</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {(data?.sessions?.list || []).map((s) => (
                  <tr key={`${s.server}-${s.number}`} className="border-t border-white/[0.06]">
                    <td className="py-2 font-mono text-white">+{s.number}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          s.state === 'open'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : s.state === 'starting' || s.state === 'backoff'
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'bg-white/[0.06] text-slate-400'
                        }`}
                      >
                        {s.state}
                      </span>
                    </td>
                    <td className="py-2">{s.opened ? `${s.opened} min` : '—'}</td>
                    <td className="py-2">{s.groups}</td>
                    <td className="py-2">{s.panel ? '✅' : '—'}</td>
                    <td className="py-2">{s.lang || 'en'}</td>
                    <td className="py-2 text-slate-400">{s.server}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.sessions?.list?.length ? (
              <p className="py-3 text-xs text-slate-400">
                No session details available (bot worker offline or storage read restricted).
              </p>
            ) : null}
          </div>
        </section>
      )}

      {tab === 'api' && (
        <div className="flex flex-col gap-4">
          <section className="glass-card rounded-3xl p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-bold text-white">API endpoint usage</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[11px]">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2">Endpoint</th>
                    <th className="py-2">Calls</th>
                    <th className="py-2">Errors</th>
                    <th className="py-2">Avg ms</th>
                    <th className="py-2">Load</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {(data?.limits?.rates || []).map((r) => {
                    const max = Math.max(1, ...(data?.limits?.rates || []).map((x) => x.calls));
                    return (
                      <tr key={r.route} className="border-t border-white/[0.06]">
                        <td className="py-2 font-mono text-white">{r.route}</td>
                        <td className="py-2">{r.calls}</td>
                        <td className={`py-2 ${r.errors ? 'text-amber-300' : ''}`}>{r.errors}</td>
                        <td className="py-2">{r.avgMs}</td>
                        <td className="w-32 py-2">
                          <Bar pct={(r.calls / max) * 100} tone={r.errors ? 'amber' : 'emerald'} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!data?.limits?.rates?.length ? <p className="py-3 text-xs text-slate-400">No API traffic recorded yet.</p> : null}
            </div>
          </section>

          <section className="glass-card rounded-3xl p-4 sm:p-5">
            <h2 className="mb-1 text-sm font-bold text-white">Rate-limited users (last 24 h)</h2>
            <p className="mb-3 text-[11px] text-slate-400">
              Pairing endpoint එකේ 10 minute window limit එක පැනලා block වුණු IP ලැයිස්තුව.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[11px]">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2">IP</th>
                    <th className="py-2">Blocks</th>
                    <th className="py-2">Last seen</th>
                    <th className="py-2">Server</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {(data?.limits?.blockedList || []).map((b) => (
                    <tr key={`${b.server}-${b.ip}`} className="border-t border-white/[0.06]">
                      <td className="py-2 font-mono text-white">{b.ip}</td>
                      <td className="py-2 text-amber-300">{b.hits}</td>
                      <td className="py-2">{ago(b.last)}</td>
                      <td className="py-2 text-slate-400">{b.server}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data?.limits?.blockedList?.length ? (
                <p className="py-3 text-xs text-slate-400">No users hit the rate limit. 🎉</p>
              ) : null}
            </div>
          </section>
        </div>
      )}

      {tab === 'ai' && (
        <div className="flex flex-col gap-4">
          <section className="glass-card rounded-3xl p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-bold text-white">.edit — today's per-owner usage</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[11px]">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2">Owner</th>
                    <th className="py-2">Used</th>
                    <th className="py-2">Limit</th>
                    <th className="py-2">Quota</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {(data?.edit?.today || []).map((u) => (
                    <tr key={u.owner} className="border-t border-white/[0.06]">
                      <td className="py-2 font-mono text-white">+{u.owner}</td>
                      <td className="py-2">{u.count}</td>
                      <td className="py-2">{u.limit}</td>
                      <td className="w-32 py-2">
                        <Bar pct={(u.count / Math.max(1, u.limit)) * 100} tone={u.count >= u.limit ? 'amber' : 'emerald'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data?.edit?.today?.length ? <p className="py-3 text-xs text-slate-400">No AI edits today yet.</p> : null}
            </div>
          </section>

          <section className="glass-card rounded-3xl p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-bold text-white">Edit history (last 14 days)</h2>
            <div className="flex flex-col gap-2">
              {(data?.edit?.days || []).map((d) => {
                const max = Math.max(1, ...(data?.edit?.days || []).map((x) => x.count));
                return (
                  <div key={d.date} className="flex items-center gap-3 text-[11px]">
                    <span className="w-20 shrink-0 text-slate-400">{d.date.slice(5)}</span>
                    <div className="flex-1">
                      <Bar pct={(d.count / max) * 100} />
                    </div>
                    <span className="w-10 shrink-0 text-right font-bold text-white">{d.count}</span>
                  </div>
                );
              })}
              {!data?.edit?.days?.length ? <p className="text-xs text-slate-400">No history yet.</p> : null}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(data?.edit?.models || []).map((m) => (
                <div key={m.model} className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2 text-[11px]">
                  <span className="font-mono text-slate-200">{m.model.replace('@cf/', '')}</span>
                  <span className="font-bold text-emerald-300">{m.count}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-card rounded-3xl p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-bold text-white">Cloudflare AI usage (calls / neurons)</h2>
            <div className="flex flex-col gap-2">
              {(data?.ai?.days || []).map((d) => {
                const max = Math.max(1, ...(data?.ai?.days || []).map((x) => x.calls));
                return (
                  <div key={d.date} className="flex items-center gap-3 text-[11px]">
                    <span className="w-20 shrink-0 text-slate-400">{d.date.slice(5)}</span>
                    <div className="flex-1">
                      <Bar pct={(d.calls / max) * 100} tone="cyan" />
                    </div>
                    <span className="w-24 shrink-0 text-right text-slate-300">
                      <b className="text-white">{d.calls}</b> · {d.neurons} n
                    </span>
                  </div>
                );
              })}
              {!data?.ai?.days?.length ? <p className="text-xs text-slate-400">No AI calls recorded yet.</p> : null}
            </div>
          </section>
        </div>
      )}

      <p className="pb-2 text-center font-mono text-[10px] text-slate-500">
        /dexter7739 · admin only · data is aggregated from every server in server.js
      </p>
    </div>
  );
}
