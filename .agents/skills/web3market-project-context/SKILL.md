---
name: web3market-project-context
description: Use when starting any task in the Web3Market FYP project (kienai.id.vn) — covers stack, architecture, common mistakes, DB migration workflow, payment flow, Docker deploy pipeline, and project-specific conventions. Must read before touching backend, frontend, smart contracts, or deployment.
---

# Web3Market — Project Context & Conventions

## Stack Overview

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind, wagmi v2, viem, RainbowKit |
| Main Backend | Node.js 22 + Express, TypeScript, PostgreSQL, Redis, RabbitMQ |
| Payment Backend | Node.js 22 service, connects to both `marketplace_db` AND `payment_db` |
| Smart Contracts | Solidity (Hardhat), EscrowCore.sol, CreditScoreSBT.sol |
| AI Service | Python (FastAPI) |
| Deploy | Docker Compose on VPS `103.20.96.79` — images built locally or by GitHub Actions, pushed to Docker Hub (`kiendzpro/`), VPS only pulls/restarts |
| Domain | `https://kienai.id.vn` (Nginx reverse proxy → Docker containers) |

## Project Structure

```
FinalYear/
├── frontend/               Next.js App Router
├── backend/
│   ├── main-service/       Port 3001 — orders, users, products, auth
│   └── payment-service/    Port 3002 — crypto payments, PayPal, escrow
├── contracts/              Hardhat — EscrowCore.sol, CreditScoreSBT.sol
├── init_database.sql/
│   ├── schema.sql          Fresh install only (used by docker-entrypoint-initdb.d)
│   ├── seed.sql            Initial data
│   ├── db-migrate.sh       Migration runner script
│   ├── Dockerfile.migrator Build db-migrator image
│   └── migrations/         Versioned migrations (001_..., 002_..., etc.)
├── docker/
│   ├── docker-compose.prod.yml   VPS production stack
│   └── docker-compose.dev.yml
└── scripts/
    ├── deploy.sh           Full build + push + SSH deploy
    └── vps-full-redeploy.sh
```

## Two Separate PostgreSQL Databases

**CRITICAL** — there are TWO databases running in separate containers:

| Database | Container | Used by |
|---|---|---|
| `marketplace_db` | `marketplace-postgres` | main-service (users, orders, products, disputes) |
| `payment_db` | `marketplace-payment-postgres` | payment-service only |

- `payment-service` connects to **both**: `MAIN_DATABASE_URL` → marketplace_db, `DATABASE_URL` → payment_db
- Migrations in `init_database.sql/migrations/` apply to **marketplace_db only**
- Payment DB schema is in `payment_init_database.sql/`

## Order Status State Machine

Valid transitions only — enforced in `orders.controller.ts`:

```
UNPAID → CANCELLED
UNPAID → TX_SUBMITTED (crypto submit/session flow, via payment-service)
TX_FAILED → new payment session allowed
TX_SUBMITTED → ONCHAIN_CONFIRMED | PAID | TX_FAILED
ONCHAIN_CONFIRMED → PAID | SHIPPED | COMPLETED | DISPUTED
PAID → SHIPPED | COMPLETED | DISPUTED
PAID_PAYPAL → SHIPPED | COMPLETED | DISPUTED
SHIPPED → COMPLETED | DISPUTED
DELIVERED → COMPLETED | DISPUTED
COMPLETED → (terminal)
DISPUTED → (terminal, admin resolves)
REFUNDED → (terminal)
CANCELLED → (terminal)
```

`orders.seller_id` references `seller_profiles.seller_id`, not `users.user_id`. When checking seller permissions, join `seller_profiles` and compare `sp.user_id` to the authenticated user.

## Crypto Payment Flow (End-to-End)

```
Frontend checkout → POST /api/payments/crypto/session
                  → POST /api/payments/crypto/session/:sessionId/quote
                  → walletClient.sendTransaction (MetaMask signs deposit calldata)
                  → POST /api/payments/crypto/session/:sessionId/submit {tx_hash, nonce}
                  → payment-service verifies receipt, records payment events
                  → main-service projection sets TX_SUBMITTED → ONCHAIN_CONFIRMED/PAID or TX_FAILED
                  → Buyer confirms delivery:
                       A) Preferred: frontend calls EscrowCore.buyerConfirmDelivery(orderId32),
                          then POST /api/orders/:id/status
                          {status:'COMPLETED', completion_source:'buyer_onchain', release_tx_hash}
                          Main-service stores release_tx_hash and must NOT trigger a second release.
                       B) Backend/admin path: main-service calls payment-service
                          POST /api/payments/crypto/release with X-Internal-Service-Key,
                          payment-service calls escrowContract.releasePayment(orderId32).
                  → After successful release: seller payout wallet receives funds, order becomes COMPLETED.
```

