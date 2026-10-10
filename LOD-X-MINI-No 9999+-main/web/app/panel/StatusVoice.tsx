"use client";
import { useRef, useState } from "react";
import { Mic, Trash2, Upload, Loader2 } from "lucide-react";
import type { Api, Me } from "./types";

export default function StatusVoice({ me, api }: { me: Me; api: Api }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);

  async function pick(f?: File) {
    if (!f) return;
    setBusy(true); setPct(0);
    try {
      await api.upload("statusvoice", f, setPct);
      api.setMe(await api.call("/api/panel/me"));
      api.say(true, "Voice note saved");
    } catch (e) { api.say(false, (e as Error).message); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  async function remove() {
    try { api.setMe(await api.call("/api/panel/status-voice", { method: "DELETE" })); api.say(true, "Voice note removed"); } catch (e) { api.say(false, (e as Error).message); }
  }

  return (
    <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-emerald-400/10"><Mic className="h-5 w-5 text-emerald-300" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white">Status reply voice note</div>
          <div className="text-xs text-slate-500">{me.statusVoice ? `Saved · ${(me.statusVoice.size / 1024).toFixed(0)} KB · ${new Date(me.statusVoice.at).toLocaleDateString()}` : "No voice note yet. Upload an audio file."}</div>
        </div>
        {me.statusVoice && <button onClick={remove} aria-label="Remove voice note" className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-red-500/15 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>}
        <button disabled={busy} onClick={() => input.current?.click()} className="glass-card inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white hover:border-emerald-400/40 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-emerald-300" />} {me.statusVoice ? "Replace" : "Upload"}
        </button>
        <input ref={input} type="file" accept="audio/*,video/mp4,.ogg,.opus,.mp3,.m4a,.wav" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {busy && <div className="progress mt-3"><i style={{ width: `${pct}%` }} /></div>}
    </div>
  );
}
