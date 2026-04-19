import { paymentClient } from '@/lib/api/client';

export interface PaymentSession {
  session_id: string;
  nonce: string;
  user_id: number;
  order_id: number;
  token_symbol: string;
  chain_id: number;
  amount_token: number | string;
  quote_snapshot: Record<string, unknown>;
  status: string;
  tx_hash?: string | null;
  expires_at: string;
}

export async function createPaymentSession(input: {
  orderId: number;
  tokenSymbol: string;
  preferredChainId?: number;
  buyerWallet?: string;
}) {
  const response = await paymentClient.post('/api/payments/crypto/session', {
    order_id: input.orderId,
    token_symbol: input.tokenSymbol,
    preferred_chain_id: input.preferredChainId,
    buyer_wallet: input.buyerWallet,
  });

  return response.data.session as PaymentSession;
}

export async function getPaymentSessionQuote(input: {
  sessionId: string;
  nonce: string;
}) {
  const response = await paymentClient.post(`/api/payments/crypto/session/${input.sessionId}/quote`, {
    nonce: input.nonce,
  });

  return response.data.quote;
}

export async function submitPaymentSessionTransaction(input: {
  sessionId: string;
  nonce: string;
  txHash: string;
}) {
  const response = await paymentClient.post(`/api/payments/crypto/session/${input.sessionId}/submit`, {
    nonce: input.nonce,
    tx_hash: input.txHash,
  });

  return response.data;
}

export async function getPaymentSessionStatus(input: {
  sessionId: string;
  nonce: string;
}) {
  const response = await paymentClient.get(`/api/payments/crypto/session/${input.sessionId}/status`, {
    params: {
      nonce: input.nonce,
    },
  });

  return response.data;
}
