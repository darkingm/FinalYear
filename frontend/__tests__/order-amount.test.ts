import { describe, expect, it } from '@jest/globals';
import { formatEscrowAmount, hasPositiveAmount } from '@/lib/orders/amount';

describe('order amount helpers', () => {
  it('formats numeric strings safely for escrow display', () => {
    expect(formatEscrowAmount('0.123456789')).toBe('0.123457');
  });

  it('treats invalid or empty amounts as zero', () => {
    expect(formatEscrowAmount(undefined)).toBe('0.000000');
    expect(hasPositiveAmount('')).toBe(false);
    expect(hasPositiveAmount('abc')).toBe(false);
  });

  it('detects positive numeric amounts from postgres string payloads', () => {
    expect(hasPositiveAmount('1.5')).toBe(true);
    expect(hasPositiveAmount(0)).toBe(false);
  });
});
