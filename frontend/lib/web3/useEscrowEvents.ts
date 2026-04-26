/**
 * useEscrowEvents — subscribe to EscrowCore events for a single order.
 *
 * Uses viem `watchContractEvent` (via wagmi `useWatchContractEvent`) to
 * receive `OrderCreated`, `OrderCompleted`, `OrderRefunded`, `OrderExpired`,
 * `OrderDisputed`, `DeliveryConfirmed` in realtime.
 *
 * IMPORTANT: viem cannot filter `bytes32 indexed` events by topic via the
 * `args` shorthand against a specific value across all event types
 * uniformly when each event has a different name. We subscribe to each
 * event separately and post-filter by `orderId` in the handler.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWatchContractEvent } from 'wagmi';
import type { Address } from 'viem';
import {
  ESCROW_ABI,
  orderIdToBytes32,
} from './contracts';
import { ESCROW_CONTRACTS, hasEscrow } from './config';

export type EscrowEventName =
  | 'OrderCreated'
  | 'OrderCompleted'
  | 'OrderRefunded'
  | 'OrderExpired'
  | 'OrderDisputed'
  | 'DeliveryConfirmed';

export interface EscrowEventEntry {
  /** Stable id: `${txHash}:${logIndex}` */
  id: string;
  name: EscrowEventName;
  /** Block timestamp in ms. May be `null` if RPC did not return it. */
  timestamp: number | null;
  blockNumber: bigint;
  txHash: `0x${string}`;
  /** Event payload, name-specific. See `EscrowEventEntry['args']`. */
  args: Record<string, unknown>;
}

interface UseEscrowEventsInput {
  internalOrderId: string | null | undefined;
  chainId: number | null | undefined;
  /** Hook fired on each new event matching the order. */
  onEvent?: (event: EscrowEventEntry) => void;
  enabled?: boolean;
}

interface UseEscrowEventsResult {
  events: EscrowEventEntry[];
  latestEvent: EscrowEventEntry | null;
  /** Reset the in-memory event log. */
  clear: () => void;
}

const TRACKED_EVENTS: EscrowEventName[] = [
  'OrderCreated',
  'OrderCompleted',
  'OrderRefunded',
  'OrderExpired',
  'OrderDisputed',
  'DeliveryConfirmed',
];

export function useEscrowEvents({
  internalOrderId,
  chainId,
  onEvent,
  enabled = true,
}: UseEscrowEventsInput): UseEscrowEventsResult {
  const [events, setEvents] = useState<EscrowEventEntry[]>([]);

  const targetOrderKey = useMemo(
    () =>
      internalOrderId ? orderIdToBytes32(internalOrderId).toLowerCase() : null,
    [internalOrderId]
  );

  const contractAddress = useMemo<Address | null>(() => {
    if (!chainId) return null;
    const addr = ESCROW_CONTRACTS[chainId];
    return addr && hasEscrow(chainId) ? (addr as Address) : null;
  }, [chainId]);

  const shouldWatch = enabled && !!contractAddress && !!chainId && !!targetOrderKey;

  const handleLogs = useCallback(
    (eventName: EscrowEventName, logs: readonly unknown[]) => {
      const matched: EscrowEventEntry[] = [];
      for (const raw of logs) {
        const log = raw as {
          args?: { orderId?: `0x${string}` } & Record<string, unknown>;
          transactionHash?: `0x${string}`;
          logIndex?: number;
          blockNumber?: bigint;
          blockTimestamp?: bigint;
        };
        const argOrderId = log.args?.orderId?.toLowerCase();
        if (!argOrderId || argOrderId !== targetOrderKey) continue;
        const txHash = log.transactionHash ?? '0x0';
        const id = `${txHash}:${log.logIndex ?? 0}`;
        matched.push({
          id,
          name: eventName,
          timestamp: log.blockTimestamp ? Number(log.blockTimestamp) * 1000 : null,
          blockNumber: log.blockNumber ?? 0n,
          txHash,
          args: { ...(log.args as Record<string, unknown>) },
        });
      }
      if (matched.length === 0) return;

      setEvents((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        const fresh = matched.filter((e) => !seen.has(e.id));
        if (fresh.length === 0) return prev;
        const next = [...prev, ...fresh].sort((a, b) =>
          a.blockNumber === b.blockNumber ? 0 : a.blockNumber < b.blockNumber ? -1 : 1
        );
        return next;
      });

      if (onEvent) matched.forEach(onEvent);
    },
    [targetOrderKey, onEvent]
  );

  // wagmi requires one hook call per event name. The list is fixed and small
  // so we call them inline; React lints are happy because order is stable.
  useWatchEscrowEvent({ eventName: 'OrderCreated', address: contractAddress, chainId, enabled: shouldWatch, onLogs: (l) => handleLogs('OrderCreated', l) });
  useWatchEscrowEvent({ eventName: 'OrderCompleted', address: contractAddress, chainId, enabled: shouldWatch, onLogs: (l) => handleLogs('OrderCompleted', l) });
  useWatchEscrowEvent({ eventName: 'OrderRefunded', address: contractAddress, chainId, enabled: shouldWatch, onLogs: (l) => handleLogs('OrderRefunded', l) });
  useWatchEscrowEvent({ eventName: 'OrderExpired', address: contractAddress, chainId, enabled: shouldWatch, onLogs: (l) => handleLogs('OrderExpired', l) });
  useWatchEscrowEvent({ eventName: 'OrderDisputed', address: contractAddress, chainId, enabled: shouldWatch, onLogs: (l) => handleLogs('OrderDisputed', l) });
  useWatchEscrowEvent({ eventName: 'DeliveryConfirmed', address: contractAddress, chainId, enabled: shouldWatch, onLogs: (l) => handleLogs('DeliveryConfirmed', l) });

  const clear = useCallback(() => setEvents([]), []);
  // Reset when the target changes — old events belong to a different order.
  useEffect(() => {
    setEvents([]);
  }, [targetOrderKey, contractAddress]);

  return {
    events,
    latestEvent: events.length > 0 ? events[events.length - 1] : null,
    clear,
  };
}

/* ── Internal: thin wrapper to keep call-site DRY ─────────────────────── */
interface WatchInput {
  eventName: EscrowEventName;
  address: Address | null;
  chainId: number | null | undefined;
  enabled: boolean;
  onLogs: (logs: readonly unknown[]) => void;
}

function useWatchEscrowEvent({ eventName, address, chainId, enabled, onLogs }: WatchInput) {
  useWatchContractEvent({
    address: address ?? undefined,
    abi: ESCROW_ABI,
    eventName,
    chainId: chainId ?? undefined,
    enabled,
    onLogs: (logs) => onLogs(logs as readonly unknown[]),
  });
}
