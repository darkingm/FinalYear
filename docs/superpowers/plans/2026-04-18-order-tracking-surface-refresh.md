# Order Tracking Surface Refresh Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the order-tracking experience complete and consistent across `orders/[id]`, `orders`, and related checkout/order surfaces, with correct product imagery, token-aware pricing, and clear next-step guidance.

**Architecture:** Centralize order presentation rules in small shared helpers instead of repeating raw status/image/amount logic inside pages. Refactor the order detail page to consume those helpers and add a compact tracking summary, then align the order list with the same image and status conventions.

**Tech Stack:** Next.js App Router, React, TypeScript, Jest, existing order/checkout UI components, shared formatting helpers.

---

## Chunk 1: Shared Order Presentation Helpers

### Task 1: Add shared order image and amount helpers

**Files:**
- Create: `frontend/lib/orders/presentation.ts`
- Modify: `frontend/lib/orders/amount.ts`
- Test: `frontend/__tests__/order-presentation.test.ts`

- [ ] **Step 1: Write the failing tests**

Cover:
- order image resolves from `primary_image`, then gallery arrays, then product fallback
- string/number token amounts format safely
- status metadata exposes human-readable labels and tracking guidance

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --runInBand order-presentation.test.ts`
Expected: FAIL because the helper file or expected behavior does not exist yet.

- [ ] **Step 3: Implement the minimal helpers**

Add a focused helper module that:
- resolves product imagery for order surfaces
- normalizes token symbols/amounts for display
- maps raw order statuses to display labels, descriptions, action owner, and next step copy

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- --runInBand order-presentation.test.ts`
Expected: PASS

## Chunk 2: Order Detail Page

### Task 2: Refactor `orders/[id]` to use shared presentation rules

**Files:**
- Modify: `frontend/app/orders/[id]/page.tsx`
- Modify: `frontend/components/order/OrderStepper.tsx`
- Create: `frontend/components/order/OrderTrackingSnapshot.tsx`
- Test: `frontend/__tests__/order-detail-presentation.test.tsx`

- [ ] **Step 1: Write the failing test**

Cover:
- product image uses the resolved order image instead of falling back to the package icon
- status title shows a human-readable label instead of the raw enum
- escrow amount and token pricing handle string payloads safely
- tracking snapshot shows current state / waiting on / next step

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- --runInBand order-detail-presentation.test.tsx`
Expected: FAIL against the current order detail rendering.

- [ ] **Step 3: Implement the detail page refresh**

Refactor the page to:
- resolve product image consistently
- replace raw status enum text with shared status copy
- render token/USDT values with shared amount components
- show a compact tracking summary and richer escrow block
- keep seller/buyer action panels wired to existing actions

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- --runInBand order-detail-presentation.test.tsx`
Expected: PASS

## Chunk 3: Orders List Consistency

### Task 3: Align `orders` list cards with the same image/status/price rules

**Files:**
- Modify: `frontend/app/orders/page.tsx`
- Test: `frontend/__tests__/orders-list-presentation.test.tsx`

- [ ] **Step 1: Write the failing test**

Cover:
- order cards resolve images from the same source order as the detail page
- token pricing and status labels match the new presentation rules

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- --runInBand orders-list-presentation.test.tsx`
Expected: FAIL before the refactor.

- [ ] **Step 3: Implement list page alignment**

Update the list page to use the new helper functions and present status/price/image consistently with the detail page.

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- --runInBand orders-list-presentation.test.tsx`
Expected: PASS

## Chunk 4: Verification

### Task 4: Run the verification suite

**Files:**
- Verify only

- [ ] **Step 1: Run focused tests**

Run: `npm test -- --runInBand order-presentation.test.ts order-detail-presentation.test.tsx orders-list-presentation.test.tsx order-amount.test.ts checkout-product-image.test.ts checkout-price-value.test.tsx coin-image.test.tsx product-token-pricing.test.tsx use-crypto-price.test.tsx`
Expected: PASS

- [ ] **Step 2: Run type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS
