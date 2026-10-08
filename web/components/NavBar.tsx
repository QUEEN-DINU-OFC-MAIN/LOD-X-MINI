'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  MessagesSquare,
  Terminal,
  HeartPulse,
  Info,
  BookOpen,
  HelpCircle,
  Settings2,
  Menu,
  X,
  ArrowRight,
  Globe,
  Camera
} from 'lucide-react';
import { useLang, type SiteLang } from '@/lib/site-lang';

const LANG_OPTIONS: { code: SiteLang; label: string; short: string }[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'si', label: 'සිංහල', short: 'සිං' },
  { code: 'ar', label: 'العربية', short: 'ع' }
];

export default function NavBar({ brand = 'RCD X MINI' }: { brand?: string }) {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const { lang, setLang, t } = useLang();

  const navLinks = [
    { href: '/', label: t('navHome'), icon: Home },
    { href: '/connect', label: t('navConnect'), icon: MessagesSquare },
    { href: '/fulldp', label: 'Full DP', icon: Camera },
    { href: '/commands', label: t('navCommands'), icon: Terminal },
    { href: '/status', label: t('navStatus'), icon: HeartPulse },
    { href: '/about', label: t('navAbout'), icon: Info },
    { href: '/guide', label: t('navGuide'), icon: BookOpen },
    { href: '/faq', label: t('navFaq'), icon: HelpCircle }
  ];

  const mobileBottom = [
    { href: '/', label: t('navHome'), icon: Home },
    { href: '/connect', label: t('navConnect'), icon: MessagesSquare },
    { href: '/fulldp', label: 'Full DP', icon: Camera },
    { href: '/commands', label: t('navCommands'), icon: Terminal },
    { href: '/status', label: t('navStatus'), icon: HeartPulse },
    { href: '/panel', label: t('navPanel'), icon: Settings2 },
    { href: '/guide', label: t('navGuide'), icon: BookOpen }
  ];

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#05070b]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2.5 px-4 py-2.5 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label={brand}
            className="shrink-0 transition hover:opacity-90"
            onClick={() => setOpen(false)}
          >
            <span className="inline-flex items-center gap-2.5">
              <img
                src="/icon.webp"
                alt="RCD X MINI"
                width={34}
                height={34}
                className="h-[34px] w-[34px] shrink-0 rounded-xl border border-emerald-400/35 object-cover shadow-[0_0_18px_-4px_rgba(16,185,129,0.55)]"
              />
              <span className="flex flex-col leading-none">
                <span className="logo-word text-[15px] font-extrabold tracking-[0.16em] text-white">
                  RCD&nbsp;X
                </span>
                <span className="text-[9px] font-bold tracking-[0.42em] text-emerald-400/90">
                  MINI&nbsp;BOT
                </span>
              </span>
            </span>
          </Link>

          <nav
            aria-label="Main"
            className="hidden items-center gap-0.5 rounded-full border border-white/[0.06] bg-white/[0.03] p-1 lg:flex"
          >
            {navLinks.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                    active
                      ? 'bg-emerald-400 text-black font-semibold shadow-[0_2px_14px_-4px_rgba(52,211,153,0.5)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/panel"
              aria-label="Settings"
              title="Bot Settings Panel"
              className={`rounded-full p-2 transition ${
                isActive('/panel')
                  ? 'bg-emerald-400 text-black shadow-[0_2px_14px_-4px_rgba(52,211,153,0.5)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Settings2 className="h-4 w-4" />
            </Link>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div
              role="group"
              aria-label="Site language"
              className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.03] p-0.5"
            >
              <Globe className="ml-1.5 hidden h-3 w-3 text-emerald-400 sm:inline" />
              {LANG_OPTIONS.map((opt) => {
                const active = lang === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => setLang(opt.code)}
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold transition ${
                      active
                        ? 'bg-emerald-400 text-black shadow-[0_2px_10px_-3px_rgba(52,211,153,0.6)]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="hidden sm:inline">{opt.label}</span>
                    <span className="sm:hidden">{opt.short}</span>
                  </button>
                );
              })}
            </div>

            <Link
              href="/connect"
              className="btn-shine hidden sm:inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-black"
            >
              {t('navConnect')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
              className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:border-white/20 hover:text-white lg:hidden"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-white/[0.06] bg-[#070a0f]/95 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div className="mb-2.5 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                <Globe className="h-3.5 w-3.5 text-emerald-400" />
                Language
              </span>
              <div className="flex items-center gap-1">
                {LANG_OPTIONS.map((opt) => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => setLang(opt.code)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                      lang === opt.code
                        ? 'bg-emerald-400 text-black'
                        : 'text-slate-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {[...navLinks, { href: '/panel', label: t('navPanel'), icon: Settings2 }].map(
                (item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition ${
                        active
                          ? 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30'
                          : 'text-slate-300 hover:bg-white/[0.04] hover:text-white border border-transparent'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                }
              )}
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[11px] text-slate-400">
              <Link href="/privacy" onClick={() => setOpen(false)} className="hover:text-white">
                {t('footerPrivacy')}
              </Link>
              <Link href="/terms" onClick={() => setOpen(false)} className="hover:text-white">
                {t('footerTerms')}
              </Link>
            </div>
          </div>
        )}
      </header>

      <nav
        aria-label="Mobile"
        className="fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-2xl border border-white/10 bg-[#0d1013]/92 p-1.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl md:hidden"
      >
        {mobileBottom.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-medium transition ${
                active
                  ? 'bg-emerald-400/15 text-emerald-300'
                  : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate max-w-[54px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
