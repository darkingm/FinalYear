'use client';

/**
 * ParticleBackground — mouse-follow blue particle effect
 * - Only visible in dark mode (reads `document.documentElement.classList.contains('dark')`)
 * - Canvas covers the entire viewport behind all content (z-index: -1)
 * - Particles spawn near cursor and drift outward with decay
 * - Pure Canvas 2D — no external libs, GPU-composited
 */

import { useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;     // 0..1
    decay: number;
    size: number;
    hue: number;      // slight hue variation around blue-purple
}

const MAX_PARTICLES = 220;
const SPAWN_PER_FRAME = 3;   // particles added per mouse-move event

export function ParticleBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const mouseRef = useRef({ x: 0, y: 0 });
    const rafRef = useRef<number>(0);
    const { resolvedTheme } = useTheme();

    const isDark = resolvedTheme === 'dark';

    const spawnParticles = useCallback((cx: number, cy: number) => {
        for (let i = 0; i < SPAWN_PER_FRAME; i++) {
            if (particlesRef.current.length >= MAX_PARTICLES) {
                // Remove oldest
                particlesRef.current.shift();
            }
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.4 + Math.random() * 1.6;
            particlesRef.current.push({
                x: cx + (Math.random() - 0.5) * 24,
                y: cy + (Math.random() - 0.5) * 24,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 0.5, // slight upward drift
                life: 1,
                decay: 0.008 + Math.random() * 0.018,
                size: 1.2 + Math.random() * 3.2,
                hue: 210 + Math.random() * 60, // 210–270: blue to violet
            });
        }
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        mouseRef.current = { x: e.clientX, y: e.clientY };
        spawnParticles(e.clientX, e.clientY);
    }, [spawnParticles]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        const draw = () => {
            rafRef.current = requestAnimationFrame(draw);

            // Clear with subtle fade (trail effect)
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const particles = particlesRef.current;
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.015; // gravity pull
                p.life -= p.decay;

                if (p.life <= 0) {
                    particles.splice(i, 1);
                    continue;
                }

                const alpha = p.life * 0.85;
                const radius = p.size * p.life;

                // Glowing core
                const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 2.5);
                grd.addColorStop(0, `hsla(${p.hue}, 100%, 72%, ${alpha})`);
                grd.addColorStop(0.4, `hsla(${p.hue}, 90%, 55%, ${alpha * 0.6})`);
                grd.addColorStop(1, `hsla(${p.hue}, 80%, 45%, 0)`);

                ctx.beginPath();
                ctx.arc(p.x, p.y, radius * 2.5, 0, Math.PI * 2);
                ctx.fillStyle = grd;
                ctx.fill();
            }
        };

        draw();
        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            cancelAnimationFrame(rafRef.current);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('resize', resize);
        };
    }, [handleMouseMove]);

    if (!isDark) return null;

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 0, opacity: 0.85 }}
            aria-hidden
        />
    );
}
