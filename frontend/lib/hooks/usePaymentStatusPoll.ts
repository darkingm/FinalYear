/**
 * usePaymentStatusPoll — Shared hook for polling payment verification status.
 *
 * Responsibilities (ONLY):
 *   - Call a fetchStatus adapter on interval
 *   - Normalise the snapshot into a uniform shape
 *   - Manage interval / timeout / manual refresh
 *   - Determine pending vs terminal state
 *
 * Does NOT handle: approve, sendTransaction, submit session, redirect logic.
 */
import { useState, useRef, useCallback, useEffect } from 'react';

/* ─── Public types ───────────────────────────────────────────────────────── */

export interface PaymentStatusSnapshot {
  /** Raw order status from backend (e.g. TX_SUBMITTED, PAID) */
  orderStatus: string | null;
  /** Verification state from buildPaymentVerificationMeta (pending | confirming | confirmed | failed | retrying) */
  verificationState: string | null;
  /** Human-readable verification message */
  verificationMessage: string | null;
  /** Current on-chain confirmations */
  confirmations: number;
  /** Required confirmations for this chain */
  requiredConfirmations: number;
  /** ISO timestamp of last successful verification */
  lastVerifiedAt: string | null;
  /** If stuck, reason from backend (e.g. "RPC timeout") */
  stuckReason: string | null;
}

export type PollTerminalState = 'confirmed' | 'failed' | 'timeout' | null;

export interface UsePaymentStatusPollConfig {
  /** Async function that fetches and returns a raw status snapshot from backend */
  fetchStatus: () => Promise<Record<string, any> | null>;
  /** Whether polling is enabled (e.g. only when order has TX in-flight) */
  enabled: boolean;
  /** Interval between polls in ms (default: 4000) */
  intervalMs?: number;
  /** Max time to poll before declaring timeout in ms (default: 120_000) */
  timeoutMs?: number;
  /** Show toast on manual refresh? */
  manualToast?: boolean;
}

export interface UsePaymentStatusPollReturn {
  /** Latest normalised snapshot */
  snapshot: PaymentStatusSnapshot;
  /** Whether a poll request is currently in-flight */
  isPolling: boolean;
  /** Terminal state if reached, null if still pending */
  terminalState: PollTerminalState;
  /** Number of consecutive poll errors */
  consecutiveErrors: number;
  /** Last poll error message (null when latest poll succeeded) */
  lastError: string | null;
  /** Manually trigger a one-shot refresh */
  refresh: () => Promise<void>;
  /** Reset poll state (e.g. when order changes or user retries) */
  reset: () => void;
}

/* ─── Default snapshot ───────────────────────────────────────────────────── */

const EMPTY_SNAPSHOT: PaymentStatusSnapshot = {
  orderStatus: null,
  verificationState: null,
  verificationMessage: null,
  confirmations: 0,
  requiredConfirmations: 0,
  lastVerifiedAt: null,
  stuckReason: null,
};

/* ─── Terminal-state check ───────────────────────────────────────────────── */

const TERMINAL_ORDER_STATUSES = new Set(['PAID', 'ONCHAIN_CONFIRMED', 'TX_FAILED', 'CANCELLED', 'REFUNDED', 'COMPLETED']);
const TERMINAL_VERIFICATION_STATES = new Set(['confirmed', 'failed']);

function deriveTerminalState(snap: PaymentStatusSnapshot): PollTerminalState {
  if (snap.verificationState === 'confirmed' || TERMINAL_ORDER_STATUSES.has(snap.orderStatus || '')) {
    // PAID and ONCHAIN_CONFIRMED are both "confirmed" for the poll
    if (['TX_FAILED', 'CANCELLED', 'REFUNDED'].includes(snap.orderStatus || '')) {
      return 'failed';
    }
    if (snap.verificationState === 'failed') {
      return 'failed';
    }
    return 'confirmed';
  }
  if (snap.verificationState === 'failed') {
    return 'failed';
  }
  return null;
}

