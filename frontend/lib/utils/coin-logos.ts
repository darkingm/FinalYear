/**
 * Real cryptocurrency logos from CoinCap CDN.
 * Rules: NEVER use AI-generated icons. Only use real logos from official/CDN sources.
 * Sources: assets.coincap.io (primary), cryptologos.cc (fallback)
 */
export const COIN_LOGOS: Record<string, string> = {
  BTC: 'https://assets.coincap.io/assets/icons/btc@2x.png',
  ETH: 'https://assets.coincap.io/assets/icons/eth@2x.png',
  BNB: 'https://assets.coincap.io/assets/icons/bnb@2x.png',
  USDT: 'https://assets.coincap.io/assets/icons/usdt@2x.png',
  USDC: 'https://assets.coincap.io/assets/icons/usdc@2x.png',
  DAI: 'https://assets.coincap.io/assets/icons/dai@2x.png',
  MATIC: 'https://assets.coincap.io/assets/icons/matic@2x.png',
  POL: 'https://assets.coincap.io/assets/icons/matic@2x.png', // POL = new MATIC
  LINK: 'https://assets.coincap.io/assets/icons/link@2x.png',
  SOL: 'https://assets.coincap.io/assets/icons/sol@2x.png',
  ADA: 'https://assets.coincap.io/assets/icons/ada@2x.png',
  DOT: 'https://assets.coincap.io/assets/icons/dot@2x.png',
  AVAX: 'https://assets.coincap.io/assets/icons/avax@2x.png',
  DOGE: 'https://assets.coincap.io/assets/icons/doge@2x.png',
  XRP: 'https://assets.coincap.io/assets/icons/xrp@2x.png',
  ARB: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
  OP: 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png',
  ATOM: 'https://assets.coincap.io/assets/icons/atom@2x.png',
  UNI: 'https://assets.coincap.io/assets/icons/uni@2x.png',
  AAVE: 'https://assets.coincap.io/assets/icons/aave@2x.png',
};

export function getCoinLogo(symbol: string): string {
  if (!symbol) return '/placeholder-product.svg';
  const upper = symbol.toUpperCase();
  if (COIN_LOGOS[upper]) return COIN_LOGOS[upper];
  // Strip USDT suffix for trading pairs (BTCUSDT → BTC)
  const clean = upper.replace(/USDT$/, '');
  if (clean && COIN_LOGOS[clean]) return COIN_LOGOS[clean];
  // Generic fallback via coincap (works for most major tokens)
  const slug = (clean || upper).toLowerCase();
  return `https://assets.coincap.io/assets/icons/${slug}@2x.png`;
}

