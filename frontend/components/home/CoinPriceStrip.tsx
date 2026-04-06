'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { CoinImage } from '@/components/ui/CoinImage';
import { usePriceStore } from '@/store';

const STRIP_COINS = [
    { symbol: 'BTCUSDT', short: 'BTC', color: '#f7931a' },
    { symbol: 'ETHUSDT', short: 'ETH', color: '#627eea' },
    { symbol: 'BNBUSDT', short: 'BNB', color: '#f0b90b' },
    { symbol: 'SOLUSDT', short: 'SOL', color: '#9945ff' },
    { symbol: 'XRPUSDT', short: 'XRP', color: '#00aae4' },
    { symbol: 'ADAUSDT', short: 'ADA', color: '#0033ad' },
    { symbol: 'DOGEUSDT', short: 'DOGE', color: '#c3a634' },
    { symbol: 'AVAXUSDT', short: 'AVAX', color: '#e84142' },
    { symbol: 'MATICUSDT', short: 'MATIC', color: '#8247e5' },
    { symbol: 'DOTUSDT', short: 'DOT', color: '#e6007a' },
    { symbol: 'LINKUSDT', short: 'LINK', color: '#2a5ada' },
    { symbol: 'TRXUSDT', short: 'TRX', color: '#ef0027' },
    { symbol: 'TONUSDT', short: 'TON', color: '#0098ea' },
    { symbol: 'NEARUSDT', short: 'NEAR', color: '#00c08b' },
    { symbol: 'ARBUSDT', short: 'ARB', color: '#28a0f0' },
    { symbol: 'OPUSDT', short: 'OP', color: '#ff0420' },
    { symbol: 'APTUSDT', short: 'APT', color: '#00c2a8' },
    { symbol: 'SUIUSDT', short: 'SUI', color: '#4ca3ff' },
    { symbol: 'LTCUSDT', short: 'LTC', color: '#bfbbbb' },
    { symbol: 'ATOMUSDT', short: 'ATOM', color: '#6f7390' },
];

export function CoinPriceStrip() {
    const { prices, connect } = usePriceStore();

    useEffect(() => {
        connect(STRIP_COINS.map(c => c.symbol));
    }, [connect]);

    // Duplicate coins for seamless infinite loop
    const items = [...STRIP_COINS, ...STRIP_COINS];

    return (
        <div className="relative w-full bg-card border-b border-border overflow-hidden py-2.5">
            {/* Left / right fade masks */}
            <div className="absolute left-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-r from-card to-transparent pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-l from-card to-transparent pointer-events-none" />

            <div
                className="flex gap-8 whitespace-nowrap"
                style={{
                    animation: 'marquee-scroll 40s linear infinite',
                    width: 'max-content',
                }}
            >
                {items.map((coin, i) => {
                    const data = prices[coin.symbol];
                    const price = data?.price ?? 0;
                    const change = data?.change24h ?? 0;
                    const isPos = change >= 0;

                    return (
                        <Link
                            key={`${coin.short}-${i}`}
                            href={`/trading/${coin.symbol}`}
                            className="inline-flex items-center gap-2 px-3 select-none hover:opacity-80 transition-opacity"
                        >
                            <CoinImage symbol={coin.short} size={16} className="rounded-full" />
                            <span className="text-xs font-bold text-foreground">{coin.short}</span>
                            {price > 0 ? (
                                <>
                                    <span className="text-xs font-mono text-foreground">
                                        ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: price > 100 ? 2 : 4 })}
                                    </span>
                                    <span className={`text-[10px] font-bold ${isPos ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {isPos ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                                    </span>
                                </>
                            ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                            )}
                            <span className="text-border ml-1">|</span>
                        </Link>
                    );
                })}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes marquee-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}} />
        </div>
    );
}
