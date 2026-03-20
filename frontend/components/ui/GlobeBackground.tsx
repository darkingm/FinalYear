'use client';

/**
 * GlobeBackground
 *
 * ✅ Earth centered, fills most of viewport
 * ✅ NASA Blue Marble texture (jsDelivr CDN, CORS-safe)
 * ✅ City lights on night side
 * ✅ Stars with ShaderMaterial (per-vertex size) — glow when mouse is near
 * ✅ Exactly like antigravity.google: stars react to cursor proximity
 * ✅ Canvas at z-index:-1, dark space drawn by canvas
 * ✅ Dark mode only
 * ✅ No cursor particle / firework effects
 */

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

/* ── Textures (jsDelivr CDN — reliable, CORS-enabled) ───────────────────── */
const TEX_DAY = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg';
const TEX_NIGHT = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-night.jpg';
const TEX_CLOUDS = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-clouds.png';
const TEX_WATER = 'https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/textures/planets/earth_specular_2048.jpg';

/* ── Stars GLSL shaders — per-vertex size + smooth glow disc ────────────── */
const STAR_VERT = /* glsl */`
  attribute float size;
  attribute vec3  aColor;
  varying   vec3  vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (350.0 / -mv.z);
    gl_Position  = projectionMatrix * mv;
  }
`;

const STAR_FRAG = /* glsl */`
  varying vec3 vColor;
  void main() {
    float d     = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float alpha = 1.0 - smoothstep(0.15, 0.5, d);
    gl_FragColor = vec4(vColor, alpha);
  }
`;

/* ── Config ─────────────────────────────────────────────────────────────── */
const STAR_COUNT = 7000;
const HOVER_RADIUS = 170;   // px — cursor glow radius
const MAX_GLOW = 5.5;   // max star size on hover
const BASE_SIZE_MIN = 0.8;
const BASE_SIZE_MAX = 2.2;
const LERP = 0.07;  // smoothing (matches antigravity.google feel)
const ROT_SPEED = 0.0013;
const EARTH_TILT_RAD = 23.5 * (Math.PI / 180);

