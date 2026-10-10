"use client";
import { useState } from "react";
import { Settings2, Palette, Radio, ShieldHalf, Sparkles, Eye, Music2, Clock } from "lucide-react";
import Select from "@/components/Select";
import type { Field, Me } from "./types";

export const GROUP_ICON: Record<string, React.ComponentType<{ className?: string }>> = { General: Settings2, "Look & feel": Palette, Presence: Radio, Smart: Sparkles, Protection: ShieldHalf, Status: Eye, "Channel songs": Music2 };

export default function SettingsGroups({ me, groups, save, children }: { me: Me; groups: string[]; save: (k: string, v: string | boolean) => void; children?: React.ReactNode }) {
  const [draft, setDraft] = useState<Record<string, string>>({});

  function commit(f: Field, cur: string) {
    const raw = draft[f.key];
    setDraft((d) => { const n = { ...d }; delete n[f.key]; return n; });
    if (raw === undefined) return;
    const t = raw.trim();
    if (t === cur) return;
    if (!t && !(f.max && f.max >= 40)) return;
    save(f.key, t);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {groups.map((g) => {
        const Icon = GROUP_ICON[g] || Settings2;
        return (
          <section key={g} className="glass-card rounded-3xl p-5 [&:has(.select-pop)]:z-20 relative">
            <h2 className="flex items-center gap-2.5 font-bold text-white"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06]"><Icon className="h-[18px] w-[18px] text-emerald-300" /></span>{g}</h2>
            <div className="mt-3 divide-y divide-white/[0.06]">
              {me.schema.filter((f) => f.group === g).map((f) => {
                const v = me.values[f.key];
                const wide = f.type === "textarea";
                return (
                  <div key={f.key} className={`py-3.5 ${wide ? "" : "flex items-center justify-between gap-4"} ${f.soon ? "opacity-70" : ""}`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-100">{f.label}{f.soon && <span className="soon-badge"><Clock className="h-3 w-3" /> Coming soon</span>}</div>
                      <div className="text-xs leading-snug text-slate-500">{f.desc}</div>
                    </div>
                    {f.type === "bool" && (
                      <button role="switch" aria-checked={v === true} data-on={String(v === true && !f.soon)} aria-label={f.label} disabled={f.soon} onClick={() => save(f.key, v !== true)} className={`switch flex-none ${f.soon ? "cursor-not-allowed" : ""}`} />
                    )}
                    {f.type === "select" && <Select label={f.label} value={String(v)} options={f.options!} onChange={(x) => save(f.key, x)} />}
                    {f.type === "text" && (
                      <input value={draft[f.key] ?? String(v ?? "")} maxLength={f.max} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} onBlur={() => commit(f, String(v ?? ""))}
                        className={`field !py-2 text-sm ${(f.max || 0) >= 40 ? "w-full max-w-[16rem]" : "w-36"}`} />
                    )}
                    {f.type === "textarea" && (
                      <div className="mt-2">
                        <textarea rows={3} value={draft[f.key] ?? String(v ?? "")} maxLength={f.max} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} onBlur={() => commit(f, String(v ?? ""))} className="field w-full resize-none text-sm" />
                        <div className="mt-1 text-right text-[11px] text-slate-500">{(draft[f.key] ?? String(v ?? "")).length}/{f.max}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {g === "Status" && children}
          </section>
        );
      })}
    </div>
  );
}
