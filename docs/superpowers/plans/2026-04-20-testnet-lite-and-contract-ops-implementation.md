# Testnet Lite And Contract Ops Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Hardhat as the primary demo chain, add a production-like `testnet-lite` path centered on Base Sepolia, retire Mumbai from active runtime/UI paths, and add contract operations visibility for escrow deployments and balances.

**Architecture:** Reuse the existing shared `EscrowCore`-per-chain model and event-driven payment flow. Split the work into four bounded areas: local Hardhat account support, chain/runtime cleanup, Base Sepolia contract/test-token enablement, and admin-facing contract operations visibility. Avoid changing order/payment state semantics in this batch.

**Tech Stack:** Hardhat, Solidity, Ethers v6, Next.js 16, React, Express, PostgreSQL, existing event-driven payment/order sync.

---

## File Map

### Contracts / deployment

- Modify: `C:\Users\Asus\Documents\FYP\FYP\contracts\hardhat.config.ts`
- Create: `C:\Users\Asus\Documents\FYP\FYP\contracts\contracts\MockUSDT.sol`
- Create: `C:\Users\Asus\Documents\FYP\FYP\contracts\scripts\deploy-base-sepolia.ts`
- Create: `C:\Users\Asus\Documents\FYP\FYP\contracts\scripts\deploy-mock-usdt-base-sepolia.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\contracts\package.json`
- Create: `C:\Users\Asus\Documents\FYP\FYP\contracts\.env.local.example`

### Frontend chain/runtime cleanup

- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\lib\web3\config.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\app\checkout\[orderId]\page.tsx`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\app\checkout\cart\page.tsx`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\app\wallet\page.tsx`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\app\admin\tokens\page.tsx`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\app\admin\escrow\page.tsx`
- Create: `C:\Users\Asus\Documents\FYP\FYP\frontend\lib\web3\testnet-lite.ts`

### Backend contract ops / chain support

- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\crypto-payment.service.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\modules\admin\admin.controller.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\modules\admin\admin.routes.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\modules\admin\admin.service.ts`
- Create: `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\modules\admin\contract-ops.service.ts`

### Tests

- Create: `C:\Users\Asus\Documents\FYP\FYP\frontend\__tests__\testnet-lite-config.test.ts`
- Create: `C:\Users\Asus\Documents\FYP\FYP\frontend\__tests__\contract-ops-shaping.test.ts`
- Create: `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\modules\admin\__tests__\contract-ops.service.test.ts`

---

## Chunk 1: Local Hardhat MetaMask Support

### Task 1: Finalize local-only Hardhat account support

**Files:**
- Modify: `C:\Users\Asus\Documents\FYP\FYP\contracts\hardhat.config.ts`
- Create: `C:\Users\Asus\Documents\FYP\FYP\contracts\.env.local.example`

- [ ] **Step 1: Add a focused test/verification target for config assumptions**

Document manual verification target in the plan:

```text
Start `npx hardhat node` in contracts.
Expected:
- standard 20 Hardhat accounts still exist
- the LOCAL_METAMASK_PRIVATE_KEY address also appears
- its balance is 10000 ETH on chain 31337
```

- [ ] **Step 2: Keep config load order deterministic**

Ensure `hardhat.config.ts` loads `.env.local` before `.env`, normalizes keys with and without `0x`, and uses a single helper for signer account resolution.

- [ ] **Step 3: Add a tracked example file**

Create `contracts/.env.local.example` with:

```env
LOCAL_METAMASK_PRIVATE_KEY=0xyour_local_only_key_here
```

- [ ] **Step 4: Verify local node behavior manually**

Run:

```bash
cd C:\Users\Asus\Documents\FYP\FYP\contracts
npx hardhat node
```

Expected:
- local MetaMask account is present in funded accounts

- [ ] **Step 5: Commit**

```bash
git add contracts/hardhat.config.ts contracts/.env.local.example
git commit -m "feat: support local metamask account in hardhat"
```

---

## Chunk 2: Base Sepolia Testnet Lite Runtime

### Task 2: Clean chain ordering and retire Mumbai from active runtime paths

