"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  LogOut,
  Lock,
  Smartphone,
  KeyRound,
  Check,
  AlertTriangle,
  Globe2,
  Wifi,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Music2,
  CalendarClock,
  MessageSquareReply,
  ShieldCheck,
  Sparkles,
  Server
} from "lucide-react";
import Logo from "@/components/Logo";
import SettingsGroups from "./Settings";
import StatusVoice from "./StatusVoice";
import Schedule from "./Schedule";
import Replies from "./Replies";
import Access from "./Access";
import type { Api, Me } from "./types";

type Auth = { n: string; k: string; srvId?: string; srvName?: string };
type ExtendedMe = Me & { serverId?: string; serverName?: string };

const TABS = [
  { id: "general", label: "General", Icon: SlidersHorizontal, groups: ["General", "Look & feel", "Presence", "Smart", "Protection"] },
  { id: "status", label: "Status", Icon: Eye, groups: ["Status"] },
  { id: "songs", label: "Channel Songs", Icon: Music2, groups: ["Channel songs"] },
  { id: "access", label: "Command Access", Icon: ShieldCheck, groups: [] },
  { id: "schedule", label: "Schedule", Icon: CalendarClock, groups: [] },
  { id: "replies", label: "Auto-Replies", Icon: MessageSquareReply, groups: [] },
];

const KEY = "rcd-panel";

function normalizeInputNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("07")) {
    return "94" + digits.slice(1);
  }
  return digits;
}

