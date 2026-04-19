import { paymentClient } from '@/lib/api/client';

export interface PaymentBatchSession {
  session_id: string;
  nonce: string;
  user_id: number;
  order_ids: number[];
  token_symbol: string;
  chain_id: number;
  amount_token_total: number | string;
  quote_snapshot: Record<string, unknown>;
  status: string;
  tx_hash?: string | null;
  expires_at: string;
}

export async function createPaymentBatchSession(input: {
  orderIds: number[];
  tokenSymbol: string;
  preferredChainId?: number;
  buyerWallet?: string;
}) {
  const response = await paymentClient.post('/api/payments/crypto/session-batch', {
    order_ids: input.orderIds,
    token_symbol: input.tokenSymbol,
    preferred_chain_id: input.preferredChainId,
    buyer_wallet: input.buyerWallet,
  });

  return response.data.session as PaymentBatchSession;
}

export async function getPaymentBatchSessionQuote(input: {
  sessionId: string;
  nonce: string;
}) {
  const response = await paymentClient.post(`/api/payments/crypto/session-batch/${input.sessionId}/quote`, {
    nonce: input.nonce,
  });

  return response.data.quote;
}

export async function submitPaymentBatchSessionTransaction(input: {
  sessionId: string;
  nonce: string;
  txHash: string;
}) {
  const response = await paymentClient.post(`/api/payments/crypto/session-batch/${input.sessionId}/submit`, {
    nonce: input.nonce,
    tx_hash: input.txHash,
  });

  return response.data;
}

export async function getPaymentBatchSessionStatus(input: {
  sessionId: string;
  nonce: string;
}) {
  const response = await paymentClient.get(`/api/payments/crypto/session-batch/${input.sessionId}/status`, {
    params: {
      nonce: input.nonce,
    },
  });

  return response.data;
}
