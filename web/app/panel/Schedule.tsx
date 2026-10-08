"use client";
import { useRef, useState } from "react";
import { CalendarClock, Type, Image as ImageIcon, Video, Mic, Upload, X, Trash2, Loader2, Send, FileCheck2, User, Users, Clock3 } from "lucide-react";
import type { Api, Me, Sched } from "./types";

const TYPES = [
  { id: "text", label: "Text", Icon: Type, accept: "" },
  { id: "image", label: "Photo", Icon: ImageIcon, accept: "image/*" },
  { id: "video", label: "Video", Icon: Video, accept: "video/mp4,video/quicktime,video/webm" },
  { id: "voice", label: "Voice note", Icon: Mic, accept: "audio/*,video/mp4,.ogg,.opus,.mp3,.m4a,.wav" },
] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const mb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const whenText = (at: number) => new Date(at).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const toText = (to: string) => (to === "me" ? "My own chat" : to.endsWith("@g.us") ? "Group" : `+${to}`);

export default function Schedule({ me, api }: { me: Me; api: Api }) {
  const [type, setType] = useState<(typeof TYPES)[number]["id"]>("text");
  const [target, setTarget] = useState<"me" | "number" | "group">("me");
  const [num, setNum] = useState("");
  const [text, setText] = useState("");
  const [when, setWhen] = useState("");
  const [file, setFile] = useState<{ name: string; key: string; size: number } | null>(null);
  const [up, setUp] = useState<{ name: string; pct: number } | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const cur = TYPES.find((t) => t.id === type)!;
  const needFile = type !== "text";
  const full = me.schedules.length >= me.limits.schedules;

  function preset(mins: number) { setWhen(local(new Date(Date.now() + mins * 60000))); }
  function tomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); setWhen(local(d)); }

  async function pick(f?: File) {
    if (!f) return;
    if (f.size > me.limits.uploadMb * 1048576) return api.say(false, `That file is too big. The limit is ${me.limits.uploadMb} MB.`);
    setFile(null); setUp({ name: f.name, pct: 0 });
    try {
      const r = await api.upload(type, f, (pct) => setUp({ name: f.name, pct }));
      setFile({ name: f.name, key: r.mediaKey, size: r.size });
    } catch (e) { api.say(false, (e as Error).message); } finally { setUp(null); if (input.current) input.current.value = ""; }
  }

  function changeType(t: (typeof TYPES)[number]["id"]) { setType(t); setFile(null); }

  const to = target === "me" ? "me" : target === "group" ? num.trim() : num.replace(/\D/g, "");
  const ok = !!when && !!to && (target !== "number" || to.length >= 8) && (target !== "group" || /@g\.us$/.test(to)) && (needFile ? !!file : !!text.trim()) && !up && !full;

  async function submit() {
    setBusy(true);
    try {
      const m = await api.call("/api/panel/schedule", { method: "POST", body: { type, to, text, at: new Date(when).getTime(), mediaKey: file?.key } });
      api.setMe(m);
      setText(""); setFile(null); setWhen("");
      api.say(true, "Message scheduled");
    } catch (e) { api.say(false, (e as Error).message); } finally { setBusy(false); }
  }

  async function remove(s: Sched) {
    try { api.setMe(await api.call(`/api/panel/schedule/${s.id}`, { method: "DELETE" })); api.say(true, "Schedule removed"); } catch (e) { api.say(false, (e as Error).message); }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <section className="glass-card rounded-3xl p-5 sm:p-6">
        <h2 className="flex items-center gap-2.5 font-bold text-white"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06]"><CalendarClock className="h-[18px] w-[18px] text-emerald-300" /></span>New scheduled message</h2>
        <p className="mt-2 text-sm text-slate-400">Pick what to send and when. Your bot sends it at that time, then deletes the file and the schedule. Scheduled messages are never posted to your status.</p>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TYPES.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => changeType(id)} className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-semibold transition-all ${type === id ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200 shadow-[0_0_0_4px_rgba(52,211,153,.08)]" : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-white"}`}>
              <Icon className="h-5 w-5" /> {label}
            </button>
          ))}
        </div>

        {needFile && (
          <div className="mt-4">
            {file ? (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.06] p-3.5">
                <FileCheck2 className="h-6 w-6 flex-none text-emerald-300" />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-white">{file.name}</div><div className="text-xs text-slate-400">Ready · {mb(file.size)}</div></div>
                <button onClick={() => setFile(null)} aria-label="Remove file" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
            ) : up ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm text-slate-200"><Loader2 className="h-4 w-4 animate-spin text-emerald-300" /> <span className="truncate">{up.name}</span><span className="ml-auto text-xs text-slate-400">{up.pct < 100 ? `${up.pct}%` : "Processing…"}</span></div>
                <div className="progress mt-3"><i style={{ width: `${up.pct}%` }} /></div>
              </div>
            ) : (
              <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]); }}
                className={`drop flex w-full flex-col items-center gap-2 px-4 py-8 text-center ${over ? "over" : ""}`}>
                <Upload className="h-7 w-7 text-emerald-300" />
                <span className="text-sm font-semibold text-white">Choose a {cur.label.toLowerCase()} file</span>
                <span className="text-xs text-slate-500">or drop it here · up to {me.limits.uploadMb} MB</span>
              </button>
            )}
            <input ref={input} type="file" accept={cur.accept} hidden onChange={(e) => pick(e.target.files?.[0])} />
          </div>
        )}

        {type !== "voice" && (
          <label className="mt-4 block">
            <span className="text-xs font-medium text-slate-400">{needFile ? "Caption (optional)" : "Message"}</span>
            <textarea rows={needFile ? 2 : 4} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder={needFile ? "Add a caption…" : "Write your message…"} className="field mt-1.5 w-full resize-none text-sm" />
          </label>
        )}

        <div className="mt-4">
          <span className="text-xs font-medium text-slate-400">Send to</span>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {([["me", "My chat", User], ["number", "A number", Send], ["group", "A group", Users]] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => { setTarget(id); setNum(""); }} className={`flex items-center justify-center gap-2 rounded-xl border px-2 py-2.5 text-sm font-semibold transition-all ${target === id ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"}`}><Icon className="h-4 w-4" /> {label}</button>
            ))}
          </div>
          {target !== "me" && <input value={num} onChange={(e) => setNum(e.target.value)} inputMode={target === "number" ? "numeric" : "text"} placeholder={target === "number" ? "Number with country code, e.g. 94771234567" : "Group id ending with @g.us"} className="field mt-2 w-full text-sm" />}
        </div>

        <div className="mt-4">
          <span className="text-xs font-medium text-slate-400">Send at</span>
          <input type="datetime-local" value={when} min={local(new Date())} onChange={(e) => setWhen(e.target.value)} className="field mt-1.5 w-full text-sm [color-scheme:dark]" />
          <div className="mt-2 flex flex-wrap gap-2">
            {[["In 10 min", () => preset(10)], ["In 1 hour", () => preset(60)], ["Tomorrow 8:00", tomorrow]].map(([l, fn]) => (
              <button key={l as string} onClick={fn as () => void} className="chip !gap-1.5 transition hover:!border-emerald-400/40 hover:!text-white"><Clock3 className="h-3 w-3" /> {l as string}</button>
            ))}
          </div>
        </div>

        <button onClick={submit} disabled={!ok || busy} className="btn-shine mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-black disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Schedule message
        </button>
        {full && <p className="mt-2 text-center text-xs text-amber-300">You have reached the limit of {me.limits.schedules} scheduled messages.</p>}
      </section>

      <section className="glass-card rounded-3xl p-5 sm:p-6">
        <h2 className="flex items-center justify-between font-bold text-white">Waiting to be sent <span className="chip">{me.schedules.length}/{me.limits.schedules}</span></h2>
        {me.schedules.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500"><CalendarClock className="mx-auto mb-3 h-9 w-9 text-slate-600" />Nothing scheduled yet.</div>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {me.schedules.map((s) => {
              const T = TYPES.find((t) => t.id === s.type)!;
              return (
                <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-emerald-400/10"><T.Icon className="h-5 w-5 text-emerald-300" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{s.text || T.label}</div>
                    <div className="text-xs text-slate-400">{whenText(s.at)} · {toText(s.to)}{s.size ? ` · ${mb(s.size)}` : ""}</div>
                  </div>
                  <button onClick={() => remove(s)} aria-label="Delete" className="grid h-9 w-9 flex-none place-items-center rounded-xl text-slate-400 transition hover:bg-red-500/15 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
