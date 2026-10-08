import React from 'react';
import Link from 'next/link';
import { FileCheck2, AlertTriangle, MessageCircle } from 'lucide-react';

export const metadata = {
  title: 'Terms & Conditions',
  description: 'Terms of Use and Fair Usage Rules for RCD X MINI WhatsApp companion.'
};

const TERMS = [
  {
    num: '1',
    enTitle: 'Accepting these terms',
    siTitle: 'කොන්දේසි පිළිගැනීම',
    en: 'By using this website or linking a WhatsApp number, you agree to these Terms & Conditions and our Privacy Policy.',
    si: 'මෙම website එක භාවිතා කිරීමෙන් හෝ bot එකක් link කිරීමෙන් ඔබ මෙම කොන්දේසි සහ අපගේ රහස්‍යතා ප්‍රතිපත්තියට එකඟ වේ.'
  },
  {
    num: '2',
    enTitle: 'Independent companion service',
    siTitle: 'නිල WhatsApp සේවාවක් නොවේ',
    en: 'RCD X MINI is an independent service and is not affiliated with WhatsApp or Meta. You must also follow WhatsApp’s own terms of service. WhatsApp may restrict or log out numbers that violate its policies, and we cannot control that.',
    si: 'RCD X MINI ස්වාධීන සේවාවකි, WhatsApp හෝ Meta සමඟ සම්බන්ධ නැත. ඔබ WhatsApp හි කොන්දේසිද පිළිපැදිය යුතුය. නීති කඩන අංක WhatsApp මඟින් සීමා කිරීම හෝ logout කිරීම සිදු විය හැකි අතර එය අපට පාලනය කළ නොහැක.'
  },
  {
    num: '3',
    enTitle: 'Your number, your responsibility',
    siTitle: 'ඔබේ අංකය, ඔබේ වගකීම',
    en: 'Only link a phone number that you own or have explicit permission to use. You are solely responsible for all messages and automated actions sent from your linked number.',
    si: 'ඔබට අයිති හෝ භාවිතයට අවසර ඇති අංකයක් පමණක් link කරන්න. ඔබේ bot එක යවන සියලු දේ සඳහා ඔබ වගකිව යුතුය.'
  },
  {
    num: '4',
    enTitle: 'Fair use & prohibited content',
    siTitle: 'සාධාරණ භාවිතය',
    en: 'Do not use the bot for spam, bulk unsolicited messaging, scams, harassment, 18+ content, illegal activities, or impersonation. Any bot or number abusing the service may be disconnected without notice.',
    si: 'Spam, වංචා, හිරිහැර, 18+ අන්තර්ගත, නීති විරෝධී ක්‍රියා හෝ වෙනත් අයෙකු ලෙස පෙනී සිටීම සඳහා bot එක භාවිතා නොකරන්න. එසේ කරන bot ගිණුම් අපට නවත්වා දැමිය හැක.'
  },
  {
    num: '5',
    enTitle: 'Downloads & media tools',
    siTitle: 'Downloads සහ අන්තර්ගත',
    en: 'Media download commands are provided for personal convenience only. Please respect creators’ copyrights; you are responsible for how you use downloaded content.',
    si: 'Download tools පුද්ගලික භාවිතය සඳහා පමණි. නිර්මාණකරුවන්ගේ අයිතීන්ට ගරු කරන්න; බාගත කළ අන්තර්ගතය භාවිතා කරන ආකාරයට ඔබ වගකිව යුතුය.'
  },
  {
    num: '6',
    enTitle: 'Service availability',
    siTitle: 'සේවාවේ ලබාගත හැකි බව',
    en: 'We work hard to keep all bot servers online 24/7, but the free service is provided "as is". Short maintenance windows may occur, and features may be updated or removed at any time.',
    si: 'Bots online තබාගැනීමට අපි උපරිම උත්සාහ කරනවා, නමුත් සේවාව "පවතින ආකාරයෙන්" ලබාදේ. යාවත්කාලීන කිරීම් සඳහා කෙටි විරාම තිබිය හැකි අතර features වෙනස් විය හැක.'
  },
  {
    num: '7',
    enTitle: 'Limitation of liability',
    siTitle: 'වගකීම් සීමාව',
    en: 'To the maximum extent permitted by law, we are not liable for missed messages, WhatsApp account restrictions, logouts, or any indirect loss resulting from using this free service.',
    si: 'නීතියෙන් ඉඩදෙන තරමට, නැතිවූ පණිවිඩ, WhatsApp තහනම් හෝ logout, හෝ සේවාව භාවිතයෙන් ඇතිවන වක්‍ර පාඩු සඳහා අපි වගකියනු නොලැබේ.'
  }
];

export default function TermsPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="glass-card gradient-ring rounded-3xl p-6 sm:p-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-300">
          <FileCheck2 className="h-3.5 w-3.5" /> Terms of Service
        </div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Terms &amp; Conditions · භාවිත කොන්දේසි
        </h1>
        <p className="mt-1.5 text-xs text-slate-400 sm:text-sm">
          Please read these fair-use terms before pairing your WhatsApp number with RCD X MINI.
        </p>

        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <span>
            This is a free community service — you are responsible for how your linked number is used. Spam or abuse is strictly prohibited.
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3.5">
        {TERMS.map((t) => (
          <section key={t.num} className="glass-card rounded-2xl p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-bold text-white sm:text-base">
                {t.num}. {t.enTitle}
              </h2>
              <span className="text-xs font-semibold text-emerald-300">{t.siTitle}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">{t.en}</p>
            <p className="mt-2 border-t border-white/[0.06] pt-2 text-xs leading-relaxed text-slate-400">
              {t.si}
            </p>
          </section>
        ))}
      </div>

      <section className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-emerald-400" />
          <span>Questions? WhatsApp:</span>
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
          <Link href="/privacy" className="text-slate-300 hover:text-white">
            Privacy Policy →
          </Link>
          <Link href="/connect" className="text-emerald-300 font-semibold hover:text-white">
            Connect Bot →
          </Link>
        </div>
      </section>
    </div>
  );
}
