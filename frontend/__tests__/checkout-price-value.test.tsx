import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { TokenAmountInline, UsdtAmountInline } from '@/components/checkout/CheckoutPriceValue';

describe('CheckoutPriceValue', () => {
  it('renders token amount with coin logo instead of visible symbol text', () => {
    render(<TokenAmountInline amount="0.789477" symbol="ETH" />);

    expect(screen.getByText('0.789477')).toBeTruthy();
    expect(screen.getByAltText('ETH')).toBeTruthy();
    expect(screen.queryByText(/^ETH$/)).toBeNull();
  });

  it('renders USDT estimate without dollar sign and with USDT logo', () => {
    render(<UsdtAmountInline amount={1899} />);

    expect(screen.getByText('1,899.00')).toBeTruthy();
    expect(screen.getByAltText('USDT')).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(screen.queryByText(/^USDT$/)).toBeNull();
  });
});
