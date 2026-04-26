/**
 * Order on-chain sync service.
 *
 * Reads the canonical order state from `EscrowCore.getOrder(bytes32)` for a
 * given DB order row, then patches the DB `orders.status` if it has fallen
 * out of sync with the chain.
 *
 * This is the foundation for two flows:
 *   1. Buyer self-rescue (Phase 3): after a buyer signs `refundExpired`, the
 *      contract status flips to `Expired`, and we need the DB to reflect it.
 *   2. Auto-heal (Phase 5): a periodic worker can call this for stale orders
 *      to detect any drift caused by missed events.
 *
 * The function is idempotent: if the DB already matches the chain, it
 * returns `{ updated: false }` without writing anything.
 *
 * Mapping of on-chain `OrderStatus` enum -> DB status:
 *   Pending  (0) -> no change (transient pre-deposit state)
 *   Paid     (1) -> no change (DB drives lifecycle from PAID -> SHIPPED -> ...)
 *   Completed(2) -> 'COMPLETED'
 *   Refunded (3) -> 'REFUNDED'
 *   Disputed (4) -> 'DISPUTED'
 *   Expired  (5) -> 'REFUNDED' (semantically: buyer was made whole)
 */

import { ethers } from 'ethers';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/error-handler';

const ESCROW_ABI = [
  'function getOrder(bytes32 orderId) view returns (tuple(address buyer, address seller, address token, uint256 amount, uint256 fee, uint8 status, uint256 createdAt, uint256 expiresAt))',
];

const RPC_BY_CHAIN: Record<number, string | undefined> = {
  31337: process.env.LOCALHOST_RPC_URL || 'http://marketplace-hardhat:8545',
  137: process.env.POLYGON_RPC_URL || 'https://polygon.drpc.org',
  80002: process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
  11155111: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
};

const ESCROW_BY_CHAIN: Record<number, string | undefined> = {
  31337: process.env.ESCROW_CONTRACT_LOCALHOST,
  137: process.env.ESCROW_CONTRACT_POLYGON,
  80002: process.env.ESCROW_CONTRACT_AMOY,
  11155111: process.env.ESCROW_CONTRACT_SEPOLIA,
};

export type OnchainOrderStatus =
  | 'Pending'
  | 'Paid'
  | 'Completed'
  | 'Refunded'
  | 'Disputed'
  | 'Expired';

const STATUS_NAMES: OnchainOrderStatus[] = [
  'Pending',
  'Paid',
  'Completed',
  'Refunded',
  'Disputed',
  'Expired',
];

/** Translate on-chain enum index into the DB status the order should have. */
function mapOnchainToDbStatus(onchain: OnchainOrderStatus): string | null {
  switch (onchain) {
    case 'Completed':
      return 'COMPLETED';
    case 'Refunded':
    case 'Expired':
      return 'REFUNDED';
    case 'Disputed':
      return 'DISPUTED';
    case 'Pending':
    case 'Paid':
    default:
      // No change — DB lifecycle owns these transitions
      return null;
  }
}

/** Statuses we are willing to *advance* away from on the strength of chain data. */
const SAFE_TO_OVERRIDE_FROM = new Set([
  'PAID',
  'PAID_PAYPAL', // unlikely on chain, but harmless
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'ONCHAIN_CONFIRMED',
  'TX_SUBMITTED',
]);

export interface OrderRowForSync {
  order_id: number;
  internal_order_id: string | null;
  status: string;
  payment_method: string | null;
  chain_id: number | null;
  escrow_contract: string | null;
}

export interface SyncResult {
  updated: boolean;
  fromStatus: string;
  toStatus: string;
  onchainStatus: OnchainOrderStatus;
  reason?: string;
}

/**
 * Read on-chain status for the given order and patch DB if it has diverged.
 * Throws `AppError` if the order is not crypto / has no escrow / chain not
 * supported. Returns a structured result so callers can render it in the UI.
 */
export async function syncOrderFromChain(order: OrderRowForSync): Promise<SyncResult> {
  if (order.payment_method !== 'crypto') {
    throw new AppError('Order is not a crypto order', 400);
  }
  if (!order.internal_order_id) {
    throw new AppError('Order has no internal_order_id', 400);
  }
  if (!order.chain_id) {
    throw new AppError('Order has no chain_id', 400);
  }

  const escrowAddress = order.escrow_contract || ESCROW_BY_CHAIN[order.chain_id];
  if (!escrowAddress) {
    throw new AppError(`No escrow contract configured for chain ${order.chain_id}`, 400);
  }
  const rpcUrl = RPC_BY_CHAIN[order.chain_id];
  if (!rpcUrl) {
    throw new AppError(`No RPC URL configured for chain ${order.chain_id}`, 400);
  }

  const orderId32 = ethers.keccak256(ethers.toUtf8Bytes(order.internal_order_id));
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(escrowAddress, ESCROW_ABI, provider);

  let onchain;
  try {
    onchain = await contract.getOrder(orderId32);
  } catch (err: any) {
    logger.error('[syncOrderFromChain] getOrder() failed', {
      order_id: order.order_id,
      chain_id: order.chain_id,
      escrow: escrowAddress,
      err: err?.message,
    });
    throw new AppError(`On-chain read failed: ${err?.message || 'unknown'}`, 502);
  }

  const statusIdx = Number(onchain.status);
  if (statusIdx < 0 || statusIdx >= STATUS_NAMES.length) {
    throw new AppError(`Unknown on-chain status index ${statusIdx}`, 502);
  }
  const onchainStatus: OnchainOrderStatus = STATUS_NAMES[statusIdx];

  const desiredDbStatus = mapOnchainToDbStatus(onchainStatus);
  if (!desiredDbStatus || desiredDbStatus === order.status) {
    return {
      updated: false,
      fromStatus: order.status,
      toStatus: order.status,
      onchainStatus,
      reason: desiredDbStatus ? 'already_in_sync' : 'onchain_status_does_not_drive_db',
    };
  }

  // Only override DB if current state is one we are allowed to advance from.
  // Terminal states (CANCELLED, COMPLETED, REFUNDED, DISPUTED) and TX_FAILED
  // / UNPAID are intentionally excluded to avoid undoing manual fixes.
  if (!SAFE_TO_OVERRIDE_FROM.has(order.status)) {
    return {
      updated: false,
      fromStatus: order.status,
      toStatus: desiredDbStatus,
      onchainStatus,
      reason: `current_status_${order.status}_not_eligible_for_auto_sync`,
    };
  }

  await query(`UPDATE orders SET status = $1, updated_at = NOW() WHERE order_id = $2`, [
    desiredDbStatus,
    order.order_id,
  ]);

  logger.info('[syncOrderFromChain] DB advanced from on-chain truth', {
    order_id: order.order_id,
    fromStatus: order.status,
    toStatus: desiredDbStatus,
    onchainStatus,
  });

  return {
    updated: true,
    fromStatus: order.status,
    toStatus: desiredDbStatus,
    onchainStatus,
  };
}
