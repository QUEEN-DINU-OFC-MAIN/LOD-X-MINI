import Image from "next/image";
import { CheckCircle2, KeyRound, ShieldCheck, Radio, ExternalLink } from "lucide-react";

export default function ConnectedPreview() {
  return (
    <div className="mx-auto w-full max-w-sm space-y-4">
      <div className="wa-bg rounded-3xl border border-emerald-400/25 p-3.5 shadow-[0_30px_80px_-25px_rgba(16,185,129,0.35)]">
        <div className="mb-2.5 flex items-center justify-between px-1 text-[11px] font-semibold text-slate-400">
          <span className="inline-flex items-center gap-1.5 text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            WhatsApp Instant Welcome
          </span>
          <span className="font-mono text-[10px] text-cyan-300">Self-Chat DM</span>
        </div>

        <div className="overflow-hidden rounded-2xl rounded-tl-sm border border-white/10 bg-[#1f2c34] text-white shadow-xl">
          <Image src="/logos/blue.jpg" alt="LOD X MINI Connected" width={360} height={260} className="aspect-[16/10] w-full object-cover" />
          <div className="space-y-2 px-3.5 py-3 text-[12.5px] leading-snug">
            <div className="flex items-center gap-1.5 font-extrabold text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> LOD X MINI — Connected!
            </div>
            <div className="text-slate-200">
              Your WhatsApp number is linked and your personal cloud bot is ready.
            </div>

            <div className="rounded-xl border border-emerald-400/25 bg-black/35 p-2.5 text-[11.5px]">
              <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" /> YOUR SETTINGS PANEL
              </div>
              <div className="mt-1 text-slate-300">
                🌐 <span className="text-cyan-300 underline">https://lodxmini.vercel.app/panel</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-slate-300">
                <KeyRound className="h-3.5 w-3.5 text-amber-300" /> Password:{" "}
                <b className="rounded bg-white/10 px-1.5 py-0.5 font-mono tracking-widest text-white">K7M2••••</b>
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-1.5 font-mono text-[10px] text-emerald-300">
              &gt; LOD X MD • FREE LOD CONNECTED &gt; https://lodxmini.vercel.app
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-[#090d14] p-3 text-center shadow-inner">
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan-300">
            <Radio className="h-3 w-3" /> Auto Welcome Status Post
          </div>
          <div className="mt-1.5 rounded-xl bg-black px-3 py-2.5 font-mono text-[11px] font-bold leading-relaxed text-emerald-300 ring-1 ring-emerald-500/25">
            FREE CONNECTED LOD X MINI BOT
            <br />
            <span className="text-cyan-300">FREE LOD CONNECTED &gt; https://lodxmini.vercel.app</span>
          </div>
        </div>
      </div>

      <a
        href="https://lodxmini.vercel.app"
        target="_blank"
        rel="noopener noreferrer"
        className="glass-card flex items-center justify-between rounded-2xl px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white"
      >
        <span className="font-mono text-[11px] text-emerald-300">FREE LOD CONNECTED &gt; rcdxmini.dexterid.org</span>
        <ExternalLink className="h-3.5 w-3.5 text-cyan-300" />
      </a>
    </div>
  );
}