## Critical orderId Encoding (Smart Contract)

**Backend** (payment-service): `ethers.keccak256(ethers.toUtf8Bytes(internal_order_id))`  
**Frontend** (wagmi/viem): `keccak256(toBytes(order.internal_order_id))` — uses `toBytes` NOT `stringToHex`

`toBytes` = UTF-8, `toHex` = hex-encoded string — they produce **different** hashes and cause silent contract failures. Always use `toBytes`.

## Internal Service Authentication

**Never** forward user JWT tokens between services (security risk + auth failures).

For `main-service → payment-service` calls:
```typescript
headers: { 'X-Internal-Service-Key': process.env.INTERNAL_SERVICE_KEY }
```

The `/api/payments/crypto/release` endpoint on payment-service uses `authenticateOrInternalKey` middleware — accepts admin JWT **or** internal key. Env var: `INTERNAL_SERVICE_KEY` must be the same value in main-service and payment-service. Never expose this key as a public `NEXT_PUBLIC_*` frontend variable.

## Auth Routing and Login Ownership

There are two different auth systems sharing the `/api/auth` prefix:

| Path group | Owner | Notes |
|---|---|---|
| `/api/auth/session`, `/api/auth/csrf`, `/api/auth/signin`, `/api/auth/signout`, `/api/auth/callback/*`, `/api/auth/providers`, `/api/auth/error`, `/api/auth/_log` | Next.js frontend / NextAuth | Must route to port `3000` |
| `/api/auth/register`, `/api/auth/login`, `/api/auth/wallet-login`, `/api/auth/oauth`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/forgot-password`, `/api/auth/reset-password` | main-service backend | Must route to port `3001` |

Never configure nginx with `location ^~ /api/auth/` pointing all auth traffic to the frontend. It breaks backend registration, password reset, wallet login, OAuth handoff, refresh, and logout blacklist. Use a narrow regex for only the NextAuth endpoints or rename one namespace deliberately.

Current login flows:
- Email/password login uses NextAuth `CredentialsProvider`, which server-to-server posts to main-service `/api/auth/login`.
- Google/Facebook OAuth uses NextAuth callbacks, then server-to-server posts to main-service `/api/auth/oauth` with `X-Internal-Service-Key`.
- Wallet login uses SIWE-style signed messages through NextAuth `wallet`, then main-service `/api/auth/wallet-login`.
- Register, forgot-password, reset-password, and backend logout are direct main-service endpoints from browser/client code.

Security rules:
- `INTERNAL_SERVICE_KEY` may exist in the Next.js server runtime for internal calls, but must never be exposed as `NEXT_PUBLIC_*` or used in browser code.
- If login CAPTCHA is intended, enforcement must happen server-side on the path that actually receives credentials. UI-only CAPTCHA is not a security control.
- If backend auth rate limiting skips internal Docker IPs for NextAuth server-to-server calls, add equivalent rate limiting at the NextAuth endpoint or forward/use the real client IP safely.
- SIWE messages must use the connected chain ID and canonical frontend origin. Production should either redirect `www.kienai.id.vn` to `kienai.id.vn` or explicitly allow both origins.

## Database Migration System

**NEVER edit `schema.sql` to add new columns/tables** — existing volumes won't pick it up.

**Always create a new migration file:**

```
init_database.sql/migrations/NNN_descriptive_name.sql
```

Rules:
- 3-digit zero-padded prefix: `001`, `002`, `003`...
- All statements must be idempotent (`IF NOT EXISTS`, `DO $$ BEGIN ... EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
- End with `SELECT 'Migration NNN applied: name' AS result;`
- **Never** use DROP TABLE, TRUNCATE, or destructive operations

The `db-migrator` Docker container reads `schema_migrations` table and only runs files not yet applied.

**To deploy migrations to VPS:**
```bash
bash scripts/deploy.sh          # build all + db-migrator + push + SSH deploy
# or just migrator (no code changes):
BUILD_ALL=false bash scripts/deploy.sh
```

## Docker Compose Deploy Order

