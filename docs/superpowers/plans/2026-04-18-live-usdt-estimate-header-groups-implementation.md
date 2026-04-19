# Live USDT Estimate And Grouped Header Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show market-based USDT estimates for selected product tokens on a stable 30-second cadence, and replace the long desktop header link row with three grouped dropdown menus.

**Architecture:** Extend the existing `usePriceStore` so it maintains a 30-second display snapshot separate from the faster internal market polling, then let `ProductTokenPricing` consume that snapshot for the `≈ USDT` row. Refactor header navigation into a shared grouped-data model that renders desktop dropdowns and mobile grouped sections from the same source of truth.

**Tech Stack:** Next.js App Router, React, TypeScript, Zustand, Tailwind CSS, shadcn dropdown primitives, Jest, Testing Library

---

## Chunk 1: Stable Market Snapshot Pricing

### Task 1: Add shared pricing helpers for quote resolution and estimate fallback

**Files:**
- Modify: `frontend/lib/products/pricing.ts`
- Modify: `frontend/lib/products/types.ts`
- Test: `frontend/__tests__/product-pricing.test.ts`

- [ ] **Step 1: Write failing helper tests**

Add tests that cover:
- token quote symbol resolution (`ETH -> ETHUSDT`, `MATIC -> MATICUSDT`, `USDT -> USDT`)
- estimate fallback to `base_price_usd` when market quote is missing
- direct mirror behavior when selected token is already `USDT`

- [ ] **Step 2: Run the focused helper test to confirm failure**

Run: `npm test -- --runInBand product-pricing.test.ts`
Expected: FAIL because the new helper behavior does not exist yet.

- [ ] **Step 3: Implement the helpers**

Add focused helpers to `frontend/lib/products/pricing.ts` for:
- mapping accepted-token symbols to market quote symbols
- computing estimated USDT from selected token + market quote + fallback base USD
- returning display metadata that `ProductTokenPricing` can consume cleanly

- [ ] **Step 4: Re-run the helper test**

Run: `npm test -- --runInBand product-pricing.test.ts`
Expected: PASS

### Task 2: Add a 30-second display snapshot to the shared price store

**Files:**
- Modify: `frontend/store/price-store.ts`

- [ ] **Step 1: Extend store state**

Add a `displaySnapshotPrices` map and expose the snapshot in the Zustand state without breaking existing `prices` consumers.

- [ ] **Step 2: Update polling lifecycle**

Keep the existing faster market polling intact, but add a single store-level 30-second snapshot timer that copies the latest real market data into `displaySnapshotPrices`.

- [ ] **Step 3: Seed the first snapshot immediately**

Make sure the UI does not wait 30 seconds before showing an estimate on initial load.

## Chunk 2: Product Pricing UI

### Task 3: Render live 30-second USDT estimates in the shared pricing component

**Files:**
- Modify: `frontend/components/product/ProductTokenPricing.tsx`
- Test: `frontend/__tests__/product-token-pricing.test.tsx`

- [ ] **Step 1: Update the component test**

Add assertions that lock:
- the selected token drives the USDT estimate
- `USDT` selection mirrors the token amount
- the row shows a freshness hint such as `Live 30s`

- [ ] **Step 2: Run the focused component test to confirm failure**

Run: `npm test -- --runInBand product-token-pricing.test.tsx`
Expected: FAIL because the current component still uses static `basePriceUsd`.

- [ ] **Step 3: Implement the market-estimate row**

Subscribe the component to the 30-second display snapshot in `usePriceStore`, compute the selected token estimate through the new pricing helpers, and render the estimate row with safe fallbacks.

- [ ] **Step 4: Re-run the pricing tests**

Run: `npm test -- --runInBand product-token-pricing.test.tsx product-pricing.test.ts`
Expected: PASS

## Chunk 3: Grouped Header Navigation

### Task 4: Move header routes into grouped navigation data

**Files:**
- Create: `frontend/lib/navigation/header-nav.ts`
- Modify: `frontend/components/layout/Header.tsx`

- [ ] **Step 1: Extract shared nav definitions**

Create a focused config module that describes:
- `Mua bán`
- `Tài chính`
- `Tài khoản`

Each group should include route, icon, auth requirement, and a short description.

- [ ] **Step 2: Add path/group matching helpers**

Implement pure helpers for:
- route active state
- group active state
- auth-aware destination URL

- [ ] **Step 3: Render desktop grouped dropdowns**

Replace the long desktop row with three dropdown triggers that use the shared grouped config and preserve current login redirect behavior.

### Task 5: Align mobile menu with the grouped source of truth

**Files:**
- Modify: `frontend/components/layout/Header.tsx`

- [ ] **Step 1: Replace the old mobile flat list**

Render grouped mobile sections from the same config module used by desktop.

- [ ] **Step 2: Preserve existing user actions**

Keep theme/language toggles, profile block, and logout behavior unchanged.

## Chunk 4: Verification

### Task 6: Prove the batch is safe

**Files:**
- Verify: `frontend/lib/products/pricing.ts`
- Verify: `frontend/store/price-store.ts`
- Verify: `frontend/components/product/ProductTokenPricing.tsx`
- Verify: `frontend/components/layout/Header.tsx`

- [ ] **Step 1: Run focused tests**

Run: `npm test -- --runInBand product-pricing.test.ts product-token-pricing.test.tsx`

- [ ] **Step 2: Run TypeScript**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Run lint**

Run: `npm run lint`

- [ ] **Step 4: Run production build**

Run: `npm run build`
