import { describe, expect, it } from '@jest/globals';
import {
  paymentPageTheme,
  getPaymentAccentPanelClass,
} from '@/lib/payments/payment-page-theme';

describe('payment page theme', () => {
  it('keeps payment pages fully transparent with bright violet borders in both themes', () => {
    expect(paymentPageTheme.pageShell).toContain('bg-transparent');
    expect(paymentPageTheme.pageShell).toContain('dark:bg-transparent');
    expect(paymentPageTheme.primarySurface).toContain('border-violet-300/70');
    expect(paymentPageTheme.primarySurface).toContain('bg-transparent');
    expect(paymentPageTheme.primarySurface).toContain('dark:bg-transparent');
  });

  it('keeps accent panels transparent and border-led instead of filled', () => {
    const emeraldPanel = getPaymentAccentPanelClass('emerald');
    expect(emeraldPanel).toContain('border-violet-300/70');
    expect(emeraldPanel).toContain('bg-transparent');

    const amberPanel = getPaymentAccentPanelClass('amber');
    expect(amberPanel).toContain('border-violet-300/70');
    expect(amberPanel).toContain('bg-transparent');
  });
});
