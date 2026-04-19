import { describe, expect, it } from '@jest/globals';
import {
  buildAcceptedTokenChipState,
  buildLiveUsdtEstimate,
  normalizeAcceptedTokensForDisplay,
  resolveMarketQuoteSymbol,
  seedAcceptedTokenEditorState,
} from '@/lib/products/pricing';

describe('normalizeAcceptedTokensForDisplay', () => {
  it('keeps token-first ordering and emits USD estimate separately', () => {
    const rows = normalizeAcceptedTokensForDisplay([
      { token_id: 1, symbol: 'ETH', price_in_token: '0.04', estimated_usdt: '120.00', is_primary: true },
      { token_id: 2, symbol: 'USDT', price_in_token: '120', estimated_usdt: '120.00', is_primary: false },
    ]);

    expect(rows[0].symbol).toBe('ETH');
    expect(rows[0].display_amount).toContain('0.04');
    expect(rows[0].estimated_usdt).toBe('120.00');
  });

  it('limits card chips to three visible tokens and reports hidden overflow', () => {
    const state = buildAcceptedTokenChipState(
      [
        { token_id: 1, symbol: 'ETH', price_in_token: '0.019996', is_primary: true },
        { token_id: 2, symbol: 'USDT', price_in_token: '49.99', is_primary: false },
        { token_id: 3, symbol: 'MATIC', price_in_token: '180', is_primary: false },
        { token_id: 4, symbol: 'BNB', price_in_token: '0.14', is_primary: false },
      ],
      { maxVisible: 3 },
    );

    expect(state.visible.map((chip) => chip.amountLabel)).toEqual(['0.019996', '49.99', '180']);
    expect(state.hiddenCount).toBe(1);
    expect(state.activeToken?.symbol).toBe('ETH');
  });

  it('keeps the selected token active when the user has already chosen one', () => {
    const state = buildAcceptedTokenChipState(
      [
        { token_id: 1, symbol: 'ETH', price_in_token: '0.019996', is_primary: true },
        { token_id: 2, symbol: 'USDT', price_in_token: '49.99', is_primary: false },
        { token_id: 3, symbol: 'MATIC', price_in_token: '180', is_primary: false },
      ],
      { selectedTokenId: 3, maxVisible: 3 },
    );

    expect(state.activeToken?.token_id).toBe(3);
    expect(state.visible.find((chip) => chip.token_id === 3)?.isActive).toBe(true);
  });
});

describe('seedAcceptedTokenEditorState', () => {
  it('seeds token rows from a USD base and preserves manual overrides', () => {
    const state = seedAcceptedTokenEditorState({
      basePriceUsd: 120,
      tokens: [
        { token_id: 1, symbol: 'ETH', usd_rate: 3000 },
        { token_id: 2, symbol: 'USDT', usd_rate: 1 },
      ],
    });

    state[0].amount = '0.05';

    expect(state[0].amount).toBe('0.05');
    expect(state[1].amount).toBe('120');
  });
});

describe('live pricing helpers', () => {
  it('maps supported symbols to Binance-compatible USDT quote symbols', () => {
    expect(resolveMarketQuoteSymbol('ETH')).toBe('ETHUSDT');
    expect(resolveMarketQuoteSymbol('matic')).toBe('MATICUSDT');
    expect(resolveMarketQuoteSymbol('USDT')).toBe('USDT');
    expect(resolveMarketQuoteSymbol('')).toBeNull();
  });

  it('builds an estimate from the selected token amount and market quote', () => {
    const estimate = buildLiveUsdtEstimate({
      tokenSymbol: 'ETH',
      tokenAmount: '0.5',
      basePriceUsd: 900,
      marketPrices: {
        ETHUSDT: { price: 2400 } as any,
      },
    });

    expect(estimate.displayAmount).toBe('1,200.00');
    expect(estimate.source).toBe('market');
    expect(estimate.quoteSymbol).toBe('ETHUSDT');
  });

  it('falls back to base USD when no market quote exists', () => {
    const estimate = buildLiveUsdtEstimate({
      tokenSymbol: 'ARB',
      tokenAmount: '10',
      basePriceUsd: 42,
      marketPrices: {},
    });

    expect(estimate.displayAmount).toBe('42.00');
    expect(estimate.source).toBe('fallback');
  });

  it('mirrors the selected amount when the token is already USDT', () => {
    const estimate = buildLiveUsdtEstimate({
      tokenSymbol: 'USDT',
      tokenAmount: '49.99',
      basePriceUsd: 50,
      marketPrices: {},
    });

    expect(estimate.displayAmount).toBe('49.99');
    expect(estimate.source).toBe('token-usdt');
    expect(estimate.quoteSymbol).toBe('USDT');
  });
});
