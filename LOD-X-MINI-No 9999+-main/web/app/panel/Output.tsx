"use client";
import { useEffect, useRef, useState } from "react";

export default function Output({ auth }: { auth: { n: string; k: string } }) {
  const [lines, setLines] = useState<string[]>([]);
  const boxRef = useRef<HTMLPreElement | null>(null);
  const sinceRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/panel/output?since=${sinceRef.current}`, {
          headers: { Authorization: `Bearer ${auth.n}.${auth.k}` },
          cache: "no-store"
        });
        if (!r.ok) return;
        const j = await r.json();
        if (j && typeof j.at === "number") sinceRef.current = j.at;
        if (alive && Array.isArray(j?.lines) && j.lines.length) {
          setLines((prev) => [...prev, ...j.lines].slice(-500));
        }
      } catch {}
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [auth.n, auth.k]);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-5">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-300">
        Live Server Output
      </p>
      <pre
        ref={boxRef}
        className="h-72 overflow-auto rounded-2xl border border-white/[0.07] bg-black/70 p-3 font-mono text-[11px] leading-relaxed text-emerald-300 whitespace-pre-wrap"
      >
        {lines.length ? lines.join("\n") : "Waiting for output…"}
      </pre>
    </div>
  );
}
