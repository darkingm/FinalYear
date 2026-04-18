import assert from 'node:assert/strict';

const paymentLogic = await import('../../backend/payment-service/dist/modules/crypto-payment/crypto-payment.logic.js');

assert.equal(paymentLogic.resolveSellerWallet(null), null);
assert.equal(paymentLogic.resolveSellerWallet('not-a-wallet'), null);

assert.equal(
  paymentLogic.resolveSellerWallet('0x1234567890abcdef1234567890ABCDEF12345678'),
  '0x1234567890abcdef1234567890abcdef12345678',
);

assert.equal(
  paymentLogic.resolveOperatorPrivateKey({ ADMIN_PRIVATE_KEY: 'admin-key' }),
  'admin-key',
);
assert.equal(
  paymentLogic.resolveOperatorPrivateKey({ PRIVATE_KEY: 'private-key' }),
  'private-key',
);
assert.equal(
  paymentLogic.resolveOperatorPrivateKey({ BLOCKCHAIN_PRIVATE_KEY: 'blockchain-key' }),
  'blockchain-key',
);

assert.deepEqual(
  paymentLogic.collectAffectedOrderIds([
    { order_id: 11 },
    { order_id: 12 },
    { order_id: 11 },
    { order_id: 13 },
  ]),
  [11, 12, 13],
);

console.log('payment-logic regression checks passed');
