"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Lock, ShieldCheck, Users, Crown, RotateCcw, Wrench } from "lucide-react";
import commands from "@/lib/commands.json";
import { CATS } from "@/lib/cats";
import type { Api, Me } from "./types";

type Mode = "owner" | "public";
type Cmd = { name: string; cat: string; desc: string; ownerOnly: boolean; devOnly: boolean; locked: boolean; groupOnly: boolean };
const LIST = (commands as Cmd[]).filter((c) => c.name);

export default function Access({ me, api }: { me: Me; api: Api }) {
  const [map, setMap] = useState<Record<string, Mode>>(me.access || {});
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  const base = (c: Cmd): Mode => (c.ownerOnly ? "owner" : "public");
  const eff = (c: Cmd): Mode => (c.locked || c.devOnly ? "owner" : map[c.name] ?? base(c));

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const diff: Record<string, Mode> = {};
      for (const c of LIST) if (!c.locked && !c.devOnly && map[c.name] && map[c.name] !== base(c)) diff[c.name] = map[c.name];
      try { api.setMe(await api.call("/api/panel/access", { method: "POST", body: { access: diff } })); api.say(true, "Command access saved"); } catch (e) { api.say(false, (e as Error).message); }
    }, 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [map]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return LIST.filter((c) => (cat === "all" || c.cat === cat) && (!t || c.name.includes(t) || c.desc.toLowerCase().includes(t)));
  }, [q, cat]);
  const editable = shown.filter((c) => !c.locked && !c.devOnly);
  const publicCount = LIST.filter((c) => eff(c) === "public").length;

  const set = (c: Cmd, m: Mode) => setMap((x) => ({ ...x, [c.name]: m }));
  const bulk = (m: Mode) => setMap((x) => { const n = { ...x }; for (const c of editable) n[c.name] = m; return n; });

  return (
    <section className="glass-card rounded-3xl p-5 sm:p-6">
      <h2 className="flex items-center gap-2.5 font-bold text-white"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06]"><ShieldCheck className="h-[18px] w-[18px] text-emerald-300" /></span>Who can use each command</h2>
      <p className="mt-2 text-xs text-slate-400"><b className="text-slate-200">Owner</b> = only you · <b className="text-slate-200">Public</b> = everyone. Settings / privacy / channel commands always stay owner-only. <b className="text-emerald-300">{publicCount}</b> of {LIST.length} public now.</p>

      <div className="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {[{ key: "all", label: "All", Icon: Users }, ...CATS].map((c) => (
          <button key={c.key} onClick={() => setCat(c.key)} className={`inline-flex flex-none items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${cat === c.key ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-200" : "border-white/10 bg-white/[0.04] text-slate-400 hover:text-white"}`}><c.Icon className="h-3.5 w-3.5" /> {c.label}</button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="glass-card flex min-w-[10rem] flex-1 items-center gap-1.5 rounded-xl px-2.5 py-1.5"><Search className="h-3.5 w-3.5 text-slate-500" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search commands…" className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-500" /></label>
        <button onClick={() => bulk("owner")} disabled={!editable.length} className="glass-card inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white hover:border-emerald-400/40 disabled:opacity-40"><Crown className="h-3.5 w-3.5 text-amber-300" /> Owner</button>
        <button onClick={() => bulk("public")} disabled={!editable.length} className="glass-card inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white hover:border-emerald-400/40 disabled:opacity-40"><Users className="h-3.5 w-3.5 text-emerald-300" /> Public</button>
        <button onClick={() => setMap({})} className="glass-card inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
      </div>

      <p className="mt-3 text-[11px] text-slate-500">{shown.length} command{shown.length === 1 ? "" : "s"}</p>
      <div className="mt-2 grid max-h-[62vh] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => {
          const m = eff(c);
          const fixed = c.locked || c.devOnly;
          return (
            <div key={c.name} title={c.desc} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5">
              <code className="truncate text-xs font-bold text-emerald-300">.{c.name}</code>
              {fixed ? (
                <span className="inline-flex flex-none items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-slate-400">{c.devOnly ? <Wrench className="h-3 w-3" /> : <Lock className="h-3 w-3" />}{c.devOnly ? "Dev" : "Owner"}</span>
              ) : (
                <div role="group" aria-label={`Access for ${c.name}`} className="flex flex-none rounded-full border border-white/10 bg-black/30 p-0.5">
                  {(["owner", "public"] as Mode[]).map((o) => (
                    <button key={o} aria-pressed={m === o} onClick={() => set(c, o)} className={`rounded-full px-2 py-0.5 text-[11px] font-bold transition ${m === o ? (o === "owner" ? "bg-amber-400/90 text-black" : "bg-emerald-400 text-black") : "text-slate-400 hover:text-white"}`}>{o === "owner" ? "Owner" : "Public"}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
