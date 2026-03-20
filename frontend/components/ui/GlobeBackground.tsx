'use client';

/**
 * GlobeBackground — 3D Earth background
 *
 * Features:
 * - Realistic rotating 3D Earth using Three.js WebGL
 * - Fixed to viewport (follows scroll — stays in view always)
 * - Auto-rotates on its own axis (realistic tilt ~23.5°)
 * - Stars burst near cursor when mouse moves (Star particles spawn in radius ~120px)
 * - Stars in the background (static star field)
 * - Only visible in DARK mode
 * - Transparent / no fill background — only the globe + stars render
 *
 * Earth texture: NASA Blue Marble (public domain)
 * via raw.githubusercontent.com / jsDelivr CDN
 */

import { useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';

/* ── Star burst particle interface ───────────────────────────────────────── */
interface StarBurst {
    x: number;  // screen x
    y: number;  // screen y
    vx: number;
    vy: number;
    life: number;    // 0→1
    decay: number;
    size: number;
    brightness: number;
}

/* ── Constants ───────────────────────────────────────────────────────────── */
const EARTH_TEXTURE_URL =
    'https://raw.githubusercontent.com/turban/webgl-earth/master/images/2_no_clouds_4k.jpg';
const EARTH_TEXTURE_FALLBACK =
    'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg';
const CLOUDS_TEXTURE_URL =
    'https://raw.githubusercontent.com/turban/webgl-earth/master/images/fair_clouds_4k.png';
const SPECULAR_TEXTURE_URL =
    'https://raw.githubusercontent.com/turban/webgl-earth/master/images/water_4k.png';

const EARTH_RADIUS = 180;          // px-equivalent in scene units
const EARTH_TILT_RAD = 23.5 * Math.PI / 180;
const ROTATION_SPEED = 0.0015;    // rad/frame — slow realistic rotation
const STAR_BURST_PER_MOVE = 5;    // stars spawned per mouse move
const STAR_BURST_RADIUS = 100;    // px radius around cursor to spawn stars
const MAX_STAR_BURSTS = 120;

export function GlobeBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    // Three.js scene refs (stored to avoid re-init)
    const sceneRef = useRef<any>(null);
    const rendererRef = useRef<any>(null);
    const earthRef = useRef<any>(null);
    const cloudsRef = useRef<any>(null);
    const rafRef = useRef<number>(0);

    // Star burst overlay refs
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const starBurstsRef = useRef<StarBurst[]>([]);
    const overlayRafRef = useRef<number>(0);

    /* ── Load Earth texture with fallback ──────────────────────────────────── */
    const loadTexture = useCallback(async (THREE: any, url: string, fallback?: string): Promise<any> => {
        return new Promise((resolve) => {
            const loader = new THREE.TextureLoader();
            loader.load(
                url,
                (tex: any) => resolve(tex),
                undefined,
                () => {
                    if (fallback) {
                        loader.load(fallback, (tex: any) => resolve(tex), undefined, () => resolve(null));
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    }, []);

    /* ── Initialize Three.js scene ─────────────────────────────────────────── */
    const initScene = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas || sceneRef.current) return;

        const THREE = await import('three');

        /* Renderer */
        const renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,           // transparent background
            antialias: true,
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 0);
        rendererRef.current = renderer;

        /* Scene */
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        /* Camera */
        const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 5000);
        // Position Earth bottom-right of viewport
        camera.position.set(0, 0, 600);
        camera.lookAt(0, 0, 0);

        /* Star field (static background) */
        const starGeo = new THREE.BufferGeometry();
        const starCount = 6000;
        const starPositions = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
            starPositions[i * 3 + 0] = (Math.random() - 0.5) * 4000;
            starPositions[i * 3 + 1] = (Math.random() - 0.5) * 4000;
            starPositions[i * 3 + 2] = (Math.random() - 0.5) * 2000 - 400;
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        const starMat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1.4,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.85,
        });
        scene.add(new THREE.Points(starGeo, starMat));

        /* Ambient + directional light (sun) */
        scene.add(new THREE.AmbientLight(0x222233, 0.8));
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
        sunLight.position.set(5, 3, 5);
        scene.add(sunLight);

        /* Earth sphere */
        const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
        const earthTex = await loadTexture(THREE, EARTH_TEXTURE_URL, EARTH_TEXTURE_FALLBACK);

        const earthMat = new THREE.MeshPhongMaterial({
            map: earthTex ?? undefined,
            color: earthTex ? undefined : new THREE.Color(0x2266aa),
            shininess: 8,
        });

        /* Specular water map for shine */
        const specTex = await loadTexture(THREE, SPECULAR_TEXTURE_URL);
        if (specTex) {
            earthMat.specularMap = specTex;
            earthMat.specular = new THREE.Color(0x334455);
        }

        const earth = new THREE.Mesh(earthGeo, earthMat);
        earth.rotation.z = EARTH_TILT_RAD;   // axial tilt

        // Position globe bottom-right, partially off screen (feels immersive)
        earth.position.set(
            window.innerWidth * 0.28,
            -window.innerHeight * 0.18,
            0
        );
        scene.add(earth);
        earthRef.current = earth;

        /* Clouds layer */
        const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS + 2.5, 64, 64);
        const cloudTex = await loadTexture(THREE, CLOUDS_TEXTURE_URL);
        const cloudMat = new THREE.MeshPhongMaterial({
            map: cloudTex ?? undefined,
            transparent: true,
            opacity: cloudTex ? 0.35 : 0,
        });
        const clouds = new THREE.Mesh(cloudGeo, cloudMat);
        clouds.rotation.z = EARTH_TILT_RAD;
        clouds.position.copy(earth.position);
        scene.add(clouds);
        cloudsRef.current = clouds;

        /* Atmosphere glow */
        const atmGeo = new THREE.SphereGeometry(EARTH_RADIUS + 12, 64, 64);
        const atmMat = new THREE.MeshPhongMaterial({
            color: new THREE.Color(0x3388cc),
            transparent: true,
            opacity: 0.08,
            side: THREE.BackSide,
        });
        const atm = new THREE.Mesh(atmGeo, atmMat);
        atm.position.copy(earth.position);
        scene.add(atm);

        /* Handle resize */
        const onResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            earth.position.set(window.innerWidth * 0.28, -window.innerHeight * 0.18, 0);
            clouds.position.copy(earth.position);
            atm.position.copy(earth.position);
        };
        window.addEventListener('resize', onResize);

        /* Animation loop */
        const tick = () => {
            rafRef.current = requestAnimationFrame(tick);
            earth.rotation.y += ROTATION_SPEED;
            clouds.rotation.y += ROTATION_SPEED * 0.9;
            renderer.render(scene, camera);
        };
        tick();

        return () => {
            cancelAnimationFrame(rafRef.current);
            window.removeEventListener('resize', onResize);
            renderer.dispose();
            sceneRef.current = null;
        };
    }, [loadTexture]);

    /* ── Star burst overlay (2D Canvas on top of Three.js) ─────────────────── */
    const initOverlay = useCallback(() => {
        const overlay = overlayCanvasRef.current;
        if (!overlay) return;

        const resize = () => {
            overlay.width = window.innerWidth;
            overlay.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        const ctx = overlay.getContext('2d')!;

        const drawOverlay = () => {
            overlayRafRef.current = requestAnimationFrame(drawOverlay);
            ctx.clearRect(0, 0, overlay.width, overlay.height);

            const bursts = starBurstsRef.current;
            for (let i = bursts.length - 1; i >= 0; i--) {
                const s = bursts[i];
                s.x += s.vx;
                s.y += s.vy;
                s.vy += 0.04;     // gravity
                s.life -= s.decay;

                if (s.life <= 0) { bursts.splice(i, 1); continue; }

                const alpha = s.life * s.brightness;
                const r = s.size * s.life;

                const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 2);
                grd.addColorStop(0, `rgba(255,255,255,${alpha})`);
                grd.addColorStop(0.3, `rgba(200,220,255,${alpha * 0.7})`);
                grd.addColorStop(1, `rgba(150,180,255,0)`);

                ctx.beginPath();
                ctx.arc(s.x, s.y, r * 2, 0, Math.PI * 2);
                ctx.fillStyle = grd;
                ctx.fill();
            }
        };
        drawOverlay();

        return () => {
            cancelAnimationFrame(overlayRafRef.current);
            window.removeEventListener('resize', resize);
        };
    }, []);

    /* ── Mouse move → spawn star bursts ────────────────────────────────────── */
    const handleMouseMove = useCallback((e: MouseEvent) => {
        const bursts = starBurstsRef.current;
        for (let i = 0; i < STAR_BURST_PER_MOVE; i++) {
            if (bursts.length >= MAX_STAR_BURSTS) bursts.shift();
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * STAR_BURST_RADIUS;
            const speed = 0.3 + Math.random() * 1.8;
            bursts.push({
                x: e.clientX + Math.cos(angle) * dist * 0.3,
                y: e.clientY + Math.sin(angle) * dist * 0.3,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 0.8,
                life: 0.7 + Math.random() * 0.3,
                decay: 0.012 + Math.random() * 0.022,
                size: 0.8 + Math.random() * 2.5,
                brightness: 0.7 + Math.random() * 0.3,
            });
        }
    }, []);

    /* ── Mount / Unmount ────────────────────────────────────────────────────── */
    useEffect(() => {
        if (!isDark) return;

        let cleanupScene: (() => void) | undefined;
        let cleanupOverlay: (() => void) | undefined;

        initScene().then(fn => { cleanupScene = fn; });
        cleanupOverlay = initOverlay() ?? undefined;

        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            cleanupScene?.();
            cleanupOverlay?.();
            cancelAnimationFrame(rafRef.current);
            cancelAnimationFrame(overlayRafRef.current);
            window.removeEventListener('mousemove', handleMouseMove);
            sceneRef.current = null;
        };
    }, [isDark, initScene, initOverlay, handleMouseMove]);

    if (!isDark) return null;

    return (
        <>
            {/* Three.js WebGL — Earth + star field (behind everything) */}
            <canvas
                ref={canvasRef}
                className="fixed inset-0 pointer-events-none"
                style={{ zIndex: 0 }}
                aria-hidden
            />
            {/* 2D Canvas overlay — star bursts near cursor */}
            <canvas
                ref={overlayCanvasRef}
                className="fixed inset-0 pointer-events-none"
                style={{ zIndex: 1 }}
                aria-hidden
            />
        </>
    );
}
