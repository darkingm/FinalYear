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

const TEX_DAY = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg';
const TEX_NIGHT = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-night.jpg';

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
        ambientColor: 0x244066, ambientIntens: 2.5,   // blue-white fill — reveals landmasses
        sunColor: 0xfff5e0, sunIntens: 4.5,         // warm bright sun
        sunPos: [4, 1.5, 2] as [number, number, number],
        starOpacity: 1.0,
        nightOpacity: 0.7,
    },
    light: {
        clearColor: 0xbddff5,
        ambientColor: 0xd0e8f8, ambientIntens: 3.5,   // very bright sky fill
        sunColor: 0xffffff, sunIntens: 6.0,         // full daytime sun
        sunPos: [3, 2, 2] as [number, number, number],
        starOpacity: 0.05,
        nightOpacity: 0.0,
    },
} as const;

export function GlobeBackground() {
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
            const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
            R.setPixelRatio(dpr);
            R.setSize(W(), H());

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(55, W() / H(), 1, 8000);
            camera.position.z = 680;

            const ambientLight = new THREE.AmbientLight(0x244066, 2.5);
            scene.add(ambientLight);
            const sun = new THREE.DirectionalLight(0xfff5e0, 4.5);
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

            /* Atmosphere glow */
            scene.add(new THREE.Mesh(
                new THREE.SphereGeometry(er * 1.07, 64, 64),
                new THREE.ShaderMaterial({
                    vertexShader: `varying float v; void main() {
            vec3 n=normalize(normalMatrix*normal);
            vec3 e=normalize(-vec3(modelViewMatrix*vec4(position,1)));
            v=pow(0.72-dot(n,e),4.0);
            gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1);}`,
                    fragmentShader: `varying float v; void main(){gl_FragColor=vec4(0.2,0.55,1.0,1.0)*v*0.85;}`,
                    side: THREE.FrontSide, blending: THREE.AdditiveBlending, transparent: true,
                })
            ));

            /* ── Stars: SCREEN-SPACE placement (fills entire viewport) ──── */
            // Each star placed at a random NDC position and pushed to a random depth.
            // This guarantees uniform coverage across the whole screen.
            const BASE_MIN = 1.5 * dpr, BASE_MAX = 4 * dpr, MAX_GLOW = 22 * dpr;

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

                // Color: cool white/blue, rare warm
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
            const applyTheme = (t: 'dark' | 'light') => {
                const p = PRESETS[t];
                R.setClearColor(p.clearColor, 1);
                ambientLight.color.setHex(p.ambientColor);
                ambientLight.intensity = p.ambientIntens;
                sun.color.setHex(p.sunColor);
                sun.intensity = p.sunIntens;
                sun.position.set(...p.sunPos).normalize();
                starMat.uniforms.uOpacity.value = p.starOpacity;
                earthMat.needsUpdate = true;
                if (nightMesh) (nightMesh.material as THREE.MeshLambertMaterial).opacity = p.nightOpacity;
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

            window.addEventListener('mousedown', onDown);
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);

            /* ── Tick ────────────────────────────────────────────────────── */
            const tick = () => {
                if (dead) return;
                rafRef.current = requestAnimationFrame(tick);
                if (!dragging) {
                    earth.rotation.y += AUTO_ROT;
                    const ns = (earth as any).__ns;
                    if (ns) ns.rotation.y = earth.rotation.y;
                }
                // Star hover glow — check pre-baked screen positions
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

            /* ── Dispose ─────────────────────────────────────────────────── */
            (canvas as any).__dispose = () => {
                dead = true;
                cancelAnimationFrame(rafRef.current);
                obs.disconnect();
                window.removeEventListener('resize', onResize);
                window.removeEventListener('mousedown', onDown);
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                R.dispose();
            };
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
                position: 'fixed', inset: 0, width: '100vw', height: '100vh',
                zIndex: -1, pointerEvents: 'none', display: 'block'
            }}
            aria-hidden
        />
    );
}
