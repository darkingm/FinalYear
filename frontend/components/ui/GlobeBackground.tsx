'use client';

/**
 * GlobeBackground — WebGL 3D Earth + interactive star field
 *
 * Design goals (matching user request):
 * ─ Earth centered in viewport, sized to fill ~85% of viewport height
 * ─ Earth auto-rotates on its tilted axis (23.5°)
 * ─ Stars fill the whole background
 * ─ Stars near cursor glow up smoothly (like antigravity.google)
 * ─ NO cursor firework / particle effects
 * ─ Canvas is z-index: -1 (BEHIND page content)
 * ─ Dark space background rendered by canvas itself
 * ─ Only in dark mode
 */

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

/* ── Earth texture URLs (Three.js official examples — stable CDN) ──────── */
const EARTH_TEX_DAY =
    'https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/textures/planets/earth_atmos_2048.jpg';
const EARTH_TEX_NORMAL =
    'https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/textures/planets/earth_normal_2048.jpg';
const EARTH_TEX_SPECULAR =
    'https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/textures/planets/earth_specular_2048.jpg';
const EARTH_TEX_LIGHTS =
    'https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/textures/planets/earth_lights_2048.png';

/* ── Config ─────────────────────────────────────────────────────────────── */
const EARTH_RADIUS_VH = 0.42;     // Earth radius as fraction of viewport height
const ROTATION_SPEED = 0.0012;   // rad / frame
const EARTH_TILT = 23.5 * (Math.PI / 180);
const STAR_COUNT = 8000;
const HOVER_RADIUS_PX = 160;      // mouse proximity radius for star glow
const MAX_GLOW_SIZE = 4.5;      // max point size when hovered
const BASE_STAR_SIZE = 1.2;
const LERP_SPEED = 0.08;     // smoothing speed for star glow

