"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Lock, Users, Sparkles, Copy, Check, X, Globe2 } from "lucide-react";
import commands from "@/lib/commands.json";
import { CATS } from "@/lib/cats";
import { toast } from "@/components/hooks/use-toast";

type Scope = "all" | "public" | "owner" | "group";

const CAT_MAP = Object.fromEntries(CATS.map((c) => [c.key, c]));

export default function CommandBrowser() {
  const sp = useSearchParams();
  const [cat, setCat] = useState(sp.get("cat") || "all");
  const [scope, setScope] = useState<Scope>("all");
  const [q, setQ] = useState("");
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const list = useMemo(
    () =>
      commands.filter((c) => {
        if (cat !== "all" && c.cat !== cat) return false;
        if (scope === "public" && c.ownerOnly) return false;
        if (scope === "owner" && !c.ownerOnly) return false;
        if (scope === "group" && !c.groupOnly) return false;
        if (!q) return true;
        return `${c.name} ${c.aliases.join(" ")} ${c.desc}`.toLowerCase().includes(q.toLowerCase());
      }),
    [cat, scope, q]
  );

  function copyCmd(name: string) {
    navigator.clipboard?.writeText(`.${name}`);
    setCopiedName(name);
    setTimeout(() => setCopiedName((cur) => (cur === name ? null : cur)), 1400);
    toast.add({ type: "success", description: `Copied .${name} to clipboard` });
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        {[{ key: "all", label: "All Categories", Icon: Sparkles }, ...CATS].map((c) => {
          const cnt = c.key === "all" ? commands.length : commands.filter((x) => x.cat === c.key).length;
          const isAct = cat === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all sm:text-sm ${
                isAct
                  ? "border-emerald-400 bg-gradient-to-r from-emerald-400 to-cyan-400 text-[#02130c] shadow-[0_4px_18px_-4px_rgba(16,185,129,0.65)]"
                  : "border-white/10 bg-[#07101f]/80 text-slate-300 hover:border-emerald-400/40 hover:text-white"
              }`}
            >
              <c.Icon className="h-3.5 w-3.5" aria-hidden />
              <span>{c.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] ${
                  isAct ? "bg-black/20 text-[#02130c]" : "bg-white/[0.06] text-slate-400"
                }`}
              >
                {cnt}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="glass-card flex flex-1 items-center gap-2.5 rounded-2xl px-4 py-3 focus-within:border-emerald-400/60">
          <Search className="h-4 w-4 text-emerald-400" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by command, alias or keyword… (Press / to focus)"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>

        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-[#060d1b]/90 p-1.5">
          {(
            [
              ["all", "All"],
              ["public", "Public"],
              ["owner", "Owner"],
              ["group", "Group"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setScope(id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                scope === id
                  ? "bg-emerald-400 text-[#02130c]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          Showing <b className="text-emerald-300">{list.length}</b> command{list.length === 1 ? "" : "s"}
        </span>
        <span className="text-[11px] text-slate-500">Tap any card to copy command</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => {
          const meta = CAT_MAP[c.cat];
          const CatIcon = meta?.Icon || Sparkles;
          const isCopied = copiedName === c.name;
          return (
            <div
              key={c.name}
              onClick={() => copyCmd(c.name)}
              className="glass-card card-lift group cursor-pointer rounded-2xl p-4 transition"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
                    <CatIcon className="h-4 w-4" aria-hidden />
                  </span>
                  <code className="font-mono text-base font-extrabold text-emerald-300 group-hover:text-cyan-300">
                    .{c.name}
                  </code>
                </div>
                <div className="flex items-center gap-1.5">
                  {c.ownerOnly ? (
                    <span
                      title="Owner only"
                      className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300"
                    >
                      <Lock className="h-3 w-3" /> Owner
                    </span>
                  ) : (
                    <span
                      title="Public"
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300"
                    >
                      <Globe2 className="h-3 w-3" /> Public
                    </span>
                  )}
                  {c.groupOnly && (
                    <span
                      title="Groups only"
                      className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300"
                    >
                      <Users className="h-3 w-3" /> Group
                    </span>
                  )}
                  <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 group-hover:border-emerald-400/40 group-hover:text-emerald-300">
                    {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                  </span>
                </div>
              </div>

              <p className="mt-2.5 text-sm leading-snug text-slate-300">{c.desc}</p>

              {c.aliases.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {c.aliases.map((a) => (
                    <span
                      key={a}
                      className="rounded-md border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[11px] text-slate-400"
                    >
                      .{a}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
