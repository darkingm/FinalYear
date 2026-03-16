'use client';

import { useEffect, useState, useRef } from 'react';

/**
 * Testnet chain IDs — tokens on these chains have no real market value
 * so we display equivalent as "0 USDT" instead of a live price.
 */
export const TESTNET_CHAIN_IDS = new Set([
    80002,  // Polygon Amoy
    80001,  // Polygon Mumbai (deprecated)
    31337,  // Localhost / Hardhat
    97,     // BSC Testnet
    421614, // Arbitrum Sepolia
    84532,  // Base Sepolia
]);

export function isTestnetChain(chainId: number): boolean {
    return TESTNET_CHAIN_IDS.has(chainId);
}

export interface TokenPriceUSD {
    MATIC: number;
    ETH: number;
    BNB: number;
    BTC: number;
    SOL: number;
    USDT: number;
    USDC: number;
}

const DEFAULT_PRICES: TokenPriceUSD = {
    MATIC: 0.85,
    ETH: 3000,
    BNB: 600,
    BTC: 85000,
    SOL: 140,
    USDT: 1,
    USDC: 1,
};

/**
 * useTokenPrice — fetches live token prices from Binance every 5 seconds.
 * Returns prices in USD for converting product prices to token amounts.
 */
export function useTokenPrice() {
    const [prices, setPrices] = useState<TokenPriceUSD>(DEFAULT_PRICES);
    const [isLoading, setIsLoading] = useState(true);
    const intervalRef = useRef<NodeJS.Timeout>();

    const fetchPrices = async () => {
        try {
            const symbols = ['MATICUSDT', 'ETHUSDT', 'BNBUSDT', 'BTCUSDT', 'SOLUSDT'];
            const res = await fetch(
                `https://api.binance.com/api/v3/ticker/price?symbols=${JSON.stringify(symbols)}`
            );
            if (!res.ok) return;
            const data: { symbol: string; price: string }[] = await res.json();
            const map: Record<string, number> = {};
            for (const item of data) {
                map[item.symbol] = parseFloat(item.price);
            }
            setPrices({
                MATIC: map['MATICUSDT'] ?? DEFAULT_PRICES.MATIC,
                ETH: map['ETHUSDT'] ?? DEFAULT_PRICES.ETH,
                BNB: map['BNBUSDT'] ?? DEFAULT_PRICES.BNB,
                BTC: map['BTCUSDT'] ?? DEFAULT_PRICES.BTC,
                SOL: map['SOLUSDT'] ?? DEFAULT_PRICES.SOL,
                USDT: 1,
                USDC: 1,
            });
        } catch {
            // Keep last known prices on error
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPrices();
        intervalRef.current = setInterval(fetchPrices, 5000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    return { prices, isLoading };
}

/**
 * Convert a USD price to the amount in a given token.
 * For stablecoins (USDT, USDC, DAI), the ratio is 1:1.
 */
export function usdToToken(
    usdAmount: number,
    tokenSymbol: string,
    prices: TokenPriceUSD
): number {
    const symbol = tokenSymbol.toUpperCase();
    if (['USDT', 'USDC', 'DAI', 'BUSD'].includes(symbol)) return usdAmount;
    const tokenPrice = (prices as any)[symbol];
    if (!tokenPrice || tokenPrice <= 0) return 0;
    return usdAmount / tokenPrice;
}

/**
 * Format token amount with appropriate decimal places.
 */
export function formatTokenAmount(amount: number, tokenSymbol: string): string {
    if (amount === 0) return '0';
    const symbol = tokenSymbol.toUpperCase();
    if (['ETH', 'WBTC', 'BTC'].includes(symbol)) {
        return amount.toFixed(6);
    }
    if (['USDT', 'USDC', 'DAI', 'BUSD'].includes(symbol)) {
        return amount.toFixed(2);
    }
    // For MATIC, BNB, SOL — 4 decimals
    if (amount < 0.0001) return amount.toExponential(4);
    if (amount < 1) return amount.toFixed(4);
    return amount.toFixed(3);
}
