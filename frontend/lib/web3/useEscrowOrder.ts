/**
 * useEscrowOrder — read on-chain truth for a single order.
 *
 * Reads `EscrowCore.getOrder(orderIdBytes32)` and returns a normalised view.
 * Auto-refreshes every 15 seconds and on chain reorgs.
 *
 * Usage:
 *   const { data, isLoading, error, refetch } = useEscrowOrder({
 *     internalOrderId: order.internal_order_id,
 *     chainId: 31337,
 *   });
 */

import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import type { Address } from 'viem';
import {
  ESCROW_ABI,
  ESCROW_ORDER_STATUS,
  type EscrowOrderStatus,
  isEscrowOrderEmpty,
  orderIdToBytes32,
} from './contracts';
import { ESCROW_CONTRACTS, hasEscrow } from './config';

export interface OnchainEscrowOrder {
  buyer: Address;
  seller: Address;
  token: Address;
  /** Amount in wei (post-fee, what seller receives) */
  amount: bigint;
  /** Fee in wei (what platform receives) */
  fee: bigint;
  /** Solidity enum index 0..5 */
  statusIndex: number;
  /** Human label, see ESCROW_ORDER_STATUS */
  status: EscrowOrderStatus | 'Unknown';
  createdAt: Date;
  expiresAt: Date;
  /** True if no order has ever been deposited under this orderId */
  isEmpty: boolean;
}

interface UseEscrowOrderInput {
  internalOrderId: string | null | undefined;
  chainId: number | null | undefined;
  /** Override polling. Default 15_000 ms; pass false to disable. */
  refetchInterval?: number | false;
  /** Skip the read entirely (e.g. when the order isn't crypto). */
  enabled?: boolean;
}

interface UseEscrowOrderResult {
  data: OnchainEscrowOrder | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
  /** Address of the EscrowCore contract on the resolved chain. */
  contractAddress: Address | null;
  /** True if the chain has no deployed escrow (read is skipped). */
  unsupportedChain: boolean;
}

export function useEscrowOrder({
  internalOrderId,
  chainId,
  refetchInterval = 15_000,
  enabled = true,
}: UseEscrowOrderInput): UseEscrowOrderResult {
  const orderKey = useMemo(
    () => (internalOrderId ? orderIdToBytes32(internalOrderId) : undefined),
    [internalOrderId]
  );

  const contractAddress = useMemo<Address | null>(() => {
    if (!chainId) return null;
    const addr = ESCROW_CONTRACTS[chainId];
    return addr && hasEscrow(chainId) ? (addr as Address) : null;
  }, [chainId]);

  const unsupportedChain = !!chainId && !contractAddress;
  const shouldRead = enabled && !!orderKey && !!contractAddress && !!chainId;

  const { data, isLoading, isFetching, error, refetch } = useReadContract({
    address: contractAddress ?? undefined,
    abi: ESCROW_ABI,
    functionName: 'getOrder',
    args: orderKey ? [orderKey] : undefined,
    chainId: chainId ?? undefined,
    query: {
      enabled: shouldRead,
      refetchInterval: refetchInterval === false ? false : refetchInterval,
      refetchOnWindowFocus: true,
      staleTime: 5_000,
    },
  });

  const normalised: OnchainEscrowOrder | null = useMemo(() => {
    if (!data) return null;
    const raw = data as {
      buyer: Address;
      seller: Address;
      token: Address;
      amount: bigint;
      fee: bigint;
      status: number;
      createdAt: bigint;
      expiresAt: bigint;
    };
    const statusIndex = Number(raw.status);
    return {
      buyer: raw.buyer,
      seller: raw.seller,
      token: raw.token,
      amount: raw.amount,
      fee: raw.fee,
      statusIndex,
      status: ESCROW_ORDER_STATUS[statusIndex] ?? 'Unknown',
      createdAt: new Date(Number(raw.createdAt) * 1000),
      expiresAt: new Date(Number(raw.expiresAt) * 1000),
      isEmpty: isEscrowOrderEmpty(raw),
    };
  }, [data]);

  return {
    data: normalised,
    isLoading,
    isFetching,
    error: (error as Error | null) ?? null,
    refetch,
    contractAddress,
    unsupportedChain,
  };
}
