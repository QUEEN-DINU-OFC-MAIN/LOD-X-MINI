'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Vortex } from './ui/vortex';

const Particles = dynamic(() => import('./Particles'), { ssr: false });

export default function SiteBackground() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [mountedFx, setMountedFx] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setMountedFx(true), 40);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 260);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    );

    const observeAll = () => {
      document
        .querySelectorAll('.reveal-on-scroll:not(.is-visible)')
        .forEach((el) => io.observe(el));
    };
    observeAll();
    const timer = setTimeout(observeAll, 120);
    return () => {
      clearTimeout(timer);
      io.disconnect();
    };
  }, [pathname]);

  return (
    <>
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] transition-opacity duration-200 ${
          loading ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="h-full w-full animate-[shimmer_1s_linear_infinite] bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 bg-[length:200%_100%] shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 h-screen w-screen overflow-hidden bg-black"
      >
        <div className="absolute inset-0 h-full w-full">
          <Vortex
            backgroundColor="black"
            containerClassName="w-full h-full"
            className="w-full h-full"
            particleCount={420}
            baseHue={152}
            rangeHue={48}
            baseSpeed={0.14}
            rangeSpeed={1.55}
            baseRadius={1.2}
            rangeRadius={2.5}
          />
        </div>

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60rem 32rem at 80% -5%, rgba(16,185,129,0.11), transparent 65%), radial-gradient(50rem 28rem at -5% 30%, rgba(6,182,212,0.09), transparent 60%)'
          }}
        />

        {mountedFx && (
          <div className="absolute inset-0 opacity-60">
            <Particles
              particleColors={['#ffffff', '#34d399', '#22d3ee']}
              particleCount={140}
              particleSpread={10}
              speed={0.08}
              particleBaseSize={90}
              moveParticlesOnHover={true}
              particleHoverFactor={0.6}
              alphaParticles={false}
              disableRotation={false}
              pixelRatio={1}
            />
          </div>
        )}
      </div>
    </>
  );
}
