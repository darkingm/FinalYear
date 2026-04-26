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

### 14. Checkout invoice creation hits rate limit during demo
- **Symptom**: Checkout shows `Too many requests for this action, please try again later` after buying several test products.
- **Root cause**: `strictLimiter` was applied to the whole `/api/payments/crypto` router, so polling/status/quote/submit requests shared the same quota as invoice creation.
- **Fix**: Remove router-level `strictLimiter`; apply `invoiceLimiter` to `/session`, `/session-batch`, and legacy `/quote`; apply `statusLimiter` to status reads; keep `strictLimiter` on verify/release/refund/admin/sensitive write routes. Default invoice limit is `10` per 5 minutes via `PAYMENT_INVOICE_RATE_LIMIT_MAX`.
- **Date found**: 2026-04-25

### 15. Seller cannot see or update their own orders
- **Symptom**: Seller dashboard/order detail misses orders or seller cannot mark `SHIPPED`/`DELIVERED`.
- **Root cause**: `orders.seller_id` stores `seller_profiles.seller_id`, but some order queries compared it directly to authenticated `users.user_id`.
- **Fix**: Join `seller_profiles sp ON o.seller_id = sp.seller_id` and compare `sp.user_id` to the authenticated user. Only compare `o.seller_id` after resolving the user's seller profile id.
- **Date found**: 2026-04-25

### 16. Buyer confirm delivery must not double-release escrow
- **Symptom**: Risk of backend trying to release an order after the buyer already released funds on-chain.
- **Root cause**: There are two valid release paths: frontend `buyerConfirmDelivery(orderId32)` and backend/admin `releasePayment(orderId32)`. Triggering both causes an invalid status/revert.
- **Fix**: When frontend sends `completion_source:'buyer_onchain'` with `release_tx_hash`, main-service should store the hash and set `COMPLETED`; do not call payment-service `/release`.
- **Date found**: 2026-04-25

### 17. Backend auth endpoints fail behind production nginx
- **Symptom**: Register, forgot-password, reset-password, wallet-login, oauth handoff, refresh, or logout returns 404/405/403 in production, while `/api/auth/session` still works.
- **Root cause**: System nginx used a broad `location ^~ /api/auth/` and routed every auth request to Next.js/NextAuth. The backend also owns several `/api/auth/*` endpoints.
- **Fix**: Route only NextAuth-owned subpaths (`session`, `csrf`, `signin`, `signout`, `callback`, `providers`, `error`, `_log`) to frontend; route backend auth endpoints to main-service.
- **Date found**: 2026-04-26

### 18. Login CAPTCHA is UI-only
- **Symptom**: Login page asks for CAPTCHA, but a direct request to NextAuth credentials can still try passwords without a CAPTCHA token.
- **Root cause**: The browser checks `captchaToken` before calling `signIn('credentials')`, but the token is not sent to the NextAuth credentials provider or verified by main-service `/api/auth/login`.
- **Fix**: Pass the CAPTCHA token through the credentials flow and verify it server-side, or remove the login CAPTCHA UI and rely on rate limits. Do not treat client-only CAPTCHA as security.
- **Date found**: 2026-04-26

### 19. NextAuth credentials can hide the real client IP from backend rate limit
- **Symptom**: Backend `authLimiter` appears configured, but credential login attempts through NextAuth may be counted as internal server-to-server traffic and skipped.
- **Root cause**: NextAuth calls main-service from the frontend container; internal Docker IP skip logic can bypass backend IP-based rate limiting for public login attempts.
- **Fix**: Add rate limiting at the NextAuth credentials endpoint or forward/use a trustworthy original client IP in limiter keys. Keep internal-key endpoints protected separately.
- **Date found**: 2026-04-26

### 20. SIWE origin mismatch on `www`
- **Symptom**: Wallet login/linking works on `https://kienai.id.vn` but fails with `Invalid SIWE origin` on `https://www.kienai.id.vn`.
- **Root cause**: Backend compares signed message URI to `FRONTEND_URL`; production serves both apex and `www` unless nginx redirects one canonical host.
- **Fix**: Canonical-redirect `www` to apex or allow both origins explicitly in SIWE validation.
- **Date found**: 2026-04-26

### 21. Hardhat RPC direct HTTP IP breaks HTTPS frontend
- **Symptom**: MetaMask/RPC fetch fails with mixed-content, CORS, or direct `http://103.20.96.79:8545` errors from production.
- **Root cause**: Browser-facing `NEXT_PUBLIC_HARDHAT_RPC_URL` points to direct HTTP VPS RPC instead of the HTTPS nginx proxy.
- **Fix**: Build/deploy frontend with `NEXT_PUBLIC_HARDHAT_RPC_URL=https://kienai.id.vn/rpc/hardhat`. Keep `http://hardhat-node:8545` only for Docker-internal services.
- **Date found**: 2026-04-26
