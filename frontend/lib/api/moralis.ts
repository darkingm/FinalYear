/**
 * Moralis API client — Token holders, metadata, and price data
 * Uses server-side Next.js API route to protect the API key
 */

const MORALIS_API_BASE = 'https://deep-index.moralis.io/api/v2.2';
const MORALIS_API_KEY = process.env.NEXT_PUBLIC_MORALIS_API_KEY || '';

/* ─── Token contract addresses per chain for major coins ─── */
export const TOKEN_CONTRACTS: Record<string, { address: string; chain: string; decimals: number }> = {
  BTC:   { address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', chain: 'bsc', decimals: 18 },  // BTCB on BSC
  ETH:   { address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', chain: 'bsc', decimals: 18 },  // WETH on BSC
  BNB:   { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', chain: 'bsc', decimals: 18 },  // WBNB
  SOL:   { address: '0x570A5D26f7765Ecb712C0924E4De545B89fD43dF', chain: 'bsc', decimals: 18 },
  XRP:   { address: '0x1D2F0da169ceB9fC7B3144828DB6957c6cc934A1', chain: 'bsc', decimals: 18 },
  ADA:   { address: '0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47', chain: 'bsc', decimals: 18 },
  DOGE:  { address: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43', chain: 'bsc', decimals: 8 },
  AVAX:  { address: '0x1CE0c2827e2eF14D5C4f29a091d735A204794041', chain: 'bsc', decimals: 18 },
  DOT:   { address: '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402', chain: 'bsc', decimals: 18 },
  MATIC: { address: '0xCC42724C6683B7E57334c4E856f4c9965ED682bD', chain: 'bsc', decimals: 18 },
  LTC:   { address: '0x4338665CBB7B2485A8855A139b75D5e34AB0DB94', chain: 'bsc', decimals: 18 },
  LINK:  { address: '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD', chain: 'bsc', decimals: 18 },
  CAKE:  { address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', chain: 'bsc', decimals: 18 },
};

/* ─── Types ─── */
export interface MoralisTokenHolder {
  owner_address: string;
  balance: string;
  balance_formatted: string;
  percentage_relative_to_total_supply: number;
  usd_value: number | null;
  is_contract: boolean;
}

export interface MoralisTokenPrice {
  usdPrice: number;
  usdPriceFormatted: string;
  '24hrPercentChange': string;
  exchangeName: string;
  exchangeAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenLogo: string;
  tokenDecimals: string;
  nativePrice: { value: string; decimals: number; name: string; symbol: string };
}

export interface MoralisTokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: string;
  logo: string;
  total_supply: string;
  total_supply_formatted: string;
}

export interface HolderData {
  rank: number;
  address: string;
  balance: string;
  percentage: number;
  usdValue: number;
  isContract: boolean;
  label?: string;
}

/* ─── API calls ─── */
async function moralisFetch(path: string) {
  const res = await fetch(`${MORALIS_API_BASE}${path}`, {
    headers: {
      accept: 'application/json',
      'X-API-Key': MORALIS_API_KEY,
    },
    next: { revalidate: 60 }, // Cache 60s
  });
  if (!res.ok) {
    console.warn(`Moralis API error: ${res.status} for ${path}`);
    return null;
  }
  return res.json();
}

/**
 * Get top token holders from Moralis
 */
export async function getTokenHolders(
  symbol: string,
  limit = 20,
): Promise<HolderData[]> {
  const contract = TOKEN_CONTRACTS[symbol];
  if (!contract) return [];

  const data = await moralisFetch(
    `/erc20/${contract.address}/owners?chain=${contract.chain}&limit=${limit}&order=DESC`
  );

  if (!data?.result) return [];

  return data.result.map((h: any, i: number) => ({
    rank: i + 1,
    address: h.owner_address,
    balance: h.balance_formatted || '0',
    percentage: h.percentage_relative_to_total_supply || 0,
    usdValue: h.usd_value || 0,
    isContract: h.is_contract || false,
  }));
}

/**
 * Get token price + metadata
 */
export async function getTokenInfo(symbol: string): Promise<{
  price: MoralisTokenPrice | null;
  metadata: MoralisTokenMetadata | null;
}> {
  const contract = TOKEN_CONTRACTS[symbol];
  if (!contract) return { price: null, metadata: null };

  const [priceData, metaData] = await Promise.all([
    moralisFetch(`/erc20/${contract.address}/price?chain=${contract.chain}&include=percent_change`),
    moralisFetch(`/erc20/metadata?chain=${contract.chain}&addresses%5B0%5D=${contract.address}`),
  ]);

  return {
    price: priceData || null,
    metadata: metaData?.[0] || null,
  };
}

/**
 * Get token contract address for a symbol
 */
export function getTokenContract(symbol: string) {
  return TOKEN_CONTRACTS[symbol] || null;
}
