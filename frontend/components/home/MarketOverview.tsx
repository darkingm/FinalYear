'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Activity, Star } from 'lucide-react';

interface TickerData {
    symbol: string;
    lastPrice: string;
    priceChangePercent: string;
    volume: string;
}

const TOP_COINS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT'];

const COIN_INFO: Record<string, { name: string; icon: string }> = {
    BTCUSDT: { name: 'Bitcoin', icon: '/crypto/btc.svg' },
    ETHUSDT: { name: 'Ethereum', icon: '/crypto/eth.svg' },
    BNBUSDT: { name: 'BNB', icon: '/crypto/bnb.svg' },
    SOLUSDT: { name: 'Solana', icon: '/crypto/sol.svg' },
    XRPUSDT: { name: 'XRP', icon: '/crypto/xrp.svg' },
    ADAUSDT: { name: 'Cardano', icon: '/crypto/ada.svg' },
};

export function MarketOverview() {
    const [tickers, setTickers] = useState<TickerData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTickers = async () => {
            try {
                const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
                const data: TickerData[] = await response.json();

                const filtered = TOP_COINS.map(symbol => {
                    const coinData = data.find((d: any) => d.symbol === symbol);
                    return coinData || {
                        symbol,
                        lastPrice: '0.00',
                        priceChangePercent: '0.00',
                        volume: '0.00'
                    };
                });

                setTickers(filtered);
            } catch (error) {
                console.error('Failed to fetch market data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTickers();
        const interval = setInterval(fetchTickers, 10000); // 10s refresh
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full bg-white dark:bg-[#181a20] border border-gray-100 dark:border-[#2b3139] shadow-sm rounded-xl overflow-hidden">
            <div className="bg-gray-50/50 dark:bg-[#0b0e11] border-b border-gray-100 dark:border-[#2b3139] px-6 py-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold flex items-center gap-2 dark:text-gray-100 m-0">
                        <Activity className="w-5 h-5 text-blue-500" />
                        Market Overview
                    </h2>
                    <span className="text-xs text-gray-500 font-medium">Auto-updates every 10s</span>
                </div>
            </div>
            <div className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-400 bg-gray-50/30 dark:bg-[#0b0e11]/50 uppercase">
                            <tr>
                                <th className="px-6 py-3 font-medium">Coin</th>
                                <th className="px-6 py-3 font-medium text-right">Price</th>
                                <th className="px-6 py-3 font-medium text-right">24h Change</th>
                                <th className="px-6 py-3 font-medium text-right hidden sm:table-cell">24h Volume</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="border-b border-gray-50 dark:border-[#2b3139]">
                                        <td className="px-6 py-4"><div className="h-4 w-24 bg-gray-100 dark:bg-[#2b3139] animate-pulse rounded"></div></td>
                                        <td className="px-6 py-4 text-right"><div className="h-4 w-16 bg-gray-100 dark:bg-[#2b3139] animate-pulse rounded ml-auto"></div></td>
                                        <td className="px-6 py-4 text-right"><div className="h-4 w-16 bg-gray-100 dark:bg-[#2b3139] animate-pulse rounded ml-auto"></div></td>
                                        <td className="px-6 py-4 text-right hidden sm:table-cell"><div className="h-4 w-20 bg-gray-100 dark:bg-[#2b3139] animate-pulse rounded ml-auto"></div></td>
                                    </tr>
                                ))
                            ) : (
                                tickers.map((ticker, index) => {
                                    const isPositive = parseFloat(ticker.priceChangePercent) >= 0;
                                    const coinMeta = COIN_INFO[ticker.symbol] || { name: ticker.symbol, icon: '*' };
                                    const displaySymbol = ticker.symbol.replace('USDT', '');

                                    return (
                                        <motion.tr
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            key={ticker.symbol}
                                            className="border-b border-gray-50 hover:bg-gray-50 dark:border-[#2b3139] dark:hover:bg-[#1e2329] transition-colors group cursor-pointer"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Link href={`/trading/chart/${ticker.symbol}`} className="flex items-center gap-3">
                                                    <Star className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-yellow-400 transition-colors" />
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-gray-900 dark:text-gray-100">{displaySymbol}</span>
                                                        <span className="text-xs text-gray-500">{coinMeta.name}</span>
                                                    </div>
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                <Link href={`/trading/chart/${ticker.symbol}`}>
                                                    <span className="font-medium dark:text-gray-200">${parseFloat(ticker.lastPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                <Link href={`/trading/chart/${ticker.symbol}`} className="flex items-center justify-end gap-1">
                                                    <span className={`font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                                        {isPositive ? '+' : ''}{parseFloat(ticker.priceChangePercent).toFixed(2)}%
                                                    </span>
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 text-right whitespace-nowrap hidden sm:table-cell text-gray-500 dark:text-gray-400">
                                                <Link href={`/trading/chart/${ticker.symbol}`}>
                                                    {parseFloat(ticker.volume).toLocaleString(undefined, { maximumFractionDigits: 0 })} {displaySymbol}
                                                </Link>
                                            </td>
                                        </motion.tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
