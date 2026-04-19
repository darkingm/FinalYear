# Light Mode Planet Anchor Well Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a broad, always-on planet anchor well beneath the globe while preserving the current cursor-driven grid deformation in light mode.

**Architecture:** Extend the existing WebGL grid shader rather than adding another mesh or render pass. Introduce a small anchor config module, expose metadata through [LightWarpBackground.tsx](C:/Users/Asus/Documents/FYP/FYP/frontend/components/ui/LightWarpBackground.tsx), and feed the anchor well into the existing grid material used by [LightSpaceGridScene.tsx](C:/Users/Asus/Documents/FYP/FYP/frontend/components/ui/LightSpaceGridScene.tsx).

**Tech Stack:** Next.js 16, React 19, TypeScript, `three`, Jest, existing frontend build/lint tooling

---

## File Map

### Files to Create

- `frontend/components/ui/light-space-anchor-config.ts`
  - Fixed config for the globe anchor well position, radius, softness, and strength.
- `frontend/__tests__/light-space-anchor-config.test.ts`
  - Config regression tests for the anchor well defaults.

### Files to Modify

- `frontend/components/ui/light-space-grid-material.ts`
  - Add anchor-well uniforms and blend the second field into the grid deformation shader.
- `frontend/components/ui/LightSpaceGridScene.tsx`
  - Pass the fixed anchor well inputs into the grid material.
- `frontend/components/ui/LightWarpBackground.tsx`
  - Expose `planetAnchorWellEnabled` and `planetAnchorWellAlwaysOn` metadata.
- `frontend/__tests__/light-warp-background.test.tsx`
  - Extend the metadata contract tests.

### Verification Targets

- `frontend/__tests__/light-warp-background.test.tsx`
- `frontend/__tests__/light-space-anchor-config.test.ts`
- `frontend/components/ui/light-space-anchor-config.ts`
- `frontend/components/ui/light-space-grid-material.ts`
- `frontend/components/ui/LightSpaceGridScene.tsx`
- `frontend/components/ui/LightWarpBackground.tsx`

---

## Chunk 1: Lock the Anchor Well Contract in Tests

### Task 1: Extend the background metadata test

**Files:**
- Modify: `frontend/__tests__/light-warp-background.test.tsx`
- Test: `frontend/__tests__/light-warp-background.test.tsx`

- [ ] **Step 1: Add failing assertions for the anchor well metadata**

```tsx
it('reports the planet anchor well metadata', () => {
  const config = getSinkFieldConfig();
  expect(config.planetAnchorWellEnabled).toBe(true);
  expect(config.planetAnchorWellAlwaysOn).toBe(true);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --runInBand light-warp-background.test.tsx`
Expected: FAIL because the wrapper does not expose the anchor metadata yet.

- [ ] **Step 3: Stop after confirming the RED state**

- [ ] **Step 4: Commit only after the implementation for this chunk is green**

```bash
git add frontend/__tests__/light-warp-background.test.tsx
git commit -m "test: add planet anchor metadata expectations"
```

### Task 2: Add focused config tests for the anchor well

**Files:**
- Create: `frontend/__tests__/light-space-anchor-config.test.ts`
- Test: `frontend/__tests__/light-space-anchor-config.test.ts`

- [ ] **Step 1: Write the failing config tests first**

```ts
import { getLightSpaceAnchorConfig } from '@/components/ui/light-space-anchor-config';

describe('light-space-anchor-config', () => {
  it('keeps the anchor well always on with low-to-medium strength', () => {
    const config = getLightSpaceAnchorConfig();
    expect(config.alwaysOn).toBe(true);
    expect(config.strength).toBeGreaterThan(0);
    expect(config.strength).toBeLessThan(0.5);
  });

  it('uses a broader radius than the cursor well', () => {
    const config = getLightSpaceAnchorConfig();
    expect(config.radius).toBeGreaterThan(0.2);
  });
});
```

- [ ] **Step 2: Run the focused config test to verify it fails**

Run: `npm test -- --runInBand light-space-anchor-config.test.ts`
Expected: FAIL because the config module does not exist yet.

- [ ] **Step 3: Stop after confirming the RED state**

- [ ] **Step 4: Commit only after the implementation for this chunk is green**

```bash
git add frontend/__tests__/light-space-anchor-config.test.ts
git commit -m "test: add planet anchor config coverage"
```

---

## Chunk 2: Build the Anchor Config Unit

### Task 3: Create the anchor config module

**Files:**
- Create: `frontend/components/ui/light-space-anchor-config.ts`
- Test: `frontend/__tests__/light-space-anchor-config.test.ts`

- [ ] **Step 1: Implement the minimal config module to satisfy the failing test**

```ts
export function getLightSpaceAnchorConfig() {
  return {
    enabled: true,
    alwaysOn: true,
    uv: [0.5, 0.34] as const,
    radius: 0.28,
    strength: 0.18,
    softness: 1.5,
  };
}
```

- [ ] **Step 2: Run the focused config test and verify it passes**

Run: `npm test -- --runInBand light-space-anchor-config.test.ts`
Expected: PASS

