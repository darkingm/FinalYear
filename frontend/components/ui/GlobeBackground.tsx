'use client';

/**
 * GlobeBackground — Three.js 3D Earth + interactive star field
 *
 * Fixes applied:
 * - No next-themes dependency (was causing undefined on first render)
 * - Checks DOM classList directly for dark mode
 * - Canvas always mounted, Three.js init on useEffect
 * - Earth centered at (0,0,0), fills ~80% viewport
 * - NASA Blue Marble from jsDelivr
 * - GLSL per-vertex star sizes (antigravity.google hover effect)
 * - Dark space bg drawn by canvas itself (z-index:-1)
 */

import { useEffect, useRef } from 'react';

/* ── Textures (jsDelivr — reliable CORS) ─────────────────────────────────── */
const TEX_DAY = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg';
const TEX_NIGHT = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-night.jpg';
const TEX_WATER = 'https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/textures/planets/earth_specular_2048.jpg';

/* ── GLSL — per-vertex star point size + glow disc ──────────────────────── */
const VERT = /* glsl */`
  attribute float size;
  attribute vec3  aColor;
  varying   vec3  vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position,1.0);
    gl_PointSize = size * (350.0 / -mv.z);
    gl_Position  = projectionMatrix * mv;
  }`;

const FRAG = /* glsl */`
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = 1.0 - smoothstep(0.15, 0.5, d);
    gl_FragColor = vec4(vColor, a);
  }`;

const STAR_N = 6000;
const HOVER_R = 160;
const MAX_GLOW = 5.0;
const BASE_MIN = 0.8;
const BASE_MAX = 2.0;
const LERP = 0.07;
const ROT = 0.0012;
const TILT = 23.5 * Math.PI / 180;

