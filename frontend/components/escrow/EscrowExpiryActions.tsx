'use client';

/**
 * EscrowExpiryActions — Phase 3 buyer self-rescue.
 *
 * Shows three states based on the on-chain order:
 *   1. Order is `Paid` and now < expiresAt
 *      → countdown badge ("Hết hạn sau 6h 21' — buyer có thể tự refund").
 *   2. Order is `Paid` and now >= expiresAt
 *      → big primary CTA "Lấy lại tiền (refundExpired)".
 *   3. Order is already `Expired` / `Refunded` / `Completed`
 *      → nothing rendered (the EscrowStatusPanel already shows the status).
 *
 * The contract function `refundExpired(bytes32)` is permissionless — anyone
 * can call it once the deadline has passed. We still gate the button to the
 * buyer because they are the ones bearing the loss; if they want a third
 * party to call it for them they can just ask. This is documented in the
 * pop-up tooltip.
 *
 * After the on-chain tx confirms, the component calls
 * `POST /api/orders/:id/sync-from-chain` so the DB row flips to REFUNDED.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import type { Address } from 'viem';
import { ESCROW_ABI, orderIdToBytes32 } from '@/lib/web3/contracts';
import { useEscrowOrder } from '@/lib/web3/useEscrowOrder';
import { CHAIN_META } from '@/lib/web3/config';
import { ensureCorrectChainRpc } from '@/lib/web3/ensure-chain';
import { apiClient } from '@/lib/api/client';

interface Props {
  orderId: number;
  internalOrderId: string;
  chainId: number;
  /** Buyer wallet from DB (may differ from on-chain — we trust on-chain). */
  isBuyerOfOrder: boolean;
  /** Called after a successful on-chain refund + DB sync, so the parent
   *  page can refetch the order row. */
  onRefunded?: () => void;
}