/* ─── Normalise backend response → PaymentStatusSnapshot ─────────────── */

function normaliseSnapshot(raw: Record<string, any>): PaymentStatusSnapshot {
  return {
    orderStatus: typeof raw.status === 'string' ? raw.status : null,
    verificationState: raw.verification_state ?? null,
    verificationMessage: raw.verification_message ?? null,
    confirmations: Number(raw.confirmations ?? 0),
    requiredConfirmations: Number(raw.required_confirmations ?? 0),
    lastVerifiedAt: raw.last_verified_at ?? null,
    stuckReason: raw.stuck_reason ?? null,
  };
}

/* ─── Hook ───────────────────────────────────────────────────────────────── */

export function usePaymentStatusPoll(config: UsePaymentStatusPollConfig): UsePaymentStatusPollReturn {
  const {
    fetchStatus,
    enabled,
    intervalMs = 4000,
    timeoutMs = 120_000,
  } = config;

  const [snapshot, setSnapshot] = useState<PaymentStatusSnapshot>(EMPTY_SNAPSHOT);
  const [isPolling, setIsPolling] = useState(false);
  const [terminalState, setTerminalState] = useState<PollTerminalState>(null);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const enabledRef = useRef(enabled);
  const fetchRef = useRef(fetchStatus);
  enabledRef.current = enabled;
  fetchRef.current = fetchStatus;

  // Clear interval helper
  const clearPoll = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Single poll tick
  const tick = useCallback(async () => {
    if (!enabledRef.current) return;

    // Timeout check
    if (startTimeRef.current > 0 && Date.now() - startTimeRef.current > timeoutMs) {
      clearPoll();
      setTerminalState('timeout');
      return;
    }

    setIsPolling(true);
    try {
      const raw = await fetchRef.current();
      if (!raw) {
        setConsecutiveErrors((prev) => prev + 1);
        return;
      }

      const snap = normaliseSnapshot(raw);
      setSnapshot(snap);
      setConsecutiveErrors(0);
      setLastError(null);

      const terminal = deriveTerminalState(snap);
      if (terminal) {
        setTerminalState(terminal);
        clearPoll();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Poll failed';
      setLastError(msg);
      setConsecutiveErrors((prev) => prev + 1);
      // Don't stop polling on transient errors — let timeout handle it
      console.warn('[usePaymentStatusPoll] poll error:', msg);
    } finally {
      setIsPolling(false);
    }
  }, [clearPoll, timeoutMs]);

  // Start/stop poll based on enabled flag
  useEffect(() => {
    if (!enabled || terminalState) {
      clearPoll();
      return;
    }

    startTimeRef.current = Date.now();
    // Immediate first tick
    tick();
    intervalRef.current = setInterval(tick, intervalMs);

    return () => clearPoll();
  }, [enabled, terminalState, intervalMs, tick, clearPoll]);

  // Manual refresh
  const refresh = useCallback(async () => {
    setIsPolling(true);
    try {
      const raw = await fetchRef.current();
      if (raw) {
        const snap = normaliseSnapshot(raw);
        setSnapshot(snap);
        setConsecutiveErrors(0);
        setLastError(null);

        const terminal = deriveTerminalState(snap);
        if (terminal) {
          setTerminalState(terminal);
          clearPoll();
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Refresh failed';
      setLastError(msg);
      setConsecutiveErrors((prev) => prev + 1);
    } finally {
      setIsPolling(false);
    }
  }, [clearPoll]);

  // Reset (e.g. when switching orders or retrying)
  const reset = useCallback(() => {
    clearPoll();
    setSnapshot(EMPTY_SNAPSHOT);
    setTerminalState(null);
    setConsecutiveErrors(0);
    setLastError(null);
    startTimeRef.current = 0;
  }, [clearPoll]);

  return {
    snapshot,
    isPolling,
    terminalState,
    consecutiveErrors,
    lastError,
    refresh,
    reset,
  };
}
