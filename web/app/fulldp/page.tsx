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
  MessageCircle,
  ShieldCheck,
  RefreshCw,
  Server,
  ScrollText,
  UploadCloud,
  Image as ImageIcon,
  Camera,
  X,
  Link2,
} from "lucide-react";
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

const BITS = ["#10b981", "#22d3ee", "#3b82f6", "#34d399", "#fbbf24"];

const COUNTRY_PRESETS = [
  { flag: "🇱🇰", label: "Sri Lanka (+94)", code: "94" },
  { flag: "🇮🇳", label: "India (+91)", code: "91" },
  { flag: "🇵🇰", label: "Pakistan (+92)", code: "92" },
  { flag: "🇬🇧", label: "UK (+44)", code: "44" },
];

const RULES_SI = [
  "මෙය නොමිලේ සේවාවක් — බැඳෙන අංකයේ සම්පූර්ණ වගකීම ඔබටයි.",
  "ඔබ upload කරන ඡායාරූපය තාවකාලිකව (ImgBB CDN) ගබඩා වී, connect වූ වහාම ඔබේ full DP ලෙස සැකසේ.",
  "Spam, bulk messages, 18+ content වැනි WhatsApp නීති උල්ලංඝනය කරන භාවිතය තහනම්.",
  "නීතිවිරෝධී ඕනෑම දෙයක් සඳහා භාවිතා කිරීම තහනම්.",
  "නීති බිඳීම නිසා අංකයක් ban වුවහොත් එහි වගකීම අප භාර නොගනී.",
];

function normalizeInputNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("07")) return "94" + digits.slice(1);
  return digits;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Could not read that file."));
    fr.readAsDataURL(file);
  });
}

