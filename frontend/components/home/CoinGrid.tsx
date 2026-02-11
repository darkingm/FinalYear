'use client';

import { memo } from 'react';
import { useCryptoPriceOptimized } from '@/lib/hooks/useCryptoPriceOptimized';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { getCoinLogo } from '@/lib/utils/coin-logos';

const FEATURED_COINS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', short: 'BTC' },
  { symbol: 'ETHUSDT', name: 'Ethereum', short: 'ETH' },
  { symbol: 'BNBUSDT', name: 'BNB', short: 'BNB' },
  { symbol: 'MATICUSDT', name: 'Polygon', short: 'MATIC' },
  { symbol: 'SOLUSDT', name: 'Solana', short: 'SOL' },
  { symbol: 'ADAUSDT', name: 'Cardano', short: 'ADA' },
  { symbol: 'DOTUSDT', name: 'Polkadot', short: 'DOT' },
  { symbol: 'AVAXUSDT', name: 'Avalanche', short: 'AVAX' },
];

export const CoinGrid = memo(function CoinGrid() {
  const { prices } = useCryptoPriceOptimized(FEATURED_COINS.map((c) => c.symbol));

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-foreground">Market Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {FEATURED_COINS.map((coin, index) => {
          const price = prices[coin.symbol];
          if (!price) {
            return (
              <div key={coin.symbol} className="h-[110px] skeleton rounded-xl" />
            );
          }

          const isPositive = price.change24h >= 0;

          return (
            <motion.div
              key={coin.symbol}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
            >
              <Link href={`/trading/${coin.symbol}`}>
                <div className="bg-card rounded-xl p-4 border border-border hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center p-1.5 group-hover:bg-primary/10 transition-colors">
                      <Image
                        src={getCoinLogo(coin.short)}
                        alt={coin.name}
                        width={32}
                        height={32}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm leading-tight">{coin.name}</p>
                      <p className="text-xs text-muted-foreground">{coin.short}</p>
                    </div>
                  </div>

                  <p className="text-lg font-bold mb-1">
                    ${price.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </p>

                  <div
                    className={`flex items-center gap-1 text-xs font-medium ${
                      isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>{isPositive ? '+' : ''}{price.change24h.toFixed(2)}%</span>
                    <span className="text-muted-foreground ml-0.5">24h</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});
