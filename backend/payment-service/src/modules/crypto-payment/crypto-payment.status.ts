const TESTNET_CONFIRMATION_CHAINS = new Set([97, 80002, 421614, 84532]);
const READ_THROUGH_PENDING_ORDER_STATUSES = new Set(['TX_SUBMITTED', 'ONCHAIN_PENDING', 'ONCHAIN_CONFIRMED']);
const READ_THROUGH_PENDING_PAYMENT_STATUSES = new Set(['pending', 'confirming']);

export interface PaymentVerificationMetaInput {
  chainId?: number | null;
  orderStatus?: string | null;
  paymentStatus?: string | null;
  confirmations?: number | null;
  requiredConfirmations?: number | null;
  verifyError?: string | null;
}

export function getRequiredConfirmationsForChain(chainId?: number | null): number {
  if (chainId === 31337) {
    return 0;
  }

  if (chainId && TESTNET_CONFIRMATION_CHAINS.has(chainId)) {
    return 1;
  }

  return 12;
}

export function shouldReadThroughVerifyStatus(input: {
  orderStatus?: string | null;
  paymentStatus?: string | null;
  txHash?: string | null;
}): boolean {
  const txHash = String(input.txHash ?? '').trim();
  if (!txHash) {
    return false;
  }

  const orderStatus = String(input.orderStatus ?? '').trim().toUpperCase();
  const paymentStatus = String(input.paymentStatus ?? '').trim().toLowerCase();

  return READ_THROUGH_PENDING_ORDER_STATUSES.has(orderStatus)
    || READ_THROUGH_PENDING_PAYMENT_STATUSES.has(paymentStatus);
}

export function buildPaymentVerificationMeta(input: PaymentVerificationMetaInput) {
  const orderStatus = String(input.orderStatus ?? '').trim().toUpperCase();
  const paymentStatus = String(input.paymentStatus ?? '').trim().toLowerCase();
  const confirmations = Number(input.confirmations ?? 0);
  const requiredConfirmations = input.requiredConfirmations ?? getRequiredConfirmationsForChain(input.chainId);
  const verifyError = String(input.verifyError ?? '').trim();

  if (verifyError) {
    return {
      verification_state: 'retrying',
      verification_message: `Không thể kiểm tra blockchain lúc này: ${verifyError}. Bạn có thể thử kiểm tra lại.`,
      confirmations,
      required_confirmations: requiredConfirmations,
    };
  }

  if (orderStatus === 'TX_FAILED' || paymentStatus === 'failed') {
    return {
      verification_state: 'failed',
      verification_message: 'Giao dịch đã bị revert trên blockchain. Tiền chưa được khóa vào escrow.',
      confirmations,
      required_confirmations: requiredConfirmations,
    };
  }

  if (paymentStatus === 'confirmed' || ['PAID', 'PAYMENT_VALIDATED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'DISPUTED'].includes(orderStatus)) {
    return {
      verification_state: 'confirmed',
      verification_message: 'Thanh toán đã được xác nhận on-chain và tiền đã được khóa vào escrow.',
      confirmations,
      required_confirmations: requiredConfirmations,
    };
  }

  if (confirmations > 0 || orderStatus === 'ONCHAIN_PENDING' || paymentStatus === 'confirming') {
    return {
      verification_state: 'confirming',
      verification_message: `Blockchain đang xác nhận giao dịch (${confirmations}/${requiredConfirmations} block).`,
      confirmations,
      required_confirmations: requiredConfirmations,
    };
  }

  return {
    verification_state: 'pending',
    verification_message: 'Giao dịch đã gửi lên blockchain và đang chờ block đầu tiên được xác nhận.',
    confirmations,
    required_confirmations: requiredConfirmations,
  };
}
