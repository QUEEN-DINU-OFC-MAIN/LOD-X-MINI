"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  QrCode,
  KeyRound,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
  ArrowRight,
  SlidersHorizontal,
  MessageCircle,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  Server,
  ScrollText
} from "lucide-react";
import ConnectedPreview from "@/components/ConnectedPreview";
import { toast } from "@/components/hooks/use-toast";

type Mode = "pair" | "qr";
type Job = {
  status: string;
  code?: string;
  qr?: string;
  number?: string;
  error?: string;
  serverId?: string;
  serverName?: string;
};
type ServerNode = {
  id: string;
  name: string;
  online: boolean;
  connected: number;
};

const BITS = ["#10b981", "#22d3ee", "#3b82f6", "#34d399", "#fbbf24"];

const COUNTRY_PRESETS = [
  { flag: "🇱🇰", label: "Sri Lanka (+94)", code: "94" },
  { flag: "🇮🇳", label: "India (+91)", code: "91" },
  { flag: "🇵🇰", label: "Pakistan (+92)", code: "92" },
  { flag: "🇬🇧", label: "UK (+44)", code: "44" },
];

const RULES_SI = [
  "මෙය නොමිලේ සේවාවක් — බැඳෙන අංකයේ සම්පූර්ණ වගකීම ඔබටයි.",
  "Spam, bulk messages, fake news, 18+ content වැනි WhatsApp නීති උල්ලංඝනය කරන භාවිතය තහනම්.",
  "අනුමැතියකින් තොරව වෙනත් අයගේ content බෙදාහැරීම තහනම්.",
  "නීතිවිරෝධී ඕනෑම දෙයක් සඳහා භාවිතා කිරීම තහනම්.",
  "ඉහත නීති බිඳීම නිසා අංකයක් ban වුවහොත් එහි වගකීම අප භාර නොගනී.",
  "නොමිලේ සේවාව ඕනෑම වේලාවක තාවකාලිකව නවත්වන්න පුළුවන්.",
];

function normalizeInputNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("07")) {
    return "94" + digits.slice(1);
  }
  return digits;
}