- [ ] **Step 3: Keep the config module focused and serializable**

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ui/light-space-anchor-config.ts frontend/__tests__/light-space-anchor-config.test.ts
git commit -m "feat: add planet anchor config"
```

---

## Chunk 3: Extend the Grid Shader with the Anchor Field

### Task 4: Add the second deformation field to the grid material

**Files:**
- Modify: `frontend/components/ui/light-space-grid-material.ts`
- Modify: `frontend/components/ui/light-space-grid-config.ts`
- Modify: `frontend/components/ui/light-space-anchor-config.ts`

- [ ] **Step 1: Add uniforms for the anchor well**

Implementation requirements:
- `uAnchorUv`
- `uAnchorRadius`
- `uAnchorStrength`
- optional `uAnchorSoftness`

- [ ] **Step 2: Blend the anchor well into the vertex deformation**

Implementation requirements:
- compute one field from cursor
- compute one field from anchor UV
- keep the anchor wider and softer than the cursor field
- clamp or blend safely so the combined result does not spike unrealistically

- [ ] **Step 3: Keep the first implementation minimal**

Do not add extra animation to the anchor well.

- [ ] **Step 4: Run frontend type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/ui/light-space-grid-material.ts frontend/components/ui/light-space-anchor-config.ts
git commit -m "feat: add anchor well to grid shader"
```

### Task 5: Feed the anchor config into `LightSpaceGridScene`

**Files:**
- Modify: `frontend/components/ui/LightSpaceGridScene.tsx`
- Modify: `frontend/components/ui/light-space-anchor-config.ts`

- [ ] **Step 1: Import and read the anchor config**

Goal:
- supply the fixed anchor UV, radius, and strength to the existing grid material uniforms

- [ ] **Step 2: Keep the anchor field static**

Implementation requirements:
- set the anchor uniforms once during scene setup
- no per-frame updates needed unless a config-derived value changes

- [ ] **Step 3: Preserve existing cursor interaction**

Implementation requirements:
- do not regress the cursor well
- do not change the globe or lens layers

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --runInBand light-warp-background.test.tsx light-space-anchor-config.test.ts`
Expected: anchor config test passes; background test may still fail until metadata is exposed in the next task

- [ ] **Step 5: Commit**

```bash
git add frontend/components/ui/LightSpaceGridScene.tsx frontend/components/ui/light-space-anchor-config.ts frontend/components/ui/light-space-grid-material.ts
git commit -m "feat: wire planet anchor well into scene"
```

---

## Chunk 4: Expose Metadata and Verify

### Task 6: Expose anchor metadata through `LightWarpBackground`

**Files:**
- Modify: `frontend/components/ui/LightWarpBackground.tsx`
- Modify: `frontend/__tests__/light-warp-background.test.tsx`

- [ ] **Step 1: Extend `getSinkFieldConfig()`**

```ts
const anchorConfig = getLightSpaceAnchorConfig();

return {
  ...existingFields,
  planetAnchorWellEnabled: anchorConfig.enabled,
  planetAnchorWellAlwaysOn: anchorConfig.alwaysOn,
};
```

- [ ] **Step 2: Run the focused metadata test and verify it passes**

Run: `npm test -- --runInBand light-warp-background.test.tsx`
Expected: PASS

- [ ] **Step 3: Keep the wrapper as metadata only**

Do not move any rendering logic into `LightWarpBackground.tsx`.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ui/LightWarpBackground.tsx frontend/__tests__/light-warp-background.test.tsx
git commit -m "feat: expose planet anchor metadata"
```

### Task 7: Run the full verification set

**Files:**
- Verify: `frontend/__tests__/light-warp-background.test.tsx`
- Verify: `frontend/__tests__/light-space-anchor-config.test.ts`
- Verify: `frontend/components/ui/light-space-anchor-config.ts`
- Verify: `frontend/components/ui/light-space-grid-material.ts`
- Verify: `frontend/components/ui/LightSpaceGridScene.tsx`
- Verify: `frontend/components/ui/LightWarpBackground.tsx`

- [ ] **Step 1: Run focused tests**

Run: `npm test -- --runInBand light-warp-background.test.tsx light-space-anchor-config.test.ts`
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
- the grid reads as slightly compressed beneath the globe
- the cursor well still works
- the two wells do not over-deform the mesh
- the globe remains visually unchanged

- [ ] **Step 6: Commit final polish if needed**

```bash
git add frontend/components/ui/light-space-anchor-config.ts frontend/components/ui/light-space-grid-material.ts frontend/components/ui/LightSpaceGridScene.tsx frontend/components/ui/LightWarpBackground.tsx frontend/__tests__/light-space-anchor-config.test.ts frontend/__tests__/light-warp-background.test.tsx
git commit -m "feat: add planet anchor well beneath globe"
```

---

## Notes for the Implementer

- Keep the anchor well broader and softer than the cursor well.
- Do not over-tune the effect into an obvious crater.
- If the combined deformation looks too strong, reduce anchor strength before reducing cursor strength.
- Preserve the existing lens sheet and grid scene structure; this change should only deepen the spatial relationship between globe and grid.
