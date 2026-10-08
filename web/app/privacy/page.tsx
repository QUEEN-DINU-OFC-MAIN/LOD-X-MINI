import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Lock, EyeOff, Cookie, MessageCircle } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy and Cookie Policy for RCD X MINI WhatsApp companion.'
};

const SECTIONS = [
  {
    num: '1',
    enTitle: 'Who we are',
    siTitle: 'අපි කවුද',
    en: 'RCD X MINI is an independent Sri Lankan WhatsApp mini-bot companion service. It is not affiliated with, endorsed by, or connected to WhatsApp or Meta.',
    si: 'RCD X MINI කියන්නේ ස්වාධීන developer කෙනෙක් පවත්වාගෙන යන ලාංකික WhatsApp mini-bot සේවාවක්. මෙය WhatsApp හෝ Meta සමාගමට අයත් හෝ සම්බන්ධ සේවාවක් නොවේ.'
  },
  {
    num: '2',
    enTitle: 'What information we keep',
    siTitle: 'අප තබාගන්නා දේ',
    en: 'We keep only your linked WhatsApp number, the active session required to keep your bot online, and your personal bot preferences (such as bot name, command prefix, mode, auto-replies, and scheduled statuses).',
    si: 'ඔබ link කළ WhatsApp අංකය, bot එක online තබාගැනීමට අවශ්‍ය සම්බන්ධතාවය සහ ඔබේ bot settings (නම, prefix, mode, auto features වැනි තේරීම්) පමණක් ආරක්ෂිතව තබාගනී.'
  },
  {
    num: '3',
    enTitle: 'Your chats stay private',
    siTitle: 'ඔබේ chats වල රහස්‍යභාවය',
    en: 'Your WhatsApp conversations remain private. We do not read, sell, or display your personal chats on the website. Your bot only processes the specific commands you send (such as a song request) and does not archive your chat history.',
    si: 'ඔබේ WhatsApp පණිවිඩ පෞද්ගලිකව පවතී. අපි ඔබේ chats කියවන්නේ, විකුණන්නේ හෝ website එකේ පෙන්වන්නේ නැත. Bot එක ඔබේ commands වලට පිළිතුරු දීමට අවශ්‍ය පණිවිඩ පමණක් භාවිතා කරයි.'
  },
  {
    num: '4',
    enTitle: 'How we use your settings',
    siTitle: 'අපි එය භාවිතා කරන ආකාරය',
    en: 'Your saved preferences are used solely to run your bot across our server cluster, display your personal settings panel, prevent abuse, and keep your service online. We never sell your information or use it for third-party advertising.',
    si: 'ඔබේ bot එක ක්‍රියාත්මක කිරීමට, ඔබේ settings panel එක පෙන්වීමට, අනිසි භාවිතය වැළැක්වීමට සහ සේවාව දියුණු කිරීමට පමණයි. ඔබේ තොරතුරු විකුණන්නේ හෝ දැන්වීම් සඳහා භාවිතා කරන්නේ නැත.'
  },
  {
    num: '5',
    enTitle: 'Protecting your access',
    siTitle: 'ආරක්ෂාව',
    en: 'Never share your pairing code, panel password, or personal .web settings link with anyone. Our team will never ask you for your pairing code or password.',
    si: 'ඔබේ pairing code එක, මුරපදය හෝ settings link එක කිසිවෙකුට දෙන්න එපා — අපි කිසිදා එය ඔබෙන් ඉල්ලන්නේ නැත.'
  },
  {
    num: '6',
    enTitle: 'Your choices & unlinking',
    siTitle: 'ඔබේ තේරීම් සහ ඉවත් කිරීම',
    en: 'You can unlink your bot at any time directly from WhatsApp → Linked Devices. Once unlinked, your active bot session stops immediately.',
    si: 'WhatsApp → Linked devices වෙතින් ඕනෑම වේලාවක bot එක ඉවත් කළ හැක. ඔබේ bot දත්ත මකා දැමීමට අවශ්‍ය නම් developer ට WhatsApp මඟින් දැනුම් දෙන්න.'
  }
];

export default function PrivacyPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="glass-card gradient-ring rounded-3xl p-6 sm:p-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" /> Privacy &amp; Data Protection
        </div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Privacy Policy · රහස්‍යතා ප්‍රතිපත්තිය
        </h1>
        <p className="mt-1.5 text-xs text-slate-400 sm:text-sm">
          Clear, transparent rules on how RCD X MINI protects your privacy in English and Sinhala.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-black/30 p-3.5">
            <Lock className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="text-xs font-medium text-slate-200">No chat history stored</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-black/30 p-3.5">
            <EyeOff className="h-4 w-4 shrink-0 text-cyan-400" />
            <span className="text-xs font-medium text-slate-200">Zero data selling or ads</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-black/30 p-3.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="text-xs font-medium text-slate-200">Unlink anytime in WhatsApp</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3.5">
        {SECTIONS.map((s) => (
          <section key={s.num} className="glass-card rounded-2xl p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-bold text-white sm:text-base">
                {s.num}. {s.enTitle}
              </h2>
              <span className="text-xs font-semibold text-emerald-300">{s.siTitle}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">{s.en}</p>
            <p className="mt-2 border-t border-white/[0.06] pt-2 text-xs leading-relaxed text-slate-400">
              {s.si}
            </p>
          </section>
        ))}
      </div>

      <section id="cookies" className="glass-card gradient-ring scroll-mt-24 rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Cookie className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white sm:text-base">
            7. Cookie &amp; Local Storage Policy · කුකී ප්‍රතිපත්තිය
          </h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">
          We do not use third-party tracking or advertising cookies. This website only uses essential browser storage to remember your active Settings Panel login session on your device so you do not have to re-enter your password every time.
        </p>
        <p className="mt-2 border-t border-white/[0.06] pt-2 text-xs leading-relaxed text-slate-400">
          අපි දැන්වීම් හෝ tracking cookies භාවිතා නොකරයි. ඔබේ Settings Panel login එක ඔබේ browser එකේ පමණක් මතක තබාගැනීමට අත්‍යවශ්‍ය local storage පමණක් භාවිතා වේ.
        </p>
      </section>

      <section className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-emerald-400" />
          <span>Questions about privacy? Contact us on WhatsApp:</span>
          <a
            href="https://wa.me/94789958225"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-emerald-300 hover:underline"
          >
            +94 78 995 8225
          </a>
        </div>
        <div className="flex gap-3">
          <Link href="/terms" className="text-slate-300 hover:text-white">
            Terms &amp; Conditions →
          </Link>
          <Link href="/faq" className="text-slate-300 hover:text-white">
            FAQ →
          </Link>
        </div>
      </section>
    </div>
  );
}
