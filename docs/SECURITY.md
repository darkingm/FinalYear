# Security Documentation — Web3Market Escrow

> Last updated: 2026-04-26 · EscrowCore v1 (non-upgradeable) on Hardhat / Polygon Amoy / BSC Testnet

---

## 1. Architecture Overview

```
┌─────────────┐   SIWE    ┌──────────────┐  JWT   ┌──────────────┐
│  Browser /  │──────────▶│ main-service │──────▶│ payment-svc  │
│  MetaMask   │◀──── ws ──│  (Express)   │ AMQP  │  (Express)   │
└──────┬──────┘           └──────────────┘       └──────┬───────┘
       │ EIP-1193                                       │ ethers v6
       ▼                                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  EscrowCore.sol (ReentrancyGuard + AccessControl + Pausable)    │
│  deployed at 0x5FbDB…aa3 (Hardhat 31337)                        │
│  Roles: DEFAULT_ADMIN → ADMIN_ROLE → OPERATOR_ROLE              │
│  Fee vault: single EOA                                          │
└──────────────────────────────────────────────────────────────────┘
```

### Trust boundaries

| Boundary | Inside | Outside |
|---|---|---|
| Smart contract | On-chain state, escrow funds, role checks | Backend DB, user identity |
| Backend (JWT) | User sessions, order DB, payment records | MetaMask, on-chain truth |
| Frontend | UI rendering, wagmi hooks | All mutation requires backend or on-chain |

### Key holders

| Key | Holder | Purpose |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | Deployer EOA | Grant/revoke roles |
| `ADMIN_ROLE` | Same EOA | pause/unpause, fee/vault updates |
| `OPERATOR_ROLE` | payment-service EOA (`BLOCKCHAIN_PRIVATE_KEY`) | releasePayment, refund |
| `INTERNAL_SERVICE_KEY` | Shared secret (main↔payment) | Inter-service auth |

---

## 2. Threat Model

### Actors

| Actor | Capabilities | Goal |
|---|---|---|
| Malicious buyer | Signs txs, controls wallet | Receive goods without paying; double-refund |
| Malicious seller | Controls wallet, confirms delivery | Receive payment without delivering |
| Compromised operator | Has `OPERATOR_ROLE` private key | Release/refund at will |
| External attacker | Network access, no keys | Steal funds, DoS, replay attacks |
| Compromised admin | Has `ADMIN_ROLE` | Pause contract, change fee to 100%, redirect fee vault |

### Attack vectors & mitigations

| Vector | Mitigation |
|---|---|
| Double-spend deposit | `require(orders[orderId].buyer == address(0))` prevents duplicate |
| Reentrancy on release/refund | `nonReentrant` modifier on all fund-moving functions |
| Operator releases without delivery | Primary path is `buyerConfirmDelivery` (trustless). `releasePayment` is backup. |
| Buyer self-refund before expiry | `require(block.timestamp >= order.expiresAt)` in `refundExpired` |
| Front-running deposits | No MEV risk — buyer deposits their own funds |
| Stolen operator key | Can release any Paid order. **Mitigation**: migrate to multisig (TODO) |
| Fee manipulation | `MAX_FEE_PERCENT = 1000` (10% cap) enforced on-chain |
| Zero-address seller | `require(seller != address(0))` in all deposit functions |
| SIWE replay | Redis one-time nonce with 5-min TTL, fail-closed in production |
| Session hijacking | JWT with rotation, httpOnly cookies, CORS whitelist |

---

## 3. Mitigations Inventory

### Smart Contract

| Control | Location | Description |
|---|---|---|
| ReentrancyGuard | All fund-moving functions | OpenZeppelin `nonReentrant` modifier |
| AccessControl | `ADMIN_ROLE`, `OPERATOR_ROLE` | Role-based function gating |
| Pausable | `deposit*` functions | Emergency circuit breaker |
| Checks-Effects-Interactions | All release/refund paths | State change before external calls |
| ORDER_TIMEOUT | 30 days | Auto-expiry for stuck orders |
| MAX_FEE_PERCENT | 1000 (10%) | Prevents admin setting 100% fee |
| Zero-address checks | All deposit + `updateFeeVault` | Prevents funds sent to burn address |
| SBT dynamic fee | `getEffectiveFee(buyer)` | CreditScoreSBT-adjusted fees |

