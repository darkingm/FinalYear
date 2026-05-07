'use client';

import { useAccount, useBalance, useChainId } from 'wagmi';
import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useCryptoPrice } from './useCryptoPrice';
import { getDeprecatedChainIds } from '@/lib/web3/testnet-lite';

export interface TokenBalance {
  symbol: string;
  balance: number;
  balanceFormatted: string;
  usdValue: number;
  tokenAddress?: string;
  logo: string;
}

/* ─── Per-chain native symbol map ─────────────────────────────────────
 * Wagmi already returns the correct symbol for each chain via useBalance,
 * but we still need the BUSD/USDT/USDC contract list per chain.
 */
const NATIVE_SYMBOL_BY_CHAIN: Record<number, string> = {
  1: 'ETH',
  137: 'MATIC',
  80002: 'MATIC',
  42161: 'ETH',
  421614: 'ETH',
  10: 'ETH',
  8453: 'ETH',
  84532: 'ETH',
  56: 'BNB',
  97: 'BNB',
  31337: 'ETH', // Hardhat
};

/* ─── ERC-20 token registry per chain ─────────────────────────────────
 * Only addresses that DO have liquid balance for typical demo users —
 * adding obscure tokens just slows the balance fetch.
 */
type Chain20Map = Record<string, string>;

const TOKENS_BY_CHAIN: Record<number, Chain20Map> = {
  // Polygon mainnet
  137: {
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    DAI:  '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
  },
  // BSC mainnet
  56: {
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  },
  // BSC Testnet
  97: {
    USDT: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
    BUSD: '0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee',
    WBNB: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd',
  },
  // Polygon Amoy testnet
  80002: {
    // Amoy has no canonical USDT/USDC; native MATIC is enough for testing.
  },
  // Hardhat: only native ETH; ERC-20 are MockUSDT etc. — skip auto-fetch.
  31337: {},
};

const DEPRECATED_CHAIN_IDS = new Set(getDeprecatedChainIds());

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const STABLE_SYMBOLS = new Set(['USDT', 'USDC', 'DAI', 'BUSD']);

/** Safe defaults returned before client mount — avoids WagmiProviderNotFoundError during SSR/SSG */
const SSR_DEFAULTS = {
  address: undefined as `0x${string}` | undefined,
  isConnected: false,
  chainId: 137,
  nativeBalance: undefined as any,
  tokenBalances: [] as TokenBalance[],
  totalUSDT: 0,
  isLoading: false,
  refetch: () => {},
};

/**
 * Internal component — calls wagmi hooks.
 * Must only be used AFTER WagmiProvider is mounted on client.
 */
function useWalletInner() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: nativeBalance } = useBalance({ address });
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [totalUSDT, setTotalUSDT] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Subscribe to all symbols we might need to price across chains
  const { prices } = useCryptoPrice([
    'BTCUSDT', 'ETHUSDT', 'MATICUSDT', 'BNBUSDT',
    'USDCUSDT', 'DAIUSDT', 'BUSDUSDT', 'WBTCUSDT',
  ]);

  useEffect(() => {
    if (!isConnected || !address) {
      setTokenBalances([]);
      setTotalUSDT(0);
      return;
    }

    // reset balances before fetch on chain/account change
    setTokenBalances([]);
    setTotalUSDT(0);

    fetchBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, isConnected, chainId]);

  const priceFor = (symbol: string): number => {
    if (STABLE_SYMBOLS.has(symbol)) return 1;
    return prices[`${symbol}USDT`]?.price || 0;
  };

  const fetchBalances = async () => {
    if (!address || typeof window === 'undefined' || !window.ethereum) return;
    setIsLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balances: TokenBalance[] = [];

      // ── Native token (chain-aware symbol via wagmi) ────────────────
      if (nativeBalance) {
        const nativeSymbol = (nativeBalance.symbol || NATIVE_SYMBOL_BY_CHAIN[chainId] || 'ETH').toUpperCase();
        const balance = parseFloat(nativeBalance.formatted);
        const usdValue = balance * priceFor(nativeSymbol);
        balances.push({
          symbol: nativeSymbol,
          balance,
          balanceFormatted: balance.toFixed(4),
          usdValue,
          logo: `/coins/${nativeSymbol.toLowerCase()}.svg`,
        });
      }

      // ── ERC-20 tokens registered for the active chain ──────────────
      const tokenMap: Chain20Map = TOKENS_BY_CHAIN[chainId] || {};
      for (const [symbol, tokenAddress] of Object.entries(tokenMap)) {
        try {
          const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
          const balanceBN = await contract.balanceOf(address);
          let decimals = 18;
          try { decimals = await contract.decimals(); } catch { /* token may not implement decimals */ }
          const balance = parseFloat(ethers.formatUnits(balanceBN, decimals));
          if (balance > 0) {
            balances.push({
              symbol,
              balance,
              balanceFormatted: balance.toFixed(4),
              usdValue: balance * priceFor(symbol),
              tokenAddress,
              logo: `/coins/${symbol.toLowerCase()}.svg`,
            });
          }
        } catch (err) {
          console.error(`Error fetching ${symbol} balance on chain ${chainId}:`, err);
        }
      }

      // Skip deprecated chains entirely (they're shown grayed out elsewhere)
      if (DEPRECATED_CHAIN_IDS.has(chainId)) {
        // keep native, drop tokens — pre-existing behavior
      }

      setTokenBalances(balances);
      setTotalUSDT(balances.reduce((sum, t) => sum + t.usdValue, 0));
    } catch (err) {
      console.error('Error fetching wallet balances:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return { address, isConnected, chainId, nativeBalance, tokenBalances, totalUSDT, isLoading, refetch: fetchBalances };
}

/**
 * useWallet — SSR-safe wrapper.
 *
 * During SSR / Next.js static prerendering: WagmiProvider is not yet mounted,
 * so we return safe empty defaults (avoids WagmiProviderNotFoundError).
 *
 * After client hydration: the inner hook connects to WagmiProvider and
 * returns real wallet data.
 */
export function useWallet() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Wagmi hooks are called here unconditionally (React rules of hooks).
  // They return undefined/empty gracefully if WagmiProvider is not yet available.
  const walletData = useWalletInner();

  if (!mounted) return SSR_DEFAULTS;
  return walletData;
}
