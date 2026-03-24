---
name: web3market-known-issues
description: Use when debugging any bug or unexpected behavior in Web3Market — check here first for known issues and proven fixes before starting fresh investigation.
---

# Web3Market — Known Issues & Proven Fixes

> **Agent instruction**: Before debugging any error, search this file for keywords matching the error message or symptom. If a match is found, apply the documented fix directly instead of re-investigating.

## Database & Schema

### 1. `order_status_check` constraint violation
- **Symptom**: `ERROR: new row for relation "orders" violates check constraint "orders_status_check"`
- **Root cause**: CHECK constraint missing newer statuses like `ONCHAIN_CONFIRMED`, `DISPUTED`, `TX_SUBMITTED`
- **Fix**: Run migration `001_payment_system_fixes.sql` — it extends the CHECK constraint
- **Date found**: 2026-03-16

### 2. `ON CONFLICT (order_id)` fails on disputes table
- **Symptom**: `ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification`
- **Root cause**: Missing UNIQUE constraint on `disputes(order_id)`
- **Fix**: Migration `001` adds the constraint. Run it.
- **Date found**: 2026-03-16

### 3. `column "updated_at" of relation "disputes" does not exist`
- **Symptom**: INSERT into disputes fails with missing column
- **Fix**: Migration `001` adds `updated_at`. Also: use `SET reason = EXCLUDED.reason` (not `$3`) in ON CONFLICT clause
- **Date found**: 2026-03-16

### 4. VPS schema out of sync with local code
- **Symptom**: New columns referenced in code don't exist in VPS database
- **Fix**: Create migration file → build & push db-migrator image → VPS applies on next deploy
- **Prevention**: Always create migration for schema changes, never edit `schema.sql` for deployed dbs
- **Date found**: 2026-03-17

## Authentication & Tokens

### 5. Invalid or expired token errors
- **Symptom**: `401 Unauthorized` on API calls, token refresh loop (infinite 401 → refresh → 401)
- **Root cause**: JWT_SECRET mismatch between services, or token refresh endpoint failing
- **Fix**: Ensure `JWT_SECRET` env var is identical across main-service and payment-service. Check that refresh endpoint returns new tokens in correct format.
- **Date found**: 2026-03-18

### 6. Inter-service auth failures
- **Symptom**: main-service → payment-service calls return 401
- **Root cause**: Forwarding user JWT tokens between services (security risk + auth failures)
- **Fix**: Use `X-Internal-Service-Key` header instead. `INTERNAL_SERVICE_KEY` env var must match in both services.
- **Date found**: 2026-03-16

## Smart Contract & Blockchain

### 7. orderId hash mismatch (silent contract failures)
- **Symptom**: Contract calls succeed but operate on wrong orderId, or `releasePayment()` has no effect
- **Root cause**: Frontend uses `toHex()` instead of `toBytes()` — produces different keccak256 hash
- **Fix**: 
  - Backend (ethers): `ethers.keccak256(ethers.toUtf8Bytes(internal_order_id))`
  - Frontend (viem): `keccak256(toBytes(order.internal_order_id))` — **NOT** `stringToHex`
- **Date found**: 2026-03-17

### 8. Payment release triggers wrong status
- **Symptom**: Order shows `PAID` after escrow release instead of `COMPLETED`
- **Fix**: `releaseFunds()` in payment-service must update status to `COMPLETED` (not `PAID`) and store `release_tx_hash`
- **Date found**: 2026-03-16

### 9. payStep type mismatch with 'approve'
- **Symptom**: TypeScript error — `'approve'` not assignable to `PayStep`
- **Fix**: PayStep type is `'idle' | 'signing' | 'submitted' | 'confirming' | 'done' | 'failed'`. Reuse `'signing'` for the approve step.
- **Date found**: 2026-03-18

## Frontend & UI

### 10. UI appears frozen during payment
- **Symptom**: Spinner shows but no feedback during MetaMask signing or blockchain confirmation
- **Fix**: Use 4-step `PayStep` enum: `signing → submitted → confirming → done`. Call `setSubmitting(false)` after `submitted`, not after `done`. Show live progress panel.
- **Date found**: 2026-03-17

### 11. ESM imports in Docker require .js extension
- **Symptom**: `Module not found` in Docker container but works locally
- **Fix**: Add `.js` extension to TypeScript import paths when building for ESM
- **Date found**: 2026-03-15

## Deployment

### 12. db-migrator container hangs on redeploy
- **Symptom**: `db-migrator` container from previous deploy still exists, new one can't start
- **Fix**: Remove old container before redeploy: `docker rm -f marketplace-db-migrator`
- **Date found**: 2026-03-17

### 13. Tokenization service build failures
- **Symptom**: TypeScript compilation errors in `tokenization-service`
- **Fix**: Check for missing type imports, ensure `tsconfig.json` includes all source files
- **Date found**: 2026-03-20
