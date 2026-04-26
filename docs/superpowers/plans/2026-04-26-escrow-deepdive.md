# Escrow Deep-Dive Implementation Plan

> **Goal:** Revert the misaligned custodial deposit flow and replace it with features that leverage the existing non-custodial `EscrowCore.sol` architecture, plus harden the production posture (admin visibility, automated keepers, contract tests, security docs).

**Architecture:** Build on top of existing `EscrowCore.sol` (escrow-based on-chain payment) instead of introducing a parallel custodial flow. Frontend reads on-chain truth via wagmi `useReadContract` and `watchContractEvent`. Backend gains a keeper worker that calls `refundExpired(orderId)` for stale orders. Smart contract tests provide regression safety. Security docs document threat model and limitations.

**Tech Stack:** Solidity 0.8.x, Hardhat, ethers v6, wagmi v2, viem, Next.js 16 App Router, Express, PostgreSQL, RabbitMQ, Docker Compose.

**Current state (commit `b41ca90`):**
- Custodial deposit flow deployed to VPS: `wallet_deposit_intents`, `deposit_indexer_state` tables, indexer worker, frontend `DepositInvoiceCard`. **All to be removed.**
- Migration 020 (`user_wallets_dedup_lowercase`) is genuinely useful — **kept**.
- `EscrowCore.sol` at `0x5FbDB2315678afecb367f032d93F642f64180aa3` (Hardhat) and Polygon Amoy / BSC Testnet.

---

## Phase 1: Revert Custodial Deposit Flow

**Outcome:** No code or schema referring to `wallet_deposit_intents`, `deposit_indexer_state`, `DepositIndexerWorker`, `DepositInvoice`, or `deposit_addresses` config remains.

### Task 1.1: Revert frontend `/wallet` page

**Files:**
- Modify: `frontend/app/wallet/page.tsx`
- Delete: `frontend/components/wallet/DepositInvoice.tsx`

**Steps:**
- [ ] Read current `/wallet/page.tsx` to identify the deposit-intent block.
- [ ] Restore the original "QR address card" block (or leave a clean tab placeholder for Phase 2 Escrow Status).
- [ ] Remove all imports referencing `DepositInvoice`, `DepositIntent`, `ChainToken`, `intents`, `activeIntent`, `tokensByChain`.
- [ ] Verify `tsc --noEmit` passes in `frontend/`.
- [ ] Delete `frontend/components/wallet/DepositInvoice.tsx`.
- [ ] Commit: `revert(frontend): remove custodial deposit UI from /wallet`.

### Task 1.2: Revert main-service wallet endpoints

**Files:**
- Modify: `backend/main-service/src/modules/wallets/wallets.service.ts`
- Modify: `backend/main-service/src/modules/wallets/wallets.controller.ts`
- Modify: `backend/main-service/src/modules/wallets/wallets.routes.ts`

**Steps:**
- [ ] Remove from `wallets.service.ts`: `createDepositIntent`, `listDepositIntents`, `cancelDepositIntent`, `getPlatformDepositAddress`, `buildDepositUri`, `generateReferenceCode`. Revert `getDepositHistory` to not join `wallet_deposit_intents`.
- [ ] Keep: `updateLabel`, `setSellerPayout` (these are useful additions, not custodial-specific).
- [ ] Remove corresponding controller/route handlers for `/deposit-intents`.
- [ ] Verify `tsc --noEmit` passes.
- [ ] Commit: `revert(main-service): remove deposit intent endpoints`.

### Task 1.3: Remove deposit indexer worker

**Files:**
- Modify: `backend/payment-service/src/workers/index.ts`
- Delete: `backend/payment-service/src/workers/deposit-indexer.worker.ts`

**Steps:**
- [ ] Remove `DepositIndexerWorker` import and start call from `workers/index.ts`.
- [ ] Delete `deposit-indexer.worker.ts`.
- [ ] Verify `tsc --noEmit` passes.
- [ ] Commit: `revert(payment-service): remove deposit indexer worker`.

### Task 1.4: Cleanup migrations

