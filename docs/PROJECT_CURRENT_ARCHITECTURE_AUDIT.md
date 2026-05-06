# Web3Market - Current Project Architecture Audit

## Status

This document is being updated progressively while the codebase is being reviewed.

Current review scope:
- Repository structure
- Service architecture
- Authentication, access token, refresh token, session flow
- Frontend stack and routing
- Docker and Docker Compose
- RabbitMQ usage
- Smart contracts and RWA/tokenization modules
- Missing pieces and technical debt

## Review Method

This document is based on the current local workspace at:

`C:\Users\Asus\Documents\FYP\FYP`

Priority of evidence:
1. Source code
2. Active Docker files and environment wiring
3. Project-specific agent rules in `.agents/skills/web3market-*`
4. Existing README and docs

## High-Level Architecture

The current project is no longer a simple 3-part system. It is a multi-service marketplace platform with these main parts:

- `frontend`: Next.js 16 application using App Router
- `backend/main-service`: core marketplace API
- `backend/payment-service`: crypto payment and PayPal service
- `backend/tokenization-service`: RWA/tokenization API layer
- `backend/ai-service`: Python FastAPI AI service
- `contracts`: Hardhat smart contract workspace
- `init_database.sql`: marketplace database schema and migrations
- `payment_init_database.sql`: payment database bootstrap
- `docker`: development and production Docker Compose files
- `docs`: technical and deployment documentation

## Current Repository Structure

Top-level directories currently present:

- `.agents`
- `.github`
- `backend`
- `contracts`
- `docker`
- `docs`
- `frontend`
- `init_database.sql`
- `k8s`
- `mobile`
- `nginx`
- `payment_init_database.sql`
- `scripts`
- `state`

Main backend services currently present under `backend`:

- `ai-service`
- `main-service`
- `payment-service`
- `tokenization-service`

This means the current system is broader than the older README summary and already includes RWA/tokenization and AI service expansion.

## Initial Findings

- The workspace contains active code for four backend services, not two.
- The current architecture uses two PostgreSQL databases: one for marketplace data and one for payment data.
- Authentication is hybrid: NextAuth in frontend plus JWT access/refresh tokens from `main-service`.
- Token/session storage is split across secure cookies, NextAuth JWT session, and browser local storage.
- RabbitMQ is present and used for asynchronous event handling, but some parts are coded as optional/best-effort.
- Production Docker Compose is significantly more advanced than the root README suggests.
- The production compose file still contains at least one risky frontend RPC setting that appears inconsistent with the newer project rules and may need correction in the final audit.

## In Progress

The next update will fill in:

- Auth architecture
- Access token / refresh token lifecycle
- Session persistence behavior
- Logout and token invalidation behavior

## Authentication Architecture

The current authentication design is hybrid and includes two layers:

### Layer 1: NextAuth in the frontend

Frontend authentication session management is handled by NextAuth at:

- `frontend/app/api/auth/[...nextauth]/route.ts`

Current providers implemented:

- Credentials provider for email/username + password
- Credentials provider for wallet login
- Google OAuth provider
- Facebook OAuth provider

NextAuth responsibilities in this project:

- Maintain the browser session for the frontend
- Store auth state in NextAuth JWT session strategy
- Refresh backend access tokens before expiry
- Expose `session.accessToken` and `session.refreshToken` to the frontend session object

### Layer 2: JWT authentication from main-service

Backend token issuance is handled by:

- `backend/main-service/src/modules/auth/auth.service.ts`
- `backend/main-service/src/modules/auth/auth.controller.ts`
- `backend/main-service/src/middleware/auth.middleware.ts`

Current backend auth methods:

- Email/password login
- Wallet login through signature verification
- OAuth login handoff from NextAuth server-side callback
- Register
- Refresh token
- Logout
- Forgot/reset password
- Wallet linking for authenticated users

## What Is Used For Auth

The current project uses these auth technologies together:

- `next-auth` for frontend session orchestration
- `jsonwebtoken` for backend `accessToken` and `refreshToken`
- `bcrypt` for password hashing
- `hCaptcha` for registration verification
- `ethers.verifyMessage()` for wallet login signature verification
- Redis for refresh-token blacklist and SIWE nonce replay protection

## Current Login Flows

### Email/password login

Flow:

1. User submits credentials on frontend login page.
2. Frontend calls `signIn('credentials')`.
3. NextAuth server-side `authorize()` posts credentials to `main-service /api/auth/login`.
4. Backend verifies password and returns:
   - `user`
   - `accessToken`
   - `refreshToken`
5. NextAuth stores these values inside its JWT session token.
6. Frontend session exposes them through `useSession()` and `useAuth()`.

### Wallet login

Flow:

1. Frontend gets signed message from connected wallet.
2. Frontend calls `signIn('wallet')`.
3. NextAuth posts to `main-service /api/auth/wallet-login`.
4. Backend verifies signature using `ethers.verifyMessage`.
5. Backend validates SIWE-style fields:
   - nonce
   - issued at
   - expiration time
   - address match
   - chain id whitelist
   - frontend origin in production
6. Backend creates user if wallet does not exist yet.
7. Backend returns JWT tokens.

### Google/Facebook OAuth

Flow:

1. User signs in through NextAuth OAuth provider.
2. NextAuth callback runs server-side.
3. NextAuth posts profile data to `main-service /api/auth/oauth`.
4. This endpoint is protected by `X-Internal-Service-Key`.
5. Backend links existing account or creates new one.
6. Backend returns JWT tokens which are stored into NextAuth JWT state.

### Registration

Registration is not owned by NextAuth. It goes directly to backend:

- Frontend calls `POST /api/auth/register`
- Backend verifies hCaptcha server-side
- Backend creates user and returns:
  - `accessToken`
  - `refreshToken`
  - `user`
- Backend also sets refresh token cookie directly

This means registration and login are not fully symmetrical in implementation.

## Where Session And Tokens Are Stored

The current system stores auth data in multiple places:

### 1. NextAuth session cookie

NextAuth uses `session.strategy = 'jwt'`.

So the frontend session is primarily held by NextAuth in its own cookie:

- production name: `__Secure-next-auth.session-token`
- development name: `next-auth.session-token`

This is the main browser session representation for frontend auth state.

