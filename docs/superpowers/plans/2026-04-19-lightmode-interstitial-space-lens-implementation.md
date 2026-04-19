# Light Mode Interstitial Space Lens Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a subtle, always-on interstitial space lens between the globe and the light-mode WebGL grid so the scene reads as curved space without deforming the globe.

**Architecture:** Extend the existing WebGL light-mode path instead of creating a second rendering stack. Keep [LightWarpBackground.tsx](C:/Users/Asus/Documents/FYP/FYP/frontend/components/ui/LightWarpBackground.tsx) as the public entry point, add a small lens config unit, and implement the lens as a lightweight mesh/material inside [LightSpaceGridScene.tsx](C:/Users/Asus/Documents/FYP/FYP/frontend/components/ui/LightSpaceGridScene.tsx) so it shares the same renderer as the grid.

**Tech Stack:** Next.js 16, React 19, TypeScript, `three`, Jest, existing frontend build/lint tooling

---

## File Map

### Files to Create

- `frontend/components/ui/light-space-lens-config.ts`
  - Central config for lens placement, opacity ceiling, falloff, and static behavior.
- `frontend/components/ui/light-space-lens-material.ts`
  - Material/shader factory for the lens sheet.
- `frontend/__tests__/light-space-lens-config.test.ts`
  - Focused regression coverage for the lens config defaults.

### Files to Modify

- `frontend/components/ui/LightSpaceGridScene.tsx`
  - Add the interstitial lens mesh to the existing WebGL scene and keep it lightweight.
- `frontend/components/ui/LightWarpBackground.tsx`
  - Expose lens metadata from `getSinkFieldConfig()` for regression tests and UI contract stability.
- `frontend/__tests__/light-warp-background.test.tsx`
  - Extend the WebGL contract tests with lens flags.

### Verification Targets

- `frontend/__tests__/light-warp-background.test.tsx`
- `frontend/__tests__/light-space-grid-config.test.ts`
- `frontend/__tests__/light-space-lens-config.test.ts`
- `frontend/components/ui/LightSpaceGridScene.tsx`
- `frontend/components/ui/LightWarpBackground.tsx`
- `frontend/components/ui/light-space-lens-config.ts`
- `frontend/components/ui/light-space-lens-material.ts`

---

## Chunk 1: Lock the Lens Contract in Tests

### Task 1: Extend the background contract test with lens metadata

**Files:**
- Modify: `frontend/__tests__/light-warp-background.test.tsx`
- Test: `frontend/__tests__/light-warp-background.test.tsx`

- [ ] **Step 1: Add failing assertions for the lens flags**

```tsx
it('reports the interstitial space lens metadata', () => {
  const config = getSinkFieldConfig();
  expect(config.spaceLensEnabled).toBe(true);
  expect(config.spaceLensMode).toBe('interstitial-sheet');
  expect(config.spaceLensAlwaysOn).toBe(true);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --runInBand light-warp-background.test.tsx`
Expected: FAIL because the current wrapper does not report the lens metadata yet.

- [ ] **Step 3: Do not change production code yet**

- [ ] **Step 4: Commit only after the implementation for this chunk is green**

```bash
git add frontend/__tests__/light-warp-background.test.tsx
git commit -m "test: add interstitial lens metadata expectations"
```

### Task 2: Add focused tests for the lens config module

**Files:**
- Create: `frontend/__tests__/light-space-lens-config.test.ts`
- Test: `frontend/__tests__/light-space-lens-config.test.ts`

- [ ] **Step 1: Write the failing config tests first**

```ts
import { getLightSpaceLensConfig } from '@/components/ui/light-space-lens-config';

describe('light-space-lens-config', () => {
  it('keeps the lens always on at low intensity', () => {
    const config = getLightSpaceLensConfig();
    expect(config.alwaysOn).toBe(true);
    expect(config.opacity).toBeLessThanOrEqual(0.2);
  });

  it('positions the lens between globe and grid', () => {
    const config = getLightSpaceLensConfig();
    expect(config.positionY).toBeLessThan(0);
    expect(config.positionZ).toBeLessThan(0);
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --runInBand light-space-lens-config.test.ts`
Expected: FAIL because the config module does not exist yet.

- [ ] **Step 3: Stop after confirming the RED state**

- [ ] **Step 4: Commit only after the implementation for this chunk is green**

```bash
git add frontend/__tests__/light-space-lens-config.test.ts
git commit -m "test: add space lens config coverage"
```

---

## Chunk 2: Build the Reusable Lens Units

### Task 3: Create the lens config module

**Files:**
- Create: `frontend/components/ui/light-space-lens-config.ts`
- Test: `frontend/__tests__/light-space-lens-config.test.ts`

- [ ] **Step 1: Implement the minimal config module to satisfy the test**

```ts
export function getLightSpaceLensConfig() {
  return {
    enabled: true,
    mode: 'interstitial-sheet' as const,
    alwaysOn: true,
    opacity: 0.12,
    positionY: -0.55,
    positionZ: -2.1,
    width: 8.8,
    height: 4.6,
    segmentsX: 48,
    segmentsY: 28,
    falloff: 0.72,
  };
}
```

- [ ] **Step 2: Run the focused config test and verify it passes**

Run: `npm test -- --runInBand light-space-lens-config.test.ts`
Expected: PASS

