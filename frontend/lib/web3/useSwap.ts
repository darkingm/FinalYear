'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useBalance, usePublicClient, useWalletClient } from 'wagmi';
import { parseUnits, formatUnits, type Address, encodeFunctionData, parseAbi, maxUint256 } from 'viem';
import {
  type SwapToken,
  type SwapType,
  getSwapTokensForChain,
  getDexRouter,
  buildSwapPath,
  getSwapType,
  ROUTER_V2_ABI,
  ERC20_ABI,
} from './swap';

/* ─── Token balance fetching ─────────────────────────────────────────────── */

export interface TokenWithBalance extends SwapToken {
  balance: bigint;
  formattedBalance: string;
}

export function useTokenBalances(chainId: number | undefined) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: chainId as any });
  const [tokens, setTokens] = useState<TokenWithBalance[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBalances = useCallback(async () => {
    if (!address || !chainId || !publicClient) return;

    setLoading(true);
    try {
      const knownTokens = getSwapTokensForChain(chainId);
      const results: TokenWithBalance[] = [];

      for (const token of knownTokens) {
        try {
          let balance: bigint;

          if (token.isNative) {
            balance = await publicClient.getBalance({ address: address as Address });
          } else {
            balance = await publicClient.readContract({
              address: token.address as Address,
              abi: parseAbi(ERC20_ABI as any),
              functionName: 'balanceOf',
              args: [address as Address],
            }) as bigint;
          }

          const formatted = formatUnits(balance, token.decimals);
          const val = parseFloat(formatted);
          const formattedBalance = val >= 1000
            ? val.toLocaleString('en-US', { maximumFractionDigits: 2 })
            : val >= 0.01
              ? val.toFixed(4)
              : val > 0
                ? val.toFixed(6)
                : '0';

          results.push({ ...token, balance, formattedBalance });
        } catch {
          results.push({ ...token, balance: 0n, formattedBalance: '0' });
        }
      }

      setTokens(results);
    } catch (err) {
      console.error('Failed to fetch token balances:', err);
    } finally {
      setLoading(false);
    }
  }, [address, chainId, publicClient]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return { tokens, loading, refetch: fetchBalances };
}

/* ─── Swap quote (getAmountsOut) ─────────────────────────────────────────── */

export interface SwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  amountOutFormatted: string;
  path: string[];
  priceImpact: number;
  minimumReceived: bigint;
  minimumReceivedFormatted: string;
}

export function useSwapQuote(
  chainId: number | undefined,
  fromToken: SwapToken | null,
  toToken: SwapToken | null,
  amountIn: string,
  slippageBps: number = 50, // 0.5%
) {
  const publicClient = usePublicClient({ chainId: chainId as any });
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chainId || !fromToken || !toToken || !amountIn || parseFloat(amountIn) <= 0 || !publicClient) {
      setQuote(null);
      setError(null);
      return;
    }

    const router = getDexRouter(chainId);
    if (!router) {
      setError('Mạng này chưa hỗ trợ swap on-chain');
      return;
    }

    const path = buildSwapPath(chainId, fromToken, toToken);
    if (path.length === 0) {
      setError('Không thể swap cùng 1 token');
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const amountInWei = parseUnits(amountIn, fromToken.decimals);

        const amounts = await publicClient.readContract({
          address: router.address as Address,
          abi: parseAbi(ROUTER_V2_ABI as any),
          functionName: 'getAmountsOut',
          args: [amountInWei, path as Address[]],
        }) as bigint[];

        const amountOut = amounts[amounts.length - 1];
        const minOut = (amountOut * BigInt(10000 - slippageBps)) / 10000n;

        setQuote({
          amountIn: amountInWei,
          amountOut,
          amountOutFormatted: formatUnits(amountOut, toToken.decimals),
          path,
          priceImpact: 0, // simplified for testnet
          minimumReceived: minOut,
          minimumReceivedFormatted: formatUnits(minOut, toToken.decimals),
        });
      } catch (err: any) {
        console.error('Swap quote error:', err);
        setError(
          err?.message?.includes('INSUFFICIENT_LIQUIDITY')
            ? 'Không đủ thanh khoản trên DEX testnet cho cặp token này'
            : 'Không thể lấy giá swap. DEX testnet có thể chưa có liquidity pool.'
        );
        setQuote(null);
      } finally {
        setLoading(false);
      }
    }, 500); // Debounce

    return () => clearTimeout(timer);
  }, [chainId, fromToken, toToken, amountIn, slippageBps, publicClient]);

  return { quote, loading, error };
}

/* ─── Execute swap ───────────────────────────────────────────────────────── */

export function useSwapExecute() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [executing, setExecuting] = useState(false);

  const executeSwap = useCallback(
    async (
      chainId: number,
      fromToken: SwapToken,
      toToken: SwapToken,
      quote: SwapQuote,
    ): Promise<string> => {
      if (!address || !walletClient || !publicClient) {
        throw new Error('Wallet not connected');
      }

      const router = getDexRouter(chainId);
      if (!router) throw new Error('No DEX router for this chain');

      setExecuting(true);
      try {
        const swapType = getSwapType(fromToken, toToken);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes

        // If ERC-20 → check + approve
        if (!fromToken.isNative) {
          const allowance = await publicClient.readContract({
            address: fromToken.address as Address,
            abi: parseAbi(ERC20_ABI as any),
            functionName: 'allowance',
            args: [address as Address, router.address as Address],
          }) as bigint;

          if (allowance < quote.amountIn) {
            const approveTx = await walletClient.writeContract({
              address: fromToken.address as Address,
              abi: parseAbi(ERC20_ABI as any),
              functionName: 'approve',
              args: [router.address as Address, maxUint256],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveTx });
          }
        }

        let txHash: string;

        if (swapType === 'exactETHForTokens') {
          txHash = await walletClient.writeContract({
            address: router.address as Address,
            abi: parseAbi(ROUTER_V2_ABI as any),
            functionName: 'swapExactETHForTokens',
            args: [quote.minimumReceived, quote.path as Address[], address as Address, deadline],
            value: quote.amountIn,
          });
        } else if (swapType === 'exactTokensForETH') {
          txHash = await walletClient.writeContract({
            address: router.address as Address,
            abi: parseAbi(ROUTER_V2_ABI as any),
            functionName: 'swapExactTokensForETH',
            args: [quote.amountIn, quote.minimumReceived, quote.path as Address[], address as Address, deadline],
          });
        } else {
          txHash = await walletClient.writeContract({
            address: router.address as Address,
            abi: parseAbi(ROUTER_V2_ABI as any),
            functionName: 'swapExactTokensForTokens',
            args: [quote.amountIn, quote.minimumReceived, quote.path as Address[], address as Address, deadline],
          });
        }

        // Wait for confirmation
        await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });

        return txHash;
      } finally {
        setExecuting(false);
      }
    },
    [address, walletClient, publicClient],
  );

  return { executeSwap, executing };
}
