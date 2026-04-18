import { describe, expect, it } from '@jest/globals';
import { buildAcceptedTokenRows, buildLegacyAcceptedTokenMigrationRows } from '../products.pricing';

describe('buildAcceptedTokenRows', () => {
  it('prefers normalized accepted tokens over legacy fields', () => {
    const result = buildAcceptedTokenRows({
      basePriceUsd: 120,
      acceptedTokens: [
        { token_id: 1, symbol: 'ETH', price_in_token: '0.04', is_primary: true },
        { token_id: 2, symbol: 'USDT', price_in_token: '120', is_primary: false },
      ],
      legacyTokenId: 99,
      legacyTokenSymbol: 'OLD',
      legacyPriceInToken: '999',
    });

    expect(result.map((row) => row.symbol)).toEqual(['ETH', 'USDT']);
    expect(result[0]).toMatchObject({
      token_id: 1,
      symbol: 'ETH',
      price_in_token: '0.04',
      is_primary: true,
    });
  });

  it('falls back to a legacy row when normalized tokens are missing', () => {
    const result = buildAcceptedTokenRows({
      legacyTokenId: 3,
      legacyTokenSymbol: 'BNB',
      legacyPriceInToken: '1.5',
    });

    expect(result).toEqual([
      {
        token_id: 3,
        symbol: 'BNB',
        price_in_token: '1.5',
        is_primary: true,
      },
    ]);
  });
});

describe('buildLegacyAcceptedTokenMigrationRows', () => {
  it('creates normalized token rows from legacy token_id and price_in_token', () => {
    const rows = buildLegacyAcceptedTokenMigrationRows({
      product_id: 42,
      token_id: 3,
      price_in_token: '12.5',
    });

    expect(rows).toEqual([
      expect.objectContaining({
        product_id: 42,
        token_id: 3,
        price_in_token: '12.5',
        is_primary: true,
      }),
    ]);
  });
});
