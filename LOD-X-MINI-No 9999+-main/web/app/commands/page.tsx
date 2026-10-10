import type { Metadata } from "next";
import { Suspense } from "react";
import { Terminal } from "lucide-react";
import commands from "@/lib/commands.json";
import { CATS } from "@/lib/cats";
import CommandBrowser from "./CommandBrowser";

export const metadata: Metadata = { title: "Commands" };

export default function Page() {
  return (
    <div className="anim-fade-up">
      <div className="glass-card gradient-ring flex flex-col justify-between gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:p-6">
        <div>
          <span className="pill">
            <Terminal className="h-3 w-3" /> Command Directory
          </span>
          <h1 className="mt-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            Bot Commands Explorer
          </h1>
          <p className="mt-1 max-w-xl text-xs text-slate-400 sm:text-sm">
            Browse all <b className="text-white">{commands.length}</b> commands across{" "}
            <b className="text-emerald-300">{CATS.length}</b> categories. Default prefix is{" "}
            <code className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-emerald-300">.</code> — change it anytime with{" "}
            <code className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-cyan-300">.setprefix</code>.
          </p>
        </div>
        <div className="flex gap-2.5 text-center">
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2.5">
            <div className="text-lg font-extrabold text-emerald-300">{commands.length}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Commands</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2.5">
            <div className="text-lg font-extrabold text-cyan-300">{CATS.length}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Categories</div>
          </div>
        </div>
      </div>

      <Suspense>
        <CommandBrowser />
      </Suspense>
    </div>
  );
}