export function GlobeBackground() {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number>(0);
    const mouseRef = useRef({ x: -9999, y: -9999 });
    const cleanRef = useRef<(() => void) | null>(null);

    useEffect(() => { setMounted(true); }, []);

    const isDark = mounted && resolvedTheme === 'dark';

    useEffect(() => {
        if (!isDark) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        let dead = false;

        (async () => {
            const THREE = await import('three');
            if (dead) return;

            /* ── Renderer ──────────────────────────────────────────────────────── */
            const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
            R.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            R.setSize(window.innerWidth, window.innerHeight);
            R.setClearColor(0x050914, 1);   // deep-space colour — canvas IS the bg

            /* ── Scene / Camera ─────────────────────────────────────────────────── */
            const scene = new THREE.Scene();
            const W = () => window.innerWidth;
            const H = () => window.innerHeight;
            const camera = new THREE.PerspectiveCamera(55, W() / H(), 1, 6000);
            camera.position.z = 680;

            /* ── Lighting ───────────────────────────────────────────────────────── */
            scene.add(new THREE.AmbientLight(0x1a2040, 1.5));
            const sun = new THREE.DirectionalLight(0xfff8f0, 2.2);
            sun.position.set(4, 1.5, 2).normalize();
            scene.add(sun);

            /* ── Earth radius — fill ~78% of the shorter viewport dimension ─────── */
            const earthR = () => Math.min(W(), H()) * 0.40;

            /* ── Load textures ──────────────────────────────────────────────────── */
            const load = (url: string) =>
                new Promise<THREE.Texture | null>(res =>
                    new THREE.TextureLoader().load(url, t => res(t), undefined, () => res(null))
                );

            const [dayTex, nightTex, cloudTex, waterTex] = await Promise.all([
                load(TEX_DAY), load(TEX_NIGHT), load(TEX_CLOUDS), load(TEX_WATER),
            ]);
            if (dead) return;

            /* ── Earth ──────────────────────────────────────────────────────────── */
            const er = earthR();
            const earthGeo = new THREE.SphereGeometry(er, 72, 72);
            const earthMat = new THREE.MeshPhongMaterial({
                map: dayTex ?? undefined,
                specularMap: waterTex ?? undefined,
                specular: new THREE.Color(0x2244aa),
                shininess: 30,
                color: dayTex ? 0xffffff : 0x1a4477,
            });
            const earth = new THREE.Mesh(earthGeo, earthMat);
            earth.rotation.z = EARTH_TILT_RAD;
            earth.position.set(0, 0, 0);   // ← centered
            scene.add(earth);

            /* Night city lights */
            if (nightTex) {
                const nm = new THREE.MeshLambertMaterial({
                    map: nightTex, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.9,
                });
                const ns = new THREE.Mesh(new THREE.SphereGeometry(er + 1, 72, 72), nm);
                ns.rotation.z = EARTH_TILT_RAD;
                scene.add(ns);
                (earth as any).__night = ns;
            }

            /* Clouds */
            if (cloudTex) {
                const cm = new THREE.MeshPhongMaterial({
                    map: cloudTex, transparent: true, opacity: 0.28, depthWrite: false,
                });
                const cs = new THREE.Mesh(new THREE.SphereGeometry(er + er * 0.012, 72, 72), cm);
                cs.rotation.z = EARTH_TILT_RAD;
                scene.add(cs);
                (earth as any).__clouds = cs;
            }

            /* Glow / atmosphere */
            const atmGeo = new THREE.SphereGeometry(er * 1.065, 64, 64);
            const atmMat = new THREE.ShaderMaterial({
                uniforms: { c: { value: 0.5 }, p: { value: 4.0 } },
                vertexShader: `
          varying float vIntensity;
          void main() {
            vec3 vNormal = normalize(normalMatrix * normal);
            vec3 vNormView = normalize(-( modelViewMatrix * vec4(position,1.0) ).xyz);
            vIntensity = pow(0.65 - dot(vNormal, vNormView), 4.0);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
                fragmentShader: `
          varying float vIntensity;
          void main() {
            gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * vIntensity * 0.9;
          }`,
                side: THREE.FrontSide, blending: THREE.AdditiveBlending, transparent: true,
            });
            scene.add(new THREE.Mesh(atmGeo, atmMat));

            /* ── Stars — ShaderMaterial for per-vertex size ──────────────────────── */
            const pos = new Float32Array(STAR_COUNT * 3);
            const col = new Float32Array(STAR_COUNT * 3);
            const sizes = new Float32Array(STAR_COUNT);
            const base = new Float32Array(STAR_COUNT);
            const tgt = new Float32Array(STAR_COUNT);

            /* Precompute screen coords once (camera is static) */
            const scrX = new Float32Array(STAR_COUNT);
            const scrY = new Float32Array(STAR_COUNT);
            const tmp = new THREE.Vector3();

            for (let i = 0; i < STAR_COUNT; i++) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const dist = 1200 + Math.random() * 2200;
                pos[i * 3] = dist * Math.sin(phi) * Math.cos(theta);
                pos[i * 3 + 1] = dist * Math.sin(phi) * Math.sin(theta);
                pos[i * 3 + 2] = dist * Math.cos(phi) - 500;

                const b = BASE_SIZE_MIN + Math.random() * (BASE_SIZE_MAX - BASE_SIZE_MIN);
                base[i] = sizes[i] = tgt[i] = b;

                /* color: mostly white-blue, few warm */
                const warm = Math.random() < 0.18;
                col[i * 3] = warm ? 1.0 : 0.88 + Math.random() * 0.12;
                col[i * 3 + 1] = warm ? 0.88 : 0.90 + Math.random() * 0.10;
                col[i * 3 + 2] = warm ? 0.70 : 1.0;

                /* project to screen once */
                tmp.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
                tmp.project(camera);
                scrX[i] = (tmp.x * 0.5 + 0.5) * window.innerWidth;
                scrY[i] = (-tmp.y * 0.5 + 0.5) * window.innerHeight;
            }

            const starGeo = new THREE.BufferGeometry();
            const posAttr = new THREE.BufferAttribute(pos, 3);
            const colAttr = new THREE.BufferAttribute(col, 3);
            const sizeAttr = new THREE.BufferAttribute(sizes, 1);
            sizeAttr.setUsage(THREE.DynamicDrawUsage);
            starGeo.setAttribute('position', posAttr);
            starGeo.setAttribute('aColor', colAttr);
            starGeo.setAttribute('size', sizeAttr);

            const starMat = new THREE.ShaderMaterial({
                uniforms: {},
                vertexShader: STAR_VERT,
                fragmentShader: STAR_FRAG,
                transparent: true,
                depthWrite: false,
            });
            scene.add(new THREE.Points(starGeo, starMat));

            /* ── Resize ─────────────────────────────────────────────────────────── */
            const onResize = () => {
                camera.aspect = W() / H();
                camera.updateProjectionMatrix();
                R.setSize(W(), H());
                /* Re-project stars on resize */
                for (let i = 0; i < STAR_COUNT; i++) {
                    tmp.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
                    tmp.project(camera);
                    scrX[i] = (tmp.x * 0.5 + 0.5) * W();
                    scrY[i] = (-tmp.y * 0.5 + 0.5) * H();
                }
            };
            window.addEventListener('resize', onResize);

            /* ── Mouse ──────────────────────────────────────────────────────────── */
            const onMouse = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
            window.addEventListener('mousemove', onMouse);

            /* ── Tick ───────────────────────────────────────────────────────────── */
            const tick = () => {
                if (dead) return;
                rafRef.current = requestAnimationFrame(tick);

                /* Rotate Earth */
                earth.rotation.y += ROT_SPEED;
                const night = (earth as any).__night;
                const clouds = (earth as any).__clouds;
                if (night) night.rotation.y = earth.rotation.y;
                if (clouds) clouds.rotation.y = earth.rotation.y + 0.0002;

                /* Star glow — antigravity.google effect */
                const mx = mouseRef.current.x;
                const my = mouseRef.current.y;
                for (let i = 0; i < STAR_COUNT; i++) {
                    const dx = scrX[i] - mx;
                    const dy = scrY[i] - my;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < HOVER_RADIUS) {
                        const t = 1 - dist / HOVER_RADIUS;
                        tgt[i] = base[i] + t * t * (MAX_GLOW - base[i]);
                    } else {
                        tgt[i] = base[i];
                    }
                    sizes[i] += (tgt[i] - sizes[i]) * LERP;
                }
                sizeAttr.needsUpdate = true;

                R.render(scene, camera);
            };
            tick();

            cleanRef.current = () => {
                dead = true;
                cancelAnimationFrame(rafRef.current);
                window.removeEventListener('resize', onResize);
                window.removeEventListener('mousemove', onMouse);
                R.dispose();
            };
        })();

        return () => {
            dead = true;
            cleanRef.current?.();
            cleanRef.current = null;
            cancelAnimationFrame(rafRef.current);
        };
    }, [isDark]);

    if (!mounted || !isDark) return null;

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                inset: 0,
                width: '100vw',
                height: '100vh',
                zIndex: -1,
                pointerEvents: 'none',
                display: 'block',
            }}
            aria-hidden
        />
    );
}