**Files:**
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\lib\web3\config.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\app\admin\tokens\page.tsx`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\app\wallet\page.tsx`
- Create: `C:\Users\Asus\Documents\FYP\FYP\frontend\lib\web3\testnet-lite.ts`
- Test: `C:\Users\Asus\Documents\FYP\FYP\frontend\__tests__\testnet-lite-config.test.ts`

- [ ] **Step 1: Write the failing config test**

Add tests that assert:

```ts
expect(getPrimaryTestnetChainId()).toBe(84532)
expect(getSecondaryTestnetChainIds()).toContain(80002)
expect(getDeprecatedChainIds()).toContain(80001)
```

- [ ] **Step 2: Run the narrow test to confirm failure**

Run:

```bash
cd C:\Users\Asus\Documents\FYP\FYP\frontend
npm test -- --runInBand __tests__/testnet-lite-config.test.ts
```

Expected: FAIL because helpers do not exist yet.

- [ ] **Step 3: Add centralized testnet-lite metadata**

Create `frontend/lib/web3/testnet-lite.ts` with:
- primary chain id
- secondary chain ids
- deprecated chain ids
- labels and faucet/explorer metadata

- [ ] **Step 4: Rewire frontend config to the new source of truth**

Update `frontend/lib/web3/config.ts` so:
- Base Sepolia is the first real public testnet
- Amoy remains secondary
- BNB Testnet remains optional
- Mumbai is removed from active UI ordering

- [ ] **Step 5: Patch visible stale Mumbai labels**

Update `admin/tokens` and `wallet` surfaces so they no longer present Mumbai as active testnet metadata.

- [ ] **Step 6: Re-run the narrow test**

Run:

```bash
cd C:\Users\Asus\Documents\FYP\FYP\frontend
npm test -- --runInBand __tests__/testnet-lite-config.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/web3/config.ts frontend/lib/web3/testnet-lite.ts frontend/app/admin/tokens/page.tsx frontend/app/wallet/page.tsx frontend/__tests__/testnet-lite-config.test.ts
git commit -m "refactor: prioritize base sepolia testnet path"
```

---

## Chunk 3: Base Sepolia Escrow Deployment And Mock Token Path

### Task 3: Add Base Sepolia escrow deploy script

**Files:**
- Create: `C:\Users\Asus\Documents\FYP\FYP\contracts\scripts\deploy-base-sepolia.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\contracts\package.json`

- [ ] **Step 1: Copy the deploy-amoy flow into a failing checklist**

Use `deploy-amoy.ts` as the template. The new script must:
- deploy `EscrowCore`
- print explorer links
- grant `OPERATOR_ROLE`
- print env variables to copy

- [ ] **Step 2: Implement the script**

Set:
- chain `84532`
- RPC from `BASE_SEPOLIA_RPC_URL`
- explorer `https://sepolia.basescan.org`

- [ ] **Step 3: Add package scripts**

Add scripts such as:

```json
"deploy:base-sepolia": "hardhat run scripts/deploy-base-sepolia.ts --network baseSepolia"
```

- [ ] **Step 4: Manual dry validation**

Run:

```bash
cd C:\Users\Asus\Documents\FYP\FYP\contracts
npx hardhat run scripts/deploy-base-sepolia.ts --network baseSepolia
```

Expected:
- if env is missing, fail with a clear message
- if funded, deploy and print env instructions

- [ ] **Step 5: Commit**

```bash
git add contracts/scripts/deploy-base-sepolia.ts contracts/package.json
git commit -m "feat: add base sepolia escrow deploy script"
```

### Task 4: Add mock stablecoin contract and deploy script

**Files:**
- Create: `C:\Users\Asus\Documents\FYP\FYP\contracts\contracts\MockUSDT.sol`
- Create: `C:\Users\Asus\Documents\FYP\FYP\contracts\scripts\deploy-mock-usdt-base-sepolia.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\contracts\package.json`

- [ ] **Step 1: Define minimal mock token contract**

Use an OpenZeppelin ERC20 with:
- name `Mock USDT`
- symbol `USDT`
- 6 decimals
- deployer mint on construction
- optional `mint(address,uint256)` restricted to owner