### Backend

| Control | Location | Description |
|---|---|---|
| SIWE wallet verification | `auth.service.ts` | Nonce, expiration, domain, address match |
| Parameterized SQL | All DB queries | SQL injection prevention |
| Rate limiting | Route-level limiters | Brute-force prevention |
| JWT authentication | `auth.middleware.ts` | Session management |
| INTERNAL_SERVICE_KEY | Service-to-service calls | Never exposed as `NEXT_PUBLIC_*` |
| hCaptcha | Registration/login | Bot prevention |
| Payout wallet CHECK | Migration 024 | DB constraint rejects zero-address forever |

### Frontend

| Control | Location | Description |
|---|---|---|
| Pre-flight on-chain check | Order detail page | Reads `getOrder()` before `buyerConfirmDelivery` to prevent wasted gas |
| EscrowStatusPanel | `/orders/[id]` | DB vs on-chain truth comparison with mismatch warnings |
| Chain validation | `ensureCorrectChainRpc` | Prevents signing on wrong chain |
| HTTPS-only RPC | `kienai.id.vn/rpc/hardhat` | Avoids mixed-content errors |

---

## 4. Known Limitations

| # | Limitation | Risk | Status |
|---|---|---|---|
| 1 | Operator key stored as env var (SPOF) | HIGH on mainnet | Acceptable for FYP demo; migrate to multisig for production |
| 2 | Fee vault is single EOA | MEDIUM on mainnet | `ProfitDistributor.sol` exists but not yet wired |
| 3 | `releasePayment` lacks buyer confirmation | MEDIUM | Primary path is `buyerConfirmDelivery`; admin path is backup |
| 4 | No per-token or daily volume cap | LOW-MEDIUM | Only `pause()` for full stop |
| 5 | `depositWithSwap` trusts caller-supplied router | LOW | Buyer only harms themselves |
| 6 | Dispute resolution is centralized (admin) | MEDIUM | Future: Kleros/UMA-style decentralized arbitration |
| 7 | No signed delivery proofs | LOW | Future: off-chain attestation with on-chain verification |

---

## 5. Roadmap (Mainnet Hardening)

1. **Gnosis Safe for operator role** — Eliminate single-key SPOF
2. **ProfitDistributor for fee vault** — Transparent fee distribution
3. **Timelock on admin functions** — Delay fee/vault changes for community review
4. **Circuit breaker** — `maxOrderValue` per token, daily volume cap
5. **Decentralized dispute resolution** — Kleros/UMA integration
6. **Signed delivery proofs** — Off-chain attestation + on-chain verification
7. **Formal verification** — Certora/Halmos for critical invariants

---

## 6. Disclosure Process

If you discover a security vulnerability in this project:

1. **Do NOT open a public issue.**
2. Email: `kientngcd220284@fpt.edu.vn` with subject `[SECURITY] Web3Market`
3. Include: description, reproduction steps, impact assessment
4. We will acknowledge within 48 hours and provide a fix timeline

---

## 7. Audit Trail

### Deployed Contracts

| Chain | Address | Verified |
|---|---|---|
| Hardhat (31337) | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | N/A (local) |
| Polygon Amoy (80002) | See deployment scripts | Polygonscan |
| BSC Testnet (97) | See deployment scripts | BscScan |

### Test Coverage

- **34 tests passing** covering all EscrowCore functions
- Happy path: deposit (ERC20/native), release, buyerConfirmDelivery, refund, refundExpired, raiseDispute, batch deposits
- Edge cases: duplicate orderId, invalid status transitions, pause guard, access control, length mismatch, msg.value mismatch, zero-address rejection
- Run: `cd contracts && npx hardhat test test/EscrowCore.test.ts`

### Security Audit (Internal)

- Date: 2026-04-26
- Scope: EscrowCore.sol, SIWE wallet linking, access control, reentrancy, oracle risk, upgrade safety
- Finding: `depositWithSwap` used static `platformFeePercent` instead of `getEffectiveFee` — **fixed**
- Full report: See implementation plan artifact from session `83460f23`