export default function FullDP() {
  const [img, setImg] = useState<string | null>(null);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [drag, setDrag] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<Mode>("pair");
  const [number, setNumber] = useState("");
  const [agreed, setAgreed] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

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
            toast.add({ type: "success", description: "Connected! Your full DP is being set." });
          }
          if ((s.status === "failed" || s.status === "expired") && prev?.status !== s.status) {
            toast.add({ type: "error", description: s.error || "This attempt ended. Please start again." });
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
    return () => { dead = true; if (timer.current) clearTimeout(timer.current); };
  }, [token]);

  async function sendUpload(payload: { image: string }) {
    setUploading(true);
    setUploadErr("");
    try {
      const r = await fetch("/api/fulldp/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Upload failed.");
      setImg(j.url);
      if (!imgPreview) setImgPreview(j.display_url || j.url);
      toast.add({ type: "success", description: "Image uploaded! Now connect your number." });
    } catch (e) {
      setUploadErr((e as Error).message);
      setImg(null);
    } finally {
      setUploading(false);
    }
  }

  async function onFile(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setUploadErr("Please choose an image file (JPG / PNG).");
    if (file.size > 10 * 1024 * 1024) return setUploadErr("Image must be under 10 MB.");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImgPreview(dataUrl);
      await sendUpload({ image: dataUrl });
    } catch (e) {
      setUploadErr((e as Error).message);
    }
  }

  async function onPaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith("image/"));
    if (item) { e.preventDefault(); await onFile(item.getAsFile()); }
  }

  async function onUrl() {
    const u = urlInput.trim();
    if (!/^https?:\/\//i.test(u)) return setUploadErr("Enter a full image URL (https://…).");
    setImgPreview(u);
    await sendUpload({ image: u });
  }

  function clearImage() {
    setImg(null);
    setImgPreview(null);
    setUrlInput("");
    setUploadErr("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const cleanNum = normalizeInputNumber(number);

  async function start() {
    if (!img) { setErr("කරුණාකර මුලින් ඡායාරූපය upload කරන්න (Upload a photo first)."); return; }
    if (!agreed) { setErr("කරුණාකර භාවිත නීති වලට එකඟ වන්න (Agree to the rules to continue)."); return; }
    if (mode === "pair" && cleanNum.length < 8) { setErr("Enter your number with country code, e.g. 94753262213"); return; }
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, number: cleanNum, dpUrl: img }),
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
          Full DP · connect &amp; set your profile photo
        </h1>
        <p className="mt-1 text-xs text-slate-400 sm:text-sm">
          Upload a photo, connect your number to the <b className="text-emerald-300">LOD X MINI</b> bot, and it is
          set as your <b className="text-white">full DP</b> the moment you connect — nothing cropped.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {[
            { n: 1, title: "Upload a photo", sub: "Stored temporarily on ImgBB" },
            { n: 2, title: "Connect your number", sub: "Pairing code or QR" },
            { n: 3, title: "Full DP set", sub: "Applied on connect" },
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
            <div className="glass-card rounded-3xl p-5 sm:p-6">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 sm:text-sm">
                <Camera className="h-4 w-4" />
                <span>1 · Upload your DP photo</span>
              </div>

              {!imgPreview ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer?.files?.[0]); }}
                  onPaste={onPaste}
                  tabIndex={0}
                  onClick={() => fileRef.current?.click()}
                  className={`mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${
                    drag ? "border-emerald-400 bg-emerald-500/10" : "border-white/15 bg-black/30 hover:border-emerald-400/50"
                  }`}
                >
                  <UploadCloud className="h-8 w-8 text-emerald-300" />
                  <p className="text-xs font-semibold text-white sm:text-sm">Drag &amp; drop, paste, or click to browse</p>
                  <p className="text-[11px] text-slate-400">JPG / PNG · up to 10 MB</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onFile(e.target.files?.[0])}
                  />
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-4 rounded-2xl border border-white/10 bg-black/30 p-3">
                  <img
                    src={imgPreview}
                    alt="DP preview"
                    className="h-24 w-24 shrink-0 rounded-2xl border border-emerald-400/30 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <ImageIcon className="h-4 w-4 text-emerald-300" />
                      {img ? "Uploaded ✓" : uploading ? "Uploading…" : "Ready"}
                    </div>
                    <p className="mt-1 truncate text-[11px] text-slate-400">
                      {img ? "Temporary CDN link ready — connect your number below." : "Sending to the CDN…"}
                    </p>
                    <button
                      onClick={clearImage}
                      className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-white/25 hover:text-white"
                    >
                      <X className="h-3 w-3" /> Remove
                    </button>
                  </div>
                </div>
              )}

              {!imgPreview && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                    <Link2 className="h-3.5 w-3.5 text-slate-400" />
                    <input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="…or paste an image URL"
                      className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={onUrl}
                    disabled={uploading}
                    className="btn-ghost rounded-xl px-4 py-2 text-xs"
                  >
                    Add
                  </button>
                </div>
              )}

              {uploadErr && (
                <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5" /> {uploadErr}
                </p>
              )}
            </div>
          )}

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
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 sm:text-sm">
                  <KeyRound className="h-4 w-4" />
                  <span>2 · Connect your number</span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-2xl border border-white/[0.08] bg-black/40 p-1.5">
                  {([["pair", "Phone Number", KeyRound], ["qr", "QR Code", QrCode]] as const).map(([m, label, Icon]) => (
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

                {mode === "pair" && (
                  <div className="mt-4">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {COUNTRY_PRESETS.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => setNumber(c.code)}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-emerald-400/40 hover:text-white"
                        >
                          {c.flag} {c.code}
                        </button>
                      ))}
                    </div>
                    <input
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      inputMode="numeric"
                      placeholder="94753262213"
                      className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-lg tracking-wider text-white placeholder:text-slate-600 focus:border-emerald-400/60 focus:outline-none"
                    />
                    <p className="mt-1.5 text-[11px] text-slate-500">Country code + number, no + or spaces.</p>
                  </div>
                )}

                {err && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                    <AlertTriangle className="h-4 w-4" /> {err}
                  </p>
                )}

                <button
                  onClick={start}
                  disabled={busy || uploading || !img}
                  className="btn-shine mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold text-black disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {!img
                    ? "Upload a photo first"
                    : mode === "pair"
                      ? "Connect & Set Full DP"
                      : "Generate QR & Set Full DP"}
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
                      }}
                      className="group relative mx-auto mt-4 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-emerald-400/50 bg-black/60 px-5 py-4 font-mono text-2xl font-black tracking-[0.2em] text-white shadow-lg transition hover:border-cyan-300 sm:px-6 sm:text-3xl"
                      aria-label="Copy code"
                    >
                      <span className="text-shimmer">{job.code}</span>
                      <span className="ml-2 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-bold tracking-normal text-emerald-300">
                        {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
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

                {(s === "starting" || s === "linked" || s === "saving" || (s === "code" && !job?.code) || (s === "qr" && !job?.qr)) && (
                  <div className="py-8">
                    <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-400" />
                    <p className="mt-3 text-xs font-bold text-white sm:text-sm">
                      {s === "linked" || s === "saving"
                        ? "Connected! Setting your full DP + personal bot…"
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
                      style={{ left: `${(i * 37) % 100}%`, background: BITS[i % BITS.length], animationDelay: `${(i % 9) * 0.07}s` }}
                    />
                  ))}
                </div>
                <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="#02130c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path className="check-path" d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </div>
                <h2 className="mt-4 text-xl font-extrabold text-white">
                  Connected{job?.number ? ` · +${job.number}` : ""} — Full DP set!
                </h2>
                <p className="mx-auto mt-1.5 max-w-sm text-xs text-slate-300">
                  Your uploaded photo is now your <b className="text-white">full profile picture</b> (no crop). Your bot is
                  starting up — send{" "}
                  <code className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-emerald-300">.menu</code> to yourself.
                </p>
                {imgPreview && (
                  <img
                    src={imgPreview}
                    alt="Your new DP"
                    className="mx-auto mt-4 h-28 w-28 rounded-full border-2 border-emerald-400/50 object-cover shadow-lg"
                  />
                )}
                <div className="mt-4 flex gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3 text-left text-xs">
                  <MessageCircle className="mt-0.5 h-4 w-4 flex-none text-emerald-300" />
                  <span className="text-slate-300">
                    A <b className="text-white">welcome card</b> with your Settings Panel password was sent to your own chat.
                  </span>
                </div>
                <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                  <Link href="/panel" className="btn-shine inline-flex items-center gap-1.5 rounded-2xl px-5 py-2.5 text-xs font-extrabold text-black">
                    Open My Settings <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <button onClick={() => { reset(); clearImage(); }} className="btn-ghost rounded-2xl px-4 py-2.5 text-xs">
                    Set Another DP
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
                <button onClick={reset} className="btn-shine mt-4 rounded-2xl px-6 py-2.5 text-xs font-extrabold text-black">
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-20">
          <div className="glass-card rounded-3xl p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Camera className="h-4 w-4 text-emerald-300" /> How it works
            </div>
            <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-300">
              <li className="flex gap-2.5"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400 text-[11px] font-extrabold text-black">1</span> Upload your photo — it is stored temporarily on the ImgBB CDN.</li>
              <li className="flex gap-2.5"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400 text-[11px] font-extrabold text-black">2</span> Connect your number to the LOD X MINI bot (pairing code or QR).</li>
              <li className="flex gap-2.5"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400 text-[11px] font-extrabold text-black">3</span> The instant you connect, the bot sets it as your full DP — exactly like the <code className="rounded bg-white/10 px-1 font-mono text-emerald-300">.setpp fulldp</code> command.</li>
            </ol>
            <p className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-slate-400">
              🔒 Your photo is only fetched back from the ImgBB CDN and applied to the number you connect. The temporary
              link expires on its own.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
