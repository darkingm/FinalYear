// Real cryptocurrency logos from CDN
export const COIN_LOGOS: Record<string, string> = {
  BTC: 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg',
  ETH: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
  BNBUSDT: 'https://cryptologos.cc/logos/bnb-bnb-logo.svg',
  BNB: 'https://cryptologos.cc/logos/bnb-bnb-logo.svg',
  USDT: 'https://cryptologos.cc/logos/tether-usdt-logo.svg',
  USDC: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg',
  DAI: 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.svg',
  MATIC: 'https://cryptologos.cc/logos/polygon-matic-logo.svg',
  LINK: 'https://cryptologos.cc/logos/chainlink-link-logo.svg',
  SOL: 'https://cryptologos.cc/logos/solana-sol-logo.svg',
  ADA: 'https://cryptologos.cc/logos/cardano-ada-logo.svg',
  DOT: 'https://cryptologos.cc/logos/polkadot-new-dot-logo.svg',
  AVAX: 'https://cryptologos.cc/logos/avalanche-avax-logo.svg',
};

export function getCoinLogo(symbol: string): string {
  return COIN_LOGOS[symbol.toUpperCase()] || `https://cryptologos.cc/logos/${symbol.toLowerCase()}-logo.svg`;
}
