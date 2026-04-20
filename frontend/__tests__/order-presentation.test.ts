import { describe, expect, it } from '@jest/globals';
import { getOrderPricingDisplay, getOrderStatusMeta, resolveOrderProductImage } from '@/lib/orders/presentation';

describe('order presentation helpers', () => {
  it('resolves the product image from primary_image before metadata galleries', () => {
    const image = resolveOrderProductImage({
      primary_image: 'https://cdn.example.com/primary.jpg',
      product_metadata: {
        images: ['https://cdn.example.com/gallery.jpg'],
      },
    });

    expect(image).toBe('https://cdn.example.com/primary.jpg');
  });

  it('returns a token-first pricing snapshot when crypto amounts are available as strings', () => {
    const pricing = getOrderPricingDisplay({
      token_symbol: 'ETH',
      subtotal_token: '0.031435',
      amount_token: '0.031435',
      price_usd: 75,
    });

    expect(pricing.mode).toBe('token');
    expect(pricing.tokenSymbol).toBe('ETH');
    expect(pricing.tokenAmountLabel).toBe('0.031435');
    expect(pricing.usdAmount).toBe(75);
  });

  it('prefers final order total over legacy price_usd when rendering historical order usd snapshots', () => {
    const pricing = getOrderPricingDisplay({
      token_symbol: 'ETH',
      amount_token: '0.031435',
      price_usd: 70,
      total_amount: 75,
    });

    expect(pricing.mode).toBe('token');
    expect(pricing.usdAmount).toBe(75);
  });

  it('maps raw statuses into human-readable tracking guidance', () => {
    const status = getOrderStatusMeta('TX_SUBMITTED');

    expect(status.label).toBe('Đang xác nhận giao dịch');
    expect(status.waitingOn).toBe('Blockchain');
    expect(status.nextStep).toContain('Chờ');
  });

  it('maps retrying verification errors into operator-friendly tracking guidance', () => {
    const status = getOrderStatusMeta('TX_SUBMITTED', {
      verificationState: 'retrying',
      verificationMessage: 'RPC timeout while checking block confirmations',
      confirmations: 1,
      requiredConfirmations: 12,
    });

    expect(status.summary).toContain('1/12');
    expect(status.waitingOn).toBe('RPC / blockchain');
    expect(status.nextStep).toContain('thử kiểm tra lại');
    expect(status.escrowCopy).toContain('RPC timeout');
  });
});