export default function Connect() {
  const [mode, setMode] = useState<Mode>("pair");
  const [number, setNumber] = useState("");
  const [agreed, setAgreed] = useState(true);
  const [servers, setServers] = useState<ServerNode[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>("");
  const [token, setToken] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.servers && Array.isArray(j.servers)) {
          setServers(j.servers);
        }
      })
      .catch(() => {});
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let dead = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/link/${token}`);
        if (!r.ok) throw new Error("This attempt ended. Please start again.");
        const s: Job = await r.json();
        if (dead) return;
        setJob((prev) => {
          if (s.status === "done" && prev?.status !== "done") {
            toast.add({
              type: "success",
              description: "Your bot is live! Send .menu to yourself on WhatsApp.",
            });
          }
          if ((s.status === "failed" || s.status === "expired") && prev?.status !== s.status) {
            toast.add({
              type: "error",
              description: s.error || "This attempt ended. Please start again.",
            });
          }
          return s;
        });
        if (["done", "failed", "expired", "cancelled"].includes(s.status)) return;
      } catch (e) {
        if (!dead) setJob({ status: "failed", error: (e as Error).message });
        return;
      }
      timer.current = setTimeout(poll, 1500);
    };
    poll();
    return () => {
      dead = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [token]);

  const cleanNum = normalizeInputNumber(number);

  async function start() {
    if (!agreed) {
      setErr("කරුණාකර භාවිත නීති වලට එකඟ වන්න (Agree to the rules to continue).");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          number: cleanNum,
          serverId: selectedServer || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Something went wrong");
      setJob({ status: "starting", serverId: j.serverId, serverName: j.serverName });
      setToken(j.token);
    } catch (e) {
      setErr((e as Error).message);
      toast.add({ type: "error", description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    if (token) fetch(`/api/link/${token}`, { method: "DELETE" }).catch(() => {});
    setToken(null);
    setJob(null);
    setErr("");
  }

  const s = job?.status;
  const failed = !!s && ["failed", "expired", "cancelled"].includes(s);
  const done = s === "done";
  const step = done ? 3 : token && !failed ? 2 : 1;

  return (
    <div className="flex flex-col gap-6">
      <section className="glass-card gradient-ring rounded-3xl p-5 sm:p-6">
        <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
          Connect your WhatsApp
        </h1>
        <p className="mt-1 text-xs text-slate-400 sm:text-sm">
          Pair a number with a QR code or a phone pairing code. Everything is set up for you automatically.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {[
            { n: 1, title: "Choose a method", sub: "QR scan or pairing code" },
            { n: 2, title: "Link in WhatsApp", sub: "Linked Devices → Link a Device" },
            { n: 3, title: "You're live", sub: "Password arrives on WhatsApp" },
          ].map((item) => (
            <div
              key={item.n}
              className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                step === item.n
                  ? "border-emerald-400/50 bg-emerald-500/10"
                  : step > item.n
                    ? "border-emerald-500/25 bg-emerald-500/[0.04]"
                    : "border-white/[0.07] bg-black/30"
              }`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold ${
                  step >= item.n ? "bg-emerald-400 text-black" : "bg-white/10 text-slate-400"
                }`}
              >
                {step > item.n ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : item.n}
              </span>
              <div>
                <div className="text-xs font-bold text-white">{item.title}</div>
                <div className="text-[11px] text-slate-400">{item.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <div className="flex flex-col gap-4">
          {!token && (
            <div className="glass-card rounded-3xl p-5">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 sm:text-sm">
                <ScrollText className="h-4 w-4" />
                <span>භාවිත නීති 📜</span>
              </div>
              <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-slate-300">
                {RULES_SI.map((rule, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
              <label className="mt-3.5 flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-emerald-400/40">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="h-4 w-4 rounded accent-emerald-400"
                />
                <span>මම ඉහත නීති මාලාව කියවා තේරුම් ගෙන එයට එකඟ වෙමි.</span>
              </label>
            </div>
          )}

          <div className="glass-card gradient-ring rounded-3xl p-5 sm:p-6">
            {!token && (
              <>
                <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/[0.08] bg-black/40 p-1.5">
                  {(
                    [
                      ["pair", "Phone Number", KeyRound],
                      ["qr", "QR Code", QrCode],
                    ] as const
                  ).map(([m, label, Icon]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition-all sm:text-sm ${
                        mode === m
                          ? "bg-emerald-400 text-black shadow-md shadow-emerald-500/20"
                          : "text-slate-300 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  ))}
                </div>

                {servers.length > 1 && (
                  <div className="mt-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Bot Server Cluster
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedServer("")}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                          selectedServer === ""
                            ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
                            : "border-white/10 bg-black/30 text-slate-400 hover:text-white"
                        }`}
                      >
                        <Server className="h-3.5 w-3.5" /> Auto (Best Server)
                      </button>
                      {servers.map((srv) => (
                        <button
                          key={srv.id}
                          type="button"
                          onClick={() => setSelectedServer(srv.id)}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                            selectedServer === srv.id
                              ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
                              : "border-white/10 bg-black/30 text-slate-400 hover:text-white"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              srv.online ? "bg-emerald-400" : "bg-amber-400"
                            }`}
                          />
                          {srv.name} ({srv.connected})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {mode === "pair" ? (
                  <div className="mt-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                        WhatsApp Phone Number
                      </span>
                      {cleanNum.length >= 8 && (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                          +{cleanNum}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {COUNTRY_PRESETS.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            if (!number.startsWith(c.code)) setNumber(c.code);
                          }}
                          className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-emerald-400/40 hover:text-white"
                        >
                          {c.flag} {c.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <Smartphone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
                      <input
                        inputMode="numeric"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && cleanNum.length >= 8 && start()}
                        placeholder="94771234567 or 0771234567"
                        className="field !pl-10 font-mono text-sm font-bold tracking-wider"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Enter with country code (<code className="text-emerald-300">94771234567</code>) or local format (<code className="text-cyan-300">0771234567</code>).
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3.5 text-xs text-slate-300">
                    <p className="font-semibold text-emerald-300">Instant QR Code Linking</p>
                    <p className="mt-1 leading-relaxed text-slate-400">
                      Open <b className="text-slate-200">WhatsApp → Linked Devices → Link a Device</b> on your phone to scan the live QR code.
                    </p>
                  </div>
                )}

                {err && (
                  <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200">
                    <AlertTriangle className="h-4 w-4 flex-none text-amber-400" /> {err}
                  </div>
                )}

                <button
                  onClick={start}
                  disabled={!agreed || busy || (mode === "pair" && cleanNum.length < 8)}
                  className="btn-shine mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-extrabold text-black sm:text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}{" "}
                  {!agreed
                    ? "Agree to the rules to continue"
                    : mode === "pair"
                      ? "Start Pairing (8-Digit Code)"
                      : "Generate Live QR Code"}
                </button>

                <div className="mt-3.5 flex items-center justify-center gap-3 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Protected Connection
                  </span>
                  <span>•</span>
                  <span>FREE LOD CONNECTED &gt; lodxmini.vercel.app</span>
                </div>
              </>
            )}

            {token && !failed && !done && (
              <div className="text-center">
                {job?.serverName && (
                  <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-0.5 text-[10px] font-semibold text-slate-300">
                    <Server className="h-3 w-3 text-emerald-400" /> {job.serverName}
                  </div>
                )}

                {s === "code" && job?.code && (
                  <>
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                      <KeyRound className="h-3.5 w-3.5" /> Pairing Code Ready
                    </div>
                    <p className="mt-2.5 text-xs text-slate-300 sm:text-sm">
                      Open <b className="text-white">WhatsApp → Linked Devices → Link with phone number</b> and enter:
                    </p>

                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(job.code!.replace(/-/g, ""));
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1800);
                        toast.add({
                          type: "success",
                          description: "Pairing code copied! Paste it in WhatsApp → Linked devices.",
                        });
                      }}
                      className="group relative mx-auto mt-4 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-emerald-400/50 bg-black/60 px-5 py-4 font-mono text-2xl font-black tracking-[0.2em] text-white shadow-lg transition hover:border-cyan-300 sm:px-6 sm:text-3xl"
                      aria-label="Copy code"
                    >
                      <span className="text-shimmer">{job.code}</span>
                      <span className="ml-2 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-bold tracking-normal text-emerald-300">
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" /> Copy
                          </>
                        )}
                      </span>
                    </button>

                    <p className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-emerald-300/90">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for WhatsApp confirmation…
                    </p>
                  </>
                )}

                {s === "qr" && job?.qr && (
                  <>
                    <p className="text-xs text-slate-300 sm:text-sm">
                      Open <b className="text-white">WhatsApp → Linked Devices → Link a Device</b> and scan:
                    </p>
                    <div className="relative mx-auto mt-4 h-60 w-60 overflow-hidden rounded-3xl border-2 border-emerald-400/60 bg-white p-3 shadow-xl">
                      <img src={job.qr} alt="QR code" className="h-full w-full object-contain" />
                    </div>
                    <p className="mt-3 flex items-center justify-center gap-2 text-xs text-emerald-300">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> QR auto-refreshes · scan with your phone camera
                    </p>
                  </>
                )}

                {(s === "starting" ||
                  s === "linked" ||
                  s === "saving" ||
                  (s === "code" && !job?.code) ||
                  (s === "qr" && !job?.qr)) && (
                  <div className="py-8">
                    <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-400" />
                    <p className="mt-3 text-xs font-bold text-white sm:text-sm">
                      {s === "linked" || s === "saving"
                        ? "Connected! Setting up your personal bot…"
                        : "Preparing your pairing session…"}
                    </p>
                  </div>
                )}

                <button
                  onClick={reset}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-white/25 hover:text-white"
                >
                  <RefreshCw className="h-3 w-3" /> Cancel &amp; Start Over
                </button>
              </div>
            )}

            {done && (
              <div className="relative py-2 text-center">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-36 overflow-hidden" aria-hidden>
                  {Array.from({ length: 24 }).map((_, i) => (
                    <span
                      key={i}
                      className="confetti-bit"
                      style={{
                        left: `${(i * 37) % 100}%`,
                        background: BITS[i % BITS.length],
                        animationDelay: `${(i % 9) * 0.07}s`,
                      }}
                    />
                  ))}
                </div>
                <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-8 w-8"
                    fill="none"
                    stroke="#02130c"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path className="check-path" d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </div>
                <h2 className="mt-4 text-xl font-extrabold text-white">
                  Connected Successfully{job?.number ? ` · +${job.number}` : ""}!
                </h2>
                <p className="mx-auto mt-1.5 max-w-sm text-xs text-slate-300">
                  Your bot is starting up. Send{" "}
                  <code className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-emerald-300">.menu</code> to yourself on WhatsApp.
                </p>
                <div className="mt-4 space-y-2 text-left text-xs">
                  <div className="flex gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
                    <MessageCircle className="mt-0.5 h-4 w-4 flex-none text-emerald-300" />
                    <span className="text-slate-300">
                      Check WhatsApp: a <b className="text-white">welcome card</b> has been sent to your own chat.
                    </span>
                  </div>
                  <div className="flex gap-2.5 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.05] p-3">
                    <SlidersHorizontal className="mt-0.5 h-4 w-4 flex-none text-cyan-300" />
                    <span className="text-slate-300">
                      It includes your <b className="text-white">Settings Panel password</b>. Or send{" "}
                      <code className="rounded bg-white/10 px-1 font-mono text-cyan-300">.web</code> for a quick login link.
                    </span>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                  <Link
                    href="/panel"
                    className="btn-shine inline-flex items-center gap-1.5 rounded-2xl px-5 py-2.5 text-xs font-extrabold text-black"
                  >
                    Open My Settings <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={reset}
                    className="btn-ghost rounded-2xl px-4 py-2.5 text-xs"
                  >
                    Link Another Number
                  </button>
                </div>
              </div>
            )}

            {failed && (
              <div className="py-4 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-amber-400/30 bg-amber-400/15">
                  <AlertTriangle className="h-6 w-6 text-amber-300" />
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-200 sm:text-sm">
                  {job?.error || (s === "expired" ? "That code expired." : "Linking did not finish.")}
                </p>
                <button
                  onClick={reset}
                  className="btn-shine mt-4 rounded-2xl px-6 py-2.5 text-xs font-extrabold text-black"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-20">
          <ConnectedPreview />
        </div>
      </div>
    </div>
  );
}
