'use client';

/**
 * GlobeBackground — 3D Earth + antigravity.google star effect
 *
 * Architecture:
 * - Canvas z-index: -1 (TRUE background, behind all content)
 * - alpha: false → canvas draws its own #050914 dark space colour
 * - body/html/sections must be transparent (globals.css) for canvas to show
 * - pointer-events: none on canvas → never blocks clicks
 * - window mouse events → drag (with 8px threshold) + star hover glow
 * - DPR-corrected star sizes so they're actually visible
 */

import { useEffect, useRef } from 'react';

/* ── Textures (jsDelivr CDN — CORS safe) ─────────────────────────────────── */
const TEX_DAY = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg';
const TEX_NIGHT = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-night.jpg';

/* ── GLSL shaders ────────────────────────────────────────────────────────── */
const VERT = /* glsl */`
  attribute float size;
  attribute vec3  aColor;
  varying   vec3  vColor;
  void main() {
    vColor = aColor;
    gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(size, 1.0, 64.0);
  }`;

const FRAG = /* glsl */`
  varying vec3 vColor;
  void main() {
    vec2  uv = gl_PointCoord - 0.5;
    float d  = length(uv) * 2.0;
    if (d > 1.0) discard;
    float a = pow(1.0 - d, 2.2);
    gl_FragColor = vec4(vColor, a);
  }`;

/* ── Config ──────────────────────────────────────────────────────────────── */
const STAR_N = 5500;
const HOVER_RADIUS = 180;     // CSS px
const AUTO_ROT = 0.0009;  // rad / frame
const DRAG_SENS = 0.007;
const DRAG_THRESH = 8;       // px — below this is a click, above is drag
const LERP = 0.08;
const TILT = 23.5 * Math.PI / 180;

