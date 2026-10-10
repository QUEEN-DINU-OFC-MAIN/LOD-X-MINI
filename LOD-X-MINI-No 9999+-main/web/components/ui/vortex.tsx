'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface VortexProps {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  particleCount?: number;
  rangeY?: number;
  baseHue?: number;
  rangeHue?: number;
  baseSpeed?: number;
  rangeSpeed?: number;
  baseRadius?: number;
  rangeRadius?: number;
  backgroundColor?: string;
}

function fastNoise3D(x: number, y: number, z: number): number {
  const a = Math.sin(x * 1.7 + z * 1.3) + Math.cos(y * 1.9 - z * 1.1);
  const b = Math.sin(y * 2.3 + x * 1.1 + z * 0.7) + Math.cos(z * 1.7 - x * 2.1);
  return (a + b) * 0.25;
}

export const Vortex: React.FC<VortexProps> = (props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const particlePropCount = 9;
  const baseTTL = 60;
  const rangeTTL = 160;
  const baseSpeed = props.baseSpeed ?? 0.12;
  const rangeSpeed = props.rangeSpeed ?? 1.5;
  const baseRadius = props.baseRadius ?? 1.1;
  const rangeRadius = props.rangeRadius ?? 2.4;
  const baseHue = props.baseHue ?? 152;
  const rangeHue = props.rangeHue ?? 48;
  const noiseSteps = 3;
  const xOff = 0.00125;
  const yOff = 0.00125;
  const zOff = 0.0005;
  const backgroundColor = props.backgroundColor ?? 'black';

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const count = props.particleCount ?? (isMobile ? 220 : 420);
    const particlePropsLength = count * particlePropCount;
    let particleProps = new Float32Array(particlePropsLength);
    let center: [number, number] = [0, 0];
    let tick = 0;
    let animId = 0;

    const rand = (n: number) => n * Math.random();
    const randRange = (n: number) => n - rand(2 * n);
    const fadeInOut = (t: number, m: number) => {
      const hm = 0.5 * m;
      return Math.abs(((t + hm) % m) - hm) / hm;
    };
    const lerp = (n1: number, n2: number, speed: number) => (1 - speed) * n1 + speed * n2;

    const resize = () => {
      const w = window.innerWidth || container.clientWidth;
      const h = window.innerHeight || container.clientHeight;
      canvas.width = w;
      canvas.height = h;
      center[0] = 0.5 * w;
      center[1] = 0.5 * h;
    };

    const initParticle = (i: number) => {
      const spreadY = props.rangeY ?? Math.max(420, canvas.height * 0.55);
      const x = rand(canvas.width);
      const y = center[1] + randRange(spreadY);
      const vx = 0;
      const vy = 0;
      const life = 0;
      const ttl = baseTTL + rand(rangeTTL);
      const speed = baseSpeed + rand(rangeSpeed);
      const radius = baseRadius + rand(rangeRadius);
      const hue = baseHue + rand(rangeHue);
      particleProps.set([x, y, vx, vy, life, ttl, speed, radius, hue], i);
    };

    const initParticles = () => {
      tick = 0;
      particleProps = new Float32Array(particlePropsLength);
      for (let i = 0; i < particlePropsLength; i += particlePropCount) {
        initParticle(i);
      }
    };

    const checkBounds = (x: number, y: number) =>
      x > canvas.width || x < 0 || y > canvas.height || y < 0;

    const updateParticle = (i: number) => {
      const i2 = 1 + i,
        i3 = 2 + i,
        i4 = 3 + i,
        i5 = 4 + i,
        i6 = 5 + i,
        i7 = 6 + i,
        i8 = 7 + i,
        i9 = 8 + i;

      const x = particleProps[i];
      const y = particleProps[i2];
      const n = fastNoise3D(x * xOff, y * yOff, tick * zOff) * noiseSteps * Math.PI * 2;
      const vx = lerp(particleProps[i3], Math.cos(n), 0.5);
      const vy = lerp(particleProps[i4], Math.sin(n), 0.5);
      let life = particleProps[i5];
      const ttl = particleProps[i6];
      const speed = particleProps[i7];
      const x2 = x + vx * speed;
      const y2 = y + vy * speed;
      const radius = particleProps[i8];
      const hue = particleProps[i9];

      const alpha = fadeInOut(life, ttl) * 0.85;
      ctx.lineCap = 'round';
      ctx.lineWidth = radius;
      ctx.strokeStyle = `hsla(${hue},98%,62%,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      life++;
      particleProps[i] = x2;
      particleProps[i2] = y2;
      particleProps[i3] = vx;
      particleProps[i4] = vy;
      particleProps[i5] = life;

      if (checkBounds(x, y) || life > ttl) {
        initParticle(i);
      }
    };

    const draw = () => {
      animId = window.requestAnimationFrame(draw);
      if (document.hidden) return;
      tick++;
      if (backgroundColor && backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      for (let i = 0; i < particlePropsLength; i += particlePropCount) {
        updateParticle(i);
      }
    };

    resize();
    initParticles();
    draw();

    window.addEventListener('resize', resize, { passive: true });
    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(animId);
    };
  }, [
    props.particleCount,
    props.rangeY,
    baseHue,
    rangeHue,
    baseSpeed,
    rangeSpeed,
    baseRadius,
    rangeRadius,
    backgroundColor
  ]);

  return (
    <div ref={containerRef} className={cn('relative h-full w-full', props.containerClassName)}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {props.children ? (
        <div className={cn('relative z-10', props.className)}>{props.children}</div>
      ) : null}
    </div>
  );
};

export default Vortex;
