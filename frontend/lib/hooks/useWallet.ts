'use client';

import { useAccount, useBalance, useChainId } from 'wagmi';
import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useCryptoPrice } from './useCryptoPrice';

export interface TokenBalance {
  symbol: string;
  balance: number;
  balanceFormatted: string;
  usdValue: number;
  tokenAddress?: string;
  logo: string;
}

// Common ERC20 tokens on Polygon
const POLYGON_TOKENS = {
  USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
  WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
};

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

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

  const { prices } = useCryptoPrice([
    'BTCUSDT', 'ETHUSDT', 'MATICUSDT', 'USDCUSDT', 'DAIUSDT',
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

  const fetchBalances = async () => {
    if (!address || typeof window === 'undefined' || !window.ethereum) return;
    setIsLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balances: TokenBalance[] = [];

      if (nativeBalance) {
        let nativeSymbol = 'MATIC';
        if (chainId === 42161 || chainId === 421613) nativeSymbol = 'ETH';
        const nativePrice = prices['MATICUSDT']?.price || 0;
        const balance = parseFloat(nativeBalance.formatted);
        balances.push({
          symbol: nativeSymbol,
          balance,
          balanceFormatted: balance.toFixed(4),
          usdValue: balance * nativePrice,
          logo: `/coins/${nativeSymbol.toLowerCase()}.svg`,
        });
      }

      if (chainId === 137 || chainId === 80001 || chainId === 80002) {
        for (const [symbol, tokenAddress] of Object.entries(POLYGON_TOKENS)) {
          try {
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
            const balanceBN = await contract.balanceOf(address);
            let decimals = 18;
            try { decimals = await contract.decimals(); } catch (_) { /* ignore */ }
            const balance = parseFloat(ethers.formatUnits(balanceBN, decimals));
            if (balance > 0) {
              const priceKey = `${symbol}USDT`;
              const tokenPrice = prices[priceKey]?.price || (['USDT', 'USDC', 'DAI'].includes(symbol) ? 1 : 0);
              balances.push({
                symbol, balance,
                balanceFormatted: balance.toFixed(4),
                usdValue: balance * tokenPrice,
                tokenAddress,
                logo: `/coins/${symbol.toLowerCase()}.svg`,
              });
            }
          } catch (err) {
            console.error(`Error fetching ${symbol} balance:`, err);
          }
        }
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
