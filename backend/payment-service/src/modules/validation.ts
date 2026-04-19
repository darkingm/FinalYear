import { z } from 'zod';

const uuidField = z.string().uuid('Invalid UUID format');

export const generateQuoteSchema = z.object({
  body: z.object({
    order_id: z.number().positive('order_id must be a positive number'),
    token_symbol: z.string().min(1, 'token_symbol is required'),
    preferred_chain_id: z.number().int().optional(),  // ← chain buyer muốn thanh toán
    buyer_wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(), // ← wallet address buyer
  }),
});

export const generateQuoteBatchSchema = z.object({
  body: z.object({
    order_ids: z.array(z.number().positive('order_id must be a positive number')).min(1, 'At least one order is required'),
    token_symbol: z.string().min(1, 'token_symbol is required'),
    preferred_chain_id: z.number().int().optional(),
    buyer_wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
  }),
});

export const createPaymentSessionSchema = z.object({
  body: z.object({
    order_id: z.number().positive('order_id must be a positive number'),
    token_symbol: z.string().min(1, 'token_symbol is required'),
    preferred_chain_id: z.number().int().optional(),
    buyer_wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
  }),
});

export const getPaymentSessionQuoteSchema = z.object({
  params: z.object({
    sessionId: uuidField,
  }),
  body: z.object({
    nonce: uuidField,
  }),
});

export const submitPaymentSessionSchema = z.object({
  params: z.object({
    sessionId: uuidField,
  }),
  body: z.object({
    nonce: uuidField,
    tx_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash format'),
  }),
});

export const getPaymentSessionStatusSchema = z.object({
  params: z.object({
    sessionId: uuidField,
  }),
  query: z.object({
    nonce: uuidField,
  }),
});

export const submitTransactionSchema = z.object({
  body: z.object({
    order_id: z.number().positive('order_id must be a positive number'),
    tx_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash format'),
  }),
});

export const getPaymentStatusSchema = z.object({
  params: z.object({
    orderId: z.string().regex(/^\d+$/, 'orderId must be a number'),
  }),
});

export const verifyTransactionSchema = z.object({
  params: z.object({
    txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash format'),
  }),
});

export const createPaypalOrderSchema = z.object({
  body: z.object({
    order_id: z.number().positive('order_id must be a positive number'),
  }),
});

export const capturePaypalPaymentSchema = z.object({
  body: z.object({
    paypal_order_id: z.string().min(1, 'paypal_order_id is required'),
  }),
});

export const releaseFundsSchema = z.object({
  body: z.object({
    order_id: z.number().positive('order_id must be a positive number'),
  }),
});

export const refundPaymentSchema = z.object({
  body: z.object({
    order_id: z.number().positive('order_id must be a positive number'),
  }),
});
