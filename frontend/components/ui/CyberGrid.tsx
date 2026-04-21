'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';

/**
 * CyberGrid — Combined Web3 background effects:
 * 1. Floating particle network with connecting lines (cursor-reactive)
 * 2. Data stream traces (hex codes flowing at edges)
 * 3. Circuit board pulse traces
 *
 * Renders on a fixed Canvas behind all content, above the Globe.
 * Auto-adapts to light/dark theme.
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
}

interface DataStream {
  x: number;
  y: number;
  speed: number;
  chars: string[];
  opacity: number;
  column: number;
}

interface CircuitTrace {
  points: { x: number; y: number }[];
  progress: number;
  speed: number;
  opacity: number;
  direction: number; // 0=horizontal, 1=vertical
}

const HEX_CHARS = '0123456789ABCDEF';
const STREAM_CHARS = '0x₿Ξ◆◇□■▪▫●○◎◉⊕⊗⊙';

function randomHex(len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += HEX_CHARS[Math.floor(Math.random() * 16)];
  return s;
}

export function CyberGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const createParticles = useCallback((w: number, h: number): Particle[] => {
    const count = Math.min(Math.floor((w * h) / 25000), 60);
    return Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.4 + 0.1,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.02 + 0.01,
    }));
  }, []);

  const createStreams = useCallback((w: number, h: number): DataStream[] => {
    const count = Math.min(Math.floor(w / 120), 12);
    return Array.from({ length: count }, (_, i) => ({
      x: (w / (count + 1)) * (i + 1) + (Math.random() - 0.5) * 40,
      y: Math.random() * h * -1,
      speed: Math.random() * 0.8 + 0.3,
      chars: Array.from({ length: Math.floor(Math.random() * 8) + 4 }, () =>
        Math.random() > 0.5 ? randomHex(2) : STREAM_CHARS[Math.floor(Math.random() * STREAM_CHARS.length)]
      ),
      opacity: Math.random() * 0.15 + 0.03,
      column: i,
    }));
  }, []);

  const createCircuits = useCallback((w: number, h: number): CircuitTrace[] => {
    const count = Math.min(Math.floor((w * h) / 80000), 8);
    return Array.from({ length: count }, () => {
      const startX = Math.random() * w;
      const startY = Math.random() * h;
      const dir = Math.random() > 0.5 ? 0 : 1;
      const segments = Math.floor(Math.random() * 4) + 3;
      const points = [{ x: startX, y: startY }];

      let cx = startX, cy = startY;
      for (let i = 0; i < segments; i++) {
        const len = Math.random() * 120 + 40;
        if (i % 2 === dir) {
          cx += (Math.random() > 0.5 ? 1 : -1) * len;
        } else {
          cy += (Math.random() > 0.5 ? 1 : -1) * len;
        }
        cx = Math.max(0, Math.min(w, cx));
        cy = Math.max(0, Math.min(h, cy));
        points.push({ x: cx, y: cy });
      }

      return {
        points,
        progress: 0,
        speed: Math.random() * 0.004 + 0.001,
        opacity: Math.random() * 0.2 + 0.05,
        direction: dir,
      };
    });
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
    let streams = createStreams(w, h);
    let circuits = createCircuits(w, h);

    const onResize = () => {
      resize();
      particles = createParticles(w, h);
      streams = createStreams(w, h);
      circuits = createCircuits(w, h);
    };
    window.addEventListener('resize', onResize);

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMouseMove);

    const accentColor = isDark
      ? { r: 167, g: 139, b: 250 } // violet-400
      : { r: 99, g: 102, b: 241 };  // indigo-500

    const streamColor = isDark
      ? { r: 34, g: 197, b: 94 }    // green-500 (matrix feel)
      : { r: 79, g: 70, b: 229 };   // indigo-600

    const circuitColor = isDark
      ? { r: 56, g: 189, b: 248 }   // sky-400
      : { r: 37, g: 99, b: 235 };   // blue-600

    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // ── 1. Particle network ─────────────────────────────
      for (const p of particles) {
        // Mouse repulsion
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          const force = (150 - dist) / 150 * 0.5;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        // Friction
        p.vx *= 0.98;
        p.vy *= 0.98;

        p.x += p.vx;
        p.y += p.vy;
        p.pulse += p.pulseSpeed;

        // Wrap edges
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        const pulsedOpacity = p.opacity * (0.6 + 0.4 * Math.sin(p.pulse));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${accentColor.r}, ${accentColor.g}, ${accentColor.b}, ${pulsedOpacity})`;
        ctx.fill();
      }

      // Connect nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            const alpha = (1 - dist / 140) * 0.12;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${accentColor.r}, ${accentColor.g}, ${accentColor.b}, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Mouse attraction lines
      for (const p of particles) {
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          const alpha = (1 - dist / 200) * 0.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mx, my);
          ctx.strokeStyle = `rgba(${accentColor.r}, ${accentColor.g}, ${accentColor.b}, ${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      // ── 2. Data streams ─────────────────────────────────
      ctx.font = '10px "JetBrains Mono", "Fira Code", monospace';
      for (const s of streams) {
        s.y += s.speed;

        for (let i = 0; i < s.chars.length; i++) {
          const charY = s.y + i * 16;
          if (charY < -20 || charY > h + 20) continue;

          const fadeIn = Math.min(1, Math.max(0, charY / 100));
          const fadeOut = Math.min(1, Math.max(0, (h - charY) / 100));
          const alpha = s.opacity * fadeIn * fadeOut * (i === 0 ? 1.5 : 1);

          ctx.fillStyle = `rgba(${streamColor.r}, ${streamColor.g}, ${streamColor.b}, ${alpha})`;
          ctx.fillText(s.chars[i], s.x, charY);
        }

        // Reset when fully scrolled past
        if (s.y - s.chars.length * 16 > h) {
          s.y = -s.chars.length * 16 - Math.random() * 300;
          s.chars = Array.from({ length: Math.floor(Math.random() * 8) + 4 }, () =>
            Math.random() > 0.5 ? randomHex(2) : STREAM_CHARS[Math.floor(Math.random() * STREAM_CHARS.length)]
          );
          s.opacity = Math.random() * 0.15 + 0.03;
        }
      }

      // ── 3. Circuit traces ───────────────────────────────
      for (const c of circuits) {
        c.progress += c.speed;
        if (c.progress > 1) c.progress = 0;

        const totalLen = c.points.reduce((sum, p, i) => {
          if (i === 0) return 0;
          const prev = c.points[i - 1];
          return sum + Math.sqrt((p.x - prev.x) ** 2 + (p.y - prev.y) ** 2);
        }, 0);

        const drawLen = totalLen * c.progress;
        let traveled = 0;

        ctx.beginPath();
        ctx.moveTo(c.points[0].x, c.points[0].y);

        for (let i = 1; i < c.points.length; i++) {
          const prev = c.points[i - 1];
          const curr = c.points[i];
          const segLen = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);

          if (traveled + segLen <= drawLen) {
            ctx.lineTo(curr.x, curr.y);
            traveled += segLen;
          } else {
            const remaining = drawLen - traveled;
            const t = remaining / segLen;
            ctx.lineTo(
              prev.x + (curr.x - prev.x) * t,
              prev.y + (curr.y - prev.y) * t
            );
            break;
          }
        }

        ctx.strokeStyle = `rgba(${circuitColor.r}, ${circuitColor.g}, ${circuitColor.b}, ${c.opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Glowing head dot
        if (c.progress > 0 && c.progress < 1) {
          const headPos = getPointAtProgress(c.points, c.progress);
          if (headPos) {
            ctx.beginPath();
            ctx.arc(headPos.x, headPos.y, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${circuitColor.r}, ${circuitColor.g}, ${circuitColor.b}, ${c.opacity * 3})`;
            ctx.fill();

            // Glow
            ctx.beginPath();
            ctx.arc(headPos.x, headPos.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${circuitColor.r}, ${circuitColor.g}, ${circuitColor.b}, ${c.opacity * 0.5})`;
            ctx.fill();
          }
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
  }, [isDark, createParticles, createStreams, createCircuits]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 1 }}
      aria-hidden="true"
    />
  );
}

function getPointAtProgress(
  points: { x: number; y: number }[],
  progress: number
): { x: number; y: number } | null {
  if (points.length < 2) return null;

  const totalLen = points.reduce((sum, p, i) => {
    if (i === 0) return 0;
    const prev = points[i - 1];
    return sum + Math.sqrt((p.x - prev.x) ** 2 + (p.y - prev.y) ** 2);
  }, 0);

  const targetLen = totalLen * progress;
  let traveled = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const segLen = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);

    if (traveled + segLen >= targetLen) {
      const t = (targetLen - traveled) / segLen;
      return {
        x: prev.x + (curr.x - prev.x) * t,
        y: prev.y + (curr.y - prev.y) * t,
      };
    }
    traveled += segLen;
  }

  return points[points.length - 1];
}