**Files:**
- Delete: `init_database.sql/migrations/021_deposit_intents_and_indexer.sql`
- Delete: `init_database.sql/migrations/022_seed_default_deposit_addresses.sql`
- Create: `init_database.sql/migrations/023_drop_deposit_intents_and_indexer.sql`

**Steps:**
- [ ] Write migration 023 that:
  - `DROP TABLE IF EXISTS wallet_deposit_intents CASCADE;`
  - `DROP TABLE IF EXISTS deposit_indexer_state CASCADE;`
  - `ALTER TABLE wallet_deposits DROP COLUMN IF EXISTS intent_id;`
  - `ALTER TABLE wallet_deposits ALTER COLUMN user_id SET NOT NULL;` (only if no NULL rows exist — guard with check)
  - `DELETE FROM platform_config WHERE key = 'deposit_addresses';`
- [ ] Delete migrations 021 and 022 source files (they were applied; deleting source means they won't reapply on fresh installs but `schema_migrations` rows on existing prod stay — harmless metadata).
- [ ] Commit: `revert(db): migration 023 drops deposit-related tables and config`.

### Task 1.5: Deploy Phase 1

- [ ] Build + push only db-migrator + main-api + payment-api + frontend (not ai/tokenization).
- [ ] Run `BUILD_ALL=true bash scripts/deploy.sh`.
- [ ] Verify migration 023 applied: `\dt wallet_deposit_intents` returns nothing.
- [ ] Verify `/wallet` UI no longer shows deposit invoice tab.
- [ ] Verify payment-service logs do not show `[deposit-indexer]`.
- [ ] Verify `/checkout/[orderId]` payment flow unaffected.

---

## Phase 2: Build "Escrow Status" Tab

**Outcome:** A new tab on `/wallet` (or panel on `/orders/[id]`) reads `EscrowCore.getOrder(orderId)` directly via wagmi, displays it side-by-side with DB record, watches events realtime, and warns on discrepancies.

### Task 2.1: Add EscrowCore ABI + helpers in frontend

**Files:**
- Modify: `frontend/lib/web3/contracts.ts`

**Steps:**
- [ ] Export `ESCROW_CORE_ABI` covering `getOrder(bytes32)` view, plus events `OrderCreated`, `OrderCompleted`, `OrderRefunded`, `OrderExpired`, `OrderDisputed`, `DeliveryConfirmed`.
- [ ] Add helper `orderIdToBytes32(uuid: string): \`0x${string}\`` that hashes/encodes the DB UUID to the same `bytes32` key the backend uses (verify by reading `crypto-payment.service` how `orderId` becomes bytes32).
- [ ] Verify `tsc --noEmit` passes.
- [ ] Commit: `feat(frontend): add EscrowCore ABI + bytes32 helper`.

### Task 2.2: `useEscrowOrder(orderId, chainId)` hook

**Files:**
- Create: `frontend/lib/web3/useEscrowOrder.ts`

**Steps:**
- [ ] Hook uses wagmi `useReadContract({ address, abi, functionName: 'getOrder', args: [bytes32], chainId, query: { refetchInterval: 15s } })`.
- [ ] Return shape: `{ buyer, seller, token, amount, fee, status: 'Pending'|'Paid'|'Completed'|'Refunded'|'Disputed'|'Expired', createdAt, expiresAt, isLoading, error }`.
- [ ] Map `OrderStatus` enum → string.
- [ ] Commit: `feat(frontend): add useEscrowOrder hook`.

### Task 2.3: `useEscrowEvents(orderId, chainId)` hook

**Files:**
- Create: `frontend/lib/web3/useEscrowEvents.ts`

**Steps:**
- [ ] Hook uses viem `watchContractEvent` to subscribe to all 6 events filtered by `orderId`.
- [ ] Push events into local state, expose `{ events, latestEvent }`.
- [ ] On new event, trigger `refetch()` on `useEscrowOrder`.
- [ ] Commit: `feat(frontend): add useEscrowEvents hook`.

### Task 2.4: `<EscrowStatusPanel orderId chainId dbOrder />` component

**Files:**
- Create: `frontend/components/escrow/EscrowStatusPanel.tsx`

**Steps:**
- [ ] Two columns: "On-chain" vs "Database".
- [ ] Highlight discrepancies (status, amount, fee, seller) with warning icon + tooltip.
- [ ] Show event timeline with timestamps + tx links to explorer.
- [ ] "View on Explorer" link for contract address.
- [ ] Commit: `feat(frontend): add EscrowStatusPanel component`.

### Task 2.5: Embed panel in `/orders/[id]`

**Files:**
- Modify: `frontend/app/orders/[id]/page.tsx`

**Steps:**
- [ ] Add panel below existing order details, only when `order.payment_method === 'crypto'` and `order.escrow_chain_id` is set.
- [ ] Pass DB order data for comparison.
- [ ] Commit: `feat(orders): embed EscrowStatusPanel on order detail page`.

### Task 2.6: Add tab on `/wallet`

**Files:**
- Modify: `frontend/app/wallet/page.tsx`

**Steps:**
- [ ] Add tab "Trạng thái Escrow" listing all user's crypto orders with their on-chain status.
- [ ] Each row links to `/orders/[id]` for full panel.
- [ ] Commit: `feat(wallet): add escrow status tab listing user crypto orders`.

### Task 2.7: Deploy Phase 2

- [ ] Frontend-only deploy.
- [ ] Smoke test: place a Hardhat order via `/checkout`, observe panel updates as escrow status changes.

---

## Phase 3: Enhance Admin Escrow Dashboard

**Outcome:** `/admin/escrow` shows aggregate metrics + live event feed sourced from on-chain reads.

### Task 3.1: Backend endpoint for escrow aggregates

**Files:**
- Modify: `backend/payment-service/src/modules/crypto-payment/crypto-payment.controller.ts`
- Create: `backend/payment-service/src/modules/crypto-payment/escrow-aggregates.service.ts`

**Steps:**
- [ ] Endpoint `GET /admin/escrow/aggregates`: returns per chain `{ chainId, lockedValue: {token: amount}, paidCount, completedCount, refundedCount, expiredCount, disputedCount }`.
- [ ] Read from existing payments DB (no on-chain query — payments table is the index).
- [ ] Restrict via `requireAdmin` middleware.
- [ ] Commit + test.

### Task 3.2: Soon-to-expire orders list

**Files:**
- Modify: same controller, add `GET /admin/escrow/expiring?within_hours=24`.

**Steps:**
- [ ] Query payments where `escrow_status = 'paid'` AND `expires_at < NOW() + interval '24 hours'`.
- [ ] Return order id, chain, expires_at, locked amount.
- [ ] Commit.

### Task 3.3: Frontend admin dashboard updates

**Files:**
- Modify: `frontend/app/admin/escrow/page.tsx`

**Steps:**
- [ ] Add cards: total locked per chain, by status counts.
- [ ] Add table: soon-to-expire orders with "Trigger refundExpired" button (calls keeper endpoint or direct contract write).
- [ ] Add live event feed using `useEscrowEvents` (no orderId filter — global on EscrowCore address).
- [ ] Commit + deploy.

---

## Phase 4: Expired Order Keeper Worker

**Outcome:** Orders past `expiresAt` automatically refunded without manual intervention.

### Task 4.1: Implement worker

**Files:**
- Create: `backend/payment-service/src/workers/expired-order-keeper.worker.ts`
- Modify: `backend/payment-service/src/workers/index.ts`

**Steps:**
- [ ] Cron interval 1h (configurable).
- [ ] Query payments: `status='paid' AND chain_id IS NOT NULL AND tx_hash IS NOT NULL AND expires_at < NOW()`.
- [ ] For each, call `escrow.refundExpired(orderIdBytes32)` via operator wallet (already in env).
- [ ] On success: emit `payment.expired_refunded` event, update DB `payment_status='refunded'`, `escrow_status='expired'`.
- [ ] On revert: log + skip (likely already refunded by another path).
- [ ] Idempotency: skip if `escrow_status` already terminal.
- [ ] Unit test with mocked escrow contract.
- [ ] Commit + deploy.

---

## Phase 5: Smart Contract Tests

**Outcome:** `npx hardhat test` passes with comprehensive coverage of EscrowCore.sol happy + edge paths.

### Task 5.1: Test scaffolding

**Files:**
- Create: `contracts/test/EscrowCore.test.ts`

**Steps:**
- [ ] Setup: deploy `EscrowCore`, `MockUSDT`, `CreditScoreSBT`, `FeeVault` (EOA).
- [ ] Helper: `createOrderId(buyer, productId): bytes32`.
- [ ] Helper: `mintUSDT(to, amount)`.
- [ ] Commit.

### Task 5.2: Happy path tests

**Steps:**
- [ ] `deposit` ERC-20: order created, status Paid, fee correct.
- [ ] `depositNative` ETH: order created, balance held in contract.
- [ ] `releasePayment`: seller receives amount, vault receives fee, status Completed.
- [ ] `buyerConfirmDelivery`: same as release + emits `DeliveryConfirmed(onTime=true)` within 24h.
- [ ] `buyerConfirmDelivery` after 24h: `onTime=false`.
- [ ] Commit.

### Task 5.3: Edge cases

**Steps:**
- [ ] Cannot deposit twice with same orderId.
- [ ] Cannot release when status != Paid.
- [ ] Cannot release after expiresAt → reverts.
- [ ] `refund`: only operator, only when Paid or Disputed.
- [ ] `refundExpired`: anyone after `expiresAt`, refunds full amount+fee to buyer.
- [ ] `raiseDispute`: only buyer/seller; status flips to Disputed.
- [ ] `depositBatch` length mismatch reverts.
- [ ] `depositNativeBatch`: msg.value must equal sum.
- [ ] Pause: deposits revert when paused; admin functions still work.
- [ ] Reentrancy guard: malicious token cannot reenter.
- [ ] SBT integration: tier discount applied to fee.
- [ ] Commit.

### Task 5.4: Coverage report

**Steps:**
- [ ] Run `npx hardhat coverage`.
- [ ] Target ≥ 90% statements on EscrowCore.sol.
- [ ] Document results in test file header.
- [ ] Commit.

---

## Phase 6: Security Documentation

**Outcome:** `docs/SECURITY.md` documents threat model, mitigations, limitations, roadmap.

### Task 6.1: Write SECURITY.md

**Files:**
- Create: `docs/SECURITY.md`

**Steps:**
- [ ] Section 1 — Architecture Overview: trust boundaries, components, who holds what key.
- [ ] Section 2 — Threat Model: actors (malicious buyer, seller, admin, attacker, unprivileged user). For each, list attack vectors.
- [ ] Section 3 — Mitigations Inventory: ReentrancyGuard, AccessControl, Pausable, expiresAt, dynamic fee, on-chain dispute, SIWE for wallet binding, parameterized SQL, JWT rotation, hCaptcha, etc. Reference exact file/line numbers.
- [ ] Section 4 — Known Limitations: operator key in env (SPOF), feeVault is EOA, off-chain confirmation counter, dispute resolution centralized, no rate limit on `refundExpired` (DoS via spam — mitigated by gas cost).
- [ ] Section 5 — Roadmap: Gnosis Safe migration for operator role, ProfitDistributor for fee vault, Kleros-like decentralized dispute, signed delivery proofs.
- [ ] Section 6 — Disclosure Process: how to report security issues.
- [ ] Section 7 — Audit Trail: links to GitHub Actions runs, deployed contract addresses with verification on Etherscan.
- [ ] Commit.

---

## Execution Order & Checkpoints

1. **Phase 1** — single deploy, verify prod parity restored.
2. **CHECKPOINT — ask user before Phase 2.** (largest UX-facing addition)
3. **Phase 2** — separate deploy, verify on-chain panel works on Hardhat.
4. **Phase 3** — admin only, low risk.
5. **Phase 4** — keeper worker, MUST be tested on Hardhat first before mainnet.
6. **Phase 5** — local only, no deploy.
7. **Phase 6** — docs only, no deploy.

**Estimated effort:** Phase 1 ~30min, Phase 2 ~3-4h, Phase 3 ~2-3h, Phase 4 ~1-2h, Phase 5 ~3-4h, Phase 6 ~1-2h. Total ~10-16h across 4-6 sessions.
