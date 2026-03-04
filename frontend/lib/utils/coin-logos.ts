// Real cryptocurrency logos from CDN
export const COIN_LOGOS: Record<string, string> = {
  BTC: 'https://assets.coincap.io/assets/icons/btc@2x.png',
  ETH: 'https://assets.coincap.io/assets/icons/eth@2x.png',
  BNB: 'https://assets.coincap.io/assets/icons/bnb@2x.png',
  USDT: 'https://assets.coincap.io/assets/icons/usdt@2x.png',
  USDC: 'https://assets.coincap.io/assets/icons/usdc@2x.png',
  DAI: 'https://assets.coincap.io/assets/icons/dai@2x.png',
  MATIC: 'https://assets.coincap.io/assets/icons/matic@2x.png',
  LINK: 'https://assets.coincap.io/assets/icons/link@2x.png',
  SOL: 'https://assets.coincap.io/assets/icons/sol@2x.png',
  ADA: 'https://assets.coincap.io/assets/icons/ada@2x.png',
  DOT: 'https://assets.coincap.io/assets/icons/dot@2x.png',
  AVAX: 'https://assets.coincap.io/assets/icons/avax@2x.png',
  DOGE: 'https://assets.coincap.io/assets/icons/doge@2x.png',
  XRP: 'https://assets.coincap.io/assets/icons/xrp@2x.png',
};

export function getCoinLogo(symbol: string): string {
  if (!symbol) return '/placeholder-product.svg';

  // Normalize symbol - remove trailing USDT only if it's a trading pair
  const upper = symbol.toUpperCase();

  // Direct match first (e.g., 'USDT', 'BTC', 'ETH')
  if (COIN_LOGOS[upper]) return COIN_LOGOS[upper];

  // Try removing 'USDT' suffix for trading pairs (e.g., 'BTCUSDT' → 'BTC')
  const cleanSymbol = upper.replace(/USDT$/, '');
  if (cleanSymbol && COIN_LOGOS[cleanSymbol]) return COIN_LOGOS[cleanSymbol];

  // Fallback to coincap CDN
  const slug = cleanSymbol.toLowerCase() || symbol.toLowerCase();
  return `https://assets.coincap.io/assets/icons/${slug}@2x.png`;
}