export function GlobeBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef(0);
    const mx = useRef(-9999);
    const my = useRef(-9999);

    useEffect(() => {
        /* Check dark mode via DOM class (avoids next-themes undefined issue) */
        const isDark = () => document.documentElement.classList.contains('dark');
        if (!isDark()) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        let dead = false;

        (async () => {
            const THREE = await import('three');
            if (dead) return;

            const W = () => window.innerWidth;
            const H = () => window.innerHeight;

            /* Renderer */
            const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
            R.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            R.setSize(W(), H());
            R.setClearColor(0x050914, 1);

            /* Scene + Camera */
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(55, W() / H(), 1, 8000);
            camera.position.z = 680;

            /* Lighting */
            scene.add(new THREE.AmbientLight(0x1a2040, 1.8));
            const sun = new THREE.DirectionalLight(0xfff8f0, 2.5);
            sun.position.set(4, 1.5, 2);
            scene.add(sun);

            /* Load textures */
            const loadTex = (url: string) =>
                new Promise<InstanceType<typeof THREE.Texture> | null>(res =>
                    new THREE.TextureLoader().load(url, t => res(t), undefined, () => res(null))
                );
            const [dayT, nightT, waterT] = await Promise.all([
                loadTex(TEX_DAY), loadTex(TEX_NIGHT), loadTex(TEX_WATER),
            ]);
            if (dead) return;

            /* Earth — radius sized to fill ~42% of viewport */
            const er = Math.min(W(), H()) * 0.42;
            const earthGeo = new THREE.SphereGeometry(er, 72, 72);
            const earthMat = new THREE.MeshPhongMaterial({
                map: dayT ?? undefined,
                specularMap: waterT ?? undefined,
                specular: new THREE.Color(0x1a3366),
                shininess: 25,
                color: dayT ? undefined : 0x1a4477,
            });
            const earth = new THREE.Mesh(earthGeo, earthMat);
            earth.rotation.z = TILT;
            scene.add(earth);

            /* Night city lights */
            if (nightT) {
                const nm = new THREE.MeshLambertMaterial({
                    map: nightT, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.85,
                });
                const ns = new THREE.Mesh(new THREE.SphereGeometry(er + 1, 72, 72), nm);
                ns.rotation.z = TILT;
                scene.add(ns);
                (earth as any).__ns = ns;
            }

            /* Atmosphere glow (Fresnel shader) */
            const atmMat = new THREE.ShaderMaterial({
                vertexShader: `
          varying float v;
          void main() {
            vec3 n = normalize(normalMatrix * normal);
            vec3 e = normalize(-vec3(modelViewMatrix * vec4(position,1.0)));
            v = pow(0.72 - dot(n, e), 4.0);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
          }`,
                fragmentShader: `
          varying float v;
          void main() { gl_FragColor = vec4(0.2, 0.55, 1.0, 1.0) * v * 0.85; }`,
                side: THREE.FrontSide, blending: THREE.AdditiveBlending, transparent: true,
            });
            scene.add(new THREE.Mesh(new THREE.SphereGeometry(er * 1.07, 64, 64), atmMat));

            /* Stars — precompute screen positions for cheap hover check */
            const pos = new Float32Array(STAR_N * 3);
            const col = new Float32Array(STAR_N * 3);
            const sz = new Float32Array(STAR_N);
            const base = new Float32Array(STAR_N);
            const tgt = new Float32Array(STAR_N);
            const sx = new Float32Array(STAR_N);
            const sy = new Float32Array(STAR_N);
            const tmp = new THREE.Vector3();

            for (let i = 0; i < STAR_N; i++) {
                const θ = Math.random() * Math.PI * 2;
                const φ = Math.acos(2 * Math.random() - 1);
                const d = 1400 + Math.random() * 2000;
                pos[i * 3] = d * Math.sin(φ) * Math.cos(θ);
                pos[i * 3 + 1] = d * Math.sin(φ) * Math.sin(θ);
                pos[i * 3 + 2] = d * Math.cos(φ) - 500;

                const b = BASE_MIN + Math.random() * (BASE_MAX - BASE_MIN);
                base[i] = sz[i] = tgt[i] = b;

                const warm = Math.random() < 0.2;
                col[i * 3] = warm ? 1.0 : 0.88 + Math.random() * 0.12;
                col[i * 3 + 1] = warm ? 0.85 : 0.90 + Math.random() * 0.10;
                col[i * 3 + 2] = warm ? 0.65 : 1.0;

                tmp.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
                tmp.project(camera);
                sx[i] = (tmp.x * 0.5 + 0.5) * W();
                sy[i] = (-tmp.y * 0.5 + 0.5) * H();
            }

            const geo = new THREE.BufferGeometry();
            const szA = new THREE.BufferAttribute(sz, 1);
            szA.setUsage(THREE.DynamicDrawUsage);
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
            geo.setAttribute('size', szA);

            const starMat = new THREE.ShaderMaterial({
                vertexShader: VERT, fragmentShader: FRAG,
                transparent: true, depthWrite: false,
            });
            scene.add(new THREE.Points(geo, starMat));

            /* Resize */
            const onResize = () => {
                camera.aspect = W() / H();
                camera.updateProjectionMatrix();
                R.setSize(W(), H());
                for (let i = 0; i < STAR_N; i++) {
                    tmp.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
                    tmp.project(camera);
                    sx[i] = (tmp.x * 0.5 + 0.5) * W();
                    sy[i] = (-tmp.y * 0.5 + 0.5) * H();
                }
            };
            window.addEventListener('resize', onResize);

            /* Mouse */
            const onMouse = (e: MouseEvent) => { mx.current = e.clientX; my.current = e.clientY; };
            window.addEventListener('mousemove', onMouse);

            /* Also re-run when dark mode changes */
            const obs = new MutationObserver(() => {
                if (!isDark()) { dead = true; cancelAnimationFrame(rafRef.current); R.dispose(); }
            });
            obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

            /* Tick */
            const tick = () => {
                if (dead) return;
                rafRef.current = requestAnimationFrame(tick);

                earth.rotation.y += ROT;
                const ns = (earth as any).__ns;
                if (ns) ns.rotation.y = earth.rotation.y;

                /* Star hover glow — antigravity.google */
                const mxv = mx.current, myv = my.current;
                for (let i = 0; i < STAR_N; i++) {
                    const dx = sx[i] - mxv, dy = sy[i] - myv;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    tgt[i] = dist < HOVER_R
                        ? base[i] + (1 - dist / HOVER_R) ** 2 * (MAX_GLOW - base[i])
                        : base[i];
                    sz[i] += (tgt[i] - sz[i]) * LERP;
                }
                szA.needsUpdate = true;
                R.render(scene, camera);
            };
            tick();

            return () => {
                dead = true;
                cancelAnimationFrame(rafRef.current);
                obs.disconnect();
                window.removeEventListener('resize', onResize);
                window.removeEventListener('mousemove', onMouse);
                R.dispose();
            };
        })().then(fn => { if (fn) fn(); });

        return () => { dead = true; cancelAnimationFrame(rafRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* Always render the canvas — Three.js controls visibility */
    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0, left: 0,
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
