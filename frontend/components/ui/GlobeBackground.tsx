'use client';

/**
 * GlobeBackground — 3D Earth for BOTH light and dark mode
 *
 * Dark mode:  deep space (#050914) + dim Earth + bright star field
 * Light mode: sky blue (#c8e8ff) + vibrant bright Earth + subtle stars
 *
 * MutationObserver watches html.class for theme changes → updates live
 */

import { useEffect, useRef } from 'react';

const TEX_DAY = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg';
const TEX_NIGHT = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-night.jpg';

/* ── GLSL ─────────────────────────────────────────────────────────────────── */
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
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float a = pow(1.0 - d, 2.2);
    gl_FragColor = vec4(vColor, a);
  }`;

const STAR_N = 5500;
const HOVER_R = 180;
const AUTO_ROT = 0.0009;
const DRAG_SENS = 0.007;
const DRAG_THRESH = 8;
const LERP = 0.08;
const TILT = 23.5 * Math.PI / 180;

/* Theme presets */
const PRESETS = {
    dark: {
        clearColor: 0x050914,
        ambientColor: 0x1a2040,
        ambientIntens: 1.8,
        sunColor: 0xfff8f0,
        sunIntens: 2.4,
        sunPos: [4, 1.5, 2] as [number, number, number],
        starOpacity: 0.9,       // fully visible stars
        starColorCool: [0.88, 0.92, 1.0] as [number, number, number],
        starHint: 0,         // no sky colour overlay on stars
    },
    light: {
        clearColor: 0xc8e8ff,  // bright sky blue
        ambientColor: 0x6699bb,  // blueish sky ambient
        ambientIntens: 3.5,       // strong ambient → bright earth surface
        sunColor: 0xffffff,
        sunIntens: 5.0,       // bright sunlight
        sunPos: [3, 2, 3] as [number, number, number],
        starOpacity: 0.25,      // stars almost invisible in daylight
        starColorCool: [0.6, 0.7, 0.9] as [number, number, number],
        starHint: 1,
    },
} as const;

export function GlobeBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = Math.min(window.devicePixelRatio, 2);
        let dead = false;
        let dragging = false;
        let didDrag = false;
        let startX = 0, startY = 0;
        let lastX = 0, lastY = 0;
        let mouseX = -9999, mouseY = -9999;

        const getTheme = () => document.documentElement.classList.contains('dark') ? 'dark' : 'light';

        import('three').then(THREE => {
            if (dead) return;

            const W = () => window.innerWidth;
            const H = () => window.innerHeight;

            /* ── Renderer ─────────────────────────────────────────────────── */
            const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
            R.setPixelRatio(dpr);
            R.setSize(W(), H());

            /* ── Scene / Camera ─────────────────────────────────────────────── */
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(55, W() / H(), 1, 8000);
            camera.position.z = 680;

            const ambientLight = new THREE.AmbientLight(0x000000, 1);
            scene.add(ambientLight);
            const sun = new THREE.DirectionalLight(0xffffff, 1);
            scene.add(sun);

            /* ── Earth ─────────────────────────────────────────────────────── */
            const er = Math.min(W(), H()) * 0.42;
            const earthMat = new THREE.MeshPhongMaterial({ color: 0x1a4477, shininess: 30 });
            const earth = new THREE.Mesh(new THREE.SphereGeometry(er, 72, 72), earthMat);
            earth.rotation.z = TILT;
            scene.add(earth);

            const loader = new THREE.TextureLoader();
            loader.load(TEX_DAY, t => { earthMat.map = t; earthMat.needsUpdate = true; });
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

            /* Atmosphere glow */
            scene.add(new THREE.Mesh(
                new THREE.SphereGeometry(er * 1.07, 64, 64),
                new THREE.ShaderMaterial({
                    vertexShader: `varying float v; void main() {
            vec3 n=normalize(normalMatrix*normal);vec3 e=normalize(-vec3(modelViewMatrix*vec4(position,1)));
            v=pow(0.72-dot(n,e),4.0);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1);}`,
                    fragmentShader: `varying float v; void main(){gl_FragColor=vec4(0.2,0.55,1.0,1.0)*v*0.85;}`,
                    side: THREE.FrontSide, blending: THREE.AdditiveBlending, transparent: true,
                })
            ));

            /* ── Stars ─────────────────────────────────────────────────────── */
            const BASE_MIN = 3 * dpr, BASE_MAX = 7 * dpr, MAX_GLOW = 28 * dpr;
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
            const starPoints = new THREE.Points(geo, new THREE.ShaderMaterial({
                vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
            }));
            scene.add(starPoints);

            /* ── Apply theme ────────────────────────────────────────────────── */
            const applyTheme = (t: 'dark' | 'light') => {
                const p = PRESETS[t];
                R.setClearColor(p.clearColor, 1);
                ambientLight.color.setHex(p.ambientColor);
                ambientLight.intensity = p.ambientIntens;
                sun.color.setHex(p.sunColor);
                sun.intensity = p.sunIntens;
                sun.position.set(...p.sunPos).normalize();
                starPoints.material.opacity = p.starOpacity;
            };
            applyTheme(getTheme());

            /* Watch for theme changes */
            const obs = new MutationObserver(() => applyTheme(getTheme()));
            obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

            /* ── Resize ─────────────────────────────────────────────────────── */
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

            /* ── Mouse / Drag ───────────────────────────────────────────────── */
            const onDown = (e: MouseEvent) => {
                dragging = true; didDrag = false;
                startX = lastX = e.clientX; startY = lastY = e.clientY;
            };
            const onMove = (e: MouseEvent) => {
                mouseX = e.clientX; mouseY = e.clientY;
                if (!dragging) return;
                if (didDrag || Math.hypot(e.clientX - startX, e.clientY - startY) > DRAG_THRESH) {
                    didDrag = true;
                    const dx = e.clientX - lastX, dy = e.clientY - lastY;
                    earth.rotation.y += dx * DRAG_SENS;
                    earth.rotation.x = Math.max(-1, Math.min(1, earth.rotation.x + dy * DRAG_SENS * 0.5));
                    const ns = (earth as any).__ns;
                    if (ns) { ns.rotation.y = earth.rotation.y; ns.rotation.x = earth.rotation.x; }
                }
                lastX = e.clientX; lastY = e.clientY;
            };
            const onUp = () => { dragging = false; };
            window.addEventListener('mousedown', onDown);
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);

            /* ── Tick ───────────────────────────────────────────────────────── */
            const tick = () => {
                if (dead) return;
                rafRef.current = requestAnimationFrame(tick);
                if (!dragging) {
                    earth.rotation.y += AUTO_ROT;
                    const ns = (earth as any).__ns;
                    if (ns) ns.rotation.y = earth.rotation.y;
                }
                for (let i = 0; i < STAR_N; i++) {
                    const dist = Math.hypot(scrX[i] - mouseX, scrY[i] - mouseY);
                    tgt[i] = dist < HOVER_R
                        ? base[i] + (1 - dist / HOVER_R) ** 2 * (MAX_GLOW - base[i])
                        : base[i];
                    sz[i] += (tgt[i] - sz[i]) * LERP;
                }
                szA.needsUpdate = true;
                R.render(scene, camera);
            };
            tick();

            /* ── Dispose ────────────────────────────────────────────────────── */
            const dispose = () => {
                dead = true;
                cancelAnimationFrame(rafRef.current);
                obs.disconnect();
                window.removeEventListener('resize', onResize);
                window.removeEventListener('mousedown', onDown);
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                R.dispose();
            };
            (canvas as any).__dispose = dispose;
        });

        return () => {
            dead = true;
            cancelAnimationFrame(rafRef.current);
            ((canvas as any).__dispose as (() => void) | undefined)?.();
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
