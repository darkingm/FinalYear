/**
 * Smart contract ABIs used by the frontend.
 *
 * EscrowCore contract:
 *   - Source: contracts/contracts/EscrowCore.sol
 *   - Order key on-chain is `bytes32`, derived from off-chain UTF-8 string
 *     `internal_order_id` via keccak256(toUtf8Bytes(internal_order_id)).
 *     The frontend MUST replicate that derivation to read/write per-order
 *     state on-chain. See `orderIdToBytes32` below.
 *
 * The ABI is in viem human-readable format and is parsed via `parseAbi` at
 * the call site. We centralise it here so all consumers stay in sync with
 * the deployed contract (avoid the previous bug where this file held a
 * stale `string orderId` signature that did not match the bytecode).
 */

import { parseAbi, keccak256, toBytes } from 'viem';

export const ESCROW_ABI = parseAbi([
  // ── Write (single order) ────────────────────────────────────────────
  'function deposit(bytes32 orderId, address token, uint256 amount, address seller) external',
  'function depositNative(bytes32 orderId, address seller) external payable',
  'function depositWithSwap(bytes32 orderId, address inputToken, address requiredToken, uint256 amountIn, uint256 minAmountOut, address seller, address routerAddress) external',
  'function releasePayment(bytes32 orderId) external',
  'function refund(bytes32 orderId) external',
  'function refundExpired(bytes32 orderId) external',
  'function raiseDispute(bytes32 orderId) external',
  'function buyerConfirmDelivery(bytes32 orderId) external',
  // ── Write (cart batch) ──────────────────────────────────────────────
  'function depositBatch(bytes32[] orderIds, address token, uint256[] amounts, address[] sellers) external',
  'function depositNativeBatch(bytes32[] orderIds, address[] sellers, uint256[] amounts) external payable',
  // ── Admin ───────────────────────────────────────────────────────────
  'function pause() external',
  'function unpause() external',
  'function updatePlatformFee(uint256 newFeePercent) external',
  'function updateFeeVault(address newVault) external',
  'function setSBTContract(address _sbt) external',
  // ── Read ────────────────────────────────────────────────────────────
  'function getOrder(bytes32 orderId) view returns ((address buyer, address seller, address token, uint256 amount, uint256 fee, uint8 status, uint256 createdAt, uint256 expiresAt))',
  'function getEffectiveFee(address buyer) view returns (uint256)',
  'function platformFeePercent() view returns (uint256)',
  'function feeVault() view returns (address)',
  'function paused() view returns (bool)',
  'function sbtContract() view returns (address)',
  // ── Events ──────────────────────────────────────────────────────────
  'event OrderCreated(bytes32 indexed orderId, address indexed buyer, address indexed seller, address token, uint256 amount, uint256 fee)',
  'event OrderCompleted(bytes32 indexed orderId)',
  'event OrderRefunded(bytes32 indexed orderId)',
  'event OrderExpired(bytes32 indexed orderId)',
  'event OrderDisputed(bytes32 indexed orderId)',
  'event DeliveryConfirmed(bytes32 indexed orderId, address indexed buyer, address indexed seller, bool onTime)',
  'event FeeUpdated(uint256 newFee)',
  'event FeeVaultUpdated(address newVault)',
  'event SBTContractUpdated(address newSBT)',
]);

export type EscrowABI = typeof ESCROW_ABI;

/**
 * On-chain order status enum mirror of `EscrowCore.OrderStatus`.
 * Index MUST match the Solidity enum order (Pending=0, Paid=1, ...).
 */
export const ESCROW_ORDER_STATUS = [
  'Pending',
  'Paid',
  'Completed',
  'Refunded',
  'Disputed',
  'Expired',
] as const;
export type EscrowOrderStatus = (typeof ESCROW_ORDER_STATUS)[number];

export function escrowStatusLabel(idx: number | undefined | null): EscrowOrderStatus | 'Unknown' {
  if (idx === undefined || idx === null) return 'Unknown';
  return ESCROW_ORDER_STATUS[idx] ?? 'Unknown';
}

/**
 * Derive the `bytes32` on-chain order key from an off-chain
 * `internal_order_id` string. MUST stay in lock-step with backend's
 * derivation in `crypto-payment.service.ts`:
 *   ethers.keccak256(ethers.toUtf8Bytes(internal_order_id))
 * which is byte-equivalent to:
 *   viem.keccak256(viem.toBytes(internal_order_id))
 */
export function orderIdToBytes32(internalOrderId: string): `0x${string}` {
  return keccak256(toBytes(internalOrderId));
}

/**
 * Sentinel value returned by `getOrder` when the on-chain mapping has no
 * entry for that key (the EVM zero-fills uninitialised storage).
 */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export function isEscrowOrderEmpty(order: {
  buyer: `0x${string}`;
  seller: `0x${string}`;
  amount: bigint;
  createdAt: bigint;
}): boolean {
  return (
    order.buyer === ZERO_ADDRESS &&
    order.seller === ZERO_ADDRESS &&
    order.amount === 0n &&
    order.createdAt === 0n
  );
}

