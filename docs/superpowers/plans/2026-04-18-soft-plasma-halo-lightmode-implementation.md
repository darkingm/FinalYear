# Soft Plasma Halo Light Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current light-mode background experiment with a polished `Soft Plasma Halo` effect: white base, cursor-locked soft sink, and morphing rainbow blobs that breathe inside a controlled halo without disturbing the globe.

**Architecture:** Keep [GlobeBackground.tsx](C:/Users/Asus/Documents/FYP/FYP/frontend/components/ui/GlobeBackground.tsx) as the stable globe layer and confine all light-mode interaction visuals to [LightWarpBackground.tsx](C:/Users/Asus/Documents/FYP/FYP/frontend/components/ui/LightWarpBackground.tsx). Build the effect from a fixed blob-seed field projected into per-frame morphing blob states so the motion feels alive without grid lines, particle spawning, or visible 3D shell structure.

**Tech Stack:** Next.js 16, React 19, TypeScript, Canvas 2D, Jest.

---

## Chunk 1: Replace The Current Visual Model

### Task 1: Lock The New Regression Contract

**Files:**
- Modify: `frontend/__tests__/light-warp-background.test.tsx`
- Reference: `docs/superpowers/specs/2026-04-18-soft-plasma-halo-lightmode-design.md`

- [ ] **Step 1: Write the failing test expectations for the new mode**

Add or keep focused tests that assert:

```ts
expect(canvas?.getAttribute('data-warp-mode')).toBe('cursor-blob-field');
expect(getBlobFieldConfig().sinkRadius).toBeLessThan(190);
expect(getBlobFieldConfig().blobCount).toBeGreaterThanOrEqual(96);
expect(getBlobMorphFrame(0, 0.7, 0.5).widthScale).not.toBeCloseTo(
  getBlobMorphFrame(420, 0.7, 0.5).widthScale,
  4,
);
```

- [ ] **Step 2: Run the focused test to verify it fails first**

Run:

```bash
npm test -- --runInBand light-warp-background.test.tsx
```

Expected: FAIL because `LightWarpBackground.tsx` is still exporting the wrong mode/config/helpers or rendering the wrong particle model.

- [ ] **Step 3: Commit the red test only if it is isolated and useful**

If the red test is cleanly isolated:

```bash
git add frontend/__tests__/light-warp-background.test.tsx
git commit -m "test: lock soft plasma halo regression contract"
```

If not, skip this commit and continue.

### Task 2: Replace Grid/Shell Logic With Soft Plasma Halo State

**Files:**
- Modify: `frontend/components/ui/LightWarpBackground.tsx`
- Reference: `docs/superpowers/specs/2026-04-18-soft-plasma-halo-lightmode-design.md`

- [ ] **Step 1: Remove the obsolete visual primitives**

Delete or stop using:

- grid rendering helpers
- shell stroke / line particle rendering
- spawn/die style particle behavior

Keep:

- cursor tracking
- sink shading
- breathing warp at the boundary

- [ ] **Step 2: Introduce fixed blob seed data**

Create a small, explicit blob model:

```ts
type BlobSeed = {
  angle: number;
  radialBias: number;
  orbitSpeed: number;
  wobbleSpeed: number;
  hue: number;
  baseSize: number;
  phase: number;
  depthBias: number;
  tilt: number;
};
```

and a deterministic generator:

```ts
function createBlobSeeds(): BlobSeed[] { /* fixed-size seed list */ }
```

- [ ] **Step 3: Add per-frame blob morph projection**

Add helpers with clear boundaries:

```ts
type BlobMorphFrame = {
  widthScale: number;
  heightScale: number;
  rotation: number;
};

function getBlobMorphFrame(timeMs: number, phase: number, depth: number): BlobMorphFrame
function projectBlobFrame(seed: BlobSeed, cx: number, cy: number, alpha: number, timeMs: number): BlobFrame
```

Rules:

