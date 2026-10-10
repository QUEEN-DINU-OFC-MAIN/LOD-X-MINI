"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export default function Select({ value, options, onChange, label, align = "right" }: { value: string; options: [string, string][]; onChange: (v: string) => void; label: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [hot, setHot] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const cur = options.find(([v]) => v === value);

  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);

  function key(e: React.KeyboardEvent) {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { setHot(Math.max(0, options.findIndex(([v]) => v === value))); return setOpen(true); }
      setHot((h) => (h + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    }
    if ((e.key === "Enter" || e.key === " ") && open) { e.preventDefault(); onChange(options[hot][0]); setOpen(false); }
    else if ((e.key === "Enter" || e.key === " ") && !open) { e.preventDefault(); setHot(Math.max(0, options.findIndex(([v]) => v === value))); setOpen(true); }
  }

  return (
    <div ref={root} className="relative" onKeyDown={key}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => { setHot(Math.max(0, options.findIndex(([v]) => v === value))); setOpen((o) => !o); }}
        className={`group flex min-w-[9.5rem] max-w-[13rem] items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all ${open ? "border-emerald-400/60 bg-emerald-400/10 text-white shadow-[0_0_0_4px_rgba(52,211,153,.12)]" : "border-white/10 bg-white/[0.05] text-slate-100 hover:border-white/25 hover:bg-white/[0.08]"}`}>
        <span className="truncate">{cur?.[1] ?? value}</span>
        <ChevronDown className={`h-4 w-4 flex-none text-slate-400 transition-transform duration-200 ${open ? "rotate-180 text-emerald-300" : ""}`} />
      </button>
      {open && (
        <ul role="listbox" className={`select-pop absolute z-50 mt-2 max-h-72 min-w-full overflow-auto rounded-2xl border border-white/10 bg-[#0c1117]/95 p-1.5 shadow-[0_24px_60px_-12px_rgba(0,0,0,.85)] backdrop-blur-xl ${align === "right" ? "right-0" : "left-0"}`} style={{ width: "max-content", maxWidth: "min(20rem, 80vw)" }}>
          {options.map(([v, l], i) => (
            <li key={v} role="option" aria-selected={v === value} onMouseEnter={() => setHot(i)} onClick={() => { onChange(v); setOpen(false); }}
              className={`flex cursor-pointer items-center justify-between gap-6 rounded-xl px-3 py-2 text-sm transition-colors ${i === hot ? "bg-white/[0.08] text-white" : "text-slate-300"} ${v === value ? "font-bold text-emerald-300" : ""}`}>
              <span>{l}</span>{v === value && <Check className="h-4 w-4 flex-none" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
