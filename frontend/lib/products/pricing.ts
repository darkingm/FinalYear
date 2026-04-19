import {
  ProductAcceptedTokenView,
  ProductTokenChipState,
  ProductTokenChipView,
  ProductEditorSeedToken,
  ProductEditorTokenRow,
  ProductPricingDisplayRow,
  ProductUpsertAcceptedTokenPayload,
} from './types';

interface MarketQuotePrice {
  price: number;
}

interface BuildLiveUsdtEstimateInput {
  tokenSymbol?: string | null;
  tokenAmount?: string | number | null;
  basePriceUsd?: string | number | null;
  marketPrices?: Record<string, MarketQuotePrice | undefined>;
}

interface LiveUsdtEstimate {
  displayAmount: string;
  numericAmount: number;
  source: 'market' | 'fallback' | 'token-usdt';
  quoteSymbol: string | null;
}

function normalizeAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function formatDisplayAmount(amount: string, symbol: string): string {
  const numeric = Number(amount);
  if (Number.isNaN(numeric)) {
    return `${amount} ${symbol}`.trim();
  }

  const maximumFractionDigits = numeric >= 1 ? 4 : 8;
  return `${numeric.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })} ${symbol}`.trim();
}

export function formatTokenAmountOnly(amount: string | number | null | undefined): string {
  const normalized = normalizeAmount(amount);
  const numeric = Number(normalized);

  if (normalized.length === 0 || Number.isNaN(numeric)) {
    return normalized;
  }

  return numeric.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: numeric >= 1 ? 4 : 8,
  });
}

function toNumericValue(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatUsdtDisplay(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function resolveMarketQuoteSymbol(symbol: string | null | undefined): string | null {
  const normalized = String(symbol ?? '').trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === 'USDT') return 'USDT';
  return `${normalized}USDT`;
}

export function buildLiveUsdtEstimate(input: BuildLiveUsdtEstimateInput): LiveUsdtEstimate {
  const quoteSymbol = resolveMarketQuoteSymbol(input.tokenSymbol);
  const tokenAmount = toNumericValue(input.tokenAmount);
  const basePriceUsd = toNumericValue(input.basePriceUsd);

  if (quoteSymbol === 'USDT') {
    return {
      displayAmount: formatUsdtDisplay(tokenAmount || basePriceUsd),
      numericAmount: tokenAmount || basePriceUsd,
      source: 'token-usdt',
      quoteSymbol,
    };
  }

  const marketQuote = quoteSymbol ? input.marketPrices?.[quoteSymbol] : null;
  if (marketQuote && Number.isFinite(marketQuote.price) && marketQuote.price > 0 && tokenAmount > 0) {
    const estimated = tokenAmount * marketQuote.price;
    return {
      displayAmount: formatUsdtDisplay(estimated),
      numericAmount: estimated,
      source: 'market',
      quoteSymbol,
    };
  }

  return {
    displayAmount: formatUsdtDisplay(basePriceUsd),
    numericAmount: basePriceUsd,
    source: 'fallback',
    quoteSymbol,
  };
}

export function normalizeAcceptedTokensForDisplay(tokens: ProductAcceptedTokenView[]): ProductPricingDisplayRow[] {
  return [...tokens]
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    .map((token) => {
      const amount = normalizeAmount(token.price_in_token);
      return {
        ...token,
        price_in_token: amount,
        logo_symbol: token.logo_symbol ?? token.symbol,
        display_amount: formatDisplayAmount(amount, token.symbol),
      };
    });
}

export function buildAcceptedTokenChipState(
  tokens: ProductAcceptedTokenView[],
  options: { selectedTokenId?: number | null; maxVisible?: number } = {},
): ProductTokenChipState {
  const ordered = normalizeAcceptedTokensForDisplay(tokens);
  const activeToken =
    ordered.find((token) => token.token_id === options.selectedTokenId) ??
    ordered.find((token) => token.is_primary) ??
    ordered[0] ??
    null;

  const all: ProductTokenChipView[] = ordered.map((token) => ({
    ...token,
    amountLabel: formatTokenAmountOnly(token.price_in_token),
    isActive: activeToken ? token.token_id === activeToken.token_id : false,
  }));

  const maxVisible = Math.max(0, options.maxVisible ?? all.length);
  return {
    activeToken,
    visible: all.slice(0, maxVisible),
    hiddenCount: Math.max(0, all.length - maxVisible),
    all,
  };
}

export function seedAcceptedTokenEditorState(input: {
  basePriceUsd: number;
  tokens: ProductEditorSeedToken[];
}): ProductEditorTokenRow[] {
  return input.tokens.map((token, index) => {
    let amount = '';
    if (token.usd_rate > 0) {
      amount = token.usd_rate === 1
        ? String(input.basePriceUsd)
        : (input.basePriceUsd / token.usd_rate).toFixed(6).replace(/\.?0+$/, '');
    }

    return {
      token_id: token.token_id,
      symbol: token.symbol,
      usd_rate: token.usd_rate,
      amount,
      is_primary: index === 0 ? true : Boolean(token.is_primary),
    };
  });
}

export function syncAcceptedTokenEditorState(input: {
  basePriceUsd: number;
  catalog: ProductEditorSeedToken[];
  selectedSymbols: string[];
  currentRows: ProductEditorTokenRow[];
}): ProductEditorTokenRow[] {
  const selectedSet = new Set(input.selectedSymbols.map((symbol) => symbol.toUpperCase()));
  const catalogRows = seedAcceptedTokenEditorState({
    basePriceUsd: input.basePriceUsd,
    tokens: input.catalog.filter((token) => selectedSet.has(token.symbol.toUpperCase())),
  });

  if (catalogRows.length === 0) {
    return [];
  }

  return catalogRows.map((seedRow, index) => {
    const existing = input.currentRows.find(
      (row) => row.token_id === seedRow.token_id || row.symbol.toUpperCase() === seedRow.symbol.toUpperCase(),
    );

    return {
      ...seedRow,
      amount: existing?.amount?.trim() ? existing.amount : seedRow.amount,
      is_primary: existing ? existing.is_primary : index === 0,
    };
  });
}

export function promotePrimaryEditorToken(
  rows: ProductEditorTokenRow[],
  tokenId: number,
): ProductEditorTokenRow[] {
  return rows.map((row) => ({
    ...row,
    is_primary: row.token_id === tokenId,
  }));
}

export function serializeAcceptedTokensForPayload(
  rows: ProductEditorTokenRow[],
): ProductUpsertAcceptedTokenPayload[] {
  return rows
    .filter((row) => row.amount.trim().length > 0 && !Number.isNaN(Number(row.amount)))
    .map((row, index) => ({
      token_id: row.token_id,
      symbol: row.symbol,
      amount: row.amount.trim(),
      is_primary: row.is_primary || index === 0,
    }));
}

export function buildPricingMetadataMap(rows: ProductEditorTokenRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const amount = Number(row.amount);
    if (!Number.isNaN(amount) && amount > 0) {
      acc[row.symbol] = amount;
    }
    return acc;
  }, {});
}
