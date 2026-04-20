import { describe, expect, it } from '@jest/globals';
import {
  buildLockedCartPreviewItems,
  getLockedCartTotalUsd,
} from '@/lib/payments/cart-pricing';

describe('cart pricing snapshots', () => {
  const cartItems = [
    {
      cart_item_id: 'hoodie',
      product_id: 11,
      name: 'BNB Chain Hoodie',
      base_price_usd: 75,
      quantity: 1,
      image_url: '/hoodie.jpg',
    },
    {
      cart_item_id: 'neon',
      product_id: 12,
      name: 'Ethereum Neon Wall Art',
      base_price_usd: 89,
      quantity: 2,
      image_url: '/neon.jpg',
    },
  ];

  it('prefers created order totals over cart estimates once orders are locked', () => {
    const createdOrders = [
      { order_id: 45, product_id: 11, quantity: 1, total_amount: '82.50' },
      { order_id: 46, product_id: 12, quantity: 2, total_amount: '190.00' },
    ];

    expect(getLockedCartTotalUsd(cartItems, createdOrders)).toBeCloseTo(272.5);

    expect(buildLockedCartPreviewItems(cartItems, createdOrders)).toEqual([
      expect.objectContaining({
        cart_item_id: 'hoodie',
        lockedUsdAmount: 82.5,
        orderId: 45,
      }),
      expect.objectContaining({
        cart_item_id: 'neon',
        lockedUsdAmount: 190,
        orderId: 46,
      }),
    ]);
  });

  it('falls back to cart item pricing before any order snapshot exists', () => {
    expect(getLockedCartTotalUsd(cartItems, [])).toBeCloseTo(253);

    expect(buildLockedCartPreviewItems(cartItems, [])).toEqual([
      expect.objectContaining({
        cart_item_id: 'hoodie',
        lockedUsdAmount: 75,
        orderId: null,
      }),
      expect.objectContaining({
        cart_item_id: 'neon',
        lockedUsdAmount: 178,
        orderId: null,
      }),
    ]);
  });
});
