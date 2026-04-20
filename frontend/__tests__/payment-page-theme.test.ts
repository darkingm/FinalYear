import { describe, expect, it } from '@jest/globals';
import {
  paymentPageTheme,
  getPaymentAccentPanelClass,
} from '@/lib/payments/payment-page-theme';

describe('payment page theme', () => {
  it('keeps payment pages white in light mode and glassy in dark mode', () => {
    expect(paymentPageTheme.pageShell).toContain('bg-white');
    expect(paymentPageTheme.pageShell).toContain('dark:bg-background');
    expect(paymentPageTheme.primarySurface).toContain('dark:bg-slate-950/[0.008]');
    expect(paymentPageTheme.primarySurface).toContain('dark:backdrop-blur-[2px]');
    expect(paymentPageTheme.primarySurface).toContain('bg-white/95');
  });

  it('provides tinted panels that stay readable in both themes', () => {
    const emeraldPanel = getPaymentAccentPanelClass('emerald');
    expect(emeraldPanel).toContain('bg-emerald-50');
    expect(emeraldPanel).toContain('dark:bg-emerald-400/[0.08]');

    const amberPanel = getPaymentAccentPanelClass('amber');
    expect(amberPanel).toContain('bg-amber-50');
    expect(amberPanel).toContain('dark:bg-amber-400/[0.08]');
  });
});
