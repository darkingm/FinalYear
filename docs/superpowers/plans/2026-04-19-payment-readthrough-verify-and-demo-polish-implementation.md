# Payment Read-Through Verify And Demo Polish Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent crypto checkout from appearing permanently stuck in miner confirmation, improve demo-facing payment tracking surfaces, and enforce readable text contrast on bright backgrounds.

**Architecture:** Keep the existing payment worker, but make the payment status endpoint perform read-through verification when an on-chain payment is still pending. Feed the richer verification payload into checkout and order-tracking UI, and replace light-mode brittle text colors with theme-safe contrast tokens.

**Tech Stack:** Express, TypeScript, PostgreSQL, Next.js App Router, Jest, Tailwind CSS, Wagmi.

---

## Chunk 1: Backend Payment Read-Through Verification

### Task 1: Add a failing test for verification metadata mapping

**Files:**
- Test: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\__tests__\crypto-payment-status.test.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\crypto-payment.service.ts`

- [ ] **Step 1: Write a failing test**
- [ ] **Step 2: Run only that test and confirm it fails for the missing helper/status shape**
- [ ] **Step 3: Add minimal helper(s) to build readable verification metadata**
- [ ] **Step 4: Re-run the focused test until it passes**

### Task 2: Make `getPaymentStatus` perform read-through verification

**Files:**
- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\crypto-payment.service.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\crypto-payment.controller.ts`

- [ ] **Step 1: Write a failing test for `getPaymentStatus` when order is pending and `tx_hash` exists**
- [ ] **Step 2: Verify the test fails because status is only reading stale DB state**
- [ ] **Step 3: Update `getPaymentStatus` to call `verifyTransaction(tx_hash)` for pending on-chain states**
- [ ] **Step 4: Return structured verification metadata (`verification_state`, `verification_message`, `required_confirmations`, `last_verified_at`)**
- [ ] **Step 5: Re-run backend tests**

## Chunk 2: Frontend Tracking And Readability

### Task 3: Add failing tests for tracking summary and readable status presentation

**Files:**
- Test: `C:\Users\Asus\Documents\FYP\FYP\frontend\__tests__\order-presentation.test.ts`
- Test: `C:\Users\Asus\Documents\FYP\FYP\frontend\__tests__\order-tracking-snapshot.test.tsx`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\lib\orders\presentation.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\components\order\OrderTrackingSnapshot.tsx`

- [ ] **Step 1: Add failing expectations for richer pending/confirming copy and surface tone metadata**
- [ ] **Step 2: Run focused frontend tests and confirm the failures**
- [ ] **Step 3: Extend order presentation helpers with verification-aware messages and surface classes**
- [ ] **Step 4: Update snapshot cards to use theme-safe text/background tokens**
- [ ] **Step 5: Re-run the focused tests**

### Task 4: Wire richer payment status into checkout and order detail

**Files:**
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\app\checkout\[orderId]\page.tsx`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\app\orders\[id]\page.tsx`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\app\orders\page.tsx`

- [ ] **Step 1: Add failing tests, if needed, for new status labels or CTA visibility**
- [ ] **Step 2: Thread `verification_state`, `confirmations`, and retry copy into checkout polling**
- [ ] **Step 3: Add a visible manual `Kiểm tra lại blockchain` action for pending crypto orders**
- [ ] **Step 4: Replace light-on-light text classes on checkout/order tracking surfaces with readable theme-safe classes**
- [ ] **Step 5: Re-run focused frontend tests**

## Chunk 3: Rule Update And Full Verification

### Task 5: Add the UI contrast rule

**Files:**
- Modify: `C:\Users\Asus\Documents\FYP\FYP\AGENTS.md`

- [ ] **Step 1: Add a concise rule requiring readable contrast between text/content and the surface/background in both light and dark themes**
- [ ] **Step 2: Review the final wording to keep it enforceable and specific**

### Task 6: Verify the full batch

**Files:**
- No code changes expected

- [ ] **Step 1: Run backend focused tests**
- [ ] **Step 2: Run `backend/main-service` build if touched indirectly**
- [ ] **Step 3: Run frontend focused tests**
- [ ] **Step 4: Run `frontend` type-check, lint, and build**
- [ ] **Step 5: Summarize residual risks, especially architecture trade-offs versus the event-driven alternative**