### 2. Backend refresh token cookie

`main-service` sets:

- cookie name: `refreshToken`
- attributes:
  - `httpOnly: true`
  - `sameSite: 'strict'`
  - `secure: true` in production
  - `maxAge: 7 days`

This cookie is set in:

- register
- login
- wallet login
- oauth login
- refresh

It is cleared on logout.

### 3. NextAuth JWT payload

NextAuth stores backend values into its token/session payload:

- `accessToken`
- `refreshToken`
- `accessTokenExpiry`
- `role`
- `walletAddress`

### 4. Browser localStorage

Frontend also mirrors `accessToken` into:

- `localStorage['auth_token']`

This is done in:

- `frontend/lib/hooks/useAuth.ts`
- `frontend/lib/auth/session-token-manager.ts`

Purpose:

- allow Axios interceptors to attach `Authorization: Bearer <token>`
- avoid calling `getSession()` on every request

This means the access token is not only in session state, but also persisted in browser local storage.

## How Access Token Is Used

API requests from frontend use Axios clients:

- `apiClient`
- `paymentClient`

They attach bearer tokens from:

1. local token cache
2. localStorage fallback
3. NextAuth session fallback through `getSession()`

Protected backend routes validate access token with:

- `backend/main-service/src/middleware/auth.middleware.ts`

Validation uses `jwt.verify(token, JWT_SECRET)`.

## Refresh Token Flow

Refresh logic currently works like this:

1. NextAuth stores `refreshToken` from backend response.
2. In the NextAuth `jwt()` callback, if access token is close to expiry within 5 minutes, it calls:
   - `POST /api/auth/refresh`
3. Backend validates the refresh token using `JWT_REFRESH_SECRET`.
4. Backend checks Redis blacklist:
   - key format: `blacklist:<refreshToken>`
5. If valid, backend issues new `accessToken` and new `refreshToken`.
6. Backend blacklists the old refresh token.
7. NextAuth updates its JWT session values.

This is refresh token rotation.

## Does Logout Expire Tokens?

### Refresh token

Yes, refresh token is explicitly revoked on logout.

Evidence:

- `AuthService.logout()` calls `blacklistToken(refreshToken)`
- logout controller clears `refreshToken` cookie

So after logout, the refresh token should no longer be accepted by backend refresh flow.

### Access token

No, access token is not centrally revoked at logout in the current code.

Current behavior:

- client removes local copy
- NextAuth session is cleared with `signOut()`
- refresh token is blacklisted
- but already-issued access token remains technically valid until JWT expiry

This means:

- logout prevents future refresh
- logout clears browser session state
- but a copied/stolen access token could still work until expiration unless additional server-side revocation is implemented

This is an important security limitation and should be stated clearly in the report.

## Auth Security Observations

### Strong points

- Password hashing uses bcrypt
- Refresh token rotation exists
- Refresh token blacklist exists in Redis
- Wallet login has nonce replay protection
- Wallet login validates chain id and signature expiry window
- OAuth internal handoff is protected with `X-Internal-Service-Key`
- Registration CAPTCHA is verified server-side

### Gaps and inconsistencies

- Login page has CAPTCHA UI, but current credentials flow does not pass that token to backend login verification
- Access token is stored in localStorage, which increases XSS blast radius compared with cookie-only storage
- Access token is not revoked server-side on logout
- Auth state is duplicated across NextAuth cookie, backend refresh cookie, NextAuth JWT payload, and localStorage
- Rate limiting on backend auth skips genuine internal server-to-server calls, which is correct, but still requires careful handling to preserve public login protection

## Auth Conclusion

Current authentication is functional but complex.

It is not a pure cookie-session model and not a pure JWT SPA model. It is a mixed architecture:

- NextAuth manages frontend session continuity
- main-service issues API JWT tokens
- browser stores access token in localStorage for API calls
- refresh token is maintained by both backend cookie behavior and NextAuth refresh workflow

This works, but it also increases cognitive complexity and creates some security/reporting caveats that should be documented as known limitations.

## Frontend Architecture

The frontend is a `Next.js 16.2.4` application using App Router.

Core frontend stack from `frontend/package.json`:

- `next@16.2.4`
- `react@19.2.0`
- `typescript@5.3.3`
- `tailwindcss@3.4.1`
- `next-auth@4.24.14`
- `@rainbow-me/rainbowkit`
- `wagmi`
- `viem`
- `ethers`
- `framer-motion`
- `@tanstack/react-query`
- `sonner`
- `i18next` and `react-i18next`
- `@paypal/react-paypal-js`

## Current Frontend Feature Areas

Current top-level app routes under `frontend/app` show the frontend already includes these user-facing domains:

- auth
- addresses
- admin
- ai-proxy
- assets
- cart
- checkout
- coupons
- disputes
- faq
- kyc
- orders
- p2p
- portfolio
- privacy
- products
- profile
- seller
- terms
- trading
- wallet
- whale-tracker
- wishlist

This means the frontend scope is much broader than a basic marketplace demo. It already combines:

- classic e-commerce
- crypto wallet workflows
- RWA investment views
- P2P flows
- admin tools
- AI-assisted features

## Frontend Technical Design

Important frontend implementation details currently in code:

- Uses App Router, not Pages Router
- Uses standalone output in `next.config.mjs`
- Uses custom `rewrites()` to route:
  - `/api/auth/*` locally to NextAuth
  - `/api/ai/*` to AI service
  - `/api/rwa/*` to tokenization service
  - remaining `/api/*` to main-service
- Uses remote image allowlist in `next.config.mjs`
- Uses custom cache headers to reduce stale HTML after deployment
- Uses Webpack customization even though Next.js 16 defaults to Turbopack

Frontend provider stack currently includes:

- `SessionProvider` from NextAuth
- `ThemeProvider` from `next-themes`
- `I18nextProvider`
- dynamic wallet provider loading
- whale tracker polling provider

This means the root app shell is already composed around:

- authentication
- theme state
- i18n
- wallet/web3 connectivity
- background data polling

## Frontend Observations

- The project uses Next.js 16, but frontend scripts still explicitly run `next dev --webpack` and `next build --webpack`.
- This is a valid compatibility choice if the project depends on custom Webpack behavior.
- However, it also means the project is not currently taking full advantage of Next.js 16 default Turbopack behavior.
- The frontend deliberately lazy-loads wallet-related providers to keep the main layout chunk smaller.