export function EscrowExpiryActions({
  orderId,
  internalOrderId,
  chainId,
  isBuyerOfOrder,
  onRefunded,
}: Props) {
  const { isConnected, address, chainId: connectedChainId } = useAccount();
  const escrow = useEscrowOrder({ internalOrderId, chainId, refetchInterval: 30_000 });
  const { writeContractAsync, data: txHash, isPending: writePending, error: writeError, reset } =
    useWriteContract();
  const {
    isLoading: waitingReceipt,
    isSuccess: receiptOk,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash: txHash });

  const [now, setNow] = useState(() => Date.now());
  const [syncing, setSyncing] = useState(false);

  // Tick the clock once per second so the countdown stays live.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  // After the receipt is mined, sync the backend.
  useEffect(() => {
    if (!receiptOk || !txHash) return;
    let cancelled = false;
    (async () => {
      setSyncing(true);
      try {
        await apiClient.post(`/api/orders/${orderId}/sync-from-chain`);
        if (cancelled) return;
        toast.success('Đã lấy lại tiền và đồng bộ trạng thái đơn hàng.');
        await escrow.refetch();
        onRefunded?.();
      } catch (e: any) {
        if (cancelled) return;
        toast.warning(
          'On-chain refund thành công nhưng đồng bộ DB thất bại. Hệ thống sẽ tự thử lại.'
        );
      } finally {
        if (!cancelled) {
          setSyncing(false);
          reset();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptOk, txHash, orderId]);

  // Surface write errors as a toast (one-shot)
  useEffect(() => {
    if (!writeError) return;
    const msg = (writeError as any)?.shortMessage || writeError.message || 'Giao dịch thất bại';
    if (msg.includes('Not expired yet')) {
      toast.error('Đơn chưa hết hạn trên blockchain — chưa thể tự refund.');
    } else if (msg.includes('Invalid status')) {
      toast.error('Đơn không còn ở trạng thái Paid (có thể đã refund/hoàn tất).');
    } else if (msg.includes('rejected') || msg.includes('denied') || msg.includes('4001')) {
      toast.info('Bạn đã từ chối giao dịch trong MetaMask.');
    } else {
      toast.error(`Refund thất bại: ${msg}`);
    }
  }, [writeError]);

  const oc = escrow.data;
  const explorer = CHAIN_META[chainId]?.explorer || '';

  // Countdown values
  const expiresAt = oc?.expiresAt.getTime() ?? 0;
  const remainingMs = Math.max(0, expiresAt - now);
  const isExpired = expiresAt > 0 && now >= expiresAt;

  const countdownLabel = useMemo(() => {
    if (remainingMs === 0) return null;
    const totalSec = Math.floor(remainingMs / 1000);
    const days = Math.floor(totalSec / 86_400);
    const hours = Math.floor((totalSec % 86_400) / 3_600);
    const minutes = Math.floor((totalSec % 3_600) / 60);
    const seconds = totalSec % 60;
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }, [remainingMs]);

  if (!oc || oc.isEmpty) return null;
  // Only render in the live escrow window. Other states are shown by the
  // EscrowStatusPanel.
  if (oc.status !== 'Paid') return null;

  // ── State 1: still in escrow window
  if (!isExpired) {
    return (
      <div className="bg-card border border-amber-500/30 rounded-2xl p-4 mb-6 flex items-center gap-3">
        <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-300">
            Đếm ngược escrow:{' '}
            <span className="font-mono">{countdownLabel}</span>
          </p>
          <p className="text-xs text-amber-300/80 mt-0.5">
            Sau khi hết hạn, bạn (buyer) có thể tự refund nếu seller chưa giao
            hàng — tiền sẽ tự về ví bạn ngay lập tức, không cần chờ admin.
          </p>
        </div>
      </div>
    );
  }

  // ── State 2: expired window, refund available
  const wrongChain = isConnected && connectedChainId !== chainId;
  const wrongWallet =
    isConnected && oc.buyer && address && oc.buyer.toLowerCase() !== address.toLowerCase();
  const buttonDisabled =
    !isConnected || writePending || waitingReceipt || syncing || wrongChain;

  async function handleRefund() {
    try {
      // Ensure RPC is correct (will throw a friendly toast if not)
      await ensureCorrectChainRpc(chainId);
      const orderIdBytes = orderIdToBytes32(internalOrderId);
      const escrowAddr = escrow.contractAddress;
      if (!escrowAddr) {
        toast.error('Không tìm thấy địa chỉ Escrow contract cho chain này.');
        return;
      }
      await writeContractAsync({
        address: escrowAddr as Address,
        abi: ESCROW_ABI,
        functionName: 'refundExpired',
        args: [orderIdBytes],
        chainId,
      });
    } catch (e: any) {
      // useEffect-on-error handles user-visible messaging
    }
  }

  return (
    <div className="bg-card border border-red-500/40 rounded-2xl p-5 mb-6">
      <div className="flex items-start gap-3 mb-4">
        <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-bold text-sm text-red-300">
            Đơn đã hết hạn trên blockchain
          </p>
          <p className="text-xs text-red-300/80 mt-1">
            Seller đã không xử lý đơn trước khi escrow timeout. Bạn có thể
            tự gọi <span className="font-mono">refundExpired</span> để lấy
            lại toàn bộ số tiền + phí vào ví ngay lập tức. Giao dịch là
            permissionless (chỉ tốn 1 phí gas nhỏ).
          </p>
        </div>
      </div>

      {wrongWallet && (
        <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">
            Ví đang kết nối <span className="font-mono">{shortAddr(address!)}</span>{' '}
            không phải ví buyer của đơn (
            <span className="font-mono">{shortAddr(oc.buyer)}</span>). Vẫn có
            thể bấm — tiền sẽ về ví buyer chứ không phải ví bạn đang dùng để ký.
          </p>
        </div>
      )}

      {wrongChain && (
        <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">
            MetaMask đang ở chain khác. Đổi sang{' '}
            <strong>{CHAIN_META[chainId]?.name || `Chain ${chainId}`}</strong>{' '}
            trước khi tiếp tục.
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        {!isBuyerOfOrder ? (
          <p className="flex-1 text-xs text-muted-foreground italic py-2">
            Chỉ buyer của đơn hàng mới được hiển thị nút self-refund.
          </p>
        ) : (
          <button
            onClick={handleRefund}
            disabled={buttonDisabled}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {writePending || waitingReceipt || syncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {writePending
                  ? 'Đang ký…'
                  : waitingReceipt
                    ? 'Đang chờ xác nhận block…'
                    : 'Đang đồng bộ…'}
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Lấy lại tiền (refundExpired)
              </>
            )}
          </button>
        )}
        {txHash && explorer && (
          <a
            href={`${explorer}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl bg-muted hover:bg-muted/70 text-xs font-bold flex items-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Xem TX
          </a>
        )}
      </div>

      {receiptError && (
        <p className="text-xs text-red-400 mt-3">
          Block xác nhận lỗi: {receiptError.message}
        </p>
      )}
    </div>
  );
}

function shortAddr(value: string) {
  return value.length < 14 ? value : `${value.slice(0, 8)}…${value.slice(-6)}`;
}