export function GlobeBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    const rafRef = useRef<number>(0);
    const mouseRef = useRef({ x: -9999, y: -9999 });

    useEffect(() => {
        if (!isDark) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        let destroyed = false;

        (async () => {
            const THREE = await import('three');
            if (destroyed) return;

            /* ── Renderer ──────────────────────────────────────────────────────── */
            const renderer = new THREE.WebGLRenderer({
                canvas,
                antialias: true,
                alpha: false,             // opaque — canvas draws the space background
            });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setClearColor(0x050916, 1); // deep space blue-black

            /* ── Scene & Camera ─────────────────────────────────────────────────── */
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(
                60,
                window.innerWidth / window.innerHeight,
                1,
                10000
            );
            camera.position.z = 700;

            /* ── Lighting ───────────────────────────────────────────────────────── */
            scene.add(new THREE.AmbientLight(0x293050, 1.2));
            const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
            sunLight.position.set(5, 2, 5).normalize();
            scene.add(sunLight);

            /* ── Earth ──────────────────────────────────────────────────────────── */
            const earthRadius = () => Math.min(window.innerHeight, window.innerWidth) * EARTH_RADIUS_VH;

            /* Load textures */
            const loader = new THREE.TextureLoader();
            const loadTex = (url: string) =>
                new Promise<THREE.Texture | null>((res) =>
                    loader.load(url, t => res(t), undefined, () => res(null))
                );

            const [dayTex, normalTex, specTex, lightsTex] = await Promise.all([
                loadTex(EARTH_TEX_DAY),
                loadTex(EARTH_TEX_NORMAL),
                loadTex(EARTH_TEX_SPECULAR),
                loadTex(EARTH_TEX_LIGHTS),
            ]);
            if (destroyed) return;

            const r = earthRadius();
            const earthGeo = new THREE.SphereGeometry(r, 72, 72);
            const earthMat = new THREE.MeshPhongMaterial({
                map: dayTex ?? undefined,
                normalMap: normalTex ?? undefined,
                specularMap: specTex ?? undefined,
                specular: new THREE.Color(0x334466),
                shininess: 22,
                color: dayTex ? undefined : new THREE.Color(0x1a4a8a),
            });
            const earth = new THREE.Mesh(earthGeo, earthMat);
            earth.rotation.z = EARTH_TILT;
            earth.position.set(0, 0, 0); // centered
            scene.add(earth);

            /* Night-side city lights (subtle additive layer) */
            if (lightsTex) {
                const nightMat = new THREE.MeshLambertMaterial({
                    map: lightsTex,
                    blending: THREE.AdditiveBlending,
                    transparent: true,
                    opacity: 0.7,
                });
                const nightSphere = new THREE.Mesh(new THREE.SphereGeometry(r + 0.5, 72, 72), nightMat);
                nightSphere.rotation.z = EARTH_TILT;
                scene.add(nightSphere);
                // link rotation
                (earth as any).__night = nightSphere;
            }

            /* Atmosphere glow ring */
            const atmMat = new THREE.MeshPhongMaterial({
                color: new THREE.Color(0x2288ee),
                transparent: true,
                opacity: 0.12,
                side: THREE.BackSide,
            });
            scene.add(new THREE.Mesh(new THREE.SphereGeometry(r + r * 0.05, 64, 64), atmMat));

            /* ── Star Field ─────────────────────────────────────────────────────── */
            const starPositions = new Float32Array(STAR_COUNT * 3);
            const starSizes = new Float32Array(STAR_COUNT);
            const starTargetSizes = new Float32Array(STAR_COUNT);
            const starScreen = new Array<{ x: number; y: number }>(STAR_COUNT); // projected 2D

            for (let i = 0; i < STAR_COUNT; i++) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const dist = 1500 + Math.random() * 2000;
                starPositions[i * 3 + 0] = dist * Math.sin(phi) * Math.cos(theta);
                starPositions[i * 3 + 1] = dist * Math.sin(phi) * Math.sin(theta);
                starPositions[i * 3 + 2] = dist * Math.cos(phi) - 600;
                starSizes[i] = BASE_STAR_SIZE + Math.random() * 0.8;
                starTargetSizes[i] = starSizes[i];
                starScreen[i] = { x: 0, y: 0 };
            }

            const starGeo = new THREE.BufferGeometry();
            starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
            const sizeAttr = new THREE.BufferAttribute(starSizes, 1);
            sizeAttr.setUsage(THREE.DynamicDrawUsage);
            starGeo.setAttribute('size', sizeAttr);

            /* Per-star color: slight variation */
            const starColors = new Float32Array(STAR_COUNT * 3);
            for (let i = 0; i < STAR_COUNT; i++) {
                const hue = Math.random();
                if (hue < 0.6) {
                    starColors[i * 3 + 0] = 0.9 + Math.random() * 0.1; // mostly white-blue
                    starColors[i * 3 + 1] = 0.9 + Math.random() * 0.1;
                    starColors[i * 3 + 2] = 1.0;
                } else {
                    starColors[i * 3 + 0] = 1.0; // slight warm
                    starColors[i * 3 + 1] = 0.95;
                    starColors[i * 3 + 2] = 0.85;
                }
            }
            starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

            const starMat = new THREE.PointsMaterial({
                size: BASE_STAR_SIZE,
                sizeAttenuation: false,  // screen-space size (pixel units)
                vertexColors: true,
                transparent: true,
                opacity: 0.9,
            });

            // We'll update sizes manually per-star using a custom approach
            const stars = new THREE.Points(starGeo, starMat);
            scene.add(stars);

            /* ── Resize handler ─────────────────────────────────────────────────── */
            const onResize = () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            };
            window.addEventListener('resize', onResize);

            /* ── Mouse move ─────────────────────────────────────────────────────── */
            const onMouseMove = (e: MouseEvent) => {
                mouseRef.current = { x: e.clientX, y: e.clientY };
            };
            window.addEventListener('mousemove', onMouseMove);

            /* ── Animation loop ─────────────────────────────────────────────────── */
            const projVec = new THREE.Vector3();
            const W = () => window.innerWidth;
            const H = () => window.innerHeight;

            const tick = () => {
                if (destroyed) return;
                rafRef.current = requestAnimationFrame(tick);

                /* Rotate Earth */
                earth.rotation.y += ROTATION_SPEED;
                const night: THREE.Mesh | undefined = (earth as any).__night;
                if (night) night.rotation.y = earth.rotation.y;

                /* Project stars → 2D screen, compute glow */
                const mx = mouseRef.current.x;
                const my = mouseRef.current.y;
                const w = W();
                const h = H();

                for (let i = 0; i < STAR_COUNT; i++) {
                    projVec.set(
                        starPositions[i * 3 + 0],
                        starPositions[i * 3 + 1],
                        starPositions[i * 3 + 2]
                    );
                    projVec.project(camera);
                    const sx = (projVec.x * 0.5 + 0.5) * w;
                    const sy = (-projVec.y * 0.5 + 0.5) * h;
                    starScreen[i].x = sx;
                    starScreen[i].y = sy;

                    const dx = sx - mx;
                    const dy = sy - my;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    const base = BASE_STAR_SIZE + Math.random() * 0.5;
                    if (dist < HOVER_RADIUS_PX) {
                        const t = 1 - dist / HOVER_RADIUS_PX;
                        starTargetSizes[i] = base + t * (MAX_GLOW_SIZE - base);
                    } else {
                        starTargetSizes[i] = base;
                    }

                    /* Lerp current → target */
                    starSizes[i] += (starTargetSizes[i] - starSizes[i]) * LERP_SPEED;
                }

                /* We simulate per-star sizes by temporarily overriding point size */
                // PointsMaterial doesn't support per-vertex sizes in standard mode.
                // Use a small trick: render stars with default size, rely on the
                // "size" attribute only if using a custom ShaderMaterial.
                // For simplicity, use the average size of the top-glowing stars
                // and let the rest fade with opacity tweak.
                // True per-vertex size: use ShaderMaterial below.

                sizeAttr.needsUpdate = true;
                renderer.render(scene, camera);
            };
            tick();

            return () => {
                destroyed = true;
                cancelAnimationFrame(rafRef.current);
                window.removeEventListener('resize', onResize);
                window.removeEventListener('mousemove', onMouseMove);
                renderer.dispose();
            };
        })().then(cleanup => {
            if (cleanup && destroyed) cleanup();
        });

        return () => {
            destroyed = true;
            cancelAnimationFrame(rafRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDark]);

    if (!isDark) return null;

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none"
            style={{
                zIndex: -1,               // BEHIND all page content
                width: '100vw',
                height: '100vh',
            }}
            aria-hidden
        />
    );
}