- [ ] **Step 2: Add deploy script**

The script should:
- deploy `MockUSDT`
- mint test balances to deployer and optional demo wallets from env
- print token address and suggested whitelist payload

- [ ] **Step 3: Add package script**

```json
"deploy:mock-usdt:base-sepolia": "hardhat run scripts/deploy-mock-usdt-base-sepolia.ts --network baseSepolia"
```

- [ ] **Step 4: Manual validation**

Run:

```bash
cd C:\Users\Asus\Documents\FYP\FYP\contracts
npx hardhat compile
```

Expected: compile succeeds with the new token contract.

- [ ] **Step 5: Commit**

```bash
git add contracts/contracts/MockUSDT.sol contracts/scripts/deploy-mock-usdt-base-sepolia.ts contracts/package.json
git commit -m "feat: add base sepolia mock usdt flow"
```

---

## Chunk 4: Payment / Checkout Chain Support

### Task 5: Expose Base Sepolia as primary public testnet in checkout

**Files:**
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\app\checkout\[orderId]\page.tsx`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\app\checkout\cart\page.tsx`

- [ ] **Step 1: Write down acceptance cases**

Acceptance:
- checkout defaults stay on Hardhat for demo mode
- real public testnet recommendation text points to Base Sepolia
- Base Sepolia displays explorer/faucet/help text correctly
- unavailable chains do not appear as first-class recommended choices

- [ ] **Step 2: Rewire network badge/help text**

Update both checkout pages so:
- Base Sepolia is presented as the recommended public testnet
- Amoy is secondary
- BNB Testnet is optional/de-emphasized
- Mumbai does not appear

- [ ] **Step 3: Gate tokens per chain**

Ensure Base Sepolia token choices are explicit:
- native `ETH` always available when escrow exists
- `USDT`/`USDC` only shown if whitelisted and deployed for that chain

- [ ] **Step 4: Manual smoke verification in dev**

Check:
- single checkout network selector
- cart checkout network selector
- explorer links for Base Sepolia

- [ ] **Step 5: Commit**

```bash
git add frontend/app/checkout/[orderId]/page.tsx frontend/app/checkout/cart/page.tsx
git commit -m "feat: add testnet lite checkout path"
```

---

## Chunk 5: Contract Ops / Balance Panel

### Task 6: Add backend contract ops snapshot service

**Files:**
- Create: `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\modules\admin\contract-ops.service.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\modules\admin\admin.controller.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\modules\admin\admin.routes.ts`
- Test: `C:\Users\Asus\Documents\FYP\FYP\backend\main-service\src\modules\admin\__tests__\contract-ops.service.test.ts`

- [ ] **Step 1: Write a failing service test**

Test expectations:
- returns a row per configured chain
- marks missing escrow addresses as unavailable
- includes operator/vault addresses
- tolerates RPC failure and reports degraded health instead of crashing

- [ ] **Step 2: Run the narrow test to confirm failure**

Run:

```bash
cd C:\Users\Asus\Documents\FYP\FYP\backend\main-service
npm test -- --runInBand src/modules/admin/__tests__/contract-ops.service.test.ts
```

Expected: FAIL because the service does not exist yet.

- [ ] **Step 3: Implement contract ops service**

The service should gather:
- chain id / name
- escrow contract address
- availability
- native balance
- accepted token balances (best-effort, token whitelist driven)
- operator / fee vault addresses when known
- RPC status / error summary

- [ ] **Step 4: Add admin route/controller**

Expose a read-only route such as:

```text
GET /api/admin/escrow/contracts
```

- [ ] **Step 5: Re-run the narrow backend test**

Run:

```bash
cd C:\Users\Asus\Documents\FYP\FYP\backend\main-service
npm test -- --runInBand src/modules/admin/__tests__/contract-ops.service.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/main-service/src/modules/admin/contract-ops.service.ts backend/main-service/src/modules/admin/admin.controller.ts backend/main-service/src/modules/admin/admin.routes.ts backend/main-service/src/modules/admin/__tests__/contract-ops.service.test.ts
git commit -m "feat: add contract ops admin snapshot"
```

