# Payment + Order Event-Driven Upgrade Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current payment submit/polling flow with an event-driven payment pipeline that uses payment sessions, outbox publishing, idempotent order projection, and strict backend validation for every payment step.

**Architecture:** Add a payment-domain security layer (`payment session + nonce`), durable event production (`payment_outbox`), and idempotent event consumption (`processed_events`) while keeping `read-through verify` as a safety net. `payment-service` becomes the source of truth for payment processing state; `main-service` becomes the projection layer for order business state.

**Tech Stack:** Next.js 16, Express + TypeScript, PostgreSQL, RabbitMQ, Redis, ethers, Jest, existing payment worker infrastructure.

---

## File Structure

### Existing files to modify

- `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\crypto-payment.routes.ts`
  - Add payment session endpoints and route-level validation.
- `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\crypto-payment.controller.ts`
  - Add controllers for session creation, session quote, guarded submit, guarded status.
- `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\crypto-payment.service.ts`
  - Remove direct “frontend drives state” assumptions.
  - Delegate to payment session and payment event services.
- `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\workers\index.ts`
  - Start the new outbox dispatcher and chain verification worker coordination.
- `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\workers\tx-monitor.worker.ts`
  - Convert into fallback verifier instead of primary state driver.
- `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\config\rabbitmq.ts`
  - Add durable payment event subscription/publish helpers if missing.
- `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\config\rabbitmq.ts`
  - Add order payment event consumer bootstrap.
- `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\server.ts`
  - Start order projection consumer after DB/RabbitMQ are ready.
- `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\modules\orders\orders.controller.ts`
  - Stop using payment endpoints as the main order sync mechanism.
  - Keep only buyer/seller business actions.
- `C:\Users\Asus\Documents\FYP\FYP\frontend\app\checkout\[orderId]\page.tsx`
  - Switch checkout to payment session flow.
- `C:\Users\Asus\Documents\FYP\FYP\frontend\app\orders\[id]\page.tsx`
  - Read event-driven payment snapshot and expose secure recheck path.
- `C:\Users\Asus\Documents\FYP\FYP\frontend\lib\api\client.ts`
  - Keep auth handling intact; add payment session-aware helpers only if needed.

### New files to create

- `C:\Users\Asus\Documents\FYP\FYP\payment_init_database.sql\03_payment_event_infra.sql`
  - Payment DB migration for `payment_sessions` and `payment_outbox`.
- `C:\Users\Asus\Documents\FYP\FYP\init_database.sql\migrations\008_payment_event_projection.sql`
  - Main DB migration for `processed_events` and any projection metadata on `orders`.
- `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\payment-session.service.ts`
  - Create/validate/consume payment sessions.
- `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\payment-event.contract.ts`
  - Event names, payload schemas, versioning constants.
- `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\payment-event.service.ts`
  - Build outbox records and enforce payment state transitions.
- `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\payment-session.validation.ts`
  - Guard functions for nonce, expiry, ownership, replay, and payload matching.
- `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\workers\payment-outbox.worker.ts`
  - Dispatch unpublished outbox events to RabbitMQ with retry-safe logic.
- `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\modules\orders\order-payment-projection.service.ts`
  - Map payment events to order state transitions.
- `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\modules\orders\order-payment-events.consumer.ts`
  - Subscribe to payment events and apply projection idempotently.
- `C:\Users\Asus\Documents\FYP\FYP\frontend\lib\payments\payment-session.ts`
  - Frontend client-side helpers for session creation and guarded calls.
- `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\__tests__\payment-session.service.test.ts`
- `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\__tests__\payment-event.service.test.ts`
- `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\workers\__tests__\payment-outbox.worker.test.ts`
- `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\modules\orders\__tests__\order-payment-projection.service.test.ts`
- `C:\Users\Asus\Documents\FYP\FYP\frontend\__tests__\payment-session.test.ts`

### Existing tests to update

- `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\__tests__\crypto-payment-status.test.ts`
- `C:\Users\Asus\Documents\FYP\FYP\frontend\__tests__\order-presentation.test.ts`
- `C:\Users\Asus\Documents\FYP\FYP\frontend\__tests__\order-tracking-snapshot.test.tsx`

---

## Chunk 1: Database + Event Contract Foundations

### Task 1: Add payment DB infrastructure migration

