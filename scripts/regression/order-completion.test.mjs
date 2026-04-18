import assert from 'node:assert/strict';

const orderLogic = await import('../../backend/main-service/dist/modules/orders/orders.logic.js');

assert.equal(
  orderLogic.shouldTriggerEscrowRelease('COMPLETED', 'crypto', 'buyer_onchain'),
  false,
);

assert.equal(
  orderLogic.shouldTriggerEscrowRelease('COMPLETED', 'crypto', null),
  true,
);

assert.equal(
  orderLogic.isBuyerOnchainCompletionSync('COMPLETED', 'crypto', 'buyer_onchain'),
  true,
);
assert.equal(
  orderLogic.isBuyerOnchainCompletionSync('COMPLETED', 'paypal', 'buyer_onchain'),
  false,
);

console.log('order-completion regression checks passed');
