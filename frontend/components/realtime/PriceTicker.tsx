'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { usePriceStore } from '@/store';
import { getCoinLogo } from '@/lib/utils/coin-logos';
import Link from 'next/link';
import { TrendingUp, TrendingDown } from 'lucide-react';

const TICKER_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'MATICUSDT',
  'SOLUSDT', 'LINKUSDT', 'ADAUSDT', 'DOTUSDT',
  'ARBUSDT', 'AVAXUSDT',
];

function formatPrice(n: number): string {
  if (n >= 10000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 100) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

/** Single ticker item with flash animation on price change */
function TickerItem({ symbol }: { symbol: string }) {
  const price = usePriceStore((s) => s.prices[symbol]);
  const coinSymbol = symbol.replace('USDT', '');
  const prevRef = useRef<number>(0);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (!price) return;
    const prev = prevRef.current;
    const curr = price.price;
    if (prev !== 0 && curr !== prev) {
      setFlash(curr > prev ? 'up' : 'down');
      const t = setTimeout(() => setFlash(null), 600);
      return () => clearTimeout(t);
    }
    prevRef.current = curr;
  }, [price?.price]);

  if (!price) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg">
        <div className="w-4 h-4 rounded-full bg-muted animate-pulse" />
        <div className="w-12 h-3 bg-muted rounded animate-pulse" />
        <div className="w-16 h-3 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const isUp = price.change24h >= 0;

  return (
    <Link
      href={`/trading/${symbol}`}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-muted/60 transition-colors group flex-shrink-0"
    >
      {/* Real coin logo from coincap CDN */}
      <img
        src={getCoinLogo(coinSymbol)}
        alt={coinSymbol}
        className="w-5 h-5 rounded-full object-contain flex-shrink-0"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />

      <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors">
        {coinSymbol}
      </span>

      {/* Price with flash color on update */}
      <span
        className={`font-mono text-xs font-semibold tabular-nums transition-colors duration-300 ${flash === 'up' ? 'text-emerald-400' :
            flash === 'down' ? 'text-red-400' :
              'text-foreground'
          }`}
      >
        ${formatPrice(price.price)}
      </span>

      {/* 24h change */}
      <span className={`flex items-center gap-0.5 text-[10px] font-bold flex-shrink-0 ${isUp ? 'text-emerald-400' : 'text-red-400'
        }`}>
        {isUp
          ? <TrendingUp className="w-3 h-3" />
          : <TrendingDown className="w-3 h-3" />}
        {Math.abs(price.change24h).toFixed(2)}%
      </span>
    </Link>
  );
}

/** Infinite scrolling ticker strip */
export const PriceTicker = memo(function PriceTicker() {
  const { isConnected, connect, disconnect } = usePriceStore();

  useEffect(() => {
    connect(TICKER_SYMBOLS);
    return () => disconnect();
  }, [connect, disconnect]);

  return (
    <div className="relative border-b border-border/60 bg-background/95 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center overflow-x-auto scrollbar-none gap-1 px-2">
        {TICKER_SYMBOLS.map((sym) => (
          <TickerItem key={sym} symbol={sym} />
        ))}
        {/* Separator */}
        <div className="w-px h-4 bg-border mx-1 flex-shrink-0" />
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 px-2 flex-shrink-0">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
            }`} />
          <span className="text-[10px] text-muted-foreground font-medium">
            {isConnected ? 'LIVE' : 'offline'}
          </span>
        </div>
      </div>
    </div>
  );
});
