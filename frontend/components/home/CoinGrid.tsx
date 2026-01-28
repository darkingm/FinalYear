'use client';

import { memo } from 'react';
import { useCryptoPriceOptimized } from '@/lib/hooks/useCryptoPriceOptimized';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const FEATURED_COINS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', emoji: '₿', color: 'from-orange-500 to-yellow-500' },
  { symbol: 'ETHUSDT', name: 'Ethereum', emoji: 'Ξ', color: 'from-blue-500 to-purple-500' },
  { symbol: 'BNBUSDT', name: 'BNB', emoji: '◆', color: 'from-yellow-500 to-orange-500' },
  { symbol: 'MATICUSDT', name: 'Polygon', emoji: '⬡', color: 'from-purple-500 to-pink-500' },
  { symbol: 'SOLUSDT', name: 'Solana', emoji: '◎', color: 'from-purple-400 to-blue-500' },
  { symbol: 'ADAUSDT', name: 'Cardano', emoji: '₳', color: 'from-blue-400 to-cyan-500' },
  { symbol: 'DOTUSDT', name: 'Polkadot', emoji: '●', color: 'from-pink-500 to-red-500' },
  { symbol: 'AVAXUSDT', name: 'Avalanche', emoji: '▲', color: 'from-red-500 to-orange-500' },
];

export const CoinGrid = memo(function CoinGrid() {
  const { prices } = useCryptoPriceOptimized(FEATURED_COINS.map((c) => c.symbol));

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold mb-6">🔥 Trending Cryptocurrencies</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {FEATURED_COINS.map((coin, index) => {
          const price = prices[coin.symbol];
          if (!price) return null;

          const isPositive = price.change24h >= 0;

          return (
            <motion.div
              key={coin.symbol}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link href={`/trading/${coin.symbol}`}>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-md hover:shadow-xl transition-all cursor-pointer border border-transparent hover:border-primary/50">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${coin.color} flex items-center justify-center text-white text-xl font-bold shadow-lg`}>
                        {coin.emoji}
                      </div>
                      <div>
                        <p className="font-semibold">{coin.name}</p>
                        <p className="text-xs text-gray-500">{coin.symbol.replace('USDT', '')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-3">
                    <p className="text-2xl font-bold">${price.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
                  </div>

                  {/* Change */}
                  <div
                    className={`flex items-center gap-1 text-sm font-medium ${
                      isPositive ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    <span>{isPositive ? '+' : ''}{price.change24h.toFixed(2)}%</span>
                    <span className="text-xs text-gray-500 ml-1">24h</span>
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
