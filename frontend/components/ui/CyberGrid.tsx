'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';

/**
 * CyberGrid — Particle network background effect
 * Floating particles connected by lines, reactive to cursor movement.
 * Renders BEHIND the globe (z-index: -2) as part of the star/space layer.
 * Adapts colors per theme: cosmic purple in light mode, bright violet in dark mode.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  pulse: number;
  pulseSpeed: number;
  colorIdx: number;
}

export function CyberGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const createParticles = useCallback((w: number, h: number): Particle[] => {
    const count = Math.min(Math.floor((w * h) / 25000), 55);
    return Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      size: Math.random() * 3.0 + 2.5,
      opacity: Math.random() * 0.4 + 0.5,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.015 + 0.008,
      colorIdx: Math.floor(Math.random() * 4),
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let particles = createParticles(w, h);

    const onResize = () => {
      resize();
      particles = createParticles(w, h);
    };
    window.addEventListener('resize', onResize);

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMouseMove);

    // Dark mode: warm white/gold like stars and satellites
    // Light mode: warm amber/brown for visibility
    const starColors = isDark
      ? [
          { r: 255, g: 255, b: 240 },  // warm white
          { r: 255, g: 240, b: 180 },  // soft gold
          { r: 255, g: 220, b: 130 },  // amber gold
          { r: 230, g: 230, b: 255 },  // cool blue-white (variety)
        ]
      : [
          { r: 80, g: 60, b: 20 },     // dark gold
          { r: 100, g: 70, b: 10 },    // warm brown
          { r: 60, g: 50, b: 30 },     // deep amber
          { r: 40, g: 40, b: 50 },     // dark blue-gray
        ];

    const lineColor = isDark
      ? { r: 255, g: 245, b: 210 }
      : { r: 90, g: 70, b: 30 };

    const mouseGlowColor = isDark
      ? { r: 255, g: 235, b: 170 }
      : { r: 70, g: 55, b: 20 };

    // Opacity multiplier — dark mode brighter
    const globalAlpha = isDark ? 1.0 : 0.9;

    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Update particles
      for (const p of particles) {
        // Mouse repulsion
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200 && dist > 0) {
          const force = (200 - dist) / 200 * 0.6;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        // Inter-particle separation — keep min ~50px apart
        for (const q of particles) {
          if (p === q) continue;
          const sx = p.x - q.x;
          const sy = p.y - q.y;
          const sd = Math.sqrt(sx * sx + sy * sy);
          if (sd < 50 && sd > 0) {
            const repel = (50 - sd) / 50 * 0.15;
            p.vx += (sx / sd) * repel;
            p.vy += (sy / sd) * repel;
          }
        }

        // Friction
        p.vx *= 0.97;
        p.vy *= 0.97;

        p.x += p.vx;
        p.y += p.vy;
        p.pulse += p.pulseSpeed;

        // Toroidal wrap — exit one side, appear on opposite
        if (p.x < 0) p.x += w;
        else if (p.x > w) p.x -= w;
        if (p.y < 0) p.y += h;
        else if (p.y > h) p.y -= h;

        // Draw particle dot with pulse
        const pulsedOpacity = p.opacity * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(p.pulse))) * globalAlpha;
        const pulsedSize = p.size * (0.7 + 0.3 * (0.5 + 0.5 * Math.sin(p.pulse)));

        // Use particle's assigned star color
        const c = starColors[p.colorIdx];

        // Outer glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, pulsedSize * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${pulsedOpacity * 0.15})`;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, pulsedSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${pulsedOpacity})`;
        ctx.fill();
      }

      // Connect nearby particles with lines
      const connectionDist = 320;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDist) {
            const alpha = (1 - dist / connectionDist) * 0.18 * globalAlpha;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${lineColor.r}, ${lineColor.g}, ${lineColor.b}, ${alpha})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }
      }

      // Mouse attraction lines — glow effect
      for (const p of particles) {
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 250) {
          const alpha = (1 - dist / 250) * 0.35 * globalAlpha;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mx, my);
          ctx.strokeStyle = `rgba(${mouseGlowColor.r}, ${mouseGlowColor.g}, ${mouseGlowColor.b}, ${alpha})`;
          ctx.lineWidth = 1.0;
          ctx.stroke();
        }
      }

      animRef.current = requestAnimationFrame(frame);
    };

    animRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [isDark, createParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 2 }}
      aria-hidden="true"
    />
  );
}
