# Product Card Pricing And Home Icons Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh product-card token pricing and the home-page "How It Works" icons so both sections look more intentional and less generic.

**Architecture:** Keep the current data flow and reuse existing components. Update the card-variant rendering inside `ProductTokenPricing` to remove the heavy active-price capsule while preserving multi-token selection, then rework the home-page step cards with a cleaner icon set and calmer wrappers using the existing `lucide-react` dependency.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, lucide-react, Jest, Testing Library

---

## Chunk 1: Product Card Pricing

### Task 1: Redesign the card token row without the purple capsule

**Files:**
- Modify: `frontend/components/product/ProductTokenPricing.tsx`
- Test: `frontend/__tests__/product-token-pricing.test.tsx`

- [ ] Step 1: Update the test to lock the intended card structure.
- [ ] Step 2: Implement a cleaner `card` variant with inline selectable token amounts, subtle active emphasis, and the existing USDT estimate row.
- [ ] Step 3: Run the focused pricing test and verify it passes.

## Chunk 2: Home How-It-Works Cards

### Task 2: Replace the generic icon treatment on the landing page

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] Step 1: Extract/define a stronger step-card data model with clearer icon choices from `lucide-react`.
- [ ] Step 2: Rebuild the section card styling so icon wrappers feel product-grade rather than gradient placeholders.
- [ ] Step 3: Verify the section still matches the site theme in light and dark modes.

## Chunk 3: Verification

### Task 3: Prove the refresh is safe

**Files:**
- Verify: `frontend/components/product/ProductTokenPricing.tsx`
- Verify: `frontend/app/page.tsx`

- [ ] Step 1: Run `npm test -- --runInBand product-token-pricing.test.tsx`.
- [ ] Step 2: Run `npx tsc --noEmit`.
- [ ] Step 3: Run `npm run lint`.
- [ ] Step 4: Run `npm run build`.
