'use client';

import { memo } from 'react';
import { useCryptoPriceOptimized } from '@/lib/hooks/useCryptoPriceOptimized';
import { formatCurrency } from '@/lib/utils/format';
import { TrendingUp, TrendingDown } from 'lucide-react';

const COIN_EMOJIS: Record<string, string> = {
  BTC: '₿',
  ETH: 'Ξ',
  MATIC: '⬡',
  BNB: '◆',
  LINK: '🔗',
  SOL: '◎',
  ADA: '₳',
  DOT: '●',
};

export const PriceTicker = memo(function PriceTicker() {
  const displaySymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'MATICUSDT', 'LINKUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT'];
  const { prices, isConnected } = useCryptoPriceOptimized(displaySymbols);

  return (
    <div className="relative overflow-hidden">
      <div className="flex items-center gap-6 py-3 px-4 animate-marquee">
        {displaySymbols.map((symbol) => {
          const price = prices[symbol];
          if (!price) return null;

          const isPositive = price.change24h >= 0;
          const coinSymbol = symbol.replace('USDT', '');
          const emoji = COIN_EMOJIS[coinSymbol] || '💎';

          return (
            <a
              key={symbol}
              href={`/trading/${symbol}`}
              className="flex items-center gap-2 min-w-fit px-4 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
            >
              <span className="text-xl">{emoji}</span>
              <span className="font-semibold text-sm">{coinSymbol}</span>
              <span className="font-mono text-sm">
                {formatCurrency(price.price)}
              </span>
              <span
                className={`flex items-center gap-1 text-xs font-medium ${
                  isPositive ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {Math.abs(price.change24h).toFixed(2)}%
              </span>
            </a>
          );
        })}
      </div>

      {/* Connection status indicator */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {isConnected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>
    </div>
  );
});