**Files:**
- Create: `C:\Users\Asus\Documents\FYP\FYP\payment_init_database.sql\03_payment_event_infra.sql`
- Test: manual SQL apply in local payment DB or migration harness check

- [ ] **Step 1: Write the SQL for `payment_sessions`**

```sql
CREATE TABLE payment_sessions (
  session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nonce UUID NOT NULL UNIQUE,
  user_id BIGINT NOT NULL,
  order_id BIGINT NOT NULL,
  token_symbol VARCHAR(16) NOT NULL,
  chain_id INT NOT NULL,
  amount_token DECIMAL(36,18) NOT NULL,
  quote_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(24) NOT NULL DEFAULT 'session_created'
    CHECK (status IN ('session_created','quoted','submitted','expired','invalidated')),
  tx_hash VARCHAR(128),
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_sessions_order_user ON payment_sessions(order_id, user_id);
CREATE INDEX idx_payment_sessions_expires_at ON payment_sessions(expires_at);
```

- [ ] **Step 2: Extend the same SQL file with `payment_outbox`**

```sql
CREATE TABLE payment_outbox (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aggregate_type VARCHAR(32) NOT NULL,
  aggregate_id VARCHAR(128) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  published_at TIMESTAMP,
  retry_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_outbox_pending
  ON payment_outbox(created_at)
  WHERE published_at IS NULL;
```

- [ ] **Step 3: Add updated-at triggers and replay-protection constraints**