- width/height/rotation must change over time
- no blob may remain a fixed circle or fixed dash
- blobs stay inside a bounded field around the cursor

- [ ] **Step 4: Render the blob field as soft ellipses/capsules**

Use layered fills in canvas 2D:

```ts
ctx.ellipse(...)
ctx.fillStyle = `hsla(...)`
ctx.shadowBlur = ...
```

Render order:

1. white background fill
2. sink shading
3. back blobs
4. front blobs
5. optional small highlight accents

- [ ] **Step 5: Keep cursor anchoring and field breathing separate**

Preserve the two existing responsibilities:

- `resolveCursorFollowStrength(distance)` for cursor lock
- `getBreathingWarp(timeMs)` for outer warp only

Do not reintroduce:

- global scale pulsing of the whole halo
- cursor lag
- globe distortion

- [ ] **Step 6: Re-run the focused test and verify it passes**

Run:

```bash
npm test -- --runInBand light-warp-background.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit the new visual model**

```bash
git add frontend/components/ui/LightWarpBackground.tsx frontend/__tests__/light-warp-background.test.tsx
git commit -m "feat: add soft plasma halo light background"
```

## Chunk 2: Preserve Globe Integration And Surface Behavior

### Task 3: Confirm Globe Layer Boundaries

**Files:**
- Modify: `frontend/components/ui/GlobeBackground.tsx`
- Reference: `frontend/components/ui/LightWarpBackground.tsx`

- [ ] **Step 1: Check the current integration path**

Verify:

- `GlobeBackground` still renders the globe canvas
- `LightWarpBackground` only mounts in desktop light mode
- the globe canvas remains above the halo canvas

- [ ] **Step 2: Make only the minimal integration changes**

Only change [GlobeBackground.tsx](C:/Users/Asus/Documents/FYP/FYP/frontend/components/ui/GlobeBackground.tsx) if one of these is wrong:

- z-index ordering
- pointer handling
- light-mode transparency

Do not redesign the globe again in this task.

- [ ] **Step 3: Run the focused test if integration changed**

Run:

```bash
npm test -- --runInBand light-warp-background.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit only if GlobeBackground needed a real change**

```bash
git add frontend/components/ui/GlobeBackground.tsx frontend/components/ui/LightWarpBackground.tsx frontend/__tests__/light-warp-background.test.tsx
git commit -m "fix: keep globe stable with soft plasma halo"
```

## Chunk 3: Full Verification

### Task 4: Run The Verification Suite

**Files:**
- Verify only

- [ ] **Step 1: Run the targeted frontend tests**

Run:

```bash
npm test -- --runInBand light-warp-background.test.tsx whale-api.test.ts session-token-manager.test.ts product-token-pricing.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript verification**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS with only the known pre-existing warnings outside this batch.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit the verification-safe state**

```bash
git add frontend/components/ui/LightWarpBackground.tsx frontend/components/ui/GlobeBackground.tsx frontend/__tests__/light-warp-background.test.tsx
git commit -m "refactor: finalize soft plasma halo light mode effect"
```

## Chunk 4: Visual QA Checklist

### Task 5: Manual Browser Review

**Files:**
- Verify only

- [ ] **Step 1: Reload the homepage in desktop light mode**

Check:

- white background is clean
- globe is unchanged
- sink is centered on the cursor

- [ ] **Step 2: Validate the halo quality**

Check:

- blobs change shape over time
- blobs do not look like line particles
- field feels alive even when the cursor stops
- outer boundary warps without obvious whole-circle scaling

- [ ] **Step 3: Validate readability**

Check:

- header, hero copy, and product cards remain readable
- effect does not overpower the UI center

- [ ] **Step 4: Capture any remaining art-direction feedback**

If the effect is still “too noisy” or “too weak”, tune only these constants first:

- `BLOB_COUNT`
- `FIELD_RADIUS`
- `getBreathingWarp(...)`
- `getBlobMorphFrame(...)`

Avoid structural changes unless those constants cannot solve the feedback.
