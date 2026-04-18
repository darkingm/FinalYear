import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockAddItem = jest.fn();

jest.mock('@/store/cart-store', () => ({
  useCartStore: (selector: (state: { addItem: typeof mockAddItem }) => unknown) =>
    selector({
      addItem: mockAddItem,
    }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
  },
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial, animate, transition, whileHover, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

jest.mock('next/link', () => {
  const React = require('react');
  const LinkMock = ({ children, href, ...props }: any) => React.createElement('a', { href, ...props }, children);
  LinkMock.displayName = 'NextLinkMock';
  return LinkMock;
});

const { ProductCard } = require('@/components/product/ProductCard');

describe('ProductCard', () => {
  it('uses the selected token for cart actions and only shows the real category badge', async () => {
    const user = userEvent.setup();

    render(
      <ProductCard
        product={{
          product_id: 42,
          name: 'Bitcoin Logo Hoodie',
          description: 'Premium cotton hoodie with embroidered BTC logo.',
          base_price_usd: 49.99,
          stock: 300,
          category: 'Fashion',
          seller_name: 'Fashion Hub',
          accepted_tokens: [
            { token_id: 1, symbol: 'ETH', price_in_token: '0.019996', is_primary: true },
            { token_id: 2, symbol: 'USDT', price_in_token: '49.99', is_primary: false },
            { token_id: 3, symbol: 'MATIC', price_in_token: '180', is_primary: false },
            { token_id: 4, symbol: 'BNB', price_in_token: '0.14', is_primary: false },
          ],
        }}
        showAddToCart
      />,
    );

    expect(screen.getByText('Fashion')).toBeTruthy();
    expect(screen.queryByText(/4 tokens/i)).toBeNull();

    await user.click(screen.getByRole('button', { name: /chọn usdt 49\.99/i }));
    fireEvent.click(screen.getByRole('button', { name: /thêm vào giỏ hàng/i }));

    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: 42,
        selected_token_id: 2,
        token_symbol: 'USDT',
      }),
    );
  });
});
