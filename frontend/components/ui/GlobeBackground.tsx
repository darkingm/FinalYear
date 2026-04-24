'use client';

/**
 * GlobeBackground — 3D Earth + full-screen star field for both themes
 *
 * KEY FIXES:
 * - Stars placed using screen-space NDC → all stars uniformly fill viewport
 * - Opacity uniform in GLSL (not .opacity property which doesn't work on ShaderMaterial)
 * - Light mode: Earth texture + brighter lighting (2.8x sun) + sky blue bg
 * - Dark mode: deep space + warm dim lighting + bright white stars
 */
import { useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { LightWarpBackground } from '@/components/ui/LightWarpBackground';
import { useDesktopLightMode } from '@/lib/hooks/useDesktopLightMode';

const TEX_DAY   = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg';
const TEX_NIGHT = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-night.jpg';
const TEX_TOPO   = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-topology.png';

/* ── GLSL — opacity is a uniform so we can toggle in light/dark ────────────── */
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
  uniform float uOpacity;
  varying vec3  vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float a = pow(1.0 - d, 2.0) * uOpacity;
    gl_FragColor = vec4(vColor, a);
  }`;

/* ── Config ────────────────────────────────────────────────────────────────── */
const STAR_N = 2500;   // sparse star field — more visible on hover
const HOVER_R = 180;
const AUTO_ROT = 0.0009;
const DRAG_SENS = 0.007;
const DRAG_THRESH = 8;
const LERP = 0.08;
const TILT = 23.5 * Math.PI / 180;

const PRESETS = {
    dark: {
        clearColor: 0x050914,
        ambientColor: 0x3366aa, ambientIntens: 1.75,
        sunColor: 0xfff5e0, sunIntens: 3.5,
        sunPos: [4, 1.5, 2] as [number, number, number],
        starOpacity: 1.0,
        nightOpacity: 0.7,
    },
    light: {
        clearColor: 0xffffff,
        ambientColor: 0xffffff, ambientIntens: 2.5,
        sunColor: 0xfff8e7, sunIntens: 6.0,
        sunPos: [3, 2, 3] as [number, number, number],
        starOpacity: 0.0,
        nightOpacity: 0.0,
    },
} as const;

export function GlobeBackground() {
    const useLightWarp = useDesktopLightMode();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = Math.min(window.devicePixelRatio, 2);
        let dead = false, dragging = false, didDrag = false;
        let startX = 0, startY = 0, lastX = 0, lastY = 0;
        let mouseX = -9999, mouseY = -9999;

        const getTheme = (): 'dark' | 'light' =>
            document.documentElement.classList.contains('dark') ? 'dark' : 'light';

        import('three').then(THREE => {
            if (dead) return;
            const W = () => window.innerWidth;
            const H = () => window.innerHeight;

            /* ── Renderer ────────────────────────────────────────────────── */
            const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
            R.setPixelRatio(dpr);
            R.setSize(W(), H());

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(55, W() / H(), 1, 8000);
            camera.position.z = 680;

            const ambientLight = new THREE.AmbientLight(0x3366aa, 1.75);
            scene.add(ambientLight);
            const sun = new THREE.DirectionalLight(0xfff5e0, 3.5);
            sun.position.set(4, 1.5, 2).normalize();
            scene.add(sun);

            /* ── Earth ───────────────────────────────────────────────────── */
            const er = Math.min(W(), H()) * 0.42;
            const earthMat = new THREE.MeshPhongMaterial({ color: 0x1a4477, shininess: 25 });
            const earth = new THREE.Mesh(new THREE.SphereGeometry(er, 72, 72), earthMat);
            earth.rotation.z = TILT;
            scene.add(earth);

            /* Textures (non-blocking) */
            const loader = new THREE.TextureLoader();
            loader.load(TEX_DAY, t => { earthMat.map = t; earthMat.needsUpdate = true; });

            let nightMesh: THREE.Mesh | null = null;
            loader.load(TEX_NIGHT, t => {
                if (dead) return;
                nightMesh = new THREE.Mesh(
                    new THREE.SphereGeometry(er + 1, 72, 72),
                    new THREE.MeshLambertMaterial({
                        map: t, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.85,
                    })
                );
                nightMesh.rotation.z = TILT;
                scene.add(nightMesh);
                (earth as any).__ns = nightMesh;
            });

            /* Atmosphere glow (dark mode — blue) */
            const atmosMat = new THREE.ShaderMaterial({
                vertexShader: `varying float v; void main() {
            vec3 n=normalize(normalMatrix*normal);
            vec3 e=normalize(-vec3(modelViewMatrix*vec4(position,1)));
            v=pow(0.72-dot(n,e),4.0);
            gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1);}`,
                fragmentShader: `uniform vec3 uGlowColor; varying float v; void main(){gl_FragColor=vec4(uGlowColor,1.0)*v*0.85;}`,
                uniforms: { uGlowColor: { value: new THREE.Vector3(0.2, 0.55, 1.0) } },
                side: THREE.FrontSide, blending: THREE.AdditiveBlending, transparent: true,
            });
            scene.add(new THREE.Mesh(new THREE.SphereGeometry(er * 1.07, 64, 64), atmosMat));

            /* ═══════════════════════════════════════════════════════════════
               CLOUD LAYER (light mode — realistic daytime Earth)
               ═══════════════════════════════════════════════════════════════ */
            const cloudMat = new THREE.MeshPhongMaterial({
                transparent: true, opacity: 0.55, depthWrite: false,
                side: THREE.DoubleSide,
                color: 0xffffff,
            });
            const createCloudTexture = () => {
                const cloudCanvas = document.createElement('canvas');
                cloudCanvas.width = 1024;
                cloudCanvas.height = 512;
                const ctx = cloudCanvas.getContext('2d');
                if (!ctx) return null;

                ctx.clearRect(0, 0, cloudCanvas.width, cloudCanvas.height);
                ctx.filter = 'blur(14px)';
                for (let i = 0; i < 260; i++) {
                    const x = Math.random() * cloudCanvas.width;
                    const y = Math.random() * cloudCanvas.height;
                    const rx = 18 + Math.random() * 85;
                    const ry = 6 + Math.random() * 28;
                    const alpha = 0.08 + Math.random() * 0.24;
                    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
                    ctx.beginPath();
                    ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.filter = 'none';

                const texture = new THREE.CanvasTexture(cloudCanvas);
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                texture.needsUpdate = true;
                return texture;
            };
            cloudMat.map = createCloudTexture();
            const cloudMesh = new THREE.Mesh(
                new THREE.SphereGeometry(er * 1.025, 72, 72), cloudMat,
            );
            cloudMesh.rotation.z = TILT;
            cloudMesh.visible = false;
            scene.add(cloudMesh);

            // Load bump texture (non-blocking). Clouds are generated locally to avoid
            // depending on a CDN asset that currently returns 404.
            loader.load(TEX_TOPO, t => {
                if (dead) return;
                earthMat.bumpMap = t;
                earthMat.bumpScale = 8;
                earthMat.needsUpdate = true;
            });

            /* ── Stars: SCREEN-SPACE placement (fills entire viewport) ──── */
            // Each star placed at a random NDC position and pushed to a random depth.
            // This guarantees uniform coverage across the whole screen.
            const BASE_MIN = 2.5 * dpr, BASE_MAX = 7 * dpr, MAX_GLOW = 26 * dpr;

            const pos = new Float32Array(STAR_N * 3);
            const col = new Float32Array(STAR_N * 3);
            const sz = new Float32Array(STAR_N);
            const base = new Float32Array(STAR_N);
            const tgt = new Float32Array(STAR_N);
            // Stars are static in screen-space, so scrX/Y = their randomized screen pos
            const scrX = new Float32Array(STAR_N);
            const scrY = new Float32Array(STAR_N);

            const right = new THREE.Vector3();
            const upV = new THREE.Vector3();
            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            right.crossVectors(forward, camera.up).normalize();
            upV.crossVectors(right, forward).normalize();

            const fovY = camera.fov * Math.PI / 180;
            const fovX = 2 * Math.atan(Math.tan(fovY / 2) * (W() / H()));

            for (let i = 0; i < STAR_N; i++) {
                // Random position in NDC space (extend ±1.3 to fill past viewport edges)
                const ndcX = (Math.random() * 2.6 - 1.3);
                const ndcY = (Math.random() * 2.6 - 1.3);
                const depth = 1200 + Math.random() * 2800;

                // Convert NDC → world direction, then place star at depth
                const angleX = ndcX * Math.tan(fovX / 2);
                const angleY = ndcY * Math.tan(fovY / 2);
                const dir = new THREE.Vector3(
                    forward.x + right.x * angleX + upV.x * angleY,
                    forward.y + right.y * angleX + upV.y * angleY,
                    forward.z + right.z * angleX + upV.z * angleY,
                ).normalize();

                pos[i * 3] = camera.position.x + dir.x * depth;
                pos[i * 3 + 1] = camera.position.y + dir.y * depth;
                pos[i * 3 + 2] = camera.position.z + dir.z * depth;

                // Screen position IS the NDC we chose (clamped to actual viewport)
                scrX[i] = Math.max(0, Math.min(W() - 1, (ndcX * 0.5 + 0.5) * W()));
                scrY[i] = Math.max(0, Math.min(H() - 1, (-ndcY * 0.5 + 0.5) * H()));

                const b = BASE_MIN + Math.random() * (BASE_MAX - BASE_MIN);
                base[i] = sz[i] = tgt[i] = b;

                // Dark mode: cool white/blue, rare warm
                // Light mode: rainbow HSL — will be set in applyTheme
                const warm = Math.random() < 0.15;
                col[i * 3] = warm ? 1.00 : 0.88 + Math.random() * 0.12;
                col[i * 3 + 1] = warm ? 0.82 : 0.92 + Math.random() * 0.08;
                col[i * 3 + 2] = warm ? 0.55 : 1.00;
            }

            const geo = new THREE.BufferGeometry();
            const szA = new THREE.BufferAttribute(sz, 1);
            szA.setUsage(THREE.DynamicDrawUsage);
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
            geo.setAttribute('size', szA);

            const starMat = new THREE.ShaderMaterial({
                vertexShader: VERT, fragmentShader: FRAG,
                uniforms: { uOpacity: { value: 1.0 } },
                transparent: true, depthWrite: false,
            });
            scene.add(new THREE.Points(geo, starMat));

            /* ── Apply theme ─────────────────────────────────────────────── */
            const colA = new THREE.BufferAttribute(col, 3);
            colA.setUsage(THREE.DynamicDrawUsage);
            geo.setAttribute('aColor', colA);

            // Pre-bake natural white/silver star colors for light mode particles
            const lightStarCol = new Float32Array(STAR_N * 3);
            for (let i = 0; i < STAR_N; i++) {
                const r2 = Math.random();
                if (r2 < 0.60) {
                    // Pure bright white (majority)
                    const v = 0.92 + Math.random() * 0.08;
                    lightStarCol[i * 3] = v;
                    lightStarCol[i * 3 + 1] = v;
                    lightStarCol[i * 3 + 2] = v;
                } else if (r2 < 0.85) {
                    // Cool silver-blue
                    lightStarCol[i * 3]     = 0.82 + Math.random() * 0.10;
                    lightStarCol[i * 3 + 1] = 0.88 + Math.random() * 0.08;
                    lightStarCol[i * 3 + 2] = 0.95 + Math.random() * 0.05;
                } else {
                    // Warm pale gold
                    lightStarCol[i * 3]     = 0.95 + Math.random() * 0.05;
                    lightStarCol[i * 3 + 1] = 0.90 + Math.random() * 0.06;
                    lightStarCol[i * 3 + 2] = 0.78 + Math.random() * 0.10;
                }
            }

            let currentTheme: 'dark' | 'light' = getTheme();
            let tickTime = 0;

            const applyTheme = (t: 'dark' | 'light') => {
                currentTheme = t;
                const p = PRESETS[t];
                R.setClearColor(p.clearColor, t === 'light' ? 0 : 1);
                ambientLight.color.setHex(p.ambientColor);
                ambientLight.intensity = p.ambientIntens;
                sun.color.setHex(p.sunColor);
                sun.intensity = p.sunIntens;
                sun.position.set(...p.sunPos).normalize();
                starMat.uniforms.uOpacity.value = p.starOpacity;
                earthMat.needsUpdate = true;
                if (nightMesh) (nightMesh.material as THREE.MeshLambertMaterial).opacity = p.nightOpacity;
                // Star colors: natural white/silver in both modes
                const src = t === 'light' ? lightStarCol : col;
                for (let i = 0; i < STAR_N * 3; i++) colA.array[i] = src[i];
                colA.needsUpdate = true;
                if (t === 'light') {
                    for (let i = 0; i < STAR_N; i++) { sz[i] = 0; tgt[i] = 0; }
                } else {
                    for (let i = 0; i < STAR_N; i++) { sz[i] = base[i]; tgt[i] = base[i]; }
                }
                szA.needsUpdate = true;

                // ── Light mode: bright earth + clouds ──
                const isLight = t === 'light';
                cloudMesh.visible = isLight;

                // Atmosphere glow: warmer for daytime, cool blue for dark
                atmosMat.uniforms.uGlowColor.value.set(
                    isLight ? 0.3  : 0.2,
                    isLight ? 0.6  : 0.55,
                    1.0,
                );

                if (isLight) {
                    // Vivid bright earth — daytime satellite view
                    earthMat.transparent = false;
                    earthMat.opacity = 1.0;
                    earthMat.color.setHex(0xffffff);  // let texture colors shine through
                    earthMat.shininess = 40;           // specular highlights on oceans
                    earthMat.specular = new THREE.Color(0x555555);
                    if (nightMesh) nightMesh.visible = false;
                } else {
                    // Normal dark mode earth
                    earthMat.transparent = false;
                    earthMat.opacity = 1.0;
                    earthMat.color.setHex(0x1a4477);
                    earthMat.shininess = 25;
                    earthMat.specular = new THREE.Color(0x111111);
                    if (nightMesh) nightMesh.visible = true;
                }
                earthMat.needsUpdate = true;
            };
            applyTheme(getTheme());

            const obs = new MutationObserver(() => applyTheme(getTheme()));
            obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

            /* ── Resize ──────────────────────────────────────────────────── */
            const onResize = () => {
                camera.aspect = W() / H();
                camera.updateProjectionMatrix();
                R.setSize(W(), H());
                // Stars in screen-space don't need re-projection (their scrX/Y is pre-baked)
            };
            window.addEventListener('resize', onResize);

            /* ── Mouse/drag ─────────────────────────────────────────────── */
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
            const onLeaveWindow = () => {
                mouseX = -9999;
                mouseY = -9999;
            };

            /* ── Touch events (mobile) ───────────────────────────────────── */
            const onTouchStart = (e: TouchEvent) => {
                const t = e.touches[0];
                dragging = true; didDrag = false;
                startX = lastX = t.clientX; startY = lastY = t.clientY;
            };
            const onTouchMove = (e: TouchEvent) => {
                if (!dragging || e.touches.length !== 1) return;
                const t = e.touches[0];
                mouseX = t.clientX; mouseY = t.clientY;
                if (didDrag || Math.hypot(t.clientX - startX, t.clientY - startY) > DRAG_THRESH) {
                    didDrag = true;
                    e.preventDefault(); // prevent page scroll while rotating globe
                    const dx = t.clientX - lastX, dy = t.clientY - lastY;
                    earth.rotation.y += dx * DRAG_SENS;
                    earth.rotation.x = Math.max(-1, Math.min(1, earth.rotation.x + dy * DRAG_SENS * 0.5));
                    const ns = (earth as any).__ns;
                    if (ns) { ns.rotation.y = earth.rotation.y; ns.rotation.x = earth.rotation.x; }
                }
                lastX = t.clientX; lastY = t.clientY;
            };
            const onTouchEnd = () => { dragging = false; };

            window.addEventListener('mousedown', onDown);
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
            window.addEventListener('mouseleave', onLeaveWindow);
            canvas.addEventListener('touchstart', onTouchStart, { passive: true });
            canvas.addEventListener('touchmove', onTouchMove, { passive: false });
            canvas.addEventListener('touchend', onTouchEnd, { passive: true });

            /* ── Tick ────────────────────────────────────────────────────── */
            const tick = () => {
                if (dead) return;
                rafRef.current = requestAnimationFrame(tick);
                if (!dragging) {
                    earth.rotation.y += AUTO_ROT;
                    const ns = (earth as any).__ns;
                    if (ns) ns.rotation.y = earth.rotation.y;
                }

                // ── Cloud layer rotation (light mode) ──
                if (cloudMesh.visible) {
                    cloudMesh.rotation.y = earth.rotation.y * 0.4 + 0.0003;
                    cloudMesh.rotation.x = earth.rotation.x;
                }

                // ── Star / Particle rendering ──
                tickTime += 0.016;
                if (currentTheme === 'light') {
                    for (let i = 0; i < STAR_N; i++) {
                        tgt[i] = 0;
                        sz[i] += (tgt[i] - sz[i]) * 0.14;
                    }
                } else {
                    // DARK MODE: standard star hover glow
                    for (let i = 0; i < STAR_N; i++) {
                        const dist = Math.hypot(scrX[i] - mouseX, scrY[i] - mouseY);
                        tgt[i] = dist < HOVER_R
                            ? base[i] + (1 - dist / HOVER_R) ** 2 * (MAX_GLOW - base[i])
                            : base[i];
                        sz[i] += (tgt[i] - sz[i]) * LERP;
                    }
                }
                szA.needsUpdate = true;
                R.setRenderTarget(null);
                R.render(scene, camera);
            };
            tick();

            /* ── Dispose ─────────────────────────────────────────────────── */
            (canvas as any).__dispose = () => {
                dead = true;
                cancelAnimationFrame(rafRef.current);
                obs.disconnect();
                window.removeEventListener('resize', onResize);
                window.removeEventListener('mousedown', onDown);
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                window.removeEventListener('mouseleave', onLeaveWindow);
                canvas.removeEventListener('touchstart', onTouchStart);
                canvas.removeEventListener('touchmove', onTouchMove);
                canvas.removeEventListener('touchend', onTouchEnd);
                R.dispose();
            };
        });

        return () => {
            dead = true;
            cancelAnimationFrame(rafRef.current);
            ((canvas as any).__dispose as (() => void) | undefined)?.();
        };
    }, [useLightWarp]);

    return (
        <>
            <canvas
                ref={canvasRef}
                style={{
                    position: 'fixed', inset: 0, width: '100vw', height: '100vh',
                    zIndex: -1, pointerEvents: 'auto', display: 'block',
                    touchAction: 'none',
                }}
                data-globe-background="true"
                aria-hidden
            />
            {useLightWarp ? <LightWarpBackground /> : null}
        </>
    );
}
