# Testnet Lite And Contract Ops Design

## Goal

Keep `Hardhat` as the zero-friction demo path, add one realistic public testnet path that works for `1-2` real test transactions with MetaMask, remove stale `Mumbai` assumptions from active UX/config, and expose contract balance / deploy health so demo and operations are observable.

## Product Decision

- `Hardhat` remains the primary demo chain.
- `Base Sepolia` becomes the primary `testnet-lite` chain.
- `Polygon Amoy` remains available as a secondary testnet path.
- `BNB Testnet` remains optional but not primary because faucet access is less practical.
- `Polygon Mumbai` is retired from active runtime/UI paths and kept only for backward compatibility where old labels still exist.

## Current Problems

- Chain configuration still contains mixed-era assumptions: `Amoy` is active, but `Mumbai` labels and paths still exist in some UI/admin code.
- The repo already supports several testnet chains, but there is no clear single “real testnet” mode that is ready for live buyer/seller demo.
- Contract operations are mostly opaque to the UI: there is no focused panel that shows whether a chain has an active escrow deployment, what the contract balance is, or whether the operator path is healthy.
- `Hardhat` local demo currently defaults to built-in test accounts, which makes it too easy to confuse imported Hardhat keys with a user’s actual MetaMask account.

## Architecture

### 1. Demo Modes

Two explicit runtime paths will coexist:

- `Demo Mode`
  - chain `31337`
  - local/VPS Hardhat
  - instant confirmations
  - zero faucet dependency
- `Testnet Lite Mode`
  - primary chain `84532` (`Base Sepolia`)
  - secondary chain `80002` (`Polygon Amoy`)
  - intended for `1-2` real MetaMask transactions with test assets

The frontend should present this distinction clearly instead of showing all testnets as equal.

### 2. Chain Configuration Cleanup

- `frontend/lib/web3/config.ts` becomes the canonical source for active testnet ordering.
- `Base Sepolia` moves ahead of `Amoy`.
- `Mumbai` labels and old references are removed from active UI/config metadata.
- `payment-service` and contract env mapping must expose a non-zero escrow contract address for `Base Sepolia`.

### 3. Contract Deployment Model

The project keeps a shared `EscrowCore` per chain:

- one `EscrowCore` on `Hardhat`
- one `EscrowCore` on `Base Sepolia`
- optionally one `EscrowCore` on `Amoy`

No per-order contract deployment is introduced. Orders continue to map into the existing `mapping(orderId => Order)` model on-chain.

### 4. Testnet Asset Strategy

`Testnet Lite Mode` supports two asset paths:

- native gas token path first
  - `ETH` on Base Sepolia
  - simplest for proving the flow works
- optional mock stablecoin path second
  - deploy `MockUSDT` or `MockUSDC` on Base Sepolia
  - whitelist it in backend/admin
  - use it for a more “real marketplace payment” demo

This avoids dependence on third-party test stablecoin availability while still allowing realistic ERC-20 escrow demonstrations.

### 5. Contract Ops / Balance Panel

Add an admin-facing contract operations panel that shows, per chain:

- chain name
- escrow contract address
- deployment status
- native balance of the escrow contract
- tracked token balances for accepted payment tokens
- operator wallet address
- fee vault address
- RPC health / last successful check

This panel is diagnostic only for the first iteration. No destructive admin actions are required in this batch.

### 6. Hardhat Local MetaMask Support

Local Hardhat should support a user-owned MetaMask account without committing secrets:

- `contracts/.env.local` stores `LOCAL_METAMASK_PRIVATE_KEY`
- `hardhat.config.ts` loads `.env.local` before `.env`
- the local `hardhat` network appends that account to the standard Hardhat funded accounts
- `localhost` script execution also uses the same local-only key when available

This keeps the user on their own MetaMask identity in the local chain while preserving the default Hardhat accounts.

## Operational Hardening Scope

This batch should also move the architecture one step closer to production-safe operation without trying to solve full HA/autoscaling in one pass:

1. keep `Hardhat` isolated as demo-only, not a production-like default
2. make the real testnet path explicit and observable
3. remove deprecated chain metadata from active paths
4. add contract/chain health visibility in admin
5. prepare queue/worker split follow-up by avoiding new coupling in the API layer
6. make operator and vault addresses visible to admins
7. keep event-driven payment/order sync compatible with the new chain mode split

## Data Flow

### Demo Mode

1. Buyer selects `Hardhat`.
2. Frontend uses local/VPS escrow address for `31337`.
3. User signs transaction from their own MetaMask account on local chain.
4. Existing payment session / event-driven sync handles submission and verification.

### Testnet Lite Mode

1. Buyer selects `Base Sepolia`.
2. Frontend requests quote/session on chain `84532`.
3. Buyer signs either native `ETH` escrow deposit or ERC-20 mock token deposit.
4. Payment verification runs on real public RPC.
5. Order/payment projection updates exactly as in the existing event-driven flow.

## Error Handling

- If a chain has no deployed escrow contract, it must be shown as unavailable in UI, not merely fail at transaction time.
- If RPC for a chain is degraded, contract ops panel should surface it as unhealthy.
- If the selected testnet token is not whitelisted on that chain, checkout must stop before quote creation.
- If mock stablecoin is not deployed, the UI should still allow native asset demo instead of failing the whole testnet mode.

## Testing

- config-level tests for active testnet ordering and contract mapping
- narrow tests for contract ops data shaping
- manual validation path:
  - local Hardhat with user MetaMask account
  - Base Sepolia native `ETH` payment
  - optional Base Sepolia mock stablecoin payment
