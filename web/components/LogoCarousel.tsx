"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

const LOGOS = ["green", "blue", "yellow"] as const;

export default function LogoCarousel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % LOGOS.length), 3200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="anim-float relative mx-auto aspect-square w-full max-w-sm">
      {LOGOS.map((n, k) => (
        <Image
          key={n}
          src={`/logos/${n}.jpg`}
          alt={`RCD X MINI logo (${n})`}
          fill
          sizes="(max-width: 768px) 80vw, 384px"
          priority={k === 0}
          className={`rounded-[2rem] border border-emerald-400/25 object-cover shadow-2xl transition-opacity duration-1000 ${k === i ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      <div className="absolute -bottom-7 left-0 right-0 flex justify-center gap-2">
        {LOGOS.map((n, k) => (
          <button
            key={n}
            aria-label={`Show ${n} logo`}
            onClick={() => setI(k)}
            className={`h-2 rounded-full transition-all ${k === i ? "w-6 bg-emerald-400" : "w-2 bg-white/30"}`}
          />
        ))}
      </div>
    </div>
  );
}