### Task 7: Render admin contract ops panel

**Files:**
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\app\admin\escrow\page.tsx`
- Create: `C:\Users\Asus\Documents\FYP\FYP\frontend\__tests__\contract-ops-shaping.test.ts`

- [ ] **Step 1: Write a narrow UI shaping test**

Test expectations:
- available chains show contract address and balance
- unavailable chains show explicit unavailable state
- degraded RPC state renders warning styling without breaking the page

- [ ] **Step 2: Run the UI test to confirm failure**

Run:

```bash
cd C:\Users\Asus\Documents\FYP\FYP\frontend
npm test -- --runInBand __tests__/contract-ops-shaping.test.ts
```

Expected: FAIL because shaping/rendering helpers do not exist yet.

- [ ] **Step 3: Add contract ops section to admin escrow page**

Render:
- contract status cards per chain
- native balance
- token balances
- operator / fee vault
- health badge

Use existing dark/light surface tokens; do not introduce a new visual system.

- [ ] **Step 4: Re-run the UI shaping test**

Run:

```bash
cd C:\Users\Asus\Documents\FYP\FYP\frontend
npm test -- --runInBand __tests__/contract-ops-shaping.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app/admin/escrow/page.tsx frontend/__tests__/contract-ops-shaping.test.ts
git commit -m "feat: surface contract ops in admin"
```

---

## Chunk 6: Token Whitelist And Runtime Contract Mapping

### Task 8: Align backend/frontend chain contract maps with Base Sepolia

**Files:**
- Modify: `C:\Users\Asus\Documents\FYP\FYP\backend\payment-service\src\modules\crypto-payment\crypto-payment.service.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\frontend\lib\web3\config.ts`

- [ ] **Step 1: Update chain address maps**

Ensure both backend and frontend:
- include `ESCROW_CONTRACT_BASE_SEPOLIA`
- do not treat zero-address chains as active
- do not promote Mumbai in any active path

- [ ] **Step 2: Verify quote behavior assumptions**

Manual checks:
- Base Sepolia quote fails clearly if escrow address is zero
- Base Sepolia quote succeeds when escrow env is set
- Hardhat path remains unchanged

- [ ] **Step 3: Commit**

```bash
git add backend/payment-service/src/modules/crypto-payment/crypto-payment.service.ts frontend/lib/web3/config.ts
git commit -m "refactor: align contract mapping for testnet lite"
```

---

## Chunk 7: Documentation And Operator Notes

### Task 9: Add runtime/operator instructions

**Files:**
- Modify: `C:\Users\Asus\Documents\FYP\FYP\docs\API.md`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\contracts\scripts\deploy-amoy.ts`
- Modify: `C:\Users\Asus\Documents\FYP\FYP\contracts\scripts\bootstrap-local.ts`

- [ ] **Step 1: Update docs for two-mode demo**

Document:
- Hardhat demo mode
- Base Sepolia testnet-lite mode
- optional Amoy fallback
- how to use local MetaMask key safely

- [ ] **Step 2: Remove stale Mumbai guidance from docs/scripts**

Update script comments and package scripts so they no longer imply Mumbai is the current public testnet.

- [ ] **Step 3: Commit**

```bash
git add docs/API.md contracts/scripts/deploy-amoy.ts contracts/scripts/bootstrap-local.ts
git commit -m "docs: document testnet lite and local wallet flow"
```

---

## Final Verification Checklist

- [ ] Start local Hardhat and confirm local MetaMask address is funded
- [ ] Deploy or reuse EscrowCore on Base Sepolia
- [ ] Confirm `ESCROW_CONTRACT_BASE_SEPOLIA` is wired through frontend + backend
- [ ] Confirm checkout shows Base Sepolia as the primary public testnet path
- [ ] Confirm admin escrow page shows contract ops / balances
- [ ] Confirm no active UI path still presents Mumbai as a recommended testnet

## Suggested Execution Order

1. Chunk 1
2. Chunk 2
3. Chunk 3
4. Chunk 6
5. Chunk 4
6. Chunk 5
7. Chunk 7

