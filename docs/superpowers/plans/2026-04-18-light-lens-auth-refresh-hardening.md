# Light Refraction Shader And Whale API Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the light-mode background with a true cursor-driven refraction shader and harden whale-tracker fetches so explorer timeouts and duplicate polling do not spam the UI.

**Architecture:** Render the globe scene into a WebGL render target and run a full-screen post-process shader in light mode so the pixels behind the cursor are displaced for real instead of faking a ring in a 2D overlay. In whale-api, add request coalescing and short-lived caches around explorer calls and wallet activity loaders so watch cards and detail modals share one fetch path, then skip or degrade unsupported explorer calls instead of timing out noisily.

**Tech Stack:** Next.js 16, React 19, Three.js, Jest, TypeScript, Fetch API.

---

### Task 1: Whale API Request Hardening

**Files:**
- Create: `frontend/__tests__/whale-api.test.ts`
- Modify: `frontend/lib/whale-api.ts`

- [ ] Write failing tests for in-flight dedupe and short TTL cache reuse.
- [ ] Run the focused whale-api test and verify it fails first.
- [ ] Add request coalescing and wallet-activity cache with minimal fallback logic.
- [ ] Re-run focused whale-api tests and confirm they pass.

### Task 2: Shader-Based Light Mode Refraction

**Files:**
- Modify: `frontend/components/ui/GlobeBackground.tsx`
- Modify: `frontend/components/ui/LightWarpBackground.tsx`
- Modify: `frontend/__tests__/light-warp-background.test.tsx`

- [ ] Keep a failing or guarded test that proves the light-mode warp path switched to the refraction shader mode.
- [ ] Render the globe through a WebGL post-process pass in light mode.
- [ ] Remove the visible 2D ring overlay behavior.
- [ ] Re-run focused background tests.

### Task 3: Full Verification

**Files:**
- Verify only

- [ ] Run targeted frontend tests for whale-api and light background.
- [ ] Run `npx tsc --noEmit` in `frontend`.
- [ ] Run `npm run lint` in `frontend`.
- [ ] Run `npm run build` in `frontend`.
