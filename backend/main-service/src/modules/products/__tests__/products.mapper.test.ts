import { describe, expect, it } from '@jest/globals';
import { mapProductDetailRow, mapProductListRow } from '../products.mapper';

describe('product row mappers', () => {
  it('returns the same normalized accepted token shape used by cards', () => {
    const acceptedTokens = [
      {
        token_id: 1,
        symbol: 'ETH',
        price_in_token: '0.04',
        is_primary: true,
        chain_id: 1,
        decimals: 18,
        token_address: '0xeth',
      },
    ];

    const list = mapProductListRow({
      product_id: 9,
      name: 'Camera',
      accepted_tokens: acceptedTokens,
      images: ['https://cdn.example.com/1.jpg'],
      primary_image: 'https://cdn.example.com/1.jpg',
    });

    const detail = mapProductDetailRow({
      product_id: 9,
      name: 'Camera',
      accepted_tokens: acceptedTokens,
      images: [
        {
          url: 'https://cdn.example.com/1.jpg',
          is_primary: true,
          sort_order: 0,
        },
      ],
      primary_image: 'https://cdn.example.com/1.jpg',
    });

    expect(detail.accepted_tokens[0]).toMatchObject({
      token_id: list.accepted_tokens[0].token_id,
      symbol: list.accepted_tokens[0].symbol,
      price_in_token: list.accepted_tokens[0].price_in_token,
      is_primary: list.accepted_tokens[0].is_primary,
      logo_symbol: list.accepted_tokens[0].logo_symbol,
    });
    expect(detail.accepted_tokens[0]).toMatchObject({
      token_id: 1,
      symbol: 'ETH',
      price_in_token: '0.04',
      logo_symbol: 'ETH',
    });
  });
});
