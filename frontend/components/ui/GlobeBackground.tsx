'use client';

/**
 * GlobeBackground — 3D Earth + interactive star field
 *
 * Features:
 * ✅ Canvas at z-index: -1 (BEHIND all page content — never blocks clicks)
 * ✅ Dark space rendered by canvas clearColor (body can be transparent)
 * ✅ Earth auto-rotates on tilted axis
 * ✅ Click + drag (anywhere on page) rotates Earth — uses window events
 * ✅ Stars glow exactly like antigravity.google — GLSL with direct pixel sizes
 * ✅ Stars precomputed to 2D screen coords — O(n) per frame, no re-projection
 * ✅ Dark mode only via DOM classList check
 */

import { useEffect, useRef } from 'react';

const TEX_DAY = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg';
const TEX_NIGHT = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-night.jpg';
const TEX_WATER = 'https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/textures/planets/earth_specular_2048.jpg';

/* ── GLSL shaders — direct pixel size (no depth attenuation bug) ─────────── */
const VERT = /* glsl */`
  attribute float size;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vSize;
  void main() {
    vColor = aColor;
    vSize  = size;
    gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size;   /* direct pixel size — no distance division */
  }
`;
const FRAG = /* glsl */`
  varying vec3 vColor;
  varying float vSize;
  void main() {
    vec2 uv  = gl_PointCoord - 0.5;
    float d  = length(uv) * 2.0;        /* 0 at center, 1 at edge */
    if (d > 1.0) discard;
    /* soft glow disc: bright core → transparent edge */
    float a = pow(1.0 - d, 2.5);
    gl_FragColor = vec4(vColor * (0.7 + 0.3 * a), a);
  }
`;

/* ── Configuration ───────────────────────────────────────────────────────── */
const STAR_N = 6000;
const HOVER_R = 150;   // px — cursor glow radius
const BASE_MIN = 1.5;   // min star size in screen pixels
const BASE_MAX = 3.5;   // max base star size
const MAX_GLOW = 14.0;  // max size when cursor nearby
const LERP = 0.09;  // smoothing factor (higher = snappier)
const AUTO_ROT = 0.0010; // radians per frame (auto rotation)
const DRAG_SENS = 0.006;  // drag sensitivity
const TILT = 23.5 * Math.PI / 180;

