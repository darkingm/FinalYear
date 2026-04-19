'use client';

import { useEffect, useRef } from 'react';
import { getLightSpaceGridConfig } from '@/components/ui/light-space-grid-config';
import { createLightSpaceGridMaterial } from '@/components/ui/light-space-grid-material';
import { getLightSpaceAnchorConfig } from '@/components/ui/light-space-anchor-config';
import { getLightSpaceLensConfig } from '@/components/ui/light-space-lens-config';
import { createLightSpaceLensMaterial } from '@/components/ui/light-space-lens-material';

type LightSpaceGridSceneProps = {
  dataWarpMode?: string;
};

export function LightSpaceGridScene({ dataWarpMode = 'cursor-webgl-space-grid' }: LightSpaceGridSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const config = getLightSpaceGridConfig();
    const anchorConfig = getLightSpaceAnchorConfig();
    const lensConfig = getLightSpaceLensConfig();
    const reduceMotion =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
    const initialGl =
      canvas.getContext('webgl2', { antialias: true, alpha: true })
      || canvas.getContext('webgl', { antialias: true, alpha: true })
      || canvas.getContext('experimental-webgl');

    if (!initialGl) {
      return;
    }

    let disposed = false;
    let frameId = 0;

    const targetUv = { x: 0.5, y: 0.32 };
    const currentUv = { x: 0.5, y: 0.32 };
    let targetStrength = 0;
    let currentStrength = 0;

    import('three').then((THREE) => {
      if (disposed) {
        return;
      }

      const renderer = new THREE.WebGLRenderer({
        canvas,
        context: initialGl as WebGLRenderingContext,
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, config.maxDpr));
      renderer.setClearColor(0xffffff, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
      camera.position.set(0, 4.9, 8.8);

      const gridMaterial = createLightSpaceGridMaterial(THREE);
      const uniforms = gridMaterial.uniforms as {
        uCursor: { value: import('three').Vector2 };
        uStrength: { value: number };
        uAnchorUv: { value: import('three').Vector2 };
        uAnchorRadius: { value: number };
        uAnchorStrength: { value: number };
      };
      const baseStrength = reduceMotion ? config.displacementStrength * 0.4 : config.displacementStrength;
      uniforms.uStrength.value = 0;
      uniforms.uAnchorUv.value.set(...anchorConfig.uv);
      uniforms.uAnchorRadius.value = anchorConfig.radius;
      uniforms.uAnchorStrength.value = reduceMotion ? anchorConfig.strength * 0.7 : anchorConfig.strength;

      const gridGeometry = new THREE.PlaneGeometry(
        config.gridWidth,
        config.gridHeight,
        config.gridSegmentsX,
        config.gridSegmentsY,
      );
      const gridPlane = new THREE.Mesh(gridGeometry, gridMaterial);
      gridPlane.rotation.x = -Math.PI / 2;
      gridPlane.position.set(0, -1.75, -3.4);
      scene.add(gridPlane);

      const lensMaterial = createLightSpaceLensMaterial(THREE);
      const lensGeometry = new THREE.PlaneGeometry(
        lensConfig.width,
        lensConfig.height,
        lensConfig.segmentsX,
        lensConfig.segmentsY,
      );
      const lensSheet = new THREE.Mesh(lensGeometry, lensMaterial);
      lensSheet.rotation.x = lensConfig.rotationX;
      lensSheet.position.set(0, lensConfig.positionY, lensConfig.positionZ);
      scene.add(lensSheet);

      camera.lookAt(0, -1.25, -3.8);

      const raycaster = new THREE.Raycaster();
      const pointerNdc = new THREE.Vector2(99, 99);

      const render = () => {
        renderer.render(scene, camera);
      };

      const resize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, config.maxDpr));
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(height, 1);
        camera.updateProjectionMatrix();
        render();
      };

      const resolvePointerUv = () => {
        raycaster.setFromCamera(pointerNdc, camera);
        const intersections = raycaster.intersectObject(gridPlane, false);
        const hit = intersections[0];

        if (hit?.uv) {
          targetUv.x = hit.uv.x;
          targetUv.y = hit.uv.y;
          targetStrength = baseStrength;
          return;
        }

        targetStrength = 0;
      };

      const schedule = () => {
        if (frameId !== 0 || disposed) {
          return;
        }

        frameId = window.requestAnimationFrame(tick);
      };

      const tick = () => {
        if (disposed) {
          return;
        }

        frameId = 0;

        currentUv.x += (targetUv.x - currentUv.x) * config.cursorEase;
        currentUv.y += (targetUv.y - currentUv.y) * config.cursorEase;
        currentStrength += (targetStrength - currentStrength) * config.cursorEase;

        uniforms.uCursor.value.set(currentUv.x, currentUv.y);
        uniforms.uStrength.value = currentStrength;
        render();

        const delta = Math.hypot(targetUv.x - currentUv.x, targetUv.y - currentUv.y);
        const strengthDelta = Math.abs(targetStrength - currentStrength);
        if (delta > config.idleDistanceThreshold || strengthDelta > 0.002) {
          schedule();
        }
      };

      const onMove = (event: MouseEvent) => {
        pointerNdc.set(
          (event.clientX / window.innerWidth) * 2 - 1,
          -(event.clientY / window.innerHeight) * 2 + 1,
        );
        resolvePointerUv();
        schedule();
      };

      const onLeave = () => {
        targetStrength = 0;
        schedule();
      };

      resize();
      window.addEventListener('resize', resize);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseleave', onLeave);

      return () => {
        disposed = true;
        if (frameId !== 0) {
          window.cancelAnimationFrame(frameId);
        }
        window.removeEventListener('resize', resize);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseleave', onLeave);
        lensGeometry.dispose();
        lensMaterial.dispose();
        gridGeometry.dispose();
        gridMaterial.dispose();
        renderer.dispose();
      };
    }).then((cleanup) => {
      if (disposed) {
        cleanup?.();
      }
      (canvas as HTMLCanvasElement & { __spaceGridCleanup?: () => void }).__spaceGridCleanup = cleanup ?? undefined;
    }).catch(() => {
      // Fail closed to the static background styling on the canvas element.
    });

    return () => {
      disposed = true;
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      (canvas as HTMLCanvasElement & { __spaceGridCleanup?: () => void }).__spaceGridCleanup?.();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-warp-mode={dataWarpMode}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -2,
        pointerEvents: 'none',
        display: 'block',
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
      }}
    />
  );
}
