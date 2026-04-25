/**
 * DEX Swap Integration — PancakeSwap V2 (BSC Testnet) + Uniswap V2 (others)
 * 
 * Primary: Moralis API for token balance discovery
 * Backup:  Direct RPC multicall for native + known ERC-20 balances
 */

// ─── DEX Router Addresses ──────────────────────────────────────────────────
export const DEX_ROUTERS: Record<number, { address: string; name: string; factory: string; wNative: string }> = {
  97: {
    address: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1', // PancakeSwap V2 Router (BSC Testnet)
    name: 'PancakeSwap V2',
    factory: '0x6725F303b657a9451d8BA641348b6761A6CC7a17',
    wNative: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd', // WBNB Testnet
  },
  80002: {
    address: '0x8954AfA98594b838bda56FE4C12a09D7739D179b', // QuickSwap V2 Router (Amoy)
    name: 'QuickSwap V2',
    factory: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
    wNative: '0x0000000000000000000000000000000000001010', // WMATIC
  },
};

// ─── Known Testnet ERC-20 Tokens ────────────────────────────────────────────
export interface SwapToken {
  symbol: string;
  name: string;
  address: string; // 0x000...000 = native
  decimals: number;
  logo?: string;
  isNative?: boolean;
}

export const KNOWN_TOKENS: Record<number, SwapToken[]> = {
  97: [
    { symbol: 'BNB', name: 'BNB (Native)', address: '0x0000000000000000000000000000000000000000', decimals: 18, isNative: true },
    { symbol: 'WBNB', name: 'Wrapped BNB', address: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd', decimals: 18 },
    { symbol: 'BUSD', name: 'BUSD Testnet', address: '0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee', decimals: 18 },
    { symbol: 'USDT', name: 'USDT Testnet', address: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd', decimals: 18 },
    { symbol: 'DAI',  name: 'DAI Testnet',  address: '0x8a9424745056Eb399FD19a0EC26A14316684e274', decimals: 18 },
  ],
  80002: [
    { symbol: 'MATIC', name: 'MATIC (Native)', address: '0x0000000000000000000000000000000000000000', decimals: 18, isNative: true },
    { symbol: 'USDT', name: 'USDT Amoy', address: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06', decimals: 6 },
  ],
  31337: [
    { symbol: 'ETH', name: 'Ether (Native)', address: '0x0000000000000000000000000000000000000000', decimals: 18, isNative: true },
  ],
  84532: [
    { symbol: 'ETH', name: 'Ether (Native)', address: '0x0000000000000000000000000000000000000000', decimals: 18, isNative: true },
  ],
};

// ─── Router V2 ABI (minimal) ────────────────────────────────────────────────
export const ROUTER_V2_ABI = [
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function WETH() external pure returns (address)',
] as const;

export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function totalSupply() view returns (uint256)',
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getSwapTokensForChain(chainId: number): SwapToken[] {
  return KNOWN_TOKENS[chainId] || [];
}

export function getDexRouter(chainId: number) {
  return DEX_ROUTERS[chainId] || null;
}

export function getWrappedNativeAddress(chainId: number): string | null {
  return DEX_ROUTERS[chainId]?.wNative || null;
}

/**
 * Build swap path for Router V2.
 * If either token is native, use WETH/WBNB as intermediary.
 */
export function buildSwapPath(
  chainId: number,
  fromToken: SwapToken,
  toToken: SwapToken,
): string[] {
  const wNative = getWrappedNativeAddress(chainId);
  if (!wNative) return [];

  const fromAddr = fromToken.isNative ? wNative : fromToken.address;
  const toAddr = toToken.isNative ? wNative : toToken.address;

  if (fromAddr.toLowerCase() === toAddr.toLowerCase()) return [];

  // Direct pair
  return [fromAddr, toAddr];
}

/**
 * Determine swap type based on native token involvement.
 */
export type SwapType = 'exactETHForTokens' | 'exactTokensForETH' | 'exactTokensForTokens';

export function getSwapType(fromToken: SwapToken, toToken: SwapToken): SwapType {
  if (fromToken.isNative) return 'exactETHForTokens';
  if (toToken.isNative) return 'exactTokensForETH';
  return 'exactTokensForTokens';
}
