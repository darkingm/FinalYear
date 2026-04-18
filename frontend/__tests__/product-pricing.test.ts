import { describe, expect, it } from '@jest/globals';
import { normalizeAcceptedTokensForDisplay, seedAcceptedTokenEditorState } from '@/lib/products/pricing';

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
