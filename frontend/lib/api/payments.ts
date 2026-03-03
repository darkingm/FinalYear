import { paymentClient } from './client';

export const paymentsApi = {
  crypto: {
    quote: (order_id: number, token_symbol: string) =>
      paymentClient.post('/api/payments/crypto/quote', { order_id, token_symbol }),
    submit: (order_id: number, tx_hash: string) =>
      paymentClient.post('/api/payments/crypto/submit', { order_id, tx_hash }),
    status: (orderId: number) =>
      paymentClient.get(`/api/payments/crypto/status/${orderId}`),
    verify: (txHash: string) =>
      paymentClient.post(`/api/payments/crypto/verify/${txHash}`),
  },
  paypal: {
    createOrder: (order_id: number) =>
      paymentClient.post('/api/payments/paypal/create-order', { order_id }),
    capture: (paypal_order_id: string) =>
      paymentClient.post('/api/payments/paypal/capture', { paypal_order_id }),
  },
};
