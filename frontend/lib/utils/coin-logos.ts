/**
 * Real cryptocurrency logos.
 * Rules: NEVER use AI-generated icons. Only use real logos from official/CDN sources.
 *
 * Primary CDN: jsdelivr (cryptocurrency-icons by spothq) — free, stable, no rate-limit
 *   URL pattern: https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/{symbol}.png
 * Fallback: cryptologos.cc
 * Last resort: text initials via CoinImage component (see below)
 */

const JSDELIVR = (sym: string) =>
  `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${sym.toLowerCase()}.png`;

const CRYPTOLOGOS: Record<string, string> = {
  BTC: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
  ETH: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
  BNB: 'https://cryptologos.cc/logos/binance-coin-bnb-logo.png',
  SOL: 'https://cryptologos.cc/logos/solana-sol-logo.png',
  XRP: 'https://cryptologos.cc/logos/xrp-xrp-logo.png',
  ADA: 'https://cryptologos.cc/logos/cardano-ada-logo.png',
  DOGE: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png',
  AVAX: 'https://cryptologos.cc/logos/avalanche-avax-logo.png',
  MATIC: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
  POL: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
  DOT: 'https://cryptologos.cc/logos/polkadot-new-dot-logo.png',
  LINK: 'https://cryptologos.cc/logos/chainlink-link-logo.png',
  ATOM: 'https://cryptologos.cc/logos/cosmos-atom-logo.png',
  LTC: 'https://cryptologos.cc/logos/litecoin-ltc-logo.png',
  TRX: 'https://cryptologos.cc/logos/tron-trx-logo.png',
  TON: 'https://cryptologos.cc/logos/toncoin-ton-logo.png',
  NEAR: 'https://cryptologos.cc/logos/near-protocol-near-logo.png',
  APT: 'https://cryptologos.cc/logos/aptos-apt-logo.png',
  ARB: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
  OP: 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png',
  SUI: 'https://cryptologos.cc/logos/sui-sui-logo.png',
  UNI: 'https://cryptologos.cc/logos/uniswap-uni-logo.png',
  USDT: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
  USDC: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
  DAI: 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png',
  SHIB: 'https://cryptologos.cc/logos/shiba-inu-shib-logo.png',
  PEPE: 'https://cryptologos.cc/logos/pepe-pepe-logo.png',
  AAVE: 'https://cryptologos.cc/logos/aave-aave-logo.png',
  LRC: 'https://cryptologos.cc/logos/loopring-lrc-logo.png',
  INJ: 'https://cryptologos.cc/logos/injective-inj-logo.png',
  GRT: 'https://cryptologos.cc/logos/the-graph-grt-logo.png',
  FIL: 'https://cryptologos.cc/logos/filecoin-fil-logo.png',
  ICP: 'https://cryptologos.cc/logos/internet-computer-icp-logo.png',
  XLM: 'https://cryptologos.cc/logos/stellar-xlm-logo.png',
  ALGO: 'https://cryptologos.cc/logos/algorand-algo-logo.png',
  VET: 'https://cryptologos.cc/logos/vechain-vet-logo.png',
  EOS: 'https://cryptologos.cc/logos/eos-eos-logo.png',
  ZRX: 'https://cryptologos.cc/logos/0x-zrx-logo.png',
  BAT: 'https://cryptologos.cc/logos/basic-attention-token-bat-logo.png',
  CRV: 'https://cryptologos.cc/logos/curve-dao-token-crv-logo.png',
  MKR: 'https://cryptologos.cc/logos/maker-mkr-logo.png',
  COMP: 'https://cryptologos.cc/logos/compound-comp-logo.png',
  SNX: 'https://cryptologos.cc/logos/synthetix-network-token-snx-logo.png',
  SUSHI: 'https://cryptologos.cc/logos/sushiswap-sushi-logo.png',
  AXS: 'https://cryptologos.cc/logos/axie-infinity-axs-logo.png',
  SAND: 'https://cryptologos.cc/logos/the-sandbox-sand-logo.png',
  MANA: 'https://cryptologos.cc/logos/decentraland-mana-logo.png',
  ENJ: 'https://cryptologos.cc/logos/enjincoin-enj-logo.png',
  CHZ: 'https://cryptologos.cc/logos/chiliz-chz-logo.png',
  BCH: 'https://cryptologos.cc/logos/bitcoin-cash-bch-logo.png',
  XTZ: 'https://cryptologos.cc/logos/tezos-xtz-logo.png',
  FLOW: 'https://cryptologos.cc/logos/flow-flow-logo.png',
  EGLD: 'https://cryptologos.cc/logos/elrond-egld-logo.png',
  FTM: 'https://cryptologos.cc/logos/fantom-ftm-logo.png',
  HBAR: 'https://cryptologos.cc/logos/hedera-hbar-logo.png',
  KAVA: 'https://cryptologos.cc/logos/kava-kava-logo.png',
  CELO: 'https://cryptologos.cc/logos/celo-celo-logo.png',
  IOTA: 'https://cryptologos.cc/logos/iota-miota-logo.png',
  BONK: 'https://cryptologos.cc/logos/bonk-bonk-logo.png',
  FET: 'https://cryptologos.cc/logos/fetch-ai-fet-logo.png',
  RNDR: 'https://cryptologos.cc/logos/render-token-rndr-logo.png',
  IMX: 'https://cryptologos.cc/logos/immutable-x-imx-logo.png',
  CAKE: 'https://cryptologos.cc/logos/pancakeswap-cake-logo.png',
  BLUR: 'https://cryptologos.cc/logos/blur-blur-logo.png',
  GALA: 'https://cryptologos.cc/logos/gala-gala-logo.png',
  STX: 'https://cryptologos.cc/logos/stacks-stx-logo.png',
  RUNE: 'https://cryptologos.cc/logos/thorchain-rune-logo.png',
  CRO: 'https://cryptologos.cc/logos/cronos-cro-logo.png',
  OKB: 'https://cryptologos.cc/logos/okb-okb-logo.png',
};

export function getCoinLogo(symbol: string): string {
  if (!symbol) return '';
  const upper = symbol.toUpperCase().replace(/USDT$/, '');
  // Primary: jsdelivr cryptocurrency-icons
  return JSDELIVR(upper);
}

/**
 * Returns an ordered list of URLs to try for a given coin symbol.
 * The browser component (CoinImage) tries them in order.
 */
export function getCoinLogoFallbacks(symbol: string): string[] {
  if (!symbol) return [];
  const upper = symbol.toUpperCase().replace(/USDT$/, '');
  const fallbacks: string[] = [JSDELIVR(upper)];
  if (CRYPTOLOGOS[upper]) fallbacks.push(CRYPTOLOGOS[upper]);
  return fallbacks;
}
