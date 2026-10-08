'use client';

import React from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/site-lang';

export default function Footer() {
  const { t } = useLang();

  return (
    <footer className="relative z-10 mt-12 border-t border-white/[0.07] bg-[#06080d]/92 backdrop-blur-xl pb-24 md:pb-10">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="footer sm:footer-horizontal grid grid-cols-1 gap-8 text-slate-300 sm:grid-cols-2 lg:grid-cols-5">
          <aside className="flex flex-col gap-3 lg:col-span-2">
            <div className="flex items-center gap-3">
              <img
                src="/icon.webp"
                alt="RCD X MINI"
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded-2xl border border-emerald-400/35 object-cover shadow-[0_0_24px_-4px_rgba(16,185,129,0.5)]"
              />
              <div>
                <span className="logo-word text-base font-extrabold tracking-[0.14em] text-white">
                  RCD X MINI
                </span>
                <p className="text-[10px] font-bold tracking-[0.28em] text-emerald-400/90">
                  DEXTER MODZ PLATFORM
                </p>
              </div>
            </div>
            <p className="max-w-xs text-xs leading-relaxed text-slate-400">
              {t('footerDesc')}
            </p>
            <a
              href="https://rcdxmini.dexterid.org"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 font-mono text-[11px] text-emerald-300 transition hover:border-emerald-400/50 hover:bg-emerald-500/15"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {t('footerPoweredBy')} &gt; rcdxmini.dexterid.org
            </a>
          </aside>

          <nav className="flex flex-col gap-2 text-xs">
            <h6 className="footer-title mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              {t('footerPlatform')}
            </h6>
            <Link href="/connect" className="link link-hover text-slate-400 transition hover:text-emerald-300">
              {t('navConnect')}
            </Link>
            <Link href="/panel" className="link link-hover text-slate-400 transition hover:text-emerald-300">
              {t('navPanel')}
            </Link>
            <Link href="/commands" className="link link-hover text-slate-400 transition hover:text-emerald-300">
              {t('navCommands')}
            </Link>
            <Link href="/status" className="link link-hover text-slate-400 transition hover:text-emerald-300">
              {t('navStatus')}
            </Link>
          </nav>

          <nav className="flex flex-col gap-2 text-xs">
            <h6 className="footer-title mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              {t('footerResources')}
            </h6>
            <Link href="/about" className="link link-hover text-slate-400 transition hover:text-emerald-300">
              {t('navAbout')}
            </Link>
            <Link href="/guide" className="link link-hover text-slate-400 transition hover:text-emerald-300">
              {t('navGuide')}
            </Link>
            <Link href="/faq" className="link link-hover text-slate-400 transition hover:text-emerald-300">
              {t('navFaq')}
            </Link>
            <a
              href="https://wa.me/94789958225"
              target="_blank"
              rel="noopener noreferrer"
              className="link link-hover text-slate-400 transition hover:text-emerald-300"
            >
              Contact Developer
            </a>
          </nav>

          <nav className="flex flex-col gap-2 text-xs">
            <h6 className="footer-title mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              {t('footerLegal')}
            </h6>
            <Link href="/terms" className="link link-hover text-slate-400 transition hover:text-emerald-300">
              {t('footerTerms')}
            </Link>
            <Link href="/privacy" className="link link-hover text-slate-400 transition hover:text-emerald-300">
              {t('footerPrivacy')}
            </Link>
            <Link href="/privacy#cookies" className="link link-hover text-slate-400 transition hover:text-emerald-300">
              Cookie Policy
            </Link>
            <Link href="/connect" className="link link-hover text-slate-400 transition hover:text-emerald-300">
              Fair Use Rules
            </Link>
          </nav>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-[11px] text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <img
              src="/icon.webp"
              alt="RCD X MINI"
              width={20}
              height={20}
              className="h-5 w-5 rounded-md border border-emerald-400/30 object-cover"
            />
            <p>© {new Date().getFullYear()} RCD X MINI · Your everyday WhatsApp companion</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/about" className="hover:text-white transition">{t('navAbout')}</Link>
            <Link href="/guide" className="hover:text-white transition">{t('navGuide')}</Link>
            <Link href="/faq" className="hover:text-white transition">{t('navFaq')}</Link>
            <Link href="/privacy" className="hover:text-white transition">{t('footerPrivacy')}</Link>
            <Link href="/terms" className="hover:text-white transition">{t('footerTerms')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
