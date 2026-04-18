import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductTokenPricing } from '@/components/product/ProductTokenPricing';

const tokens = [
  { token_id: 1, symbol: 'ETH', price_in_token: '0.019996', is_primary: true },
  { token_id: 2, symbol: 'USDT', price_in_token: '49.99', is_primary: false },
  { token_id: 3, symbol: 'MATIC', price_in_token: '180', is_primary: false },
  { token_id: 4, symbol: 'BNB', price_in_token: '0.14', is_primary: false },
];

describe('ProductTokenPricing', () => {
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
    expect(screen.getAllByLabelText(/^USDT$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/300 còn lại/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /chọn usdt 49\.99/i }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ token_id: 2 }));
  });
});
