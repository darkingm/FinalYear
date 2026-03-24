---
name: web3market-recent-changes
description: Use when starting any new task in Web3Market — check recent changes to understand what was modified recently and avoid conflicts or regressions.
---

# Web3Market — Recent Changes

> **Agent instruction**: Read this before starting work. Update this file after completing any significant change (new feature, bug fix, deploy, schema change).

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