export function GlobeBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        /* Only in dark mode */
        if (!document.documentElement.classList.contains('dark')) return;

        const dpr = Math.min(window.devicePixelRatio, 2);

        let dead = false;
        let dragging = false;
        let didDrag = false;
        let startX = 0, startY = 0;
        let lastX = 0, lastY = 0;
        let mouseX = -9999, mouseY = -9999;

        import('three').then(THREE => {
            if (dead) return;

            const W = () => window.innerWidth;
            const H = () => window.innerHeight;

            /* ── Renderer ─────────────────────────────────────────────────── */
            const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
            R.setPixelRatio(dpr);
            R.setSize(W(), H());
            R.setClearColor(0x050914, 1);   // deep space — this IS the bg

            /* ── Scene / Camera ────────────────────────────────────────────── */
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(55, W() / H(), 1, 8000);
            camera.position.z = 680;
            scene.add(new THREE.AmbientLight(0x1a2040, 1.8));
            const sun = new THREE.DirectionalLight(0xfff8f0, 2.4);
            sun.position.set(4, 1.5, 2);
            scene.add(sun);

            /* ── Earth ─────────────────────────────────────────────────────── */
            const er = Math.min(W(), H()) * 0.42;
            const earth = new THREE.Mesh(
                new THREE.SphereGeometry(er, 72, 72),
                new THREE.MeshPhongMaterial({ color: 0x1a4477, shininess: 25 })
            );
            earth.rotation.z = TILT;
            scene.add(earth);

            /* Load textures (non-blocking) */
            const loader = new THREE.TextureLoader();
            loader.load(TEX_DAY, t => { (earth.material as any).map = t; (earth.material as any).needsUpdate = true; });
            loader.load(TEX_NIGHT, t => {
                if (dead) return;
                const ns = new THREE.Mesh(
                    new THREE.SphereGeometry(er + 1, 72, 72),
                    new THREE.MeshLambertMaterial({ map: t, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.85 })
                );
                ns.rotation.z = TILT;
                scene.add(ns);
                (earth as any).__ns = ns;
            });

            /* Atmosphere */
            scene.add(new THREE.Mesh(
                new THREE.SphereGeometry(er * 1.07, 64, 64),
                new THREE.ShaderMaterial({
                    vertexShader: `varying float v; void main() {
            vec3 n=normalize(normalMatrix*normal);
            vec3 e=normalize(-vec3(modelViewMatrix*vec4(position,1)));
            v=pow(0.72-dot(n,e),4.0);
            gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1); }`,
                    fragmentShader: `varying float v; void main() { gl_FragColor=vec4(0.2,0.55,1.0,1.0)*v*0.85; }`,
                    side: THREE.FrontSide, blending: THREE.AdditiveBlending, transparent: true,
                })
            ));

            /* ── Stars ─────────────────────────────────────────────────────── */
            // Star sizes in FRAMEBUFFER pixels = CSS pixels × dpr
            const BASE_MIN = 3 * dpr;   // 3 CSS px
            const BASE_MAX = 7 * dpr;   // 7 CSS px
            const MAX_GLOW = 28 * dpr;  // 28 CSS px (big visible glow)

            const pos = new Float32Array(STAR_N * 3);
            const col = new Float32Array(STAR_N * 3);
            const sz = new Float32Array(STAR_N);
            const base = new Float32Array(STAR_N);
            const tgt = new Float32Array(STAR_N);
            const scrX = new Float32Array(STAR_N);
            const scrY = new Float32Array(STAR_N);
            const tmp = new THREE.Vector3();

            for (let i = 0; i < STAR_N; i++) {
                const θ = Math.random() * Math.PI * 2;
                const φ = Math.acos(2 * Math.random() - 1);
                const d = 1500 + Math.random() * 2000;
                pos[i * 3] = d * Math.sin(φ) * Math.cos(θ);
                pos[i * 3 + 1] = d * Math.sin(φ) * Math.sin(θ);
                pos[i * 3 + 2] = d * Math.cos(φ) - 500;

                const b = BASE_MIN + Math.random() * (BASE_MAX - BASE_MIN);
                base[i] = sz[i] = tgt[i] = b;

                const warm = Math.random() < 0.18;
                col[i * 3] = warm ? 1.0 : 0.88 + Math.random() * 0.12;
                col[i * 3 + 1] = warm ? 0.82 : 0.92 + Math.random() * 0.08;
                col[i * 3 + 2] = warm ? 0.55 : 1.0;

                tmp.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).project(camera);
                scrX[i] = (tmp.x * 0.5 + 0.5) * W();
                scrY[i] = (-tmp.y * 0.5 + 0.5) * H();
            }

            const geo = new THREE.BufferGeometry();
            const szA = new THREE.BufferAttribute(sz, 1);
            szA.setUsage(THREE.DynamicDrawUsage);
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
            geo.setAttribute('size', szA);
            scene.add(new THREE.Points(geo, new THREE.ShaderMaterial({
                vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
            })));

            /* ── Resize ────────────────────────────────────────────────────── */
            const onResize = () => {
                camera.aspect = W() / H();
                camera.updateProjectionMatrix();
                R.setSize(W(), H());
                for (let i = 0; i < STAR_N; i++) {
                    tmp.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).project(camera);
                    scrX[i] = (tmp.x * 0.5 + 0.5) * W();
                    scrY[i] = (-tmp.y * 0.5 + 0.5) * H();
                }
            };
            window.addEventListener('resize', onResize);

            /* ── Mouse / drag ──────────────────────────────────────────────── */
            const onDown = (e: MouseEvent) => {
                dragging = true; didDrag = false;
                startX = lastX = e.clientX;
                startY = lastY = e.clientY;
            };
            const onMove = (e: MouseEvent) => {
                mouseX = e.clientX; mouseY = e.clientY;
                if (!dragging) return;
                const totalDist = Math.hypot(e.clientX - startX, e.clientY - startY);
                if (didDrag || totalDist > DRAG_THRESH) {
                    didDrag = true;
                    const dx = e.clientX - lastX;
                    const dy = e.clientY - lastY;
                    earth.rotation.y += dx * DRAG_SENS;
                    earth.rotation.x = Math.max(-1.0, Math.min(1.0, earth.rotation.x + dy * DRAG_SENS * 0.5));
                    const ns = (earth as any).__ns;
                    if (ns) { ns.rotation.y = earth.rotation.y; ns.rotation.x = earth.rotation.x; }
                }
                lastX = e.clientX; lastY = e.clientY;
            };
            const onUp = () => { dragging = false; };

            window.addEventListener('mousedown', onDown);
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);

            /* ── Tick ──────────────────────────────────────────────────────── */
            const tick = () => {
                if (dead) return;
                rafRef.current = requestAnimationFrame(tick);

                if (!dragging) {
                    earth.rotation.y += AUTO_ROT;
                    const ns = (earth as any).__ns;
                    if (ns) ns.rotation.y = earth.rotation.y;
                }

                /* antigravity.google star effect */
                for (let i = 0; i < STAR_N; i++) {
                    const dist = Math.hypot(scrX[i] - mouseX, scrY[i] - mouseY);
                    tgt[i] = dist < HOVER_RADIUS
                        ? base[i] + (1 - dist / HOVER_RADIUS) ** 2 * (MAX_GLOW - base[i])
                        : base[i];
                    sz[i] += (tgt[i] - sz[i]) * LERP;
                }
                szA.needsUpdate = true;
                R.render(scene, camera);
            };
            tick();

            /* ── Cleanup ───────────────────────────────────────────────────── */
            const dispose = () => {
                dead = true;
                cancelAnimationFrame(rafRef.current);
                window.removeEventListener('resize', onResize);
                window.removeEventListener('mousedown', onDown);
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                R.dispose();
            };
            // Store for effect cleanup
            (canvas as any).__dispose = dispose;
        });

        return () => {
            dead = true;
            cancelAnimationFrame(rafRef.current);
            const dispose = (canvas as any).__dispose;
            if (dispose) dispose();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
