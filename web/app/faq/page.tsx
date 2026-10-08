import React from 'react';
import Link from 'next/link';
import { HelpCircle, BookOpen, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'FAQ',
  description: 'Frequently Asked Questions about RCD X MINI WhatsApp companion.'
};

const FAQS = [
  {
    q: 'How do I connect my WhatsApp number?',
    si: 'මගේ WhatsApp අංකය bot එකට සම්බන්ධ කරන්නේ කොහොමද?',
    a: 'Open the Connect page, agree to the fair-use rules, choose QR Code or Phone Pairing Code, and follow the 3 steps. Once linked, your bot immediately greets you on WhatsApp with your password and personal settings link.'
  },
  {
    q: 'How do I log into my Settings Panel if there are multiple bot servers?',
    si: 'Servers කිහිපයක් තියෙද්දී Settings Panel එකට log වෙන්නේ කොහොමද?',
    a: 'You log in from this single website (/panel) using your phone number and password (or by tapping the .web link sent by your bot). The website automatically finds which server hosts your bot and saves your settings directly to it.'
  },
  {
    q: 'Is my chat safe? What can the website see?',
    si: 'මගේ chats ආරක්ෂිතද? Website එකට මොනවද පේන්නේ?',
    a: 'Your personal messages remain private on WhatsApp. The website only displays aggregate bot status and your own bot preferences when you sign into the Settings Panel — never your chat conversations.'
  },
  {
    q: 'My bot went offline — what should I do?',
    si: 'මගේ bot එක offline වුණොත් මොකද කරන්නේ?',
    a: 'First check the Status page to see if all servers are operational. If a server is restarting, wait a minute for it to reconnect automatically; otherwise open Connect and link your number again.'
  },
  {
    q: 'How do I get a new Settings Panel password or link?',
    si: 'Settings Panel password එක අමතක වුණොත් මොකද කරන්නේ?',
    a: 'Send .web in your own WhatsApp chat ("Message yourself"). Your bot will reply with a fresh one-tap login link. You can also send .web new to rotate your link anytime.'
  },
  {
    q: 'How do I stop or unlink my bot?',
    si: 'Bot එක ඉවත් කරන්නේ කොහොමද?',
    a: 'Open WhatsApp on your phone → Settings → Linked Devices, tap the linked device, and select Log Out. Your bot stops immediately.'
  }
];

export default function FaqPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="glass-card gradient-ring rounded-3xl p-6 sm:p-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-300">
          <HelpCircle className="h-3.5 w-3.5" /> Help Center
        </div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Frequently asked questions
        </h1>
        <p className="mt-1.5 text-xs text-slate-400 sm:text-sm">
          Quick answers to common questions about connecting and managing your RCD X MINI bot.
        </p>

        <Link
          href="/guide"
          className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 transition hover:border-emerald-400/50 hover:bg-emerald-500/15"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400 text-black">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs font-bold text-white sm:text-sm">Full Step-by-Step User Guide</div>
              <div className="text-[11px] text-slate-300">
                Easy steps in Sinhala &amp; English — connect, login, settings, schedules &amp; auto-replies.
              </div>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-300">
            Open guide <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      </section>

      <div className="grid grid-cols-1 gap-3.5">
        {FAQS.map((item, idx) => (
          <section key={idx} className="glass-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white sm:text-base">{item.q}</h2>
            <p className="mt-0.5 text-xs font-medium text-emerald-300/90">{item.si}</p>
            <p className="mt-2.5 text-xs leading-relaxed text-slate-300 sm:text-sm">{item.a}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
