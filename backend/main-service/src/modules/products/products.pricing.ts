import {
  LegacyAcceptedTokenMigrationRow,
  ProductAcceptedTokenInput,
  ProductAcceptedTokenRow,
} from './products.types';

function normalizePrice(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeSymbol(symbol: unknown): string {
  return String(symbol ?? '').trim().toUpperCase();
}

export function buildAcceptedTokenRows(input: {
  acceptedTokens?: ProductAcceptedTokenInput[] | null;
  legacyTokenId?: number | null;
  legacyTokenSymbol?: string | null;
  legacyPriceInToken?: string | number | null;
  basePriceUsd?: number | null;
}): ProductAcceptedTokenRow[] {
  const acceptedTokens = (input.acceptedTokens ?? [])
    .map((token) => {
      const price = normalizePrice(token.amount ?? token.price_in_token);
      const symbol = normalizeSymbol(token.symbol);
      if (!token.token_id || !price || !symbol) return null;
      return {
        token_id: token.token_id,
        symbol,
        price_in_token: price,
        is_primary: Boolean(token.is_primary),
      } satisfies ProductAcceptedTokenRow;
    })
    .filter((token): token is ProductAcceptedTokenRow => Boolean(token));

  if (acceptedTokens.length > 0) {
    if (!acceptedTokens.some((token) => token.is_primary)) {
      acceptedTokens[0].is_primary = true;
    }
    return acceptedTokens.sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  }

  const legacyPrice = normalizePrice(input.legacyPriceInToken);
  const legacySymbol = normalizeSymbol(input.legacyTokenSymbol);
  if (input.legacyTokenId && legacyPrice && legacySymbol) {
    return [
      {
        token_id: input.legacyTokenId,
        symbol: legacySymbol,
        price_in_token: legacyPrice,
        is_primary: true,
      },
    ];
  }

  return [];
}

export function buildLegacyAcceptedTokenMigrationRows(input: {
  product_id: number;
  token_id?: number | null;
  price_in_token?: string | number | null;
}): LegacyAcceptedTokenMigrationRow[] {
  const price = normalizePrice(input.price_in_token);
  if (!input.product_id || !input.token_id || !price) {
    return [];
  }

  return [
    {
      product_id: input.product_id,
      token_id: input.token_id,
      price_in_token: price,
      is_primary: true,
    },
  ];
}
