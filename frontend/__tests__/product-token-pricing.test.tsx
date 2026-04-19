import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ProductTokenPricing } from '@/components/product/ProductTokenPricing';
import { usePriceStore } from '@/store';

const tokens = [
  { token_id: 1, symbol: 'ETH', price_in_token: '0.019996', is_primary: true },
  { token_id: 2, symbol: 'USDT', price_in_token: '49.99', is_primary: false },
  { token_id: 3, symbol: 'MATIC', price_in_token: '180', is_primary: false },
  { token_id: 4, symbol: 'BNB', price_in_token: '0.14', is_primary: false },
];

describe('ProductTokenPricing', () => {
  beforeEach(() => {
    usePriceStore.setState((state) => ({
      ...state,
      prices: {},
      displaySnapshotPrices: {},
      connect: jest.fn(),
      isConnected: true,
    }));
  });

  it('renders compact amount-only chips, shows +N overflow, and emits token selection', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();

    render(
      <ProductTokenPricing
        acceptedTokens={tokens}
        basePriceUsd={49.99}
        selectedTokenId={2}
        onSelect={onSelect}
        variant="card"
        stock={300}
      />,
    );

    expect(screen.getByRole('button', { name: /chọn eth 0\.019996/i })).toBeTruthy();
    expect(screen.queryByText(/^ETH$/)).toBeNull();
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.getByText('≈')).toBeTruthy();
    expect(screen.getAllByAltText(/^USDT$/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(screen.getByText(/300 còn lại/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /chọn usdt 49\.99/i }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /chọn eth 0\.019996/i }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: /chọn usdt 49\.99/i }).className).toContain('text-slate-950');

    await user.click(screen.getByRole('button', { name: /chọn usdt 49\.99/i }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ token_id: 2 }));
  });

  it('uses the selected token to compute the USDT estimate from the 30-second market snapshot', async () => {
    const user = userEvent.setup();

    usePriceStore.setState((state) => ({
      ...state,
      displaySnapshotPrices: {
        ETHUSDT: {
          symbol: 'ETHUSDT',
          price: 2400,
          change24h: 1.25,
          high24h: 2500,
          low24h: 2300,
          volume24h: 1000,
        },
      },
    }));

    function ControlledPricing() {
      const [selectedTokenId, setSelectedTokenId] = useState<number | null>(1);

      return (
        <ProductTokenPricing
          acceptedTokens={tokens}
          basePriceUsd={49.99}
          selectedTokenId={selectedTokenId}
          onSelect={(token) => setSelectedTokenId(token.token_id)}
          variant="card"
          stock={300}
        />
      );
    }

    render(<ControlledPricing />);

    expect(screen.getByText('47.99')).toBeTruthy();
    expect(screen.queryByText('Live 30s')).toBeNull();

    await user.click(screen.getByRole('button', { name: /chọn usdt 49\.99/i }));

    expect(screen.getByRole('button', { name: /chọn usdt 49\.99/i }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByText('49.99').length).toBeGreaterThan(0);
    expect(screen.queryByText('Live 30s')).toBeNull();
  });
});
