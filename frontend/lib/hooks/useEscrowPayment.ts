/**
 * useEscrowPayment — Shared hook for blockchain payment + polling flow.
 * Used by both checkout/[orderId] and checkout/cart pages.
 */
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletClient, useBalance, useSwitchChain, useWriteContract } from 'wagmi';
import { type Address, erc20Abi } from 'viem';
import { toast } from 'sonner';
import { paymentClient } from '@/lib/api/client';

export type PayStep = 'idle' | 'approve' | 'signing' | 'sending' | 'submitted' | 'confirming' | 'done';

interface UseEscrowPaymentConfig {
  /** The order ID(s) to submit TX hash for */
  orderIds: number[];
  /** Redirect path after successful payment */
  redirectPath: string;
  /** Translation function */
  t: (key: string, opts?: any) => string;
}

interface PayTransactionParams {
  escrowContract: string;
  calldata: string;
  amountWei: string;
  chainId: number;
  isNative: boolean;
  tokenAddress?: string;
}

export function useEscrowPayment({ orderIds, redirectPath, t }: UseEscrowPaymentConfig) {
  const router = useRouter();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [payStep, setPayStep] = useState<PayStep>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmCount, setConfirmCount] = useState(0);
  const [redirectIn, setRedirectIn] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  /**
   * Approve ERC-20 token spending
   */
  const handleApprove = useCallback(async (
    tokenAddress: string,
    escrowContract: string,
    amountWei: string,
    chainId: number,
    refetchAllowance?: () => Promise<any>,
  ) => {
    setPayStep('approve');
    try {
      await writeContractAsync({
        address: tokenAddress as Address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [escrowContract as Address, BigInt(amountWei)],
        chainId,
      });
      toast.loading(t('checkout.approvePending') || 'Approving...', { id: 'approve' });
      await new Promise(r => setTimeout(r, 3000));
      if (refetchAllowance) await refetchAllowance();
      toast.success(t('checkout.approveSuccess') || 'Approve successful!', { id: 'approve' });
    } catch (e: any) {
      const msg = e.shortMessage || e.message || '';
      if (e.code === 4001 || msg.includes('rejected')) {
        toast.info(t('checkout.approveCancelled') || 'Approve cancelled');
      } else {
        toast.error(`${t('checkout.approveFailed') || 'Approve failed'}: ${msg}`);
      }
    } finally {
      setPayStep('idle');
    }
  }, [writeContractAsync, t]);

  /**
   * Switch chain if needed
   */
  const handleSwitchChain = useCallback(async (chainId: number) => {
    try {
      await switchChainAsync({ chainId });
    } catch {
      toast.error(t('checkout.switchChainFailed') || 'Switch chain failed');
    }
  }, [switchChainAsync, t]);

  /**
   * Main pay flow: send TX → submit hash → poll for confirmation → redirect
   */
  const handlePay = useCallback(async (params: PayTransactionParams) => {
    if (!walletClient) {
      toast.error(t('checkout.connectWallet') || 'Connect wallet first');
      return;
    }

    setPayError(null);
    setSubmitting(true);
    setPayStep('signing');

    try {
      // Step 1: Send transaction
      const tx = await walletClient.sendTransaction({
        to: params.escrowContract as Address,
        data: params.calldata as `0x${string}`,
        value: params.isNative ? BigInt(params.amountWei) : 0n,
        chainId: params.chainId,
      });
      const hash: string = typeof tx === 'string' ? tx : (tx as any).hash;

      // Step 2: TX submitted
      setPayStep('submitted');
      setTxHash(hash);
      toast.success(t('checkout.txSent') || 'Transaction sent!', { duration: 4000 });

      // Submit TX hash to payment service for all orders
      await Promise.allSettled(
        orderIds.map(id =>
          paymentClient.post('/api/payments/crypto/submit', { order_id: id, tx_hash: hash })
        )
      );

      // Step 3: Poll for on-chain confirmation
      setPayStep('confirming');
      setSubmitting(false);

      const maxWaitMs = 120_000;
      const pollStart = Date.now();
      let pollCount = 0;
      const firstOrderId = orderIds[0];

      const poll = async (): Promise<void> => {
        if (Date.now() - pollStart > maxWaitMs) {
          setPayStep('done');
          setConfirmed(true);
          toast.info(t('checkout.stillConfirming') || 'Still confirming... Check orders page.', { duration: 8000 });
          return;
        }
        try {
          const statusRes = await paymentClient.get(`/api/payments/crypto/status/${firstOrderId}`);
          const orderStatus = statusRes.data?.status?.status || statusRes.data?.status;
          const confs = Number(statusRes.data?.status?.confirmations ?? 0);
          setConfirmCount(confs);

          if (orderStatus === 'ONCHAIN_CONFIRMED' || orderStatus === 'PAID') {
            setPayStep('done');
            setConfirmed(true);
            toast.success(t('checkout.onchainConfirmed') || '✅ Payment confirmed on-chain!', { duration: 6000 });
            let countdown = 5;
            setRedirectIn(countdown);
            const iv = setInterval(() => {
              countdown -= 1;
              setRedirectIn(countdown);
              if (countdown <= 0) { clearInterval(iv); router.push(redirectPath); }
            }, 1000);
            return;
          }
        } catch { /* keep polling */ }

        pollCount++;
        const delay = Math.min(2000 + pollCount * 500, 8000);
        await new Promise(r => setTimeout(r, delay));
        return poll();
      };

      poll().catch(() => { setPayStep('done'); setConfirmed(true); });

    } catch (e: any) {
      const msg = e.shortMessage || e.message || 'Transaction failed';
      if (e.code === 4001 || msg.includes('rejected') || msg.includes('denied')) {
        toast.info(t('checkout.txCancelled') || 'Transaction cancelled');
      } else {
        toast.error(msg);
        setPayError(msg);
      }
      setPayStep('idle');
      setSubmitting(false);
    }
  }, [walletClient, orderIds, redirectPath, router, t]);

  return {
    payStep, setPayStep,
    txHash, setTxHash,
    confirmed, setConfirmed,
    confirmCount,
    redirectIn,
    submitting, setSubmitting,
    payError,
    handleApprove,
    handleSwitchChain,
    handlePay,
  };
}