## Main Backend Module Structure

The current `main-service` is the central business API and currently mounts these modules:

- `auth`
- `users`
- `products`
- `orders`
- `inventory`
- `admin`
- `p2p`
- `wallets`
- `nft`
- `reviews`
- `seller`
- `onchain`
- `rwa`
- `kyc`

This means the main backend is acting as:

- marketplace core
- auth gateway
- seller/admin domain hub
- public API facade for RWA flows

## Docker And Deployment Architecture

The Docker layer currently has three compose variants:

- `docker/docker-compose.yml`
- `docker/docker-compose.dev.yml`
- `docker/docker-compose.prod.yml`

### Current service inventory in Docker

Development/full compose currently includes:

- `postgres`
- `postgres-payment`
- `redis`
- `rabbitmq`
- `main-api`
- `payment-api`
- `frontend`
- `ai-service`

Production compose currently includes:

- `postgres`
- `db-migrator`
- `postgres-payment`
- `redis`
- `rabbitmq`
- `main-api`
- `payment-api`
- `frontend`
- `hardhat-node`
- `hardhat-bootstrap`
- `ai-service`
- `tokenization-service`

This is a fairly mature container topology for an FYP project.

## Dockerfile Review

### `backend/main-service/Dockerfile`

Strengths:

- Multi-stage build
- Build dependencies separated from runtime
- Production runtime installs only prod dependencies
- Small Alpine base image

Weak points:

- Runs as root in runtime stage
- No explicit healthcheck
- No `NODE_OPTIONS` or memory tuning

### `backend/payment-service/Dockerfile`

Strengths:

- Same good multi-stage pattern as main-service
- Production dependency pruning

Weak points:

- Also runs as root
- No explicit healthcheck
- No `.dockerignore` found in this service folder

### `backend/tokenization-service/Dockerfile`

Strengths:

- Simple multi-stage flow
- Production dependency pruning

Weak points:

- Runs as root
- No `.dockerignore` found
- No healthcheck

### `backend/ai-service/Dockerfile`

Strengths:

- Lean Python slim image
- `pip install --no-cache-dir`
- Single worker chosen intentionally for low-resource VPS

Weak points:

- No non-root user
- No explicit healthcheck

### `frontend/Dockerfile`

Strengths:

- Good multi-stage design
- Dedicated dependency stage
- Uses standalone Next.js output
- Runs as non-root user in runtime
- Handles build-time `NEXT_PUBLIC_*` variables correctly
- Copies only runtime artifacts from builder

Weak points:

- Build args include several production defaults directly inside Dockerfile
- This makes config drift easier if compose env and Dockerfile defaults diverge

## Docker Optimization Verdict

Current Docker setup is generally good for an FYP project and already beyond beginner level.

Best optimized file:

- `frontend/Dockerfile`

Reason:

- non-root runtime
- standalone output
- focused artifact copy

Still improvable:

- backend services should also run as non-root
- payment-service and tokenization-service should add `.dockerignore`
- healthchecks could be moved closer to image level or verified consistently at compose level

## Compose Review

### Good parts

- Production uses `db-migrator` with `service_completed_successfully`
- Separate databases for marketplace and payment domains
- Internal Docker networking is used correctly
- Public ports are narrowed to localhost in production for most services
- Hardhat bootstrap flow exists for local/VPS demo chain automation

### Risks and inconsistencies

- `docker-compose.prod.yml` still sets `NEXT_PUBLIC_HARDHAT_RPC_URL: http://103.20.96.79:8545`
- This conflicts with newer project rules saying browser-side production RPC should use `https://kienai.id.vn/rpc/hardhat`
- README and older docs are behind the current compose reality

That specific RPC mismatch should be explicitly called out in the report as a current deployment risk.

## RabbitMQ Architecture

RabbitMQ is configured as a topic-exchange event bus:

- exchange name: `marketplace`
- exchange type: `topic`

Code locations:

- `backend/main-service/src/config/rabbitmq.ts`
- `backend/payment-service/src/config/rabbitmq.ts`

Current behavior:

- both services can publish events
- main-service subscribes to payment-related events through a durable queue

## How RabbitMQ Works In This Project

### Main event direction

The important business flow is:

1. `payment-service` emits payment lifecycle events
2. `main-service` consumes them
3. `main-service` updates order state projection in database

Current consumer:

- `OrderPaymentEventsConsumer`
- queue name: `main-service.payment-projection`

Current payment event topics:

- `payment.submitted`
- `payment.confirming`
- `payment.confirmed`
- `payment.failed`
- `payment.expired`
- `payment.released`
- `payment.refunded`

## RabbitMQ Business Purpose

RabbitMQ is used to decouple:

- payment execution
- payment verification
- order status projection

Without queueing, services would need tighter synchronous coupling for every state change.

## Is RabbitMQ Necessary?

Short answer:

- not strictly necessary for a very small demo
- useful and justified for this project's current multi-service architecture

Why it helps here:

- payment and order services are already separated
- blockchain confirmation can be delayed or retried
- event-driven projection reduces direct service dependency
- durable queue gives resilience for payment state updates

Why it is still somewhat optional in current code:

- both `main-service` and `payment-service` are coded to continue running even if RabbitMQ is unavailable
- comments in startup code describe it as optional/best-effort

Final judgment:

- RabbitMQ is architecturally useful in this project
- but the codebase is not fully dependent on it yet
- so it is important, but not absolutely mandatory for the whole system to boot

## Smart Contract Workspace

The `contracts` folder currently includes more than escrow only.

Current contracts found:

- `EscrowCore.sol`
- `CreditScoreSBT.sol`
- `ComplianceRegistry.sol`
- `RWAFactory.sol`
- `RWAToken.sol`
- `RWATokenV2.sol`
- `GovernanceRWA.sol`
- `ProfitDistributor.sol`
- `BuyoutVault.sol`
- `RWAMarketEscrow.sol`
- `ProductNFT.sol`
- `MockUSDT.sol`

So the blockchain side currently covers:

- crypto order escrow
- reputation/credit via soulbound token
- compliance/KYC
- tokenized RWA issuance
- governance
- profit distribution
- buyout flow
- secondary market escrow
- NFT-linked product logic

## EscrowCore Contract

Primary role:

- hold buyer funds in escrow
- release to seller
- refund buyer
- support disputes
- support batch/cart checkout
- support native token and ERC20

### Main statuses

`EscrowCore.OrderStatus`:

- `Pending`
- `Paid`
- `Completed`
- `Refunded`
- `Disputed`
- `Expired`

### Main functions

- `setSBTContract`
- `getEffectiveFee`
- `deposit`
- `depositNative`
- `depositWithSwap`
- `depositBatch`
- `depositNativeBatch`
- `releasePayment`
- `refund`
- `refundExpired`
- `raiseDispute`
- `buyerConfirmDelivery`
- `updatePlatformFee`
- `updateFeeVault`
- `pause`
- `unpause`
- `getOrder`

### Security controls present

- `ReentrancyGuard`
- `AccessControl`
- `Pausable`
- `SafeERC20`

## CreditScoreSBT Contract

Purpose:

- track buyer reputation
- map score to tier
- influence fee policy and privileges

### Tier enum

- `BRONZE`
- `SILVER`
- `GOLD`
- `DIAMOND`

### Main functions

- `mintSBT`
- `recordCompletedOrder`
- `recordDispute`
- `recordFraudFlag`
- `updateScore`
- `getPlatformFee`
- `getTier`
- `getScore`
- `canInstallment`
- `canPriorityList`

This is one of the more distinctive business contracts in the project because it ties reputation directly into platform fee logic.

## RWA Contract System

The RWA subsystem is made of multiple contracts working together:

- `ComplianceRegistry`: KYC/verification registry
- `RWAFactory`: deploy tokenized asset bundles
- `RWAToken` and `RWATokenV2`: asset token contracts
- `GovernanceRWA`: proposal and voting logic
- `ProfitDistributor`: dividend/profit distribution
- `BuyoutVault`: buyout settlement and claims
- `RWAMarketEscrow`: secondary market listing and purchase escrow

## RWA Backend Architecture

RWA backend is split into two layers:

### Internal tokenization service

Location:

- `backend/tokenization-service`

This service exposes internal endpoints for:

- assets
- KYC
- portfolio
- holders
- governance
- buyout
- profit
- market

It is protected by:

- `X-Internal-Service-Key`

Meaning:

- the tokenization service is not designed as a public-facing standalone API
- it is intended to sit behind `main-service`

### Public/main-service RWA proxy

Location:

- `backend/main-service/src/modules/rwa/rwa-proxy.routes.ts`

This proxy layer:

- exposes public reads for selected RWA endpoints
- enforces auth and role rules
- injects authenticated `user_id`
- forwards requests internally to tokenization-service

This is a clean architectural decision because it centralizes public auth policy in main-service.

## Current RWA Feature Set

Based on the current code, the RWA feature scope includes:

- create tokenized asset record
- optional on-chain asset deployment
- KYC grant/revoke/status
- portfolio holdings view
- purchase tokenized asset
- reconcile holdings from chain
- holder concentration analytics
- governance proposal creation
- governance voting
- governance execution recording
- profit deposit and distribution history
- buyout proposal flow
- Merkle snapshot generation for buyout claims
- claim proof retrieval
- claim recording
- secondary market listing
- secondary market cancellation
- secondary market purchase/trade recording

## How RWA Purchase Works

Current RWA purchase flow is not just a DB insert.

It does:

1. validate asset and supply with row lock
2. validate KYC status of wallet
3. write idempotency record
4. mint on-chain token
5. store mint tx hash
6. let transfer indexer project holdings from chain events

This is a solid design choice because chain state becomes the source of truth for holdings, not only API writes.

## RWA Governance Logic

Current governance proposal types in `GovernanceRWA.sol`:

- `GENERAL`
- `UPDATE_VALUATION`
- `DISTRIBUTE_PROFIT`
- `SELL_ASSET`
- `INITIATE_BUYOUT`
- `REPLACE_OPERATOR`

Current governance statuses:

- `ACTIVE`
- `PASSED`
- `REJECTED`
- `EXECUTED`
- `CANCELLED`

Important design detail:

- high-impact proposal types such as sell/buyout/operator replacement use stricter supermajority rules

## Frontend/Backend Technology Summary

Technologies currently used in the project include:

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- NextAuth
- Axios
- RainbowKit
- wagmi
- viem
- ethers.js
- Framer Motion
- Node.js 22
- Express
- PostgreSQL
- Redis
- RabbitMQ
- Docker
- Docker Compose
- Python FastAPI
- Solidity
- Hardhat
- OpenZeppelin contracts
- PayPal SDK
- hCaptcha
- Cloudinary
- Nodemailer

## Next.js 16 - Officially Confirmed Updates

This section is based on official Next.js sources checked on May 6, 2026:

- Upgrade docs:
  - [Version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
  - [General upgrading docs](https://nextjs.org/docs/app/getting-started/upgrading)
- Official release post:
  - [Next.js 16 release blog](https://nextjs.org/blog/next-16)

Important official points currently relevant to your project:

- Next.js 16 uses Turbopack by default for `next dev` and `next build`
- Node.js minimum is now `20.9+`
- TypeScript minimum is `5.1+`
- `next build` no longer runs lint automatically
- `middleware` naming is being replaced by `proxy`
- partial prerendering experimental route config was removed from earlier experimental naming
- routing and prefetch behavior were improved for leaner navigation caching
- development output is now separated under `.next/dev`
- some image defaults changed, including cache and quality behavior
- parallel route slots now require explicit `default.js` files

## What Next.js 16 Means For This Project

Positive fit:

- Your project already uses App Router, React 19, and a fairly modern structure.
- Your current version `16.2.4` is already aligned with the modern Next.js stack.

Current divergence from default conventions:

- your scripts still force Webpack
- your config contains custom Webpack split-chunk behavior
- therefore migration to pure Turbopack would require validation, not just script cleanup

This should be reported as:

- the project is using Next.js 16 successfully
- but is operating it in a compatibility-oriented configuration rather than the most default v16 path

## Missing Pieces And Technical Debt

Based on the current codebase review so far, these are the most important missing pieces or weaknesses:

- logout does not revoke already-issued access tokens server-side
- login CAPTCHA appears UI-gated on frontend, but not enforced server-side in the credentials login flow
- auth state is duplicated across multiple storage layers, increasing complexity
- production compose still contains a browser RPC URL setting that appears inconsistent with newer HTTPS proxy rules
- RabbitMQ is important for event projection, but the system also treats it as optional, which may create state lag if queue is unavailable
- some backend containers still run as root
- payment-service and tokenization-service do not currently show local `.dockerignore` files
- README summary is behind the actual current architecture
- there is visible architecture growth across marketplace, RWA, AI, NFT, and P2P, but documentation has not been consolidated to the same level

## Current Documentation Gap

The current codebase is ahead of the current top-level documentation in at least these ways:

- more services exist than the README claims
- RWA is much more complete than older summaries suggest
- production deployment logic is more complex than old docs imply
- auth/session behavior is more nuanced than a simple "JWT auth" description

This Markdown file is intended to close that gap by documenting the system from the code outward, not from older assumptions.

## Detailed Feature Map

This section goes deeper by domain and focuses on what the code is actually doing now.

Where something below is marked as "confirmed", it is directly backed by route/service/page code already inspected.
Where something is marked as "appears" or "UI-level", the frontend clearly exposes it but the exact backend implementation still needs another pass to fully prove every branch.

### 1. Product Marketplace Domain

Confirmed backend behavior:

- `products.routes.ts` exposes public listing, product detail, seller public store, accepted token directory, image upload, and authenticated seller product management
- product listing supports filters such as `category`, `search`, `seller_id`, `has_token`, pagination, and sorting behaviors
- product detail response enriches the item with:
  - seller profile
  - seller public identity fields
  - accepted crypto tokens
  - inventory/stock information
  - rating and review summary
- accepted token pricing is not only a UI concept:
  - product pricing is normalized into `product_accepted_tokens`
  - legacy token fields still coexist for compatibility
  - each token pricing row can store chain, symbol, token address, decimals, and whether it is primary
- product creation auto-normalizes:
  - images
  - metadata
  - accepted token array
  - initial inventory row
- image upload is handled through backend upload endpoint and then persisted as product image URLs, not only as local files
- seller public storefront is first-class:
  - seller slug/profile can be fetched publicly
  - active products are shown under that seller
- homepage-style product aggregation exists:
  - code limits featured products by coin/token bucket and caps total items

Important business rule:

- any authenticated active user can become a seller implicitly
- there is no strict pre-created seller onboarding gate
- `ensureSellerProfile` can auto-create seller profile data and upgrade user role from buyer to seller when needed

What this means architecturally:

- your marketplace is not a simple "products table"
- it is already a multi-price, multi-token, multi-seller catalog service
- tokenized commerce and regular commerce are being unified in one product system rather than split into two separate apps

Frontend mapping:

- `/products` is the main marketplace browser
- it has two visible modes:
  - regular products
  - `NFT & Token hóa`
- it fetches regular products from `/api/products`
- it fetches tokenized/NFT-like marketplace products using `/api/products?has_token=true&limit=50`
- filters currently include:
  - search
  - category
  - price range
  - sort
  - tokenized asset chain/category filters in the NFT tab
- `/products/[id]` is a fairly complete product detail surface:
  - image gallery
  - seller profile summary
  - review section
  - accepted token price selector
  - add-to-cart
  - buy-now
  - social share
  - NFT ownership widget
- `/products/create` plus editor components indicates seller-side product authoring already has a dedicated frontend flow

Supporting frontend components confirmed:

- `ProductCard`
- `ProductGalleryViewer`
- `ProductTokenPricing`
- `ProductQuickActions`
- `ProductReviewSection`
- `ProductEditorForm`
- `ProductImageEditor`
- `ProductPricingEditor`

### 2. Order and Checkout Domain

Confirmed backend behavior:

- orders support both:
  - single product direct checkout
  - cart checkout creating multiple orders under one shared `internal_order_id` group
- inventory is protected with temporary reservation via `inventory_locks`
- lock duration is currently 10 minutes
- order creation publishes event(s) including `order.created`
- order cancellation also emits event(s) including `order.cancelled`
- order queries are not only buyer-facing:
  - `getOrders` can return buyer-owned and seller-owned views
  - seller-side visibility is implemented through joins with seller profile data
- cancellation policy is status-sensitive:
  - unpaid orders can be cancelled
  - some pending PayPal states can be cancelled
  - crypto flows are stricter once escrow/on-chain state is involved
- order status transitions are explicit and not free-form
- seller actions include shipping/delivery progression
- buyer actions include completion or dispute
- completion logic supports:
  - off-chain completion
  - buyer on-chain confirmation
  - automatic or admin-assisted chain sync
- dispute creation is wired into order status transition logic
- backend can also sync stale order state from blockchain when DB state drifts

Escrow-sensitive order behavior:

- a crypto order may move through:
  - `UNPAID`
  - `TX_SUBMITTED`
  - `ONCHAIN_PENDING`
  - `ONCHAIN_CONFIRMED`
  - `PAID`
  - `SHIPPED`
  - `DELIVERED`
  - `COMPLETED`
  - or issue states such as `DISPUTED`, `REFUNDED`, `TX_FAILED`, `CANCELLED`
- this is more advanced than a normal e-commerce order state machine because payment settlement and delivery settlement are split

Frontend mapping:

- `/checkout/[orderId]` is the payment orchestration page for a single order
- `/checkout/cart` handles grouped cart checkout
- `/orders` is a buyer/seller order center with:
  - filtering
  - search
  - status journey visualization
  - token-aware amount display
- `/orders/[id]` is a very rich order detail page

Confirmed order detail features:

- PayPal capture callback handling using URL state
- blockchain payment status refresh through `payment-service`
- auto-polling while payment confirmation is pending
- on-chain escrow status read from contract
- auto-heal when blockchain says completed but DB still stale
- buyer on-chain confirmation using wagmi/viem contract write
- backend patch after on-chain confirm succeeds
- dispute evidence submission
- seller tracking update / shipping update
- NFT ownership panel integration
- escrow status panel
- escrow expiry actions

This is one of the strongest parts of the system because it connects:

- frontend status UX
- backend order DB state
- payment-service verification state
- escrow smart contract state

### 3. Seller Domain

Confirmed backend behavior:

- seller routes expose:
  - seller overview/dashboard metrics
  - seller products
  - seller orders
  - seller public profile/store
  - payout wallet update
- seller dashboard metrics include:
  - revenue
  - order breakdown
  - review stats
  - top products
  - recent orders
  - conversion-style indicators
- seller payout wallet is constrained:
  - it must already be one of the linked user wallets
  - seller cannot arbitrarily set an unknown payout address through this endpoint

Frontend mapping:

- `/seller/dashboard` is the seller control panel
- `/seller/upload` appears to be the product onboarding/upload flow
- `/seller/[slug]` is the public storefront
- seller dashboard currently shows:
  - order stats
  - revenue stats
  - review summary
  - recent orders
  - shortcuts to products/orders/reviews

Design implication:

- seller functionality is not bolted on as an admin-only view
- it is a distinct operator persona inside the same app

### 4. Wallet and Deposit Domain

Confirmed backend behavior:

- wallet module is broader than MetaMask linking
- it supports multiple chain families:
  - EVM
  - Solana
  - Tron
  - TON
  - Aptos
  - and other chain-type validated entries
- public endpoints expose:
  - supported chains
  - chain-specific tokens
  - deposit address or deposit metadata views
- authenticated endpoints expose:
  - wallet CRUD
  - mark primary wallet
  - deposit history
- wallet validation depends on chain type rather than assuming all addresses are EVM hex strings

Frontend mapping:

- `/wallet` is more than a list of addresses
- confirmed features on this page:
  - RainbowKit/MetaMask connect
  - signed wallet linking flow
  - wallet list management
  - primary wallet switching
  - wallet deletion
  - QR deposit experience
  - deposit history
  - escrow orders tab
  - seller payout wallet section
  - network diagnostics
  - add-network-to-wallet helper
- `/wallet/deposit` exists as a dedicated deposit surface

Important auth/security detail:

- linking a wallet is not just "submit address"
- the frontend signs a message before calling `/api/wallets`
- that proves control of the wallet at link time

### 5. Review and Reputation Domain

Confirmed backend behavior:

- review creation is tied to completed orders
- one review per order is enforced
- review edit window is limited to 7 days
- helpful vote toggle is persisted through `review_votes`
- 5-star reviews attempt to insert a best-effort `credit_score_events` record

This means reviews are feeding two layers:

- normal marketplace trust
- web3 credit reputation side effects

Frontend mapping:

- review UI is embedded deeply into product and profile surfaces rather than isolated in one page only
- confirmed components:
  - `ProductReviews`
  - `ProductReviewSection`
- seller dashboard also references review metrics

### 6. Dispute and Return Domain

Confirmed backend behavior:

- disputes are connected to order status transitions
- dispute records can be created from order workflows
- admin can resolve disputes
- P2P dispute resolver logic also appears to cover some regular order escrow outcomes such as release/refund handling

Frontend mapping:

- `/disputes` is a user-facing dispute center
- confirmed UI features:
  - list disputes
  - filter by status
  - submit new dispute
  - attach evidence URLs
  - explain issue for refund/return review
- `/disputes/[id]` exists for detail flow

Current observation:

- the frontend is prepared for a more complete after-sales flow than typical school-project CRUD apps
- this area should still be documented carefully in the final report because some endpoints appear to be evolving and may deserve a final verification pass

### 7. P2P Trading Domain

Confirmed backend behavior:

- public offer listing with filters
- offer detail
- authenticated create/update/pause/resume offer flows
- P2P order creation from offer
- P2P order lifecycle and state management
- proof upload for payments
- P2P order messaging
- admin dispute resolution

Observed P2P order state family:

- `PENDING`
- `PAID`
- `CONFIRMED`
- `CANCELLED`
- `DISPUTED`
- `RESOLVED_*`

Business meaning:

- this is a second marketplace model inside the same project
- instead of buyer purchasing product stock from seller catalog, users can trade token liquidity directly through negotiated ads

Frontend mapping:

- `/p2p` is a live ad-book style trading page
- confirmed features on that page:
  - buy/sell tab
  - token filter
  - fiat filter
  - payment method filter
  - amount filter
  - create order modal
  - redirect to `/p2p/orders/[id]`
- UI also exposes:
  - "Post Ad"
  - "My Orders"
  - advertiser profile snippets
  - payment window/terms context

This is one of the biggest functional expansions in your project because it turns the platform from only commerce + escrow into a hybrid commerce + peer-trading platform.

### 8. NFT and Web3 Reputation Domain

Confirmed backend behavior:

- NFT service integrates with `ProductNFT`
- metadata upload is designed for Pinata/IPFS, with fallback/mock behavior when not configured
- NFT minting can be attached to product authenticity or product ownership workflow
- `CreditScoreSBT` integration tracks user credit-like reputation based on behavior
- backend reads credit info, tier, fee benefits, and can register completed-order effects

Frontend mapping:

- `/profile/nfts`
- `/profile/credit`
- `/profile/credit-score`
- product pages show `NFTOwnershipCard`
- profile page explicitly contains CTA into the Web3 credit score area

Architectural meaning:

- NFT is not only collectible decoration here
- you are using NFT/SBT concepts as:
  - authenticity proof
  - ownership badge
  - reputation / credit score layer

### 9. KYC Domain

Confirmed backend behavior:

- KYC routes support:
  - upload document image
  - submit application
  - get own status
  - list submissions
  - admin review
- stored submission fields include:
  - full name
  - date of birth
  - document type
  - document number
  - wallet address
  - front/back document image
  - selfie
  - status
  - rejection reason

Frontend mapping:

- `/kyc` is a dedicated KYC flow
- confirmed behavior:
  - individual file uploads happen immediately
  - URLs returned from backend are then submitted in final KYC payload
  - statuses shown include `PENDING`, `REVIEWING`, `APPROVED`, `REJECTED`
  - wallet address from connected wallet can be included
- `/admin/kyc` exists for review/admin processing

RWA relevance:

- KYC is not decorative
- it is a real prerequisite in the tokenization flow before purchase/investment for regulated assets

### 10. RWA Tokenization Domain

Confirmed backend behavior:

- tokenization-service is a dedicated service, not only a helper module
- main-service proxies RWA traffic through internal-authenticated routes
- tokenization-service modules confirmed:
  - assets
  - portfolio
  - governance
  - buyout
  - market
  - profit
- purchase flow uses:
  - DB row lock / supply validation
  - KYC validation
  - idempotency record
  - on-chain mint
  - tx hash persistence
  - transfer indexer to project final holdings from chain events

Confirmed frontend mapping:

- `/assets`
- `/assets/[id]`
- `/assets/[id]/governance`
- `/assets/[id]/buyout`
- `/assets/[id]/market`
- `/portfolio`
- `/admin/assets`

Detailed RWA capabilities currently present:

- browse tokenized assets
- see asset detail and asset metadata
- purchase fractional ownership
- inspect holdings in personal portfolio
- inspect pending rewards/dividends
- claim rewards on-chain
- participate in governance proposals
- enter buyout process
- use secondary market listing/trading surfaces
- view profit/distribution related information

This is already a multi-module mini-platform inside the broader app.

### 11. Admin and Operations Domain

Confirmed backend behavior:

- admin routes are extensive, not minimal
- areas already exposed include:
  - dashboard
  - orders
  - users
  - products
  - disputes
  - refunds
  - payouts
  - settings
  - supported tokens
  - audit logs
  - escrow snapshots / health
  - payment reconciliation
  - manual escrow sync
  - KYC review

Frontend mapping:

- `/admin`
- `/admin/assets`
- `/admin/audit-logs`
- `/admin/disputes`
- `/admin/escrow`
- `/admin/kyc`
- `/admin/orders`
- `/admin/products`
- `/admin/reconciliation`
- `/admin/refunds`
- `/admin/tokens`
- `/admin/users`
- `/admin/vouchers`

Confirmed admin dashboard behavior:

- revenue chart
- order status chart
- recent orders
- quick links to vouchers/products/users/refunds
- aggregate stats for users/orders/revenue/disputes

System implication:

- your project already contains an operator console, not only customer-facing screens
- that is important for a capstone/demo because it proves platform governance and operational maintainability

### 12. On-Chain Analytics and Whale Tracking Domain

Confirmed backend behavior:

- `onchain.routes.ts` handles analytics-oriented endpoints such as:
  - transaction stats/history
  - pair transaction batches
  - pair transaction queries
  - top traders
- caching uses Redis to reduce repeated expensive reads

Frontend mapping:

- `/whale-tracker` is a dedicated trading analytics screen
- it is not just a static chart
- confirmed UI features:
  - token/pair search sidebar
  - chain-aware selection
  - pair chart
  - live transaction feed
  - right sidebar info panel
  - mobile overlays for navigation
- component set confirms a real subsystem:
  - `DexChart`
  - `LiveTxFeed`
  - `DexLeftSidebar`
  - `DexRightSidebar`
  - watchlist/alert-oriented components in `components/whale-tracker`

Interpretation:

- this is a separate analytics product surface living inside the same repository
- it strengthens the "crypto market intelligence" side of the project beyond simple payments

### 13. User Profile and Account Management Domain

Confirmed frontend mapping:

- `/profile`
- `/addresses`
- `/wishlist`
- `/faq`
- `/privacy`
- `/terms`

Confirmed profile features on `/profile`:

- fetch and update profile via `/api/users/profile`
- avatar upload reuses product image upload backend
- profile completeness scoring
- account connection summary:
  - Google
  - crypto wallet
  - PayPal
- role/status display
- credit score CTA

This area shows that your account system is trying to centralize identity across:

- web2 identity
- payment identity
- wallet identity
- reputation identity

### 14. Homepage and Discovery Experience

Confirmed frontend behavior on `/`:

- dynamic hero
- live-like coin cards
- featured products
- market overview sections
- coin price strip
- category and discovery surfaces
- add-to-cart shortcuts
- wallet/cart/search-aware navigation

Important architectural point:

- the homepage is not a plain marketing landing page
- it is a hybrid of:
  - storefront
  - market dashboard
  - crypto discovery layer

### 15. Frontend Architecture by Capability

Current frontend is not just "Next.js pages". It already has several capability layers:

- provider layer:
  - NextAuth `SessionProvider`
  - i18n provider
  - theme provider
  - RainbowKit / wagmi wallet provider
  - whale polling provider
- API abstraction layer:
  - `auth.ts`
  - `products.ts`
  - `orders.ts`
  - `payments.ts`
  - `admin.ts`
  - `rwa.ts`
  - analytics/binance integration files
- state/store layer:
  - cart store
  - price store
  - whale tracker store
- UI domains:
  - home
  - product
  - order
  - checkout
  - escrow
  - wallet
  - whale tracker
  - web3
  - reusable UI primitives

This is why the project already feels closer to a platform than to a single-feature web app.

## Contract-Level System Detail

### EscrowCore.sol

Confirmed responsibilities:

- create order escrow entry
- receive or track payment
- buyer confirm delivery
- admin or rule-based refund/release handling
- dispute state handling
- expiry handling
- fee accounting

Order lifecycle state in the contract:

- `Pending`
- `Paid`
- `Completed`
- `Refunded`
- `Disputed`
- `Expired`

High-value functions already identified:

- order creation / payment registration
- buyer confirmation
- refund execution
- dispute initiation/resolution
- expiry checks
- getters for order state

### CreditScoreSBT.sol

Confirmed role:

- soulbound reputation contract
- stores user score/credit-like behavior
- exposes tier logic and likely fee-benefit or trust-benefit relationships

Practical system use:

- marketplace behavior can create score events
- frontend profile/credit pages expose this as a user-facing trust product

### ComplianceRegistry.sol

System role:

- regulatory/eligibility layer for wallets or users
- likely used to gate RWA participation

Importance:

- this is one of the pieces that makes the RWA subsystem feel regulated rather than purely speculative

### RWAFactory.sol

Confirmed role:

- deploys or registers tokenized asset contracts
- forms the creation backbone of new RWA issuances

### RWAToken.sol / RWATokenV2.sol

Confirmed role:

- represent fractionalized ownership units
- participate in mint/transfer/holding logic indexed by tokenization-service

### GovernanceRWA.sol

Confirmed proposal types:

- `GENERAL`
- `UPDATE_VALUATION`
- `DISTRIBUTE_PROFIT`
- `SELL_ASSET`
- `INITIATE_BUYOUT`
- `REPLACE_OPERATOR`

Confirmed statuses:

- `ACTIVE`
- `PASSED`
- `REJECTED`
- `EXECUTED`
- `CANCELLED`

Important detail:

- higher-impact proposal categories require stronger approval thresholds

### ProfitDistributor.sol

System role:

- manages investor reward or dividend claims
- frontend portfolio claim flow talks to distributor contract using `claimReward()`

### BuyoutVault.sol

System role:

- supports buyout process when a controlling acquisition event is triggered

### RWAMarketEscrow.sol

System role:

- secondary market transaction support for tokenized assets

### ProductNFT.sol

System role:

- authenticity or ownership NFT for marketplace products

### MockUSDT.sol

System role:

- development/test settlement token

## Cross-System Flows

### Commerce Flow

1. user browses products
2. selects payment method:
   - PayPal/fiat
   - crypto token
3. backend creates order and locks inventory
4. payment is verified:
   - PayPal capture or
   - crypto payment/escrow verification
5. seller fulfills order
6. buyer confirms or raises dispute
7. review and reputation side effects may be created
8. NFT and/or SBT side effects may also occur depending on the flow

### RWA Flow

1. admin/operator creates or manages tokenized asset
2. investor completes KYC
3. investor purchases fractions
4. tokenization-service mints on-chain
5. indexer projects final holdings from chain events
6. investor sees holdings in portfolio
7. investor may:
   - claim rewards
   - vote
   - join buyout
   - trade on secondary market

### P2P Flow

1. user posts ad or browses ad
2. counterparty places order
3. off-chain payment proof/messages are exchanged
4. creator confirms or dispute is raised
5. admin can intervene in disputes

## Gaps Still Worth Calling Out

Beyond the already listed technical debt, the deeper feature review shows a few more important gaps:

- the repo contains many frontend surfaces whose backend maturity is uneven; some pages are very complete, while some adjacent routes appear partially productized
- there are multiple product lines inside one repo:
  - marketplace
  - P2P
  - RWA
  - whale tracker
  - AI proxy
  this is powerful, but it also increases documentation and operational complexity
- auth/session is functionally rich but too fragmented across:
  - NextAuth cookie state
  - backend refresh cookie
  - frontend JWT callback state
  - localStorage token
- seller promotion being implicit is convenient, but from a production governance perspective it may need stricter onboarding or moderation rules
- some contract-backed flows are well designed, but the report should be honest that final production safety depends on:
  - contract audit depth
  - monitoring
  - operational runbooks
- admin console breadth is already impressive, but it also means permission boundaries and auditability should be documented more explicitly

## Current State Summary

At this point, your project is no longer a single-purpose e-commerce demo.

From the codebase, it currently behaves like a combined platform containing:

- crypto-enabled marketplace
- escrow-backed checkout
- seller operations console
- review and reputation system
- wallet and deposit center
- P2P token trading
- NFT authenticity/reputation features
- KYC compliance layer
- RWA issuance and portfolio management
- governance, rewards, and buyout mechanics
- operator/admin console
- on-chain analytics and whale tracking

That breadth is one of the strongest things about the project, but it is also exactly why this documentation needs to stay code-driven and very explicit.

## Supporting And Secondary Features

These features are smaller than the core marketplace/RWA flows, but they are still real parts of the current product and should be mentioned in any serious project description.

### Cart

Confirmed frontend behavior:

- `/cart` uses a client-side cart store
- supports:
  - quantity update
  - remove item
  - subtotal summary
  - token price badge display
  - login-aware redirect into `/checkout/cart`
- cart UX explicitly references:
  - escrow protection
  - crypto and fiat payment options

Current architecture note:

- cart state is frontend-store driven rather than DB-synced persistent cart
- this is acceptable for a project/demo setup, but it should be described honestly as session/device-local unless a backend cart layer is later added

### Wishlist

Confirmed frontend behavior:

- `/wishlist` is auth-gated
- uses a wishlist client store
- supports:
  - saved products
  - remove from wishlist
  - add wishlist item into cart
  - stock/status display

Current architecture note:

- wishlist currently looks frontend-store oriented as well
- if there is no server persistence for it, that should be disclosed in the final report as a current limitation rather than overstated as fully cross-device synchronized

### Coupons and Promotions

Confirmed frontend behavior:

- `/coupons` is seller/admin oriented
- supports:
  - coupon list
  - coupon creation
  - coupon deactivation
  - discount type:
    - percentage
    - fixed amount
  - min order
  - max discount
  - validity window
  - per-user limit

Current documentation note:

- frontend clearly treats coupon management as a seller growth feature
- this should be described as a promotion/merchant-marketing subsystem
- backend route verification for the full coupon lifecycle still deserves one more direct pass before claiming every endpoint as fully confirmed

### Trading Screen

Confirmed frontend behavior:

- `/trading/[symbol]` is a market detail screen
- it combines:
  - live-ish coin detail data
  - chart
  - order book
  - recent trades
  - related products
  - wallet balances
  - swap helper logic
- it uses:
  - Binance-style market data adapters
  - `usePriceStore`
  - wagmi balance reads
  - swap hooks

Meaning:

- this is not only a display page for coin prices
- it is a bridge between market data discovery and your commerce/web3 stack

### Profile Connections and Credit Surfaces

Confirmed frontend behavior:

- `/profile` centralizes:
  - basic identity
  - avatar
  - PayPal email
  - wallet summary
  - Google link state
  - profile completeness
- `/profile/credit` and `/profile/credit-score` indicate a dedicated reputation/credit surface
- `/profile/nfts` indicates the NFT identity/ownership area is separated from the generic profile page

### AI Proxy Surface

Repository observation:

- the frontend route tree contains an `ai-proxy` area
- this confirms the repo already anticipates AI-assisted capability as part of the broader platform

Current documentation note:

- this area should be mentioned as existing architecture surface area
- but it should not be over-described until its exact routes and live behavior are inspected as deeply as the marketplace and RWA modules