export default function Panel() {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<ExtendedMe | null>(null);
  const [number, setNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [tab, setTab] = useState("general");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((ok: boolean, msg: string) => {
    setToast({ ok, msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const signOut = useCallback((msg?: string) => {
    sessionStorage.removeItem(KEY);
    setAuth(null);
    setMe(null);
    if (msg) setErr(msg);
  }, []);

  useEffect(() => {
    const m = /n=(\d{6,16})&k=([a-f0-9]{40})/.exec(window.location.hash);
    if (m) {
      const a: Auth = { n: m[1], k: m[2] };
      sessionStorage.setItem(KEY, JSON.stringify(a));
      history.replaceState(null, "", window.location.pathname);
      setAuth(a);
    } else {
      try {
        const s = sessionStorage.getItem(KEY);
        if (s) setAuth(JSON.parse(s));
      } catch {}
    }
    setReady(true);
  }, []);

  const headers = useCallback((a: Auth) => {
    const h: Record<string, string> = {
      "content-type": "application/json",
      authorization: `Bearer ${a.n}.${a.k}`,
    };
    if (a.srvId) h["x-server-id"] = a.srvId;
    return h;
  }, []);

  useEffect(() => {
    if (!auth) return;
    let dead = false;
    (async () => {
      try {
        const r = await fetch("/api/panel/me", { headers: headers(auth) });
        const j = await r.json();
        if (dead) return;
        if (!r.ok) return signOut(j.error);
        setMe(j);
        if (j.serverId && j.serverId !== auth.srvId) {
          const updated = { ...auth, srvId: j.serverId, srvName: j.serverName };
          sessionStorage.setItem(KEY, JSON.stringify(updated));
          setAuth(updated);
        }
      } catch {
        if (!dead) signOut("Could not reach the server. Please try again.");
      }
    })();
    return () => {
      dead = true;
    };
  }, [auth, headers, signOut]);

  const cleanNum = normalizeInputNumber(number);

  async function login() {
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/panel/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ number: cleanNum, password }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not sign in");
      const a: Auth = { n: j.number, k: j.token, srvId: j.serverId, srvName: j.serverName };
      sessionStorage.setItem(KEY, JSON.stringify(a));
      setAuth(a);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const api: Api = useMemo(
    () => ({
      setMe: (m) => setMe(m as ExtendedMe),
      say,
      call: async (path, init) => {
        if (!auth) throw new Error("Please sign in again.");
        const r = await fetch(path, {
          method: init?.method || "GET",
          headers: headers(auth),
          body: init?.body ? JSON.stringify(init.body) : undefined,
        });
        const j = await r.json().catch(() => ({}));
        if (r.status === 401) {
          signOut(j.error);
          throw new Error(j.error || "Please sign in again.");
        }
        if (!r.ok) throw new Error(j.error || "Something went wrong. Please try again.");
        return j as Me;
      },
      upload: (kind, file, onProgress) =>
        new Promise((resolve, reject) => {
          if (!auth) return reject(new Error("Please sign in again."));
          const x = new XMLHttpRequest();
          x.open("POST", `/api/panel/upload?kind=${kind}`);
          x.setRequestHeader("authorization", `Bearer ${auth.n}.${auth.k}`);
          if (auth.srvId) x.setRequestHeader("x-server-id", auth.srvId);
          x.setRequestHeader("content-type", (file as File).type || "application/octet-stream");
          x.upload.onprogress = (e) =>
            e.lengthComputable && onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
          x.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
          x.onload = () => {
            let j: { error?: string; mediaKey?: string; size?: number } = {};
            try {
              j = JSON.parse(x.responseText);
            } catch {}
            if (x.status === 413) return reject(new Error("That file is too big."));
            if (x.status >= 200 && x.status < 300) {
              onProgress(100);
              resolve(j as { mediaKey: string; size: number });
            } else reject(new Error(j.error || "Could not upload that file."));
          };
          x.send(file);
        }),
    }),
    [auth, headers, say, signOut]
  );

  async function save(key: string, value: string | boolean) {
    if (!me) return;
    const before = me.values[key];
    setMe({ ...me, values: { ...me.values, [key]: value } });
    try {
      const j = await api.call("/api/panel/settings", { method: "POST", body: { settings: { [key]: value } } });
      setMe(j as ExtendedMe);
      say(true, "Saved");
    } catch (e) {
      setMe((m) => (m ? { ...m, values: { ...m.values, [key]: before } } : m));
      say(false, (e as Error).message);
    }
  }

  if (!ready) return null;

  if (!auth || !me) {
    const loading = !!auth && !me;
    return (
      <div className="mx-auto max-w-md anim-fade-up">
        <div className="text-center">
          <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-emerald-400/30 bg-emerald-500/10 shadow-[0_0_30px_-8px_rgba(16,185,129,0.45)]">
            <Logo size={38} withWordmark={false} />
            <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border border-emerald-400/40 bg-[#06080c]">
              <Lock className="h-3 w-3 text-emerald-300" />
            </span>
          </div>
          <span className="pill mt-4">
            <Sparkles className="h-3 w-3" /> Unified Multi-Server Login
          </span>
          <h1 className="mt-2.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Bot Settings Panel
          </h1>
          <p className="mt-1.5 text-xs text-slate-400 sm:text-sm">
            Sign in from any connected server to customize your bot preferences, schedules &amp; auto-replies.
          </p>
        </div>

        <div className="glass-card gradient-ring mt-6 rounded-3xl p-5 sm:p-6">
          {loading ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-emerald-300" />
              <p className="mt-3 text-xs text-slate-400">Locating your bot across servers…</p>
            </div>
          ) : (
            <>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Your WhatsApp Number
                </span>
                <div className="relative mt-1.5">
                  <Smartphone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
                  <input
                    inputMode="numeric"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="94753262213 or 0753262213"
                    className="field !pl-10 font-mono"
                  />
                </div>
              </label>

              <label className="mt-3.5 block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Panel Password
                </span>
                <div className="relative mt-1.5">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-400" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && login()}
                    placeholder="K7M2P9QX"
                    autoCapitalize="characters"
                    maxLength={12}
                    className="field !pl-10 !pr-10 font-mono tracking-[0.22em]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              {err && (
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-400" /> {err}
                </p>
              )}

              <button
                onClick={login}
                disabled={busy || cleanNum.length < 8 || password.length < 6}
                className="btn-shine mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-extrabold text-[#02130c] sm:text-sm disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Log in to Settings
              </button>

              <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 text-center text-[11px] leading-relaxed text-slate-400">
                Don&apos;t have your password? Send{" "}
                <code className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono font-bold text-emerald-300">
                  .web
                </code>{" "}
                in your WhatsApp self-chat for an instant 1-tap login link.
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const online = me.state === "open";
  const langLabel =
    me.schema.find((f) => f.key === "lang")?.options?.find(([v]) => v === me.language)?.[1] || me.language;
  const cur = TABS.find((t) => t.id === tab) || TABS[0];
  const srvBadge = me.serverName || auth.srvName || "Server 01 · Primary";

  return (
    <div className="anim-fade-up">
      <div className="glass-card gradient-ring flex flex-wrap items-center gap-3.5 rounded-3xl p-4 sm:p-5">
        <Logo size={42} withWordmark={false} />
        <div className="min-w-[10rem] flex-1">
          <h1 className="truncate text-lg font-extrabold text-white sm:text-xl">
            {String(me.values.botName || "RCD X MINI")}
          </h1>
          <p className="font-mono text-xs text-emerald-300">+{me.pn || me.number}</p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-slate-200">
          <Server className="h-3 w-3 text-emerald-400" /> {srvBadge}
        </span>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${
            online
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
              : "border-amber-400/40 bg-amber-500/10 text-amber-300"
          }`}
        >
          <Wifi className="h-3 w-3" /> {online ? "Bot Online" : "Starting…"}
        </span>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-200">
          <Globe2 className="h-3 w-3" /> {langLabel}
        </span>

        <button
          onClick={() => signOut()}
          className="btn-ghost !rounded-full !px-3.5 !py-1.5 !text-xs"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign Out
        </button>
      </div>

      <div className="no-scrollbar -mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" className="glass-card inline-flex gap-1 rounded-2xl p-1.5">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              data-active={tab === id}
              onClick={() => setTab(id)}
              className="tab-btn"
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4" key={tab}>
        <div className="anim-fade-up">
          {tab === "schedule" ? (
            <Schedule me={me} api={api} />
          ) : tab === "replies" ? (
            <Replies me={me} api={api} />
          ) : tab === "access" ? (
            <Access me={me} api={api} />
          ) : (
            <SettingsGroups me={me} groups={cur.groups} save={save}>
              {tab === "status" ? <StatusVoice me={me} api={api} /> : null}
            </SettingsGroups>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-slate-500">
        Changes apply immediately in real time. Need to rotate your password? Send{" "}
        <code className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-emerald-300">.web new</code> to your bot.
      </p>

      <div
        aria-live="polite"
        className={`fixed inset-x-0 bottom-20 md:bottom-6 z-50 flex justify-center transition-all duration-300 ${
          toast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        {toast && (
          <div
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold backdrop-blur-xl ${
              toast.ok
                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                : "border-amber-400/40 bg-amber-500/15 text-amber-200"
            }`}
          >
            {toast.ok ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />} {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}
