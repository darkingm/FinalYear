# Payment Read-Through Verify And Demo Polish Design

## Goal

Stabilize crypto checkout so orders do not appear stuck at "waiting for miner confirmation", make tracking surfaces clearer for demo/protection use, and enforce a UI readability rule that prevents text from blending into its background.

## Current Problem

- `submit` triggers a best-effort async `verifyTransaction(txHash)` call, but the main frontend polling path only reads stored payment/order rows.
- If immediate verification fails and the background worker is delayed or misses a cycle, the order can remain in `TX_SUBMITTED` or `ONCHAIN_PENDING` even after the transaction is visible on-chain.
- Order detail and checkout use several hard-coded light-on-light color combinations in light mode, which makes important tracking text unreadable during demos.

## Architecture

### 1. Payment Status Read-Through Verification

- Keep the existing background `tx-monitor` worker.
- Upgrade the payment status path so `GET /api/payments/crypto/status/:orderId` becomes a read-through status endpoint:
  - read the order and latest payment row
  - if the order is still in an on-chain pending state and a `tx_hash` exists, trigger `verifyTransaction(tx_hash)` inline before returning the payload
  - return the refreshed order/payment snapshot, not just the stale database state
- Add response fields that explain the state machine to the frontend:
  - `verification_state`
  - `required_confirmations`
  - `confirmations`
  - `last_verified_at`
  - `stuck_reason` or `verification_message`

This keeps the current architecture intact while removing the main "stuck forever" failure mode.

### 2. Demo-Oriented Tracking Surfaces

- Checkout and order detail should expose the same payment-tracking language:
  - what happened
  - what the system is waiting on
  - what the next step is
- Add a visible manual refresh / retry-check action when payment is still pending.
- If the chain is still confirming, show the confirmation progress directly instead of a vague miner-wait message.
- If verification failed because of RPC issues, show a human-readable explanation while keeping the order safe.

### 3. Readability And Contrast Guardrails

- Update the project rule file so new UI work must not render text or key content with insufficient contrast against its surface/background.
- Remove hard-coded `text-white`, `text-gray-100`, and similar classes on light-mode-sensitive order/checkout surfaces where they currently wash out against bright backgrounds.
- Use semantic light/dark-compatible text tokens instead of effect-specific colors for core information.

## Data Flow

1. Buyer sends transaction.
2. Backend stores `TX_SUBMITTED` and a `payments.pending` row.
3. Frontend polls payment status.
4. Status endpoint performs read-through verification when needed.
5. If enough confirmations exist:
   - payment row becomes confirmed
   - order becomes `PAID`
6. Frontend receives refreshed state and updates the journey UI immediately.

## Error Handling

- Missing payment row: return a structured `not_found` state instead of generic "pending".
- RPC timeout/rate limit: keep order safe, return `verification_state = retrying` plus a readable message.
- Reverted transaction: mark `TX_FAILED` and expose the reason cleanly.
- No `tx_hash`: avoid verification attempts and return a clear "waiting for submission" state.

## Testing

- Backend tests for read-through status behavior and verification metadata mapping.
- Frontend tests for new tracking summary copy and contrast-friendly presentation metadata.
- Existing checkout/order page tests should continue passing after wiring in the richer status payload.
