---
name: web3market-decisions
description: Use when making architectural decisions or modifying core infrastructure in Web3Market — check existing ADRs to maintain consistency, and add new ADRs when making significant decisions.
---

# Web3Market — Architecture Decision Records

> **Agent instruction**: Before proposing architectural changes, check if an existing ADR covers the same concern. If making a new significant decision, append a new ADR at the bottom of this file.

## ADR-001: Two Separate PostgreSQL Databases
- **Context**: Payment data requires isolation from marketplace data for security and cleaner separation
- **Decision**: `marketplace_db` (users, orders, products, disputes) + `payment_db` (crypto payments, blockchain logs)
- **Consequence**: `payment-service` must connect to BOTH databases (`DATABASE_URL` → payment_db, `MAIN_DATABASE_URL` → marketplace_db). Migrations in `init_database.sql/migrations/` apply to marketplace_db only.
- **Status**: Active

## ADR-002: Internal Service Key (not JWT forwarding)
- **Context**: Forwarding user JWT between services is a security risk and causes auth failures when tokens expire mid-request
- **Decision**: Use `X-Internal-Service-Key` header for service-to-service calls
- **Consequence**: `INTERNAL_SERVICE_KEY` env var must match in both main-service and payment-service. The `/release` endpoint uses `authenticateOrInternalKey` middleware.
- **Status**: Active

## ADR-003: OrderId Encoding — keccak256(UTF-8 bytes)
- **Context**: Smart contract uses `bytes32` orderId. Need consistent encoding across backend (ethers) and frontend (viem).
- **Decision**: Always encode as `keccak256(toUTF8Bytes(internal_order_id))`. Never use hex-encoding.
- **Consequence**: Backend: `ethers.keccak256(ethers.toUtf8Bytes(id))`. Frontend: `keccak256(toBytes(id))` (NOT `stringToHex`). Mismatch causes silent contract failures.
- **Status**: Active

## ADR-004: Hardhat Node on VPS for Testing
- **Context**: Need a persistent blockchain for staging/demo without using real testnet (faucet hassles, slow confirmation)
- **Decision**: Run Hardhat node in Docker on VPS (chain ID 31337), deploy contracts there
- **Consequence**: Use known Hardhat test accounts (not real keys). `ESCROW_CONTRACT_LOCALHOST` env var points to deployed address. Hardhat node must be running before payment-service starts.
- **Status**: Active

## ADR-005: Migration System (Never Edit schema.sql)
- **Context**: `schema.sql` is only used by `docker-entrypoint-initdb.d` for fresh installs. Changing it won't affect existing databases with data volumes.
- **Decision**: All schema changes go through versioned migration files in `init_database.sql/migrations/`. The `db-migrator` container tracks applied migrations in `schema_migrations` table.
- **Consequence**: All migrations must be idempotent (`IF NOT EXISTS`, `DO $$ ... EXCEPTION WHEN ...`). Zero-padded 3-digit prefix. End with `SELECT 'Migration NNN applied: ...' AS result;`.
- **Status**: Active

## ADR-006: Docker Deploy Pipeline (Local build → Docker Hub → VPS pull)
- **Context**: VPS has limited resources for building. Need reproducible deploys.
- **Decision**: Build images locally, push to Docker Hub (`kaitojpla/`), VPS pulls and restarts via `scripts/deploy.sh`
- **Consequence**: Must build on same architecture or use multi-platform builds. Deploy order: postgres → db-migrator → main-api + payment-api → frontend.
- **Status**: Active

## ADR-007: Vietnamese UI, English Code
- **Context**: Target users are Vietnamese. Codebase must be maintainable internationally.
- **Decision**: All UI text in Vietnamese, code/variables/API fields in English, toast messages in Vietnamese, console logs in English
- **Consequence**: Use i18n system for all user-facing strings. Vietnamese comments OK for complex business logic only.
- **Status**: Active

## ADR-008: Whale Tracker Uses Client-Side Onchain Queries
- **Context**: Whale tracker needs real-time DEX swap data from BSC/ETH/Polygon
- **Decision**: Frontend queries subgraphs + Etherscan + RPC directly (via Next.js API proxy routes to avoid CORS)
- **Consequence**: Heavy logic in frontend (`pair-tx-fetcher.ts` 625 lines). API keys exposed via `NEXT_PUBLIC_*` env vars. Long-term should move to dedicated backend service.
- **Status**: Active (tech debt acknowledged)

## ADR-009: Crypto Payment Rate Limits Are Route-Specific
- **Context**: Checkout creates sessions, posts quotes, submits tx hashes, and polls status. Applying one strict limiter to all `/api/payments/crypto` routes lets read-only polling consume the same quota as invoice creation, which blocks demos with false `Too many requests` errors.
- **Decision**: Use route-level limiters: `invoiceLimiter` for `/session`, `/session-batch`, and legacy `/quote`; `statusLimiter` for status reads; `strictLimiter` for sensitive writes/admin actions.
- **Consequence**: Demo invoice creation defaults to 10 requests per 5 minutes via `PAYMENT_INVOICE_RATE_LIMIT_MAX`, while status polling remains safe and does not consume invoice quota.
- **Status**: Active

## ADR-010: Seller Identity Uses seller_profiles.seller_id
- **Context**: `orders.seller_id` references `seller_profiles.seller_id`, while authenticated sessions identify users by `users.user_id`.
- **Decision**: Seller ownership checks must join `seller_profiles` and compare `sp.user_id` to the authenticated user. Public seller navigation should use `seller_profiles.slug`.
- **Consequence**: Do not compare `orders.seller_id` directly to `req.user.user_id`. This prevents seller dashboards/order updates from failing when seller profile ids differ from user ids.
- **Status**: Active

## ADR-011: Auth Namespace Is Shared by NextAuth and main-service
- **Context**: NextAuth and backend auth endpoints both live under `/api/auth`. A broad nginx catch-all can send backend register/login/reset/logout endpoints to the wrong service.
- **Decision**: NextAuth owns only `session`, `csrf`, `signin`, `signout`, `callback`, `providers`, `error`, and `_log` subpaths. main-service owns register, login, wallet-login, oauth, refresh, logout, forgot-password, and reset-password.
- **Consequence**: Production nginx must route these groups explicitly. Do not use `location ^~ /api/auth/` pointing all auth requests at the frontend unless the backend namespace is intentionally changed.
- **Status**: Active

## ADR-012: Browser Hardhat RPC Uses HTTPS Proxy
- **Context**: The production site is HTTPS, while the raw Hardhat node can be exposed as plain HTTP on the VPS.
- **Decision**: Browser and MetaMask configuration should use `https://kienai.id.vn/rpc/hardhat`; Docker-internal services should use `http://hardhat-node:8545`.
- **Consequence**: `NEXT_PUBLIC_HARDHAT_RPC_URL` must be set before frontend build and should not use `http://103.20.96.79:8545` for production browser code. Direct IP RPC is infrastructure/debug only.
- **Status**: Active

## ADR-013: No Placeholder User-Facing UI
- **Context**: Dead links, `href="#"`, toast-only coming-soon buttons, and clickable seller text without routes cause demos to look broken and can hide missing product logic.
- **Decision**: Every clickable user-facing element must either navigate to an existing route, execute a real handler, or be visibly disabled with a Vietnamese explanation. Seller names should link to public seller storefronts when a slug is available.
- **Consequence**: Agents must scan affected UI after adding features and list any missing routes/handlers instead of silently leaving placeholders.
- **Status**: Active