```sql
CREATE TRIGGER trg_payment_sessions_upd
BEFORE UPDATE ON payment_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 4: Run a local SQL parse/sanity check**

Run:

```powershell
Get-Content 'C:\Users\Asus\Documents\FYP\FYP\payment_init_database.sql\03_payment_event_infra.sql'
```

Expected: SQL is syntactically consistent with existing schema style and uses ASCII-only object names.

- [ ] **Step 5: Commit**

```bash
git add payment_init_database.sql/03_payment_event_infra.sql
git commit -m "feat: add payment event infrastructure schema"
```

### Task 2: Add main DB projection/inbox migration

**Files:**
- Create: `C:\Users\Asus\Documents\FYP\FYP\init_database.sql\migrations\008_payment_event_projection.sql`
- Test: migration review against existing `schema_migrations` convention

- [ ] **Step 1: Write the failing migration concept into SQL comments**

```sql
-- processed_events prevents duplicate payment event application in main-service
```

- [ ] **Step 2: Add `processed_events` table**

```sql
CREATE TABLE IF NOT EXISTS processed_events (
  event_id UUID PRIMARY KEY,
  event_type VARCHAR(64) NOT NULL,
  aggregate_id VARCHAR(128) NOT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
```

- [ ] **Step 3: Add minimal order projection metadata if needed**

```sql
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_projection_updated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS payment_projection_version INT NOT NULL DEFAULT 0;
```

- [ ] **Step 4: Verify naming aligns with existing migration numbering**

Run:

```powershell
Get-ChildItem 'C:\Users\Asus\Documents\FYP\FYP\init_database.sql\migrations' | Select-Object -ExpandProperty Name
```

Expected: new file is `008_...sql` and follows existing numbering after `007_product_pricing_gallery_normalization.sql`.

- [ ] **Step 5: Commit**

```bash
git add init_database.sql/migrations/008_payment_event_projection.sql
git commit -m "feat: add payment event projection migration"
```

### Task 3: Define durable event contract

**Files:**
- Create: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\payment-event.contract.ts`
- Test: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\__tests__\payment-event.service.test.ts`

- [ ] **Step 1: Write failing tests for event names and payload shape**

```ts
it('uses stable event names for payment lifecycle', () => {
  expect(PAYMENT_EVENT_TYPES.SUBMITTED).toBe('payment.submitted');
  expect(PAYMENT_EVENT_TYPES.CONFIRMED).toBe('payment.confirmed');
});
```

- [ ] **Step 2: Run the test to confirm failure**

Run:

```powershell
cd C:\Users\Asus\Documents\FYP\FYP\backend\payment-service
npx jest src/modules/crypto-payment/__tests__/payment-event.service.test.ts --runInBand
```

Expected: FAIL because contract file/constants do not exist yet.

- [ ] **Step 3: Implement event constants and a strict payload type**

```ts
export const PAYMENT_EVENT_TYPES = {
  SUBMITTED: 'payment.submitted',
  CONFIRMING: 'payment.confirming',
  CONFIRMED: 'payment.confirmed',
  FAILED: 'payment.failed',
  RELEASED: 'payment.released',
  REFUNDED: 'payment.refunded',
} as const;
```

- [ ] **Step 4: Re-run the test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/payment-service/src/modules/crypto-payment/payment-event.contract.ts backend/payment-service/src/modules/crypto-payment/__tests__/payment-event.service.test.ts
git commit -m "feat: add payment event contract"
```

## Chunk 2: Payment Session Security Layer

### Task 4: Build payment session validation service

**Files:**
- Create: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\payment-session.service.ts`
- Create: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\payment-session.validation.ts`
- Test: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\__tests__\payment-session.service.test.ts`

- [ ] **Step 1: Write failing tests for session creation**

```ts
it('creates a session bound to user, order, token, chain and amount', async () => {
  const session = await service.createSession({ userId: 7, orderId: 42, tokenSymbol: 'USDT', chainId: 31337 });
  expect(session.user_id).toBe(7);
  expect(session.order_id).toBe(42);
  expect(session.nonce).toBeDefined();
});
```

- [ ] **Step 2: Add failing tests for replay/mismatch protection**

```ts
it('rejects submit when nonce does not match the stored session', async () => {
  await expect(service.assertUsableSession({ sessionId, nonce: badNonce, ...payload })).rejects.toThrow('Invalid payment session');
});
```

- [ ] **Step 3: Run the tests to ensure red**

Run:

```powershell
cd C:\Users\Asus\Documents\FYP\FYP\backend\payment-service
npx jest src/modules/crypto-payment/__tests__/payment-session.service.test.ts --runInBand
```

Expected: FAIL because service files do not exist.

- [ ] **Step 4: Implement `createSession()`**

Core behavior:

```ts
// pseudocode
load order from main DB
verify order belongs to authenticated user and is payable
derive canonical token/chain/amount from backend data
insert payment_sessions row with nonce + expiry + quote_snapshot
return session snapshot
```

- [ ] **Step 5: Implement `assertUsableSession()`**

Validation rules:

```ts
reject if expired
reject if status is invalidated or expired
reject if JWT user != session.user_id
reject if order/token/chain/amount mismatch
reject if session already consumed by another tx
```

- [ ] **Step 6: Re-run the tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/payment-service/src/modules/crypto-payment/payment-session.service.ts backend/payment-service/src/modules/crypto-payment/payment-session.validation.ts backend/payment-service/src/modules/crypto-payment/__tests__/payment-session.service.test.ts
git commit -m "feat: add guarded payment session service"
```

### Task 5: Expose payment session endpoints

**Files:**
- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\crypto-payment.routes.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\crypto-payment.controller.ts`
- Test: extend `payment-session.service.test.ts` or add controller tests if practical

- [ ] **Step 1: Add failing controller-level test coverage or API assertions**

Test intent:

```ts
POST /api/payments/crypto/session
POST /api/payments/crypto/session/:sessionId/quote
POST /api/payments/crypto/session/:sessionId/submit
GET /api/payments/crypto/session/:sessionId/status
```

- [ ] **Step 2: Run the failing controller test**

Expected: FAIL due to missing routes.

- [ ] **Step 3: Implement controllers using `paymentSessionService`**

Rules:
- create session from authenticated user
- quote only through valid session
- submit only through valid session + matching nonce
- status only for same owner

- [ ] **Step 4: Keep old endpoints temporarily as adapters**

Adapter behavior:
- old `/quote` and `/submit` return a deprecation-safe error or internally create/use session only if backward compatibility is required during migration
- do not remove old endpoints until frontend is migrated and tests pass

- [ ] **Step 5: Re-run tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/payment-service/src/modules/crypto-payment/crypto-payment.routes.ts backend/payment-service/src/modules/crypto-payment/crypto-payment.controller.ts
git commit -m "feat: add payment session endpoints"
```

## Chunk 3: Payment Event Production and Dispatch

### Task 6: Add payment event service with outbox writes

**Files:**
- Create: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\payment-event.service.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\crypto-payment.service.ts`
- Test: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\__tests__\payment-event.service.test.ts`

- [ ] **Step 1: Write failing tests for “state update + outbox record”**

```ts
it('writes payment state and outbox entry together for submit', async () => {
  await service.recordSubmitted(...);
  expect(insertedPayment.status).toBe('pending');
  expect(insertedOutbox.event_type).toBe('payment.submitted');
});
```

- [ ] **Step 2: Add failing test for duplicate submit idempotency**

```ts
it('does not create duplicate submit events for the same tx hash', async () => {
  await service.recordSubmitted(...);
  await service.recordSubmitted(...);
  expect(outboxRows).toHaveLength(1);
});
```

- [ ] **Step 3: Run tests to confirm failure**

Expected: FAIL because service not implemented.

- [ ] **Step 4: Implement `paymentEventService.recordTransition()`**

Core behavior:

```ts
within one logical transaction:
  validate from_state -> to_state
  update payments row
  insert payment_outbox row
```

- [ ] **Step 5: Refactor `submitTransaction()` to use payment session + event service**

Rules:
- validate session before any state change
- mark session submitted
- insert/update payment row
- enqueue `payment.submitted`
- stop relying on frontend as the state driver

- [ ] **Step 6: Refactor `verifyTransaction()` to emit transitions**

Mappings:
- first receipt but not enough confirms -> `payment.confirming`
- enough confirms -> `payment.confirmed`
- reverted -> `payment.failed`

- [ ] **Step 7: Re-run tests**

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/payment-service/src/modules/crypto-payment/payment-event.service.ts backend/payment-service/src/modules/crypto-payment/crypto-payment.service.ts backend/payment-service/src/modules/crypto-payment/__tests__/payment-event.service.test.ts
git commit -m "feat: add payment event outbox transitions"
```

### Task 7: Add outbox dispatcher worker

**Files:**
- Create: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\workers\payment-outbox.worker.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\workers\index.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\config\rabbitmq.ts`
- Test: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\workers\__tests__\payment-outbox.worker.test.ts`

- [ ] **Step 1: Write failing tests for dispatching pending outbox rows**

```ts
it('publishes unpublished outbox rows and marks them as published', async () => {
  await worker.runOnce();
  expect(mockPublish).toHaveBeenCalledWith('payment.confirmed', expect.anything());
  expect(row.published_at).not.toBeNull();
});
```

- [ ] **Step 2: Add failing test for publish failure retry bookkeeping**

```ts
it('increments retry_count and stores last_error when publish fails', async () => {
  mockPublish.mockRejectedValueOnce(new Error('mq down'));
  await worker.runOnce();
  expect(row.retry_count).toBe(1);
});
```

- [ ] **Step 3: Run tests to confirm failure**

- [ ] **Step 4: Implement worker `runOnce()`**

Core behavior:

```ts
select unpublished outbox rows ordered by created_at
publish each row to RabbitMQ
on success set published_at
on error increment retry_count and persist last_error
```

- [ ] **Step 5: Start worker from `startWorkers()`**

Expected behavior:
- worker runs on interval
- interval should not overlap existing runs

- [ ] **Step 6: Re-run tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/payment-service/src/works* backend/payment-service/src/config/rabbitmq.ts
git commit -m "feat: add payment outbox dispatcher worker"
```

## Chunk 4: Order Projection Consumer

### Task 8: Add order projection state machine

**Files:**
- Create: `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\modules\orders\order-payment-projection.service.ts`
- Test: `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\modules\orders\__tests__\order-payment-projection.service.test.ts`

- [ ] **Step 1: Write failing tests for event-to-order mapping**

```ts
it('maps payment.confirmed to PAID', async () => {
  const next = projectOrderStatus({ currentStatus: 'TX_SUBMITTED', eventType: 'payment.confirmed' });
  expect(next).toBe('PAID');
});
```

- [ ] **Step 2: Add failing test for duplicate event idempotency**

```ts
it('ignores an event already stored in processed_events', async () => {
  await service.applyEvent(event);
  await service.applyEvent(event);
  expect(updateCount).toBe(1);
});
```

- [ ] **Step 3: Run tests to confirm failure**

- [ ] **Step 4: Implement projection service**

Core behavior:

```ts
begin transaction
  if event_id already processed -> return noop
  validate event transition against current order status
  update orders.status and projection metadata
  insert processed_events row
commit
```

- [ ] **Step 5: Re-run tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/main-service/src/modules/orders/order-payment-projection.service.ts backend/main-service/src/modules/orders/__tests__/order-payment-projection.service.test.ts
git commit -m "feat: add order payment projection service"
```

### Task 9: Add payment event consumer in main-service

**Files:**
- Create: `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\modules\orders\order-payment-events.consumer.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\config\rabbitmq.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\server.ts`

- [ ] **Step 1: Add failing integration-level test or consumer smoke test**

Test intent:

```ts
it('subscribes to payment lifecycle topics and forwards them to projection service', async () => {
  await consumer.start();
  expect(mockSubscribe).toHaveBeenCalledWith(expect.arrayContaining(['payment.submitted','payment.confirmed']), expect.any(Function));
});
```

- [ ] **Step 2: Run the test to ensure red**

- [ ] **Step 3: Implement consumer wiring**

Required topics:
- `payment.submitted`
- `payment.confirming`
- `payment.confirmed`
- `payment.failed`
- `payment.released`
- `payment.refunded`

- [ ] **Step 4: Start consumer from `server.ts` only after RabbitMQ is connected**

Fallback:
- if RabbitMQ unavailable, service starts but logs that projection consumer is inactive
- reconciliation/read-through remains safety net

- [ ] **Step 5: Re-run tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/main-service/src/modules/orders/order-payment-events.consumer.ts backend/main-service/src/config/rabbitmq.ts backend/main-service/src/server.ts
git commit -m "feat: consume payment events for order projection"
```

## Chunk 5: Frontend Migration

### Task 10: Move checkout to payment session flow

**Files:**
- Create: `C:\Users\Asus\Documents\FYP\FYP\frontend\lib\payments\payment-session.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\app\checkout\[orderId]\page.tsx`
- Test: `C:\Users\Asus\Documents\FYP\FYP\frontend\__tests__\payment-session.test.ts`

- [ ] **Step 1: Write failing frontend tests**

```ts
it('creates a payment session before requesting quote', async () => {
  await startCheckout();
  expect(paymentClient.post).toHaveBeenCalledWith('/api/payments/crypto/session', expect.anything());
});
```

- [ ] **Step 2: Add failing test for guarded submit**

```ts
it('submits tx hash with session_id and nonce', async () => {
  await submitCryptoPayment();
  expect(paymentClient.post).toHaveBeenCalledWith(
    expect.stringContaining('/session/'),
    expect.objectContaining({ nonce: expect.any(String), tx_hash: expect.any(String) })
  );
});
```

- [ ] **Step 3: Run tests to confirm failure**

Run:

```powershell
cd C:\Users\Asus\Documents\FYP\FYP\frontend
npm test -- --runInBand payment-session.test.ts
```

- [ ] **Step 4: Implement `frontend/lib/payments/payment-session.ts`**

Functions:
- `createPaymentSession`
- `getPaymentSessionQuote`
- `submitPaymentSessionTransaction`
- `getPaymentSessionStatus`

- [ ] **Step 5: Refactor checkout page**

Rules:
- create session before quote
- store `session_id`, `nonce`, and expiry in component state
- renew session if expired before submit
- use backend snapshot for confirmation messaging

- [ ] **Step 6: Re-run tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/payments/payment-session.ts frontend/app/checkout/[orderId]/page.tsx frontend/__tests__/payment-session.test.ts
git commit -m "feat: migrate checkout to payment session flow"
```

### Task 11: Update order detail/tracking to read event-driven snapshot

**Files:**
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\app\orders\[id]\page.tsx`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\components\order\OrderTrackingSnapshot.tsx`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\lib\orders\presentation.ts`
- Test: update `order-presentation.test.ts` and `order-tracking-snapshot.test.tsx`

- [ ] **Step 1: Write failing test for event-driven projection copy**

```ts
it('shows blockchain confirmation state from payment snapshot', () => {
  const meta = getOrderStatusMeta('ONCHAIN_PENDING', { verification_state: 'confirming', required_confirmations: 1, confirmations: 0 });
  expect(meta.detail).toContain('Blockchain');
});
```

- [ ] **Step 2: Run the focused tests to verify failure**

- [ ] **Step 3: Wire order detail to session/payment snapshot contract**

Behavior:
- status copy comes from projection + payment snapshot
- manual recheck uses guarded status endpoint
- no client-side guessing of business state

- [ ] **Step 4: Re-run tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/orders/[id]/page.tsx frontend/components/order/OrderTrackingSnapshot.tsx frontend/lib/orders/presentation.ts frontend/__tests__/order-presentation.test.ts frontend/__tests__/order-tracking-snapshot.test.tsx
git commit -m "feat: align order tracking with payment event projection"
```

## Chunk 6: Fallbacks, Reconciliation, and Verification

### Task 12: Keep read-through verify as migration safety net

**Files:**
- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\crypto-payment.service.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\crypto-payment.status.ts`
- Test: extend `crypto-payment-status.test.ts`

- [ ] **Step 1: Add failing test for “event lag but status endpoint heals state”**

```ts
it('re-verifies chain when payment is stuck in submitted state', async () => {
  const snapshot = await service.getPaymentStatus(orderId);
  expect(snapshot.verification_state).toBe('confirmed');
});
```

- [ ] **Step 2: Run the failing test**

- [ ] **Step 3: Refine status service so it cooperates with event-driven state**

Rules:
- read-through verify remains fallback, not the primary path
- never regress a more advanced payment state
- include `stuck_reason`, `verification_message`, `last_verified_at`

- [ ] **Step 4: Re-run tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/payment-service/src/modules/crypto-payment/crypto-payment.service.ts backend/payment-service/src/modules/crypto-payment/crypto-payment.status.ts backend/payment-service/src/modules/crypto-payment/__tests__/crypto-payment-status.test.ts
git commit -m "feat: preserve read-through verify as payment fallback"
```

### Task 13: Add reconciliation command or repair path

**Files:**
- Create: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\workers\payment-reconciliation.worker.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\workers\index.ts`

- [ ] **Step 1: Write a failing test or documented worker contract**

Behavior:
- scan recent `payments`
- compare against `orders`
- repair stale projection by emitting recovery events or re-running projection

- [ ] **Step 2: Implement minimal reconciliation worker**

Rules:
- idempotent
- narrow scan window
- log mismatches with concrete identifiers

- [ ] **Step 3: Run payment-service tests/build**

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/payment-service/src/workers/payment-reconciliation.worker.ts backend/payment-service/src/workers/index.ts
git commit -m "feat: add payment reconciliation worker"
```

## Chunk 7: Full Verification and Rollout

### Task 14: Run full verification suite

**Files:**
- Verify all files touched in prior tasks

- [ ] **Step 1: Run payment-service focused tests**

```powershell
cd C:\Users\Asus\Documents\FYP\FYP\backend\payment-service
npx jest src/modules/crypto-payment/__tests__/payment-session.service.test.ts src/modules/crypto-payment/__tests__/payment-event.service.test.ts src/modules/crypto-payment/__tests__/crypto-payment-status.test.ts src/workers/__tests__/payment-outbox.worker.test.ts --runInBand
```

Expected: all targeted payment tests PASS.

- [ ] **Step 2: Run payment-service build**

```powershell
cd C:\Users\Asus\Documents\FYP\FYP\backend\payment-service
npm run build
```

Expected: PASS.

- [ ] **Step 3: Run main-service projection tests/build**

```powershell
cd C:\Users\Asus\Documents\FYP\FYP\backend\main-service
npx jest src/modules/orders/__tests__/order-payment-projection.service.test.ts --runInBand
npm run build
```

Expected: PASS.

- [ ] **Step 4: Run frontend tests/type-check/build**

```powershell
cd C:\Users\Asus\Documents\FYP\FYP\frontend
npm test -- --runInBand payment-session.test.ts order-presentation.test.ts order-tracking-snapshot.test.tsx
npx tsc --noEmit
npm run build
```

Expected: PASS.

- [ ] **Step 5: Perform manual integration smoke check**

Checklist:
- create order
- create payment session
- quote through session
- submit tx
- observe `payment.submitted` -> `payment.confirming` -> `payment.confirmed`
- confirm order status becomes `PAID`
- buyer completion triggers release path without contract mismatch

- [ ] **Step 6: Commit final implementation**

```bash
git add -A
git commit -m "feat: migrate payment order sync to event-driven flow"
```

---

## Notes for Execution

- Preserve backward compatibility until the new checkout session flow is green.
- Do not remove `read-through verify` until event-driven sync has been verified under failure conditions.
- Do not trust frontend-provided `amount`, `token`, or `chain` after this migration; always derive canonical values from backend session state.
- If payment DB migration deployment is blocked by the current repo tooling, create a dedicated `payment migration runner` in the same execution batch before enabling the new schema in production.

## Spec Reference

- [2026-04-19-payment-order-event-driven-design.md](/C:/Users/Asus/Documents/FYP/FYP/docs/superpowers/specs/2026-04-19-payment-order-event-driven-design.md)
