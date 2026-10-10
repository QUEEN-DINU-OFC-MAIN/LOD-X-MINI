import React from 'react';

export default function Logo({
  size = 34,
  withWordmark = true
}: {
  size?: number;
  withWordmark?: boolean;
}) {
  const mark = (
    <img
      src="/icon.webp"
      alt="LOD X MINI"
      width={size}
      height={size}
      className="logo-mark shrink-0 rounded-xl border border-emerald-400/35 object-cover shadow-[0_0_16px_-4px_rgba(16,185,129,0.5)]"
      style={{ width: size, height: size }}
    />
  );
  if (!withWordmark) return mark;
  return (
    <span className="inline-flex items-center gap-2.5">
      {mark}
      <span className="flex flex-col leading-none">
        <span className="logo-word text-[15px] font-extrabold tracking-[0.16em] text-white">
          RCD&nbsp;X
        </span>
        <span className="text-[9px] font-bold tracking-[0.42em] text-emerald-400/90">
          MINI&nbsp;BOT
        </span>
      </span>
    </span>
  );
}