- [ ] **Step 3: Keep the config module small and serializable**

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ui/light-space-lens-config.ts frontend/__tests__/light-space-lens-config.test.ts
git commit -m "feat: add interstitial lens config"
```

### Task 4: Create the lens material unit

**Files:**
- Create: `frontend/components/ui/light-space-lens-material.ts`
- Modify: `frontend/components/ui/light-space-lens-config.ts`

- [ ] **Step 1: Implement a focused material factory**

```ts
import type * as THREE from 'three';
import { getLightSpaceLensConfig } from '@/components/ui/light-space-lens-config';

export function createLightSpaceLensMaterial(THREE: typeof import('three')) {
  const config = getLightSpaceLensConfig();
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uOpacity: { value: config.opacity },
      uGlowColor: { value: new THREE.Color('#e0f2fe') },
      uFalloff: { value: config.falloff },
    },
    vertexShader: `...`,
    fragmentShader: `...`,
  });
}
```

- [ ] **Step 2: Keep the material restrained**

Constraints:
- no visible hard ring
- no pulse loop
- no thick fog effect
- no dependence on hover to remain visible

- [ ] **Step 3: Run TypeScript to confirm the module compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ui/light-space-lens-material.ts frontend/components/ui/light-space-lens-config.ts
git commit -m "feat: add interstitial lens material"
```

---

## Chunk 3: Integrate the Lens into the WebGL Scene

### Task 5: Add the lens sheet to `LightSpaceGridScene`

**Files:**
- Modify: `frontend/components/ui/LightSpaceGridScene.tsx`
- Modify: `frontend/components/ui/light-space-lens-config.ts`
- Modify: `frontend/components/ui/light-space-lens-material.ts`
- Test: `frontend/__tests__/light-warp-background.test.tsx`

- [ ] **Step 1: Read the existing grid scene setup in full**

Goal:
- keep one renderer
- keep the globe untouched
- place the lens between the globe and the grid in depth

- [ ] **Step 2: Add the lens mesh as a second lightweight scene layer**

Implementation requirements:
- one additional mesh only
- transparent material
- fixed placement using `getLightSpaceLensConfig()`
- no separate render pass

- [ ] **Step 3: Keep the lens always on**

Implementation requirements:
- no hover-only activation
- no loop needed just for the lens
- the lens should remain subtle even when the pointer is idle

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --runInBand light-warp-background.test.tsx light-space-lens-config.test.ts`
Expected: still FAIL until the wrapper metadata is updated in the next task if those flags have not been added yet.

- [ ] **Step 5: Commit once the scene compiles**

```bash
git add frontend/components/ui/LightSpaceGridScene.tsx frontend/components/ui/light-space-lens-config.ts frontend/components/ui/light-space-lens-material.ts
git commit -m "feat: add interstitial lens to webgl space grid"
```

### Task 6: Expose the lens metadata through `LightWarpBackground`

**Files:**
- Modify: `frontend/components/ui/LightWarpBackground.tsx`
- Modify: `frontend/__tests__/light-warp-background.test.tsx`

- [ ] **Step 1: Extend `getSinkFieldConfig()`**

```ts
const lensConfig = getLightSpaceLensConfig();

return {
  ...existingFields,
  spaceLensEnabled: lensConfig.enabled,
  spaceLensMode: lensConfig.mode,
  spaceLensAlwaysOn: lensConfig.alwaysOn,
};
```

- [ ] **Step 2: Run the focused background test and verify it passes**

Run: `npm test -- --runInBand light-warp-background.test.tsx`
Expected: PASS

- [ ] **Step 3: Keep the wrapper minimal**

Do not add rendering logic into `LightWarpBackground.tsx`; it remains a metadata + scene wrapper.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ui/LightWarpBackground.tsx frontend/__tests__/light-warp-background.test.tsx
git commit -m "feat: expose interstitial lens metadata"
```

---

## Chunk 4: Verification and Visual Review

### Task 7: Run the full verification set

**Files:**
- Verify: `frontend/components/ui/LightSpaceGridScene.tsx`
- Verify: `frontend/components/ui/LightWarpBackground.tsx`
- Verify: `frontend/components/ui/light-space-lens-config.ts`
- Verify: `frontend/components/ui/light-space-lens-material.ts`
- Verify: `frontend/__tests__/light-warp-background.test.tsx`
- Verify: `frontend/__tests__/light-space-lens-config.test.ts`

- [ ] **Step 1: Run focused tests**

Run: `npm test -- --runInBand light-warp-background.test.tsx light-space-lens-config.test.ts`
Expected: PASS

- [ ] **Step 2: Run frontend type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Run frontend lint**

Run: `npm run lint`
Expected: PASS with no new errors; existing unrelated warnings may remain.

- [ ] **Step 5: Manual browser review**

Review checklist:
- the globe remains visually unchanged
- the space between globe and grid feels subtly curved
- the lens is visible by depth/compression, not by a hard outline
- the scene still feels clean and scientific, not decorative
- performance remains acceptable

- [ ] **Step 6: Commit final polish if needed**

```bash
git add frontend/components/ui/LightSpaceGridScene.tsx frontend/components/ui/LightWarpBackground.tsx frontend/components/ui/light-space-lens-config.ts frontend/components/ui/light-space-lens-material.ts frontend/__tests__/light-warp-background.test.tsx frontend/__tests__/light-space-lens-config.test.ts
git commit -m "feat: add interstitial space lens to light mode"
```

---

## Notes for the Implementer

- Do not distort the globe mesh or silhouette.
- Keep the lens in the same WebGL scene as the grid; avoid adding a second heavy rendering stack.
- Keep the effect subtle. If the lens becomes the first thing the eye notices, it is too strong.
- If performance regresses, reduce lens mesh segments before adding any new visual nuance.
