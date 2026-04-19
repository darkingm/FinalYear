export interface PaymentReconciliationRow {
  order_id: number;
  order_number: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  order_status: string;
  order_updated_at: string | Date | null;
  order_tx_hash: string | null;
  order_chain_id: number | null;
  order_amount_token: number | string | null;
  order_total_amount: number | string | null;
  payment_projection_updated_at: string | Date | null;
  payment_projection_version: number | null;
  payment_id: number | null;
  payment_status: string | null;
  payment_tx_hash: string | null;
  payment_chain_id: number | null;
  payment_confirmations: number | null;
  payment_required_confirmations: number | null;
  payment_updated_at: string | Date | null;
}

export interface PaymentReconciliationCase extends PaymentReconciliationRow {
  has_issue: boolean;
  issue_code: string | null;
  issue_label: string | null;
  issue_detail: string | null;
}

function toMs(value: string | Date | null | undefined) {
  if (!value) return null;
  return new Date(value).getTime();
}

export function derivePaymentReconciliationCase(
  row: PaymentReconciliationRow,
  now: Date,
  pendingThresholdMs = 3 * 60 * 1000
): PaymentReconciliationCase {
  const paymentUpdatedAtMs = toMs(row.payment_updated_at);
  const isPendingTooLong =
    !!paymentUpdatedAtMs &&
    (now.getTime() - paymentUpdatedAtMs) >= pendingThresholdMs;

  if (row.order_tx_hash && row.payment_tx_hash && row.order_tx_hash !== row.payment_tx_hash) {
    return {
      ...row,
      has_issue: true,
      issue_code: 'tx_hash_mismatch',
      issue_label: 'TX hash mismatch',
      issue_detail: 'Order tx_hash and latest payment tx_hash do not match.',
    };
  }

  if (!row.payment_id && (row.order_tx_hash || ['TX_SUBMITTED', 'PAID', 'COMPLETED', 'REFUNDED', 'ONCHAIN_CONFIRMED'].includes(row.order_status))) {
    return {
      ...row,
      has_issue: true,
      issue_code: 'missing_payment_record',
      issue_label: 'Missing payment record',
      issue_detail: 'Order moved into a payment-related state but no payment row exists.',
    };
  }

  if (row.payment_status === 'pending' || row.payment_status === 'confirming') {
    if (isPendingTooLong) {
      return {
        ...row,
        has_issue: true,
        issue_code: 'stuck_confirmation',
        issue_label: 'Stuck confirmation',
        issue_detail: 'Payment has stayed pending/confirming longer than the allowed threshold.',
      };
    }

    return {
      ...row,
      has_issue: false,
      issue_code: null,
      issue_label: null,
      issue_detail: null,
    };
  }

  if (row.payment_status === 'confirmed' && !['PAID', 'COMPLETED', 'REFUNDED', 'ONCHAIN_CONFIRMED'].includes(row.order_status)) {
    return {
      ...row,
      has_issue: true,
      issue_code: 'projection_mismatch_confirmed',
      issue_label: 'Projection mismatch',
      issue_detail: 'Payment is confirmed but order status has not been projected forward.',
    };
  }

  if (row.payment_status === 'failed' && row.order_status !== 'TX_FAILED') {
    return {
      ...row,
      has_issue: true,
      issue_code: 'projection_mismatch_failed',
      issue_label: 'Failed payment mismatch',
      issue_detail: 'Payment failed but order status is not TX_FAILED.',
    };
  }

  if (!row.order_tx_hash && row.payment_tx_hash) {
    return {
      ...row,
      has_issue: true,
      issue_code: 'missing_order_tx_hash',
      issue_label: 'Missing order tx_hash',
      issue_detail: 'Payment row has tx_hash but order row does not.',
    };
  }

  return {
    ...row,
    has_issue: false,
    issue_code: null,
    issue_label: null,
    issue_detail: null,
  };
}
