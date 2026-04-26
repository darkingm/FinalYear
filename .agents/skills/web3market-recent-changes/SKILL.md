---
name: web3market-recent-changes
description: Use when starting any new task in Web3Market — check recent changes to understand what was modified recently and avoid conflicts or regressions.
---

# Web3Market — Recent Changes

> **Agent instruction**: Read this before starting work. Update this file after completing any significant change (new feature, bug fix, deploy, schema change).

## 2026-04-26: Agent Guidance Sync for Auth Routing, Deploy, UI Guardrails
- Updated project guidance so future agents treat the local workspace as source of truth, avoid heavy VPS work, and do not pull/reset VPS state without explicit approval.
- Clarified shared `/api/auth` ownership: NextAuth owns only session/callback/provider subpaths; backend register/login/wallet/oauth/refresh/logout/forgot/reset must route to main-service.
- Documented production Hardhat RPC rule: browser/MetaMask uses `https://kienai.id.vn/rpc/hardhat`; direct `http://103.20.96.79:8545` is debug/infrastructure only.
- Added guardrails for UI work: no dead links/placeholders, no primary CTA labels leaking `VPS`, seller names should link to public storefronts when possible.
- Added known issues for auth nginx catch-all, login CAPTCHA UI-only, NextAuth credential rate-limit bypass risk, SIWE `www` origin mismatch, and direct HTTP RPC failures.
- **Files**: `AGENTS.md`, `.agents/skills/web3market-project-context/SKILL.md`, `.agents/skills/web3market-backend-patterns/SKILL.md`, `.agents/skills/web3market-frontend-conventions/SKILL.md`, `.agents/skills/web3market-deploy-pipeline/SKILL.md`, `.agents/skills/web3market-known-issues/SKILL.md`, `.agents/skills/web3market-decisions/SKILL.md`

## 2026-04-25: Skill Metadata, Grapuco Guardrails, RWA Demo Test Fallback
- Added `agents/openai.yaml` metadata for Web3Market skills so the UI can display clear skill names, descriptions, and default prompts.
- Clarified Grapuco usage: use MCP when available, otherwise inspect `.grapuco/status.json` and fall back to local code search instead of blocking.
- Updated Grapuco reindex wrappers to prefer `grapuco ingest` and fall back to `npx -y @bitsness/grapuco-cli ingest`.
- Renamed the Hardhat context heading to `Hardhat Demo Node` to avoid leaking infrastructure wording into UI guidance.
- RWA demo assets are available in Jest tests without enabling production demo mode.

## 2026-04-25: Agent Context Sync With Current Checkout/Seller System
- Updated Web3Market agent context to match the current Next 16 frontend, session-based crypto checkout, route-level payment rate limiters, Hardhat RPC expectations, seller identity model, and no-double-release escrow rule.
- **Files**: `.agents/skills/web3market-project-context/SKILL.md`, `.agents/skills/web3market-backend-patterns/SKILL.md`, `.agents/skills/web3market-frontend-conventions/SKILL.md`, `.agents/skills/web3market-known-issues/SKILL.md`, `.agents/skills/web3market-decisions/SKILL.md`

## 2026-04-25: Checkout Demo Rate Limit, Seller Links, Public Seller Holdings
- Split crypto payment rate limits by route: `invoiceLimiter` for invoice/session creation, `statusLimiter` for polling, `strictLimiter` for sensitive actions.
- Checkout button now displays `Hardhat` instead of `Hardhat VPS`.
- Seller names in product cards/details/checkout/order detail link to public seller storefronts.
- Public seller storefront shows payout wallet holdings for demo verification.
- Fixed order seller ownership checks by joining `seller_profiles` instead of comparing `orders.seller_id` to `users.user_id`.
- **Files**: `backend/payment-service/src/middleware/rate-limit.ts`, `backend/payment-service/src/modules/crypto-payment/crypto-payment.routes.ts`, `backend/main-service/src/modules/orders/orders.controller.ts`, `frontend/app/checkout/[orderId]/page.tsx`, `frontend/app/seller/[slug]/page.tsx`, `frontend/components/product/ProductCard.tsx`

## 2026-03-24: Whale Tracker Dashboard Overhaul
- Redesigned transaction feed for full-width layout
- Added real-time buy/sell counters per wallet address
- Integrated V3 liquidity pool data parsing
- Removed wallet watch sidebar
- Fixed data accuracy issues for V3 pools
- **Files**: `frontend/app/whale-tracker/`, `frontend/lib/pair-tx-fetcher.ts`, `frontend/lib/whale-api.ts`

## 2026-03-24: Freelance Escrow Platform (Stellar/Soroban)
- New project: decentralized escrow on Stellar blockchain
- Separate from main Web3Market codebase
- **Files**: separate repo / workspace

## 2026-03-20: Tokenization Service Build Fixes
- Fixed TypeScript compilation errors in tokenization-service
- Resolved deployment issues
- **Files**: `backend/tokenization-service/`

## 2026-03-19: Live Price Sync Consolidation
- Unified all live crypto price displays to use `usePriceStore`
- Replaced custom `useLivePrices` hook in login/registration pages
- Modified Header component to consume from shared store
- **Files**: `frontend/store/price-store.ts`, `frontend/components/layout/Header.tsx`, `frontend/app/(auth)/`

## 2026-03-18: Token Authentication Fixes
- Fixed "Invalid or expired token" errors
- Fixed JWT secret management between services
- Resolved `/api/seller/stats` endpoint issues
- **Files**: `backend/main-service/src/modules/auth/`, `frontend/lib/api/client.ts`

## 2026-03-17: VPS Deployment & Debugging
- Full VPS deployment cycle
- Fixed db-migrator container issues
- Resolved schema sync between local and VPS
- **Files**: `scripts/deploy.sh`, `docker/docker-compose.prod.yml`, `init_database.sql/migrations/`

## 2026-03-16: Payment System & Escrow Fixes
- Payment flow: checkout → submit → confirm → release
- Fixed order status state machine transitions
- Added dispute system with ON CONFLICT handling
- **Files**: `backend/payment-service/`, `frontend/app/checkout/`, `contracts/contracts/EscrowCore.sol`

---

> **Update template**: Copy and paste at the top of this list:
> ```
> ## YYYY-MM-DD: [Short Title]
> - [What changed]
> - **Files**: [key files modified]
> ```
