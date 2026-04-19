# Light Mode WebGL Space Grid Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current light-mode 2D canvas distortion with a lightweight WebGL perspective space-grid scene that feels scientific, clean, and responsive.

**Architecture:** Reuse the existing `three` foundation already present in [GlobeBackground.tsx](C:/Users/Asus/Documents/FYP/FYP/frontend/components/ui/GlobeBackground.tsx) and keep [LightWarpBackground.tsx](C:/Users/Asus/Documents/FYP/FYP/frontend/components/ui/LightWarpBackground.tsx) as the public light-mode entry point. Move the grid into a focused WebGL scene component with a small config module and a local displacement material so the cursor-driven gravity well runs on the GPU instead of canvas path math on the main thread.

**Tech Stack:** Next.js 16, React 19, TypeScript, `three`, Jest, existing frontend build/lint tooling

---

## File Map

### Files to Create

- `frontend/components/ui/LightSpaceGridScene.tsx`
  - WebGL scene setup, camera, renderer lifecycle, pointer tracking, resize handling, idle render scheduling.
- `frontend/components/ui/light-space-grid-config.ts`
  - Shared constants for DPR cap, horizon ratio, grid dimensions, segment count, displacement radius, and fallback thresholds.
- `frontend/components/ui/light-space-grid-material.ts`
  - Shader/material factory or mesh deformation utilities for the grid plane.
- `frontend/__tests__/light-space-grid-config.test.ts`
  - Config-level regression tests for mode metadata and performance defaults.

### Files to Modify

- `frontend/components/ui/LightWarpBackground.tsx`
  - Replace current canvas implementation with a wrapper that renders the WebGL scene in desktop light mode and preserves the public marker/API surface.
- `frontend/components/ui/GlobeBackground.tsx`
  - Adjust layering/integration so the globe stays stable and the light-mode space grid sits behind content without conflicting with dark mode.
- `frontend/__tests__/light-warp-background.test.tsx`
  - Update the background tests for the WebGL mode marker and config metadata.
- `frontend/package.json`
  - Only if an additional script or dependency adjustment is actually required. Prefer no package changes because `three` is already installed.

### Verification Targets

- `frontend/__tests__/light-warp-background.test.tsx`
- `frontend/__tests__/light-space-grid-config.test.ts`
- `frontend/components/ui/LightWarpBackground.tsx`
- `frontend/components/ui/LightSpaceGridScene.tsx`
- `frontend/components/ui/light-space-grid-config.ts`
- `frontend/components/ui/light-space-grid-material.ts`
- `frontend/components/ui/GlobeBackground.tsx`

---

## Chunk 1: Lock the WebGL Contract in Tests

### Task 1: Update `LightWarpBackground` regression expectations

**Files:**
- Modify: `frontend/__tests__/light-warp-background.test.tsx`
- Test: `frontend/__tests__/light-warp-background.test.tsx`

- [ ] **Step 1: Write the failing test for the new WebGL mode marker**

```tsx
it('renders the light-mode WebGL space grid canvas marker', () => {
  const { container } = render(<LightWarpBackground />);
  const canvas = container.querySelector('canvas');
  expect(canvas?.getAttribute('data-warp-mode')).toBe('cursor-webgl-space-grid');
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --runInBand light-warp-background.test.tsx`
Expected: FAIL because the current implementation still reports the old perspective-canvas mode.

- [ ] **Step 3: Add config assertions for the WebGL path**

```tsx
it('reports the WebGL space-grid configuration', () => {
  const config = getSinkFieldConfig();
  expect(config.renderEngine).toBe('webgl');
  expect(config.gridPerspectiveMode).toBe('plane');
  expect(config.gridUsesStaticCache).toBe(false);
  expect(config.gridWarpRenderMode).toBe('mesh-displacement');
});
```

- [ ] **Step 4: Run the focused test again and verify the new assertions also fail**

Run: `npm test -- --runInBand light-warp-background.test.tsx`
Expected: FAIL because the config metadata does not exist yet.

- [ ] **Step 5: Commit only after the implementation for this chunk is green**

```bash
git add frontend/__tests__/light-warp-background.test.tsx
git commit -m "test: add webgl light background expectations"
```

### Task 2: Add focused tests for the new scene config module

**Files:**
- Create: `frontend/__tests__/light-space-grid-config.test.ts`
- Test: `frontend/__tests__/light-space-grid-config.test.ts`

- [ ] **Step 1: Write the failing config tests first**

