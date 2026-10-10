"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Globe2, ListTree, Radio, UserRound, Check, ShieldCheck, Zap, Sparkles } from "lucide-react";
import Logo from "@/components/Logo";

const LANGS = [
  { code: "si", name: "සිංහල", hi: "ආයුබෝවන්!", line: "ඔබේ LOD X MINI bot සූදානම්!", btn: "මෙනුව විවෘත කරන්න" },
  { code: "en", name: "English", hi: "Hello!", line: "Your LOD X MINI bot is ready!", btn: "Open Command Menu" },
  { code: "ta", name: "தமிழ்", hi: "வணக்கம்!", line: "உங்கள் bot தயார்!", btn: "மெனுவைத் திற" },
  { code: "hi", name: "हिन्दी", hi: "नमस्ते!", line: "आपका bot तैयार है!", btn: "मेनू खोलें" },
  { code: "ar", name: "العربية", hi: "مرحباً!", line: "البوت جاهز للعمل!", btn: "افتح القائمة" },
  { code: "es", name: "Español", hi: "¡Hola!", line: "¡Tu bot está listo!", btn: "Abrir menú" },
];

export default function PhoneMock({ className = "" }: { className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % LANGS.length), 2800);
    return () => clearInterval(t);
  }, []);
  const L = LANGS[i];

  return (
    <div className={`relative mx-auto w-[18rem] sm:w-[20.5rem] ${className}`}>
      <div className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-8 -top-8 -z-10 h-36 w-36 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 -z-10 h-36 w-36 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="anim-float pointer-events-none absolute -left-36 top-10 z-20 hidden items-center gap-2.5 rounded-2xl border border-emerald-400/30 bg-[#060d1b]/90 px-3.5 py-2.5 text-left shadow-xl backdrop-blur-xl lg:flex">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
          <Zap className="h-4 w-4" />
        </span>
        <div>
          <div className="text-[11px] font-extrabold text-white">Ultra-Low Latency</div>
          <div className="text-[10px] text-emerald-300">~14ms Cloud Response</div>
        </div>
      </div>

      <div className="anim-float-delayed pointer-events-none absolute -right-40 bottom-14 z-20 hidden items-center gap-2.5 rounded-2xl border border-cyan-400/30 bg-[#060d1b]/90 px-3.5 py-2.5 text-left shadow-xl backdrop-blur-xl lg:flex">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-500/15 text-cyan-300">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <div className="text-[11px] font-extrabold text-white">Anti-Delete &amp; ViewOnce</div>
          <div className="text-[10px] text-cyan-300">Auto Recovery Active</div>
        </div>
      </div>

      <div className="anim-float rounded-[2.6rem] border border-emerald-400/25 bg-gradient-to-b from-slate-700/70 via-slate-900 to-[#040812] p-2.5 shadow-[0_40px_100px_-28px_rgba(16,185,129,0.45)]">
        <div className="wa-bg overflow-hidden rounded-[2.1rem] border border-white/[0.06]">
          <div className="flex items-center justify-between bg-[#081018] px-5 pt-2 pb-1 text-[10px] font-semibold text-slate-400">
            <span>9:41</span>
            <span className="h-2.5 w-16 rounded-full bg-black/80 ring-1 ring-white/10" />
            <span className="text-emerald-400">5G ●●●</span>
          </div>

          <div className="flex items-center gap-2.5 border-b border-white/[0.06] bg-[#111b21] px-3.5 py-2.5">
            <Logo size={32} withWordmark={false} />
            <div className="min-w-0 leading-tight text-left">
              <div className="flex items-center gap-1 truncate text-[13px] font-bold text-white">
                LOD X MINI
                <Sparkles className="h-3 w-3 text-emerald-400" />
              </div>
              <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> online · cloud worker
              </div>
            </div>
            <span className="chip ml-auto !gap-1 !border-emerald-400/35 !bg-emerald-500/10 !px-2.5 !py-0.5 text-[10px] !text-emerald-200" key={L.code}>
              <Globe2 className="h-3 w-3 text-emerald-300" /> {L.name}
            </span>
          </div>

          <div className="space-y-2.5 px-3 py-3.5 text-left" style={{ minHeight: "22rem" }}>
            <div
              className="bubble ml-auto flex w-fit max-w-[70%] items-center gap-1.5 rounded-2xl rounded-tr-sm bg-[#005c4b] px-3 py-1.5 text-[12.5px] font-medium text-white shadow"
              style={{ animationDelay: ".2s" }}
            >
              .menu <Check className="h-3.5 w-3.5 text-cyan-300" />
            </div>

            <div
              className="bubble w-[92%] overflow-hidden rounded-2xl rounded-tl-sm border border-white/[0.07] bg-[#1f2c34] text-white shadow-lg"
              style={{ animationDelay: ".7s" }}
            >
              <Image src="/logos/green.jpg" alt="LOD X MINI" width={320} height={240} className="aspect-[16/10] w-full object-cover" />
              <div className="px-3 py-2.5 text-[12px] leading-snug" key={`c${L.code}`}>
                <div className="flex items-center justify-between font-extrabold text-emerald-300">
                  <span>LOD X MINI LIST MENU</span>
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-200">200+ CMDS</span>
                </div>
                <div className="tick-word mt-1 font-medium text-slate-100">
                  {L.hi} {L.line}
                </div>
                <div className="mt-1.5 font-mono text-[9.5px] text-emerald-400/90">
                  &gt; LOD X MD • FREE LOD CONNECTED &gt; https://rcdxmini.dexterid.org
                </div>
              </div>
              <div
                className="flex items-center justify-center gap-1.5 border-t border-white/10 bg-[#182229] py-2 text-center text-[11.5px] font-bold text-emerald-300"
                key={`b${L.code}`}
              >
                <ListTree className="h-3.5 w-3.5" /> {L.btn}
              </div>
            </div>

            <div className="bubble flex gap-1.5" style={{ animationDelay: "1.2s" }}>
              <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.06] bg-[#1f2c34] py-2 text-[11px] font-bold text-emerald-300">
                <Radio className="h-3.5 w-3.5" /> ALIVE
              </span>
              <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.06] bg-[#1f2c34] py-2 text-[11px] font-bold text-cyan-300">
                <UserRound className="h-3.5 w-3.5" /> OWNER
              </span>
            </div>

            <div className="flex flex-wrap justify-center gap-1 pt-1">
              {LANGS.map((item, idx) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setI(idx)}
                  className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold transition ${
                    idx === i
                      ? "bg-emerald-400 text-[#02130c]"
                      : "bg-white/[0.06] text-slate-400 hover:text-white"
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
