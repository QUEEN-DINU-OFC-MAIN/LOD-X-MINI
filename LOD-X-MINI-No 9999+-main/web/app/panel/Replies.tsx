"use client";
import { useRef, useState } from "react";
import { Plus, Trash2, Save, MessageSquareReply, Loader2, Paperclip, X, Image as ImageIcon, Video, Mic } from "lucide-react";
import type { Api, Me } from "./types";

type MType = "image" | "video" | "voice";
type Row = { k: string; text: string; mediaKey: string | null; mediaType: MType | null };
const EMPTY: Row = { k: "", text: "", mediaKey: null, mediaType: null };

const KIND_OF: Record<MType, string> = { image: "rimage", video: "rvideo", voice: "rvoice" };
const ICON_OF: Record<MType, typeof ImageIcon> = { image: ImageIcon, video: Video, voice: Mic };
const PICK = "image/*,video/mp4,video/quicktime,video/webm,audio/*";

function typeOfMime(mime: string): MType | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "voice";
  return null;
}

export default function Replies({ me, api }: { me: Me; api: Api }) {
  const [rows, setRows] = useState<Row[]>(() => {
    const r = Object.entries(me.replies || {}).map(([k, v]) =>
      typeof v === "string"
        ? { k, text: v, mediaKey: null, mediaType: null }
        : { k, text: (v as { text?: string }).text || "", mediaKey: (v as { mediaKey?: string }).mediaKey || null, mediaType: ((v as { mediaType?: MType }).mediaType || null) as MType | null }
    );
    return r.length ? r : [{ ...EMPTY }];
  });
  const [busy, setBusy] = useState(false);
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pickFor = useRef<number>(0);
  const max = me.limits.replies;

  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  function chooseFile(i: number) {
    pickFor.current = i;
    fileRef.current?.click();
  }

  async function onFile(f?: File | null) {
    const i = pickFor.current;
    if (!f) return;
    const t = typeOfMime(f.type);
    if (!t) return api.say(false, "Use a photo, video or audio file.");
    setBusyRow(i);
    try {
      const up = await api.upload(KIND_OF[t], f, () => {});
      set(i, { mediaKey: up.mediaKey, mediaType: t });
      api.say(true, "Media attached — press Save replies");
    } catch (e) {
      api.say(false, (e as Error).message);
    } finally {
      setBusyRow(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    setBusy(true);
    const replies: Record<string, string | { text: string; mediaKey: string; mediaType: MType }> = {};
    for (const r of rows) {
      const key = r.k.trim();
      const text = r.text.trim();
      if (!key || (!text && !r.mediaKey)) continue;
      replies[key] = r.mediaKey && r.mediaType ? { text, mediaKey: r.mediaKey, mediaType: r.mediaType } : text;
    }
    try {
      const m = await api.call("/api/panel/replies", { method: "POST", body: { replies } });
      api.setMe(m);
      const r = Object.entries(m.replies || {}).map(([k, v]) =>
        typeof v === "string"
          ? { k, text: v, mediaKey: null, mediaType: null }
          : { k, text: (v as { text?: string }).text || "", mediaKey: (v as { mediaKey?: string }).mediaKey || null, mediaType: ((v as { mediaType?: MType }).mediaType || null) as MType | null }
      );
      setRows(r.length ? r : [{ ...EMPTY }]);
      api.say(true, "Auto-replies saved");
    } catch (e) {
      api.say(false, (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass-card rounded-3xl p-5 sm:p-6">
      <h2 className="flex items-center gap-2.5 font-bold text-white"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06]"><MessageSquareReply className="h-[18px] w-[18px] text-emerald-300" /></span>Keyword auto-replies</h2>
      <p className="mt-2 text-sm text-slate-400">When someone sends exactly this word or phrase, your bot answers with your text <b className="text-slate-200">and/or a photo, video or voice note</b>. Up to {max} replies.</p>
      <input ref={fileRef} type="file" accept={PICK} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

      <div className="mt-5 space-y-3">
        {rows.map((r, i) => {
          const Icon = r.mediaType ? ICON_OF[r.mediaType] : Paperclip;
          return (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
              <div className="grid items-start gap-2 sm:grid-cols-[12rem_1fr_auto]">
                <input value={r.k} maxLength={40} onChange={(e) => set(i, { k: e.target.value })} placeholder="When they say" className="field text-sm" />
                <textarea value={r.text} maxLength={500} rows={2} onChange={(e) => set(i, { text: e.target.value })} placeholder={r.mediaKey ? "Caption (optional)" : "Bot replies"} className="field resize-none text-sm" />
                <div className="flex gap-1.5">
                  <button onClick={() => chooseFile(i)} disabled={busyRow === i} aria-label="Attach media" title="Attach photo / video / voice" className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-emerald-400/40 hover:text-emerald-300 disabled:opacity-50">
                    {busyRow === i ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                  </button>
                  <button onClick={() => setRows((x) => (x.length > 1 ? x.filter((_, y) => y !== i) : [{ ...EMPTY }]))} aria-label="Remove" className="grid h-11 w-11 place-items-center rounded-xl text-slate-400 transition hover:bg-red-500/15 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              {r.mediaKey && (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.07] px-2.5 py-1.5">
                  <Icon className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="text-xs font-semibold text-emerald-200">{r.mediaType === "image" ? "Photo" : r.mediaType === "video" ? "Video" : "Voice note"} attached</span>
                  <button onClick={() => set(i, { mediaKey: null, mediaType: null })} className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-300 hover:text-white"><X className="h-3 w-3" /> Remove</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button disabled={rows.length >= max} onClick={() => setRows((r) => [...r, { ...EMPTY }])} className="glass-card inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white hover:border-emerald-400/40 disabled:opacity-50"><Plus className="h-4 w-4 text-emerald-300" /> Add reply</button>
        <button disabled={busy} onClick={save} className="btn-shine inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-black disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save replies</button>
      </div>
    </section>
  );
}
