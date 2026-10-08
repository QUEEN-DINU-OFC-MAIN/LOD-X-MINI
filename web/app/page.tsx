'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import LiveAreaChart from '@/components/LiveAreaChart';
import { useLang } from '@/lib/site-lang';
import {
  ArrowRight,
  Bot,
  Sparkles,
  ShieldCheck,
  Download,
  Search,
  Mic,
  PhoneCall,
  MessageSquareText,
  Wand2,
  Settings2,
  Play,
  ExternalLink,
  BookOpen,
  Zap,
  Lock
} from 'lucide-react';

const TEAM_ADMINS = [
  {
    name: 'REAL DEXTER DEV',
    role: 'Lead Developer',
    img: 'https://i.ibb.co/67H7L6TS/284a980f0551c1e40cf4a1a47734a17d.jpg'
  },
  {
    name: 'RAVI TEAM ADMIN',
    role: 'Core Admin',
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

const FEATURE_CATEGORIES = [
  {
    title: 'DOWNLOAD',
    icon: Download,
    cmds: ['.song', '.video', '.tiktok', '.mediafire', '.gdrive']
  },
  {
    title: 'SEARCH',
    icon: Search,
    cmds: ['.yts', '.lyrics', '.wiki', '.search']
  },
  {
    title: 'MEDIA',
    icon: Mic,
    cmds: ['.vv', '.ptt', '.status', '.image']
  },
  {
    title: 'CALL',
    icon: PhoneCall,
    cmds: ['.callme', '.callprank', '.setbusyaudio']
  },
  {
    title: 'STATUS',
    icon: Sparkles,
    cmds: ['.statusviews', '.autoreadstatus', '.statusschedule']
  },
  {
    title: 'AUTO-REPLY',
    icon: MessageSquareText,
    cmds: ['.addreply', '.listreply']
  },
  {
    title: 'AI',
    icon: Wand2,
    cmds: ['.aireply', '.setprompt', '.gpt']
  },
  {
    title: 'SETTINGS',
    icon: Settings2,
    cmds: ['.settings', '.menu', '.search']
  }
];

export default function HomePage() {
  const [heroArt, setHeroArt] = useState<'md' | '3d'>('md');
  const { t, lang } = useLang();

  return (
    <div className="flex flex-col gap-7">
      <section className="relative flex flex-col items-center justify-center pb-6 pt-4 text-center sm:pt-8">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible">
          {[210, 280, 350, 420, 490].map((size, i) => (
            <div
              key={size}
              className="absolute animate-ripple rounded-full border border-emerald-400/20 bg-emerald-400/[0.02]"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                opacity: Math.max(0.03, 0.13 - i * 0.025),
                animationDelay: `${i * 0.08}s`
              }}
            />
          ))}
        </div>

        <div className="relative z-10 mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-1 text-[11px] font-semibold text-emerald-300 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          {t('heroBadge')}
        </div>

        <div className="relative z-10 mx-auto flex max-w-md flex-col items-center">
          <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-black/50 shadow-2xl shadow-emerald-950/60">
            <img
              src={heroArt === 'md' ? '/rcd-md-banner.webp' : '/rcd-hero-3d.webp'}
              alt="RCD X MINI Bot"
              width={720}
              height={540}
              fetchPriority="high"
              className="mx-auto max-h-[300px] w-full object-cover transition-all duration-500 sm:max-h-[340px]"
            />
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full border border-white/15 bg-black/75 p-1 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setHeroArt('md')}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition ${
                  heroArt === 'md' ? 'bg-emerald-400 text-black' : 'text-slate-300 hover:text-white'
                }`}
              >
                RCD MD
              </button>
              <button
                type="button"
                onClick={() => setHeroArt('3d')}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition ${
                  heroArt === '3d' ? 'bg-emerald-400 text-black' : 'text-slate-300 hover:text-white'
                }`}
              >
                3D Bot
              </button>
            </div>
          </div>
        </div>

        <h1 className="relative z-10 mt-5 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          <span className="logo-word">RCD X MINI BOT</span>
        </h1>
        <p className="relative z-10 mx-auto mt-2 max-w-xl text-xs leading-relaxed text-slate-300 sm:text-sm">
          {t('heroSub')}
        </p>

        <div className="relative z-10 mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <Link
            href="/connect"
            className="btn-shine inline-flex items-center gap-2 rounded-2xl px-6 py-2.5 text-xs font-bold text-black sm:text-sm"
          >
            {t('heroBtnConnect')} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/panel"
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-xs font-bold text-emerald-300 backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-emerald-500/20 sm:text-sm"
          >
            <Settings2 className="h-4 w-4" /> {t('heroBtnPanel')}
          </Link>
          <Link
            href="/guide"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-2.5 text-xs font-semibold text-slate-200 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/20 sm:text-sm"
          >
            <BookOpen className="h-4 w-4 text-cyan-300" /> {t('heroBtnGuide')}
          </Link>
        </div>

        <div className="relative z-10 mt-4 flex justify-center">
          <a
            href="https://rcdxmini.dexterid.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1 font-mono text-[11px] text-emerald-300/90 backdrop-blur-md transition hover:border-emerald-400/50 hover:text-white"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            FREE RCD CONNECTED &gt; https://rcdxmini.dexterid.org
            <ExternalLink className="h-3 w-3 opacity-75" />
          </a>
        </div>
      </section>

      <LiveAreaChart />

      <section className="reveal-on-scroll grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <div className="glass-card card-lift rounded-2xl p-4 sm:p-5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
            <Bot className="h-5 w-5 text-emerald-300" />
          </span>
          <h3 className="mt-3 text-sm font-bold text-white">{t('step1Title')}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">{t('step1Desc')}</p>
        </div>

        <div className="glass-card card-lift rounded-2xl p-4 sm:p-5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
            <Sparkles className="h-5 w-5 text-emerald-300" />
          </span>
          <h3 className="mt-3 text-sm font-bold text-white">{t('step2Title')}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">{t('step2Desc')}</p>
        </div>

        <div className="glass-card card-lift rounded-2xl p-4 sm:p-5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
            <ShieldCheck className="h-5 w-5 text-emerald-300" />
          </span>
          <h3 className="mt-3 text-sm font-bold text-white">{t('step3Title')}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">{t('step3Desc')}</p>
        </div>
      </section>

      <section className="glass-card gradient-ring reveal-on-scroll overflow-hidden rounded-3xl p-5 sm:p-6">
        <div className="grid items-center gap-6 md:grid-cols-[260px_1fr]">
          <div className="mx-auto w-full max-w-[250px] overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-xl">
            <img
              src="/rcd-md-banner.webp"
              alt="RCD MD MINI BOT Emblem"
              width={500}
              height={500}
              loading="lazy"
              className="aspect-square w-full object-cover"
            />
          </div>
          <div className="flex flex-col gap-3 text-left">
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
              <Zap className="h-3 w-3" /> {t('heroBadge')}
            </div>
            <h2 className="text-lg font-extrabold tracking-tight text-white sm:text-xl">
              {t('featuresTitle')}
            </h2>
            <p className="text-xs leading-relaxed text-slate-400 sm:text-sm">
              {t('featuresSub')}
            </p>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                { label: lang === 'si' ? 'ඉහළ ආරක්ෂාව' : lang === 'ar' ? 'حماية متقدمة' : 'Advanced Security', icon: Lock },
                { label: lang === 'si' ? 'අධිවේගී ක්‍රියාකාරීත්වය' : lang === 'ar' ? 'استجابة فائقة' : 'Ultra Fast Response', icon: Zap },
                { label: lang === 'si' ? 'ස්වයංක්‍රීය පද්ධතිය' : lang === 'ar' ? 'أتمتة ذكية' : 'Smart Automation', icon: Sparkles }
              ].map((b) => {
                const Icon = b.icon;
                return (
                  <div
                    key={b.label}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2 text-[11px] font-semibold text-slate-200"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <span>{b.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card gradient-ring reveal-on-scroll relative overflow-hidden rounded-3xl p-5 sm:p-6">
        <h2 className="mb-4 text-center text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
          Team admins
        </h2>
        <div className="mx-auto max-w-xs">
          <div
            className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]"
            style={{ height: '320px' }}
          >
            <style>{`@keyframes teamMarquee{from{transform:translateY(0)}to{transform:translateY(-50%)}}`}</style>
            <div
              className="will-change-transform group-hover:[animation-play-state:paused]"
              style={{ animation: 'teamMarquee 14s linear infinite' }}
            >
              {[0, 1].map((dup) => (
                <div
                  key={dup}
                  className="flex flex-col items-center gap-5 py-3"
                  aria-hidden={dup === 1}
                >
                  {TEAM_ADMINS.map((admin) => (
                    <div key={`${dup}-${admin.name}`} className="flex flex-col items-center gap-2">
                      <img
                        src={admin.img}
                        alt={admin.name}
                        width={96}
                        height={96}
                        loading="lazy"
                        className="aspect-square w-[96px] rounded-full border-2 border-emerald-400/40 object-cover shadow-[0_0_24px_-8px_rgba(52,211,153,0.6)]"
                      />
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-0.5 text-[10px] font-bold tracking-wider text-emerald-200">
                        {admin.name}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-[#05070b] to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#05070b] to-transparent" />
          </div>
        </div>
      </section>

      <section className="glass-card gradient-ring reveal-on-scroll overflow-hidden rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              <Play className="h-3 w-3" /> {t('guideBadge')}
            </span>
            <h2 className="mt-2 text-base font-bold text-white sm:text-lg">
              {t('guideTitle')}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {t('guideSub')}
            </p>
          </div>
          <Link
            href="/guide"
            className="btn-shine inline-flex shrink-0 items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold text-black"
          >
            {t('heroBtnGuide')} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      <section className="reveal-on-scroll">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white sm:text-lg">{t('navCommands')}</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Send <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-emerald-300">.menu</code> on WhatsApp — or reply with a number to open a category.
            </p>
          </div>
          <Link
            href="/commands"
            className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition"
          >
            View all →
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <div key={cat.title} className="glass-card card-lift rounded-2xl p-4">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/30">
                    <Icon className="h-4 w-4 text-emerald-300" />
                  </span>
                  <span className="font-mono text-[11px] font-bold tracking-widest text-white">
                    {cat.title}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {cat.cmds.map((cmd) => (
                    <span
                      key={cmd}
                      className="rounded-md border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-[11px] text-slate-300"
                    >
                      {cmd}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass-card gradient-ring reveal-on-scroll relative overflow-hidden rounded-3xl px-6 py-8 text-center">
        <h2 className="relative z-10 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
          {t('quickStartTitle')}
        </h2>
        <p className="relative z-10 mx-auto mt-1.5 max-w-md text-xs text-slate-400 sm:text-sm">
          {t('quickStartSub')}
        </p>
        <Link
          href="/connect"
          className="btn-shine relative z-10 mt-5 inline-flex items-center gap-2 rounded-2xl px-6 py-2.5 text-xs font-bold text-black sm:text-sm"
        >
          {t('heroBtnConnect')} <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