```
postgres (healthy) → db-migrator (runs migrations, exits 0)
                                  ↓
                    main-api + payment-api start (service_completed_successfully)
                                  ↓
                    frontend starts
```

`db-migrator` uses `restart: "no"` — runs once per deploy then exits. Remove old container before redeploy:
```bash
docker rm -f marketplace-db-migrator
```

## VPS Resource Rule

VPS `103.20.96.79` is a low-resource production host with 2 CPU cores.

- Local workspace `C:\Users\Asus\Documents\FYP\FYP` is the source of truth unless the user explicitly says otherwise.
- Do not use VPS Git state or GitHub branch state as the deploy authority.
- Do not run `git pull`, `git reset`, branch switching, or destructive cleanup on VPS unless explicitly authorized for that exact command.
- Do not run `docker build`, `npm run build`, `next build`, `npx tsc`, `hardhat compile`, `hardhat test`, or other CPU-heavy jobs on VPS unless explicitly authorized.
- VPS deploy work should be limited to pulling pre-built images, lightweight migrations, env updates, container restart, log reads, and health checks.

## Environment Variables — Key Ones

| Var | Where | Value |
|---|---|---|
| `INTERNAL_SERVICE_KEY` | main-service, payment-service | Must match in both |
| `PAYMENT_SERVICE_URL` | main-service | `http://payment-api:3002` (Docker) |
| `DATABASE_URL` | payment-service | Points to payment_db |
| `MAIN_DATABASE_URL` | payment-service | Points to marketplace_db |
| `DEFAULT_CHAIN_ID` | payment-service | `31337` (Hardhat demo chain) |
| `ESCROW_CONTRACT_LOCALHOST` | payment-service, frontend | Contract address on Hardhat |
| `NEXT_PUBLIC_HARDHAT_RPC_URL` | frontend | Production default is `https://kienai.id.vn/rpc/hardhat`; local dev can set `http://127.0.0.1:8545` |
| `LOCALHOST_RPC_URL` | payment-service/contracts | Docker internal value should be `http://hardhat-node:8545` |
| `PAYMENT_INVOICE_RATE_LIMIT_MAX` | payment-service | Optional override for invoice/session creation limit; default `10` per 5 minutes |
| `NEXTAUTH_URL` | frontend | Production canonical URL should be `https://kienai.id.vn` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | frontend server runtime | Required for Google OAuth through NextAuth |
| `HCAPTCHA_SECRET` | main-service | Required in production for register CAPTCHA verification |
| `FRONTEND_URL` | main-service, payment-service | Canonical frontend origin; keep aligned with SIWE and CORS |

## Common Mistakes & Fixes

### 1. `order_status_check` constraint violation
**Symptom:** `ERROR: new row for relation "orders" violates check constraint "orders_status_check"`  
**Fix:** Run migration `001_payment_system_fixes.sql` which extends the CHECK constraint to include `ONCHAIN_CONFIRMED`, `DISPUTED`, `TX_SUBMITTED`, etc.

### 2. `ON CONFLICT (order_id)` fails on disputes table
**Symptom:** `ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification`  
**Fix:** Migration `001` adds `UNIQUE` constraint on `disputes(order_id)`. Run it.

### 3. Payment release triggers wrong status
**Symptom:** Order shows `PAID` after escrow release instead of `COMPLETED`  
**Fix:** `releaseFunds()` in payment-service must update to `COMPLETED` (not `PAID`) and store `release_tx_hash`.

### 4. UI appears frozen during payment
**Symptom:** Spinner shows but no feedback during MetaMask signing or blockchain confirmation  
**Fix:** Use 4-step `PayStep` enum: `signing → submitted → confirming → done`. Set `setSubmitting(false)` after `submitted`, not after `done`. Show live progress panel.

### 5. `disputes` insert fails with missing column
**Symptom:** `column "updated_at" of relation "disputes" does not exist`  
**Fix:** Migration `001` adds `updated_at` to disputes. Also use `SET reason = EXCLUDED.reason` (not `$3`) in ON CONFLICT clause.

### 6. VPS schema out of sync with local code
**Symptom:** New columns referenced in code don't exist in VPS DB  
**Fix:** Create migration file, build & push db-migrator image, VPS will apply it on next deploy.

### 7. payStep type mismatch with 'approve'
**Symptom:** TypeScript error — `'approve'` not assignable to `PayStep`  
**Fix:** PayStep type is `'idle' | 'signing' | 'submitted' | 'confirming' | 'done' | 'failed'`. Reuse `'signing'` for the approve step.

