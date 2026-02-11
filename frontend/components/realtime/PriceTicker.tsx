'use client';

import { memo, useEffect } from 'react';
import { usePriceStore } from '@/store';
import { formatCurrency } from '@/lib/utils/format';
import { TrendingUp, TrendingDown } from 'lucide-react';
import Image from 'next/image';
import { getCoinLogo } from '@/lib/utils/coin-logos';
import Link from 'next/link';

const TICKER_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'MATICUSDT',
  'LINKUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT',
];

export const PriceTicker = memo(function PriceTicker() {
  const { prices, isConnected, connect, disconnect } = usePriceStore();

  useEffect(() => {
    connect(TICKER_SYMBOLS);
    return () => disconnect();
  }, [connect, disconnect]);

  return (
    <div className="relative overflow-hidden">
      <div className="flex items-center gap-2 py-2.5 px-4 overflow-x-auto scrollbar-none">
        {TICKER_SYMBOLS.map((symbol) => {
          const price = prices[symbol];
          if (!price) return null;

          const isPositive = price.change24h >= 0;
          const coinSymbol = symbol.replace('USDT', '');

          return (
            <Link
              key={symbol}
              href={`/trading/${symbol}`}
              className="flex items-center gap-1.5 min-w-fit px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <Image
                src={getCoinLogo(coinSymbol)}
                alt={coinSymbol}
                width={18}
                height={18}
                className="w-[18px] h-[18px]"
              />
              <span className="font-semibold text-xs">{coinSymbol}</span>
              <span className="font-mono text-xs">{formatCurrency(price.price)}</span>
              <span
                className={`flex items-center gap-0.5 text-[11px] font-medium ${
                  isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(price.change24h).toFixed(2)}%
              </span>
            </Link>
          );
        })}
      </div>

      {/* Status */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
        <span className="text-[10px] text-muted-foreground">{isConnected ? 'Live' : 'Offline'}</span>
      </div>
    </div>
  );
});
