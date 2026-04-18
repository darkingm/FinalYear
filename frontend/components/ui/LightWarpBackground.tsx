'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
  alpha: number;
}

const MAX_PARTICLES = 220;

function createParticle(x: number, y: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.4 + Math.random() * 1.6;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 0.8 + Math.random() * 2.8,
    hue: 190 + Math.random() * 180,
    alpha: 0.6 + Math.random() * 0.35,
  };
}

export function LightWarpBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const particles: Particle[] = [];
    const pointer = {
      x: window.innerWidth * 0.68,
      y: window.innerHeight * 0.34,
      targetX: window.innerWidth * 0.68,
      targetY: window.innerHeight * 0.34,
      active: false,
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const spawnBurst = (x: number, y: number, count: number) => {
      for (let index = 0; index < count; index += 1) {
        particles.push(createParticle(
          x + (Math.random() - 0.5) * 26,
          y + (Math.random() - 0.5) * 26,
        ));
      }

      while (particles.length > MAX_PARTICLES) {
        particles.shift();
      }
    };

    const drawBackdrop = (width: number, height: number) => {
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#fbfdff');
      gradient.addColorStop(0.42, '#f4f9ff');
      gradient.addColorStop(1, '#eef5ff');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      const haze = context.createRadialGradient(width * 0.2, height * 0.18, 0, width * 0.2, height * 0.18, width * 0.42);
      haze.addColorStop(0, 'rgba(107, 170, 255, 0.14)');
      haze.addColorStop(1, 'rgba(107, 170, 255, 0)');
      context.fillStyle = haze;
      context.fillRect(0, 0, width, height);

      const warm = context.createRadialGradient(width * 0.82, height * 0.2, 0, width * 0.82, height * 0.2, width * 0.36);
      warm.addColorStop(0, 'rgba(255, 154, 94, 0.12)');
      warm.addColorStop(1, 'rgba(255, 154, 94, 0)');
      context.fillStyle = warm;
      context.fillRect(0, 0, width, height);
    };

    const drawWarp = (time: number) => {
      const pulse = 1 + Math.sin(time * 0.0018) * 0.04;
      const outerRadius = 160 * pulse;
      const innerRadius = 72 * pulse;

      const halo = context.createRadialGradient(pointer.x, pointer.y, innerRadius * 0.35, pointer.x, pointer.y, outerRadius);
      halo.addColorStop(0, 'rgba(14, 16, 26, 0.9)');
      halo.addColorStop(0.28, 'rgba(22, 28, 44, 0.72)');
      halo.addColorStop(0.52, 'rgba(74, 158, 255, 0.20)');
      halo.addColorStop(0.72, 'rgba(255, 95, 179, 0.16)');
      halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
      context.fillStyle = halo;
      context.beginPath();
      context.arc(pointer.x, pointer.y, outerRadius, 0, Math.PI * 2);
      context.fill();

      context.save();
      context.globalCompositeOperation = 'screen';
      for (let ring = 0; ring < 4; ring += 1) {
        const radius = innerRadius + ring * 26 + Math.sin(time * 0.002 + ring) * 10;
        context.strokeStyle = `hsla(${205 + ring * 34}, 100%, 68%, ${0.12 - ring * 0.02})`;
        context.lineWidth = 14 - ring * 2.4;
        context.beginPath();
        context.ellipse(pointer.x, pointer.y, radius * 1.12, radius * 0.76, Math.sin(time * 0.0007 + ring) * 0.4, 0, Math.PI * 2);
        context.stroke();
      }
      context.restore();

      context.fillStyle = 'rgba(7, 10, 18, 0.96)';
      context.beginPath();
      context.ellipse(pointer.x, pointer.y, innerRadius * 0.92, innerRadius * 0.66, Math.sin(time * 0.0008) * 0.4, 0, Math.PI * 2);
      context.fill();
    };

    const drawParticles = (width: number, height: number) => {
      context.save();
      context.globalCompositeOperation = 'screen';

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        const dx = pointer.x - particle.x;
        const dy = pointer.y - particle.y;
        const distance = Math.hypot(dx, dy);
        const influence = Math.max(0, 1 - distance / 240);
        const swirl = influence * 0.14;

        particle.vx += (-dy / Math.max(distance, 1)) * swirl;
        particle.vy += (dx / Math.max(distance, 1)) * swirl;
        particle.vx += dx * influence * 0.0007;
        particle.vy += dy * influence * 0.0007;

        particle.vx *= 0.985;
        particle.vy *= 0.985;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.alpha *= 0.992;

        if (
          particle.alpha < 0.04
          || particle.x < -40
          || particle.x > width + 40
          || particle.y < -40
          || particle.y > height + 40
        ) {
          particles.splice(index, 1);
          continue;
        }

        const gradient = context.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.radius * 5);
        gradient.addColorStop(0, `hsla(${particle.hue}, 100%, 72%, ${particle.alpha})`);
        gradient.addColorStop(0.4, `hsla(${particle.hue + 18}, 100%, 62%, ${particle.alpha * 0.6})`);
        gradient.addColorStop(1, `hsla(${particle.hue + 48}, 100%, 54%, 0)`);

        context.fillStyle = gradient;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius * 5, 0, Math.PI * 2);
        context.fill();
      }

      context.restore();
    };

    const render = (time: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      pointer.x += (pointer.targetX - pointer.x) * 0.08;
      pointer.y += (pointer.targetY - pointer.y) * 0.08;

      drawBackdrop(width, height);
      drawWarp(time);
      drawParticles(width, height);

      if (!pointer.active) {
        spawnBurst(
          pointer.x + Math.sin(time * 0.0008) * 40,
          pointer.y + Math.cos(time * 0.0011) * 30,
          2,
        );
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    const handlePointerMove = (event: MouseEvent) => {
      pointer.targetX = event.clientX;
      pointer.targetY = event.clientY;
      pointer.active = true;
      spawnBurst(event.clientX, event.clientY, 6);
    };

    const handleLeave = () => {
      pointer.active = false;
      pointer.targetX = window.innerWidth * 0.68;
      pointer.targetY = window.innerHeight * 0.34;
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseleave', handleLeave);
    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 block pointer-events-none"
      style={{ zIndex: -1 }}
      aria-hidden="true"
    />
  );
}