### 8. Invoice creation blocked by status polling
**Symptom:** Checkout shows `Too many requests for this action` while demo-buying several items.
**Root cause:** `strictLimiter` wrapped all `/api/payments/crypto` routes, so quote/status/submit traffic consumed the same quota as invoice creation.
**Fix:** Use route-level limiters: `invoiceLimiter` for `/session`, `/session-batch`, and legacy `/quote`; `statusLimiter` for status reads; `strictLimiter` for quote submit, verify, release, refund, and admin actions.

### 9. Seller cannot see/update orders
**Symptom:** Seller dashboard/order pages miss seller orders or seller cannot mark shipped/delivered.
**Root cause:** Code compares `orders.seller_id` to authenticated `users.user_id`, but `orders.seller_id` stores `seller_profiles.seller_id`.
**Fix:** Join `seller_profiles sp ON o.seller_id = sp.seller_id` and compare `sp.user_id` with the authenticated user.

### 10. Auth routes work locally but fail in production
**Symptom:** Register, forgot-password, reset-password, wallet login, OAuth handoff, refresh, or logout returns 404/405/403 behind nginx while NextAuth session still works.
**Root cause:** System nginx routed all `/api/auth/*` to Next.js instead of routing only NextAuth-owned subpaths to the frontend.
**Fix:** Keep the narrow NextAuth route list on port `3000`; route backend auth endpoints to main-service port `3001`.

### 11. Hardhat RPC works locally but fails from HTTPS production UI
**Symptom:** MetaMask/RPC fetch fails with CORS, mixed-content, or direct `http://103.20.96.79:8545` errors from `https://kienai.id.vn`.
**Root cause:** Browser config used the direct HTTP VPS RPC instead of the HTTPS nginx proxy.
**Fix:** Set `NEXT_PUBLIC_HARDHAT_RPC_URL=https://kienai.id.vn/rpc/hardhat` before building the frontend image. Keep `http://hardhat-node:8545` only for Docker-internal service calls.

## Key Files Reference

| File | Purpose |
|---|---|
| `frontend/app/checkout/[orderId]/page.tsx` | Crypto payment checkout UI, 4-step flow |
| `frontend/app/orders/[id]/page.tsx` | Order details, confirm delivery, dispute |
| `frontend/app/seller/[slug]/page.tsx` | Public seller storefront/profile and public payout wallet holdings |
| `backend/main-service/src/modules/orders/orders.controller.ts` | Status updates, escrow trigger, dispute creation |
| `backend/payment-service/src/modules/crypto-payment/crypto-payment.service.ts` | Quote, submit, release escrow |
| `backend/payment-service/src/modules/crypto-payment/crypto-payment.routes.ts` | `authenticateOrInternalKey` middleware |
| `backend/payment-service/src/middleware/rate-limit.ts` | API, invoice, strict, and status rate limiters |
| `contracts/contracts/EscrowCore.sol` | Smart contract — escrow logic |
| `init_database.sql/migrations/` | All DB migrations |
| `docker/docker-compose.prod.yml` | Production stack with db-migrator |
| `scripts/deploy.sh` | Full deploy pipeline |

## Hardhat Demo Node

- Chain ID: `31337`
- Frontend/public RPC: `https://kienai.id.vn/rpc/hardhat`
- VPS internal Docker RPC: `http://hardhat-node:8545`
- Direct VPS RPC may exist at `http://103.20.96.79:8545`, but prefer the HTTPS proxy for browser/MetaMask to avoid mixed-content/CORS issues.
- Test private key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` (10000 ETH, for testing only)
- Escrow contract: env var `ESCROW_CONTRACT_LOCALHOST`
- Container: `marketplace-hardhat` (docker network internal: `http://hardhat-node:8545`)

## Supported Order Flow by Payment Method

| Method | Status after payment | Release trigger |
|---|---|---|
| Crypto (ETH/MATIC/BNB) | `ONCHAIN_CONFIRMED` → `PAID` | Buyer clicks "Confirm Delivery" → on-chain `buyerConfirmDelivery()` OR backend `releasePayment()` |
| PayPal | `PAID_PAYPAL` | Admin manual release |

## Vietnamese Language Convention

- All UI text in Vietnamese (user-facing)
- Code, variables, API fields in English
- Toast messages: Vietnamese
- Console logs/errors: English
- Comments in code: Vietnamese OK for complex business logic, English for technical implementation