```ts
import { getLightSpaceGridConfig } from '@/components/ui/light-space-grid-config';

describe('light-space-grid-config', () => {
  it('caps device pixel ratio for the WebGL scene', () => {
    expect(getLightSpaceGridConfig().maxDpr).toBeLessThanOrEqual(1.75);
  });

  it('uses a lower-half perspective floor layout', () => {
    const config = getLightSpaceGridConfig();
    expect(config.horizonRatio).toBeGreaterThan(0.45);
    expect(config.gridPlaneDepth).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the focused config test to verify it fails**

Run: `npm test -- --runInBand light-space-grid-config.test.ts`
Expected: FAIL because the config module does not exist yet.

- [ ] **Step 3: Do not create production code yet; stop after confirming the RED state**

- [ ] **Step 4: Commit only after the implementation for this chunk is green**

```bash
git add frontend/__tests__/light-space-grid-config.test.ts
git commit -m "test: add webgl grid config coverage"
```

---

## Chunk 2: Build the Reusable WebGL Grid Units

### Task 3: Create the shared config module

**Files:**
- Create: `frontend/components/ui/light-space-grid-config.ts`
- Test: `frontend/__tests__/light-space-grid-config.test.ts`

- [ ] **Step 1: Implement the minimal config module to satisfy the failing config test**

```ts
export function getLightSpaceGridConfig() {
  return {
    mode: 'cursor-webgl-space-grid' as const,
    renderEngine: 'webgl' as const,
    maxDpr: 1.5,
    horizonRatio: 0.58,
    gridPlaneDepth: 1,
    displacementRadius: 0.24,
    displacementStrength: 0.18,
    gridSegmentsX: 96,
    gridSegmentsY: 64,
  };
}
```

- [ ] **Step 2: Run the focused config test and verify it passes**

Run: `npm test -- --runInBand light-space-grid-config.test.ts`
Expected: PASS

- [ ] **Step 3: Refactor only if needed to keep the config module small and serializable**

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ui/light-space-grid-config.ts frontend/__tests__/light-space-grid-config.test.ts
git commit -m "feat: add light space grid config"
```

### Task 4: Create the grid material/deformation unit

**Files:**
- Create: `frontend/components/ui/light-space-grid-material.ts`
- Modify: `frontend/components/ui/light-space-grid-config.ts`

- [ ] **Step 1: Implement a focused material factory**

```ts
import * as THREE from 'three';
import { getLightSpaceGridConfig } from '@/components/ui/light-space-grid-config';

export function createLightSpaceGridMaterial() {
  const config = getLightSpaceGridConfig();
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uCursor: { value: new THREE.Vector2(999, 999) },
      uRadius: { value: config.displacementRadius },
      uStrength: { value: config.displacementStrength },
      uLineColor: { value: new THREE.Color('#111827') },
      uHorizonGlow: { value: new THREE.Color('#dbeafe') },
    },
    vertexShader: `...`,
    fragmentShader: `...`,
  });
}
```

- [ ] **Step 2: Keep the first pass minimal**

Implementation constraints:
- one plane mesh only
- no postprocessing
- no star layer yet unless the scene looks empty after the first integration

- [ ] **Step 3: Sanity-check the file compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ui/light-space-grid-material.ts frontend/components/ui/light-space-grid-config.ts
git commit -m "feat: add light space grid material"
```

### Task 5: Build the `LightSpaceGridScene` component

**Files:**
- Create: `frontend/components/ui/LightSpaceGridScene.tsx`
- Modify: `frontend/components/ui/light-space-grid-config.ts`
- Modify: `frontend/components/ui/light-space-grid-material.ts`
- Test: `frontend/__tests__/light-warp-background.test.tsx`

- [ ] **Step 1: Mount a minimal Three.js scene using the repo’s existing pattern**

Implementation requirements:
- use `import('three')` lazily, matching the pattern already used in [GlobeBackground.tsx](C:/Users/Asus/Documents/FYP/FYP/frontend/components/ui/GlobeBackground.tsx)
- cap DPR using `getLightSpaceGridConfig()`
- create:
  - one renderer
  - one perspective camera
  - one perspective grid plane mesh
  - optional faint horizon helper/light only if necessary

- [ ] **Step 2: Add pointer tracking and a local gravity-well displacement**

Implementation requirements:
- pointer updates go into shader uniforms
- no continuous pulse animation
- only keep RAF active while cursor state is settling
- if no movement is happening, allow the scene to idle

- [ ] **Step 3: Add defensive fallback handling**

Implementation requirements:
- if WebGL setup fails, render `null` and let the wrapper fall back
- if `prefers-reduced-motion` is enabled, lower displacement strength

- [ ] **Step 4: Run the existing focused background test**

Run: `npm test -- --runInBand light-warp-background.test.tsx`
Expected: still FAIL until the wrapper has been switched over in the next chunk

- [ ] **Step 5: Commit once the scene component is compiling**

```bash
git add frontend/components/ui/LightSpaceGridScene.tsx frontend/components/ui/light-space-grid-config.ts frontend/components/ui/light-space-grid-material.ts
git commit -m "feat: add webgl light space grid scene"
```

---

## Chunk 3: Integrate the Scene into the Existing Background System

### Task 6: Switch `LightWarpBackground` from canvas mode to WebGL wrapper mode

**Files:**
- Modify: `frontend/components/ui/LightWarpBackground.tsx`
- Modify: `frontend/__tests__/light-warp-background.test.tsx`

- [ ] **Step 1: Replace the current canvas-heavy implementation with a wrapper**

```tsx
import { LightSpaceGridScene } from '@/components/ui/LightSpaceGridScene';
import { getLightSpaceGridConfig } from '@/components/ui/light-space-grid-config';

