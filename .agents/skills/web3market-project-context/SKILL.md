---
name: web3market-project-context
description: Use when starting any task in the Web3Market FYP project (kienai.id.vn) — covers stack, architecture, common mistakes, DB migration workflow, payment flow, Docker deploy pipeline, and project-specific conventions. Must read before touching backend, frontend, smart contracts, or deployment.
---

# Web3Market — Project Context & Conventions

## Stack Overview

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind, wagmi v2, RainbowKit |
| Main Backend | Node.js + Express, TypeScript, PostgreSQL, Redis, RabbitMQ |
| Payment Backend | Separate Node.js service, connects to both `marketplace_db` AND `payment_db` |
| Smart Contracts | Solidity (Hardhat), EscrowCore.sol, CreditScoreSBT.sol |
| AI Service | Python (FastAPI) |
| Deploy | Docker Compose on VPS `103.20.96.79` — images built locally, pushed to Docker Hub (`kiendzpro/`), VPS pulls |
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
UNPAID → TX_SUBMITTED (crypto flow, via payment-service event)
TX_SUBMITTED → ONCHAIN_CONFIRMED | TX_FAILED
ONCHAIN_CONFIRMED → PAID | SHIPPED
PAID → SHIPPED | DISPUTED
SHIPPED → COMPLETED | DISPUTED
COMPLETED → (terminal)
DISPUTED → (terminal, admin resolves)
REFUNDED → (terminal)
CANCELLED → (terminal)
```

**Never** set status directly to `COMPLETED` from `UNPAID` or `PAID` — state machine will reject it.

## Crypto Payment Flow (End-to-End)

```
Frontend checkout → GET /api/payments/crypto/quote
                  → walletClient.sendTransaction (MetaMask signs)
                  → POST /api/payments/crypto/submit {order_id, tx_hash}
                  → payment-service blockchain listener → event 'payment.confirmed'
                  → main-service sets status ONCHAIN_CONFIRMED or PAID
                  → Buyer confirms delivery → POST /api/orders/:id/status {status:'COMPLETED'}
                  → main-service calls payment-service POST /api/crypto-payment/release
                  → payment-service calls escrowContract.releasePayment(orderId32)
                  → After release: order status → COMPLETED, release_tx_hash stored
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

The `/release` endpoint on payment-service uses `authenticateOrInternalKey` middleware — accepts JWT **or** internal key. Env var: `INTERNAL_SERVICE_KEY` (same value in both services).

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

## Environment Variables — Key Ones

| Var | Where | Value |
|---|---|---|
| `INTERNAL_SERVICE_KEY` | main-service, payment-service | Must match in both |
| `PAYMENT_SERVICE_URL` | main-service | `http://payment-api:3002` (Docker) |
| `DATABASE_URL` | payment-service | Points to payment_db |
| `MAIN_DATABASE_URL` | payment-service | Points to marketplace_db |
| `DEFAULT_CHAIN_ID` | payment-service | `31337` (Hardhat VPS) |
| `ESCROW_CONTRACT_LOCALHOST` | payment-service, frontend | Contract address on Hardhat |

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

## Key Files Reference

| File | Purpose |
|---|---|
| `frontend/app/checkout/[orderId]/page.tsx` | Crypto payment checkout UI, 4-step flow |
| `frontend/app/orders/[id]/page.tsx` | Order details, confirm delivery, dispute |
| `backend/main-service/src/modules/orders/orders.controller.ts` | Status updates, escrow trigger, dispute creation |
| `backend/payment-service/src/modules/crypto-payment/crypto-payment.service.ts` | Quote, submit, release escrow |
| `backend/payment-service/src/modules/crypto-payment/crypto-payment.routes.ts` | `authenticateOrInternalKey` middleware |
| `contracts/contracts/EscrowCore.sol` | Smart contract — escrow logic |
| `init_database.sql/migrations/` | All DB migrations |
| `docker/docker-compose.prod.yml` | Production stack with db-migrator |
| `scripts/deploy.sh` | Full deploy pipeline |

## Hardhat VPS Node

- Chain ID: `31337`
- RPC (public): `http://103.20.96.79:8545`
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
