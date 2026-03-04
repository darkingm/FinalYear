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

// ERC20 ABI (only balanceOf needed)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

export function useWallet() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: nativeBalance } = useBalance({ address });
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [totalUSDT, setTotalUSDT] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Get crypto prices
  const { prices } = useCryptoPrice([
    'BTCUSDT',
    'ETHUSDT',
    'MATICUSDT',
    'USDCUSDT',
    'DAIUSDT',
  ]);

  useEffect(() => {
    if (!isConnected || !address) {
      setTokenBalances([]);
      setTotalUSDT(0);
      return;
    }

    fetchBalances();
  }, [address, isConnected, chainId, prices]);

  const fetchBalances = async () => {
    if (!address || !window.ethereum) return;

    setIsLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balances: TokenBalance[] = [];

      // Add native token balance (MATIC on Polygon)
      if (nativeBalance) {
        // Get native currency symbol based on chainId
        let nativeSymbol = 'MATIC';
        if (chainId === 137 || chainId === 80001) {
          nativeSymbol = 'MATIC';
        } else if (chainId === 42161 || chainId === 421613) {
          nativeSymbol = 'ETH';
        }

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

      // Fetch ERC20 token balances (only on Polygon for now)
      if (chainId === 137 || chainId === 80001 || chainId === 80002) {
        for (const [symbol, tokenAddress] of Object.entries(POLYGON_TOKENS)) {
          try {
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
            // Fetch balance
            const balanceBN = await contract.balanceOf(address);

            // Wait for decimals with timeout to prevent hang if address is empty (e.g. wrong network)
            let decimals = 18;
            try {
              decimals = await contract.decimals();
            } catch (e) {
              // Ignore decimal fetch errors if contract doesn't exist
            }

            const balance = parseFloat(ethers.formatUnits(balanceBN, decimals));

            if (balance > 0) {
              const priceKey = `${symbol}USDT`;
              const tokenPrice = prices[priceKey]?.price || (symbol === 'USDT' || symbol === 'USDC' || symbol === 'DAI' ? 1 : 0);

              balances.push({
                symbol,
                balance,
                balanceFormatted: balance.toFixed(4),
                usdValue: balance * tokenPrice,
                tokenAddress,
                logo: `/coins/${symbol.toLowerCase()}.svg`,
              });
            }
          } catch (error) {
            console.error(`Error fetching ${symbol} balance on address ${tokenAddress}:`, error);
          }
        }
      }

      setTokenBalances(balances);

      // Calculate total USDT value
      const total = balances.reduce((sum, token) => sum + token.usdValue, 0);
      setTotalUSDT(total);
    } catch (error) {
      console.error('Error fetching wallet balances:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    address,
    isConnected,
    chainId,
    nativeBalance,
    tokenBalances,
    totalUSDT,
    isLoading,
    refetch: fetchBalances,
  };
}