export function getSinkFieldConfig() {
  const config = getLightSpaceGridConfig();
  return {
    sinkRadius: 0,
    auraRadius: 0,
    gridLayerEnabled: true,
    gridCellSize: 0,
    gridWarpStrength: config.displacementStrength,
    gridAnchoredToViewport: true,
    gridAlwaysVisible: true,
    boundaryVisible: false,
    gridCoverage: 'full-screen' as const,
    gridPerspectiveMode: 'plane' as const,
    gridHorizonRatio: config.horizonRatio,
    gridUsesStaticCache: false,
    gridWarpRenderMode: 'mesh-displacement' as const,
    renderEngine: 'webgl' as const,
  };
}

export function LightWarpBackground() {
  return <LightSpaceGridScene dataWarpMode="cursor-webgl-space-grid" />;
}
```

- [ ] **Step 2: Run the focused background test and verify it passes**

Run: `npm test -- --runInBand light-warp-background.test.tsx`
Expected: PASS

- [ ] **Step 3: Keep the wrapper minimal**

Do not leave any of the old canvas path-warp logic behind if it is no longer used.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ui/LightWarpBackground.tsx frontend/__tests__/light-warp-background.test.tsx
git commit -m "feat: switch light background to webgl scene"
```

### Task 7: Integrate with `GlobeBackground` without disturbing dark mode

**Files:**
- Modify: `frontend/components/ui/GlobeBackground.tsx`
- Test: `frontend/__tests__/light-warp-background.test.tsx`

- [ ] **Step 1: Re-read the current light-mode layering in `GlobeBackground.tsx`**

Goal:
- ensure the globe remains visually stable
- ensure the light WebGL grid sits behind content and coexists with the globe
- do not alter the dark-mode path

- [ ] **Step 2: Make the minimal layering change**

Possible implementation:
- keep `LightWarpBackground` mounted only when `useDesktopLightMode()` is true
- confirm the canvas z-index and renderer alpha do not hide the globe

- [ ] **Step 3: Run focused tests**

Run: `npm test -- --runInBand light-warp-background.test.tsx light-space-grid-config.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ui/GlobeBackground.tsx frontend/components/ui/LightWarpBackground.tsx
git commit -m "fix: layer webgl space grid behind globe"
```

---

## Chunk 4: Verification and Visual Review

### Task 8: Run the full verification set

**Files:**
- Verify: `frontend/components/ui/LightWarpBackground.tsx`
- Verify: `frontend/components/ui/LightSpaceGridScene.tsx`
- Verify: `frontend/components/ui/light-space-grid-config.ts`
- Verify: `frontend/components/ui/light-space-grid-material.ts`
- Verify: `frontend/components/ui/GlobeBackground.tsx`

- [ ] **Step 1: Run focused tests**

Run: `npm test -- --runInBand light-warp-background.test.tsx light-space-grid-config.test.ts`
Expected: PASS

- [ ] **Step 2: Run frontend type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Manual browser review**

Review checklist:
- desktop light mode shows a perspective floor, not a flat 2D overlay
- cursor interaction looks like a local gravity well
- no visible lag spike compared with the current canvas implementation
- globe stays stable
- dark mode is unchanged

- [ ] **Step 5: Commit final polish if needed**

```bash
git add frontend/components/ui/LightWarpBackground.tsx frontend/components/ui/LightSpaceGridScene.tsx frontend/components/ui/light-space-grid-config.ts frontend/components/ui/light-space-grid-material.ts frontend/components/ui/GlobeBackground.tsx frontend/__tests__/light-warp-background.test.tsx frontend/__tests__/light-space-grid-config.test.ts
git commit -m "feat: add webgl light mode space grid"
```

---

## Notes for the Implementer

- Do not add `@react-three/fiber` or other scene wrappers unless the plain `three` path proves unworkable. The repo already uses `three`, and reusing that lowers risk.
- Keep the first implementation visually restrained. Scientific and clean is more important than spectacle.
- Do not bundle unrelated background experiments into this change.
- If the WebGL path still lags, the next escalation path is reducing plane subdivisions before adding any new rendering features.