export function GlobeBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef(0);
    const stateRef = useRef({
        mx: -9999, my: -9999,
        dragging: false,
        lastX: 0, lastY: 0,
    });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        /* Dark mode only */
        if (!document.documentElement.classList.contains('dark')) return;

        let dead = false;

        (async () => {
            const THREE = await import('three');
            if (dead) return;

            const W = () => window.innerWidth;
            const H = () => window.innerHeight;

            /* ── Renderer ─────────────────────────────────────────────────── */
            const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
            R.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            R.setSize(W(), H());
            R.setClearColor(0x050914, 1);  // deep space — canvas IS the background

            /* ── Scene / Camera ──────────────────────────────────────────── */
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(55, W() / H(), 1, 8000);
            camera.position.z = 680;

            /* ── Light ────────────────────────────────────────────────────── */
            scene.add(new THREE.AmbientLight(0x1a2040, 1.8));
            const sun = new THREE.DirectionalLight(0xfff8f0, 2.4);
            sun.position.set(4, 1.5, 2);
            scene.add(sun);

            /* ── Load textures ────────────────────────────────────────────── */
            const loadTex = (url: string) =>
                new Promise<InstanceType<typeof THREE.Texture> | null>(res =>
                    new THREE.TextureLoader().load(url, t => res(t), undefined, () => res(null))
                );
            const [dayT, nightT, waterT] = await Promise.all([
                loadTex(TEX_DAY), loadTex(TEX_NIGHT), loadTex(TEX_WATER),
            ]);
            if (dead) return;

            /* ── Earth ────────────────────────────────────────────────────── */
            const er = Math.min(W(), H()) * 0.42;  // 42% of shorter side
            const earth = new THREE.Mesh(
                new THREE.SphereGeometry(er, 72, 72),
                new THREE.MeshPhongMaterial({
                    map: dayT ?? undefined,
                    specularMap: waterT ?? undefined,
                    specular: new THREE.Color(0x1a3366),
                    shininess: 25,
                    color: dayT ? undefined : 0x1a4477,
                })
            );
            earth.rotation.z = TILT;
            scene.add(earth);

            /* Night lights (additive) */
            if (nightT) {
                const ns = new THREE.Mesh(
                    new THREE.SphereGeometry(er + 1, 72, 72),
                    new THREE.MeshLambertMaterial({
                        map: nightT, blending: THREE.AdditiveBlending,
                        transparent: true, opacity: 0.85,
                    })
                );
                ns.rotation.z = TILT;
                (earth as any).__ns = ns;
                scene.add(ns);
            }

            /* Atmosphere Fresnel glow */
            scene.add(new THREE.Mesh(
                new THREE.SphereGeometry(er * 1.07, 64, 64),
                new THREE.ShaderMaterial({
                    vertexShader: `
            varying float v;
            void main() {
              vec3 n = normalize(normalMatrix * normal);
              vec3 e = normalize(-vec3(modelViewMatrix * vec4(position,1.0)));
              v = pow(0.72 - dot(n,e), 4.0);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
            }`,
                    fragmentShader: `
            varying float v;
            void main() { gl_FragColor = vec4(0.2, 0.55, 1.0, 1.0) * v * 0.85; }`,
                    side: THREE.FrontSide, blending: THREE.AdditiveBlending, transparent: true,
                })
            ));

            /* ── Star Field ────────────────────────────────────────────────── */
            const pos = new Float32Array(STAR_N * 3);
            const col = new Float32Array(STAR_N * 3);
            const sz = new Float32Array(STAR_N);
            const base = new Float32Array(STAR_N);
            const tgt = new Float32Array(STAR_N);

            /* Precomputed 2D screen positions (camera is static — project once) */
            const scrX = new Float32Array(STAR_N);
            const scrY = new Float32Array(STAR_N);
            const tmp = new THREE.Vector3();

            for (let i = 0; i < STAR_N; i++) {
                const θ = Math.random() * Math.PI * 2;
                const φ = Math.acos(2 * Math.random() - 1);
                const d = 1600 + Math.random() * 1800;
                pos[i * 3] = d * Math.sin(φ) * Math.cos(θ);
                pos[i * 3 + 1] = d * Math.sin(φ) * Math.sin(θ);
                pos[i * 3 + 2] = d * Math.cos(φ) - 500;

                const b = BASE_MIN + Math.random() * (BASE_MAX - BASE_MIN);
                base[i] = sz[i] = tgt[i] = b;

                /* Color: mostly cool white/blue, few warm stars */
                const warm = Math.random() < 0.18;
                col[i * 3] = warm ? 1.00 : 0.88 + Math.random() * 0.12;
                col[i * 3 + 1] = warm ? 0.82 : 0.90 + Math.random() * 0.10;
                col[i * 3 + 2] = warm ? 0.55 : 1.00;

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
                vertexShader: VERT, fragmentShader: FRAG,
                transparent: true, depthWrite: false,
            })));

            /* ── Resize ────────────────────────────────────────────────────── */
            const onResize = () => {
                camera.aspect = W() / H();
                camera.updateProjectionMatrix();
                R.setSize(W(), H());
                /* Re-project stars (viewport changed) */
                for (let i = 0; i < STAR_N; i++) {
                    tmp.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).project(camera);
                    scrX[i] = (tmp.x * 0.5 + 0.5) * W();
                    scrY[i] = (-tmp.y * 0.5 + 0.5) * H();
                }
            };
            window.addEventListener('resize', onResize);

            /* ── Input: mouse move + drag-to-rotate ─────────────────────── */
            const s = stateRef.current;

            const onMouseMove = (e: MouseEvent) => {
                s.mx = e.clientX;
                s.my = e.clientY;

                if (s.dragging) {
                    const dx = e.clientX - s.lastX;
                    const dy = e.clientY - s.lastY;
                    earth.rotation.y += dx * DRAG_SENS;
                    /* Tilt: clamp so it doesn't flip upside down */
                    earth.rotation.x = Math.max(-1.0, Math.min(1.0,
                        earth.rotation.x + dy * DRAG_SENS * 0.5));
                    const ns = (earth as any).__ns;
                    if (ns) { ns.rotation.y = earth.rotation.y; ns.rotation.x = earth.rotation.x; }
                    s.lastX = e.clientX;
                    s.lastY = e.clientY;
                }
            };

            const onMouseDown = (e: MouseEvent) => {
                s.dragging = true;
                s.lastX = e.clientX;
                s.lastY = e.clientY;
            };

            const onMouseUp = () => { s.dragging = false; };

            /* Touch support */
            const onTouchStart = (e: TouchEvent) => {
                const t = e.touches[0];
                s.dragging = true; s.lastX = t.clientX; s.lastY = t.clientY;
            };
            const onTouchMove = (e: TouchEvent) => {
                const t = e.touches[0];
                const dx = t.clientX - s.lastX;
                const dy = t.clientY - s.lastY;
                earth.rotation.y += dx * DRAG_SENS;
                earth.rotation.x = Math.max(-1.0, Math.min(1.0, earth.rotation.x + dy * DRAG_SENS * 0.5));
                const ns = (earth as any).__ns;
                if (ns) { ns.rotation.y = earth.rotation.y; ns.rotation.x = earth.rotation.x; }
                s.lastX = t.clientX; s.lastY = t.clientY;
            };
            const onTouchEnd = () => { s.dragging = false; };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mousedown', onMouseDown);
            window.addEventListener('mouseup', onMouseUp);
            window.addEventListener('touchstart', onTouchStart, { passive: true });
            window.addEventListener('touchmove', onTouchMove, { passive: true });
            window.addEventListener('touchend', onTouchEnd);

            /* ── Tick ─────────────────────────────────────────────────────── */
            const tick = () => {
                if (dead) return;
                rafRef.current = requestAnimationFrame(tick);

                /* Auto-rotate Y (only when not dragging) */
                if (!s.dragging) {
                    earth.rotation.y += AUTO_ROT;
                    const ns = (earth as any).__ns;
                    if (ns) ns.rotation.y = earth.rotation.y;
                }

                /* Star glow — antigravity.google proximity effect */
                const mxv = s.mx, myv = s.my;
                for (let i = 0; i < STAR_N; i++) {
                    const dx = scrX[i] - mxv;
                    const dy = scrY[i] - myv;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    /* Smooth quadratic falloff like antigravity */
                    if (dist < HOVER_R) {
                        const t = 1 - dist / HOVER_R;
                        tgt[i] = base[i] + t * t * (MAX_GLOW - base[i]);
                    } else {
                        tgt[i] = base[i];
                    }
                    sz[i] += (tgt[i] - sz[i]) * LERP;
                }
                szA.needsUpdate = true;

                R.render(scene, camera);
            };
            tick();

            /* ── Cleanup ────────────────────────────────────────────────── */
            return () => {
                dead = true;
                cancelAnimationFrame(rafRef.current);
                window.removeEventListener('resize', onResize);
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mousedown', onMouseDown);
                window.removeEventListener('mouseup', onMouseUp);
                window.removeEventListener('touchstart', onTouchStart);
                window.removeEventListener('touchmove', onTouchMove);
                window.removeEventListener('touchend', onTouchEnd);
                R.dispose();
            };
        })().then(fn => { if (fn) fn(); });

        return () => { dead = true; cancelAnimationFrame(rafRef.current); };
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
                zIndex: -1,          /* BEHIND all page content */
                pointerEvents: 'none',      /* canvas itself never captures events */
                display: 'block',
            }}
            aria-hidden
        />
    );
}
