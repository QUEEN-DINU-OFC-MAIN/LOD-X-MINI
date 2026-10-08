import React from 'react';
import Link from 'next/link';
import { MessageCircle, ArrowRight, ShieldCheck, Zap, Sparkles } from 'lucide-react';

export const metadata = {
  title: 'About',
  description: 'About RCD X MINI and the DEXTER MODZ team.'
};

const ADMINS = [
  {
    name: 'REAL DEXTER DEV',
    role: 'Founder & Lead Developer',
    img: 'https://i.ibb.co/67H7L6TS/284a980f0551c1e40cf4a1a47734a17d.jpg'
  },
  {
    name: 'RAVI TEAM ADMIN',
    role: 'Core Team Admin',
    img: 'https://i.ibb.co/LFCRtVC/IMG-20260924-WA0071.jpg'
  },
  {
    name: 'DORA ADMIN',
    role: 'Community Admin',
    img: 'https://i.ibb.co/C5t3qpdQ/IMG-20260924-WA0070.jpg'
  },
  {
    name: 'MR DANA ADMIN',
    role: 'Support Admin',
    img: 'https://i.ibb.co/r2HrZj8d/1790270212249.jpg'
  }
];

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="glass-card gradient-ring overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="grid items-center gap-6 md:grid-cols-[240px_1fr]">
          <div className="mx-auto w-full max-w-[220px] overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-xl">
            <img
              src="/rcd-md-banner.webp"
              alt="RCD X MINI Emblem"
              width={440}
              height={440}
              className="aspect-square w-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              About <span className="logo-word">RCD X MINI</span>
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">
              A proudly Sri Lankan WhatsApp multi-bot platform — pair your number in seconds, enjoy a rich command menu, and manage all your bot preferences from one place.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Developer
                </div>
                <div className="text-sm font-extrabold text-emerald-300">DEXTER</div>
              </div>
              <a
                href="https://wa.me/94789958225"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-shine inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold text-black"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp the Developer
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-4">
          <Zap className="h-5 w-5 text-emerald-400" />
          <h3 className="mt-2 text-sm font-bold text-white">Multi-Server Speed</h3>
          <p className="mt-1 text-xs text-slate-400">
            Distributed across multiple bot servers with unified live counts and instant panel login.
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <Sparkles className="h-5 w-5 text-cyan-400" />
          <h3 className="mt-2 text-sm font-bold text-white">200+ Smart Commands</h3>
          <p className="mt-1 text-xs text-slate-400">
            Song &amp; video downloads, status automation, AI assistant, voice notes, and channel tools.
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <h3 className="mt-2 text-sm font-bold text-white">Safe &amp; Private</h3>
          <p className="mt-1 text-xs text-slate-400">
            Your chats stay private. Control who can use your bot anytime from the web settings panel.
          </p>
        </div>
      </section>

      <section className="glass-card gradient-ring rounded-3xl p-6">
        <h2 className="mb-5 text-center text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
          Team admins
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {ADMINS.map((a) => (
            <div
              key={a.name}
              className="flex flex-col items-center gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center transition hover:border-emerald-400/30"
            >
              <img
                src={a.img}
                alt={a.name}
                width={96}
                height={96}
                loading="lazy"
                className="aspect-square w-20 rounded-full border-2 border-emerald-400/40 object-cover shadow-[0_0_24px_-8px_rgba(52,211,153,0.6)]"
              />
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-0.5 text-[10px] font-bold tracking-wider text-emerald-200">
                {a.name}
              </span>
              <span className="text-[11px] text-slate-400">{a.role}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5">
        <div>
          <h3 className="text-sm font-bold text-white">Ready to link your WhatsApp number?</h3>
          <p className="text-xs text-slate-400">Connect in under 60 seconds with QR or an 8-digit pairing code.</p>
        </div>
        <Link href="/connect" className="btn-shine inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold text-black">
          Connect Now <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
