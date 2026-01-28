'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency, formatCrypto } from '@/lib/utils/format';
import { TokenBalance } from '@/lib/hooks/useWallet';

interface CoinCardProps {
  token: TokenBalance;
}

const COIN_EMOJIS: Record<string, string> = {
  BTC: '₿',
  ETH: 'Ξ',
  MATIC: '⬡',
  USDT: '₮',
  USDC: '$',
  DAI: '◆',
  BNB: '◆',
  LINK: '🔗',
};

export const CoinCard = memo(function CoinCard({ token }: CoinCardProps) {
  const emoji = COIN_EMOJIS[token.symbol] || '💎';
  
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 hover:bg-white/20 transition-all cursor-pointer"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{emoji}</span>
        <span className="font-semibold text-white">{token.symbol}</span>
      </div>
      
      <p className="text-2xl font-bold text-white mb-1">
        {formatCrypto(token.balance, 4)}
      </p>
      
      <p className="text-sm text-white/70">
        ≈ {formatCurrency(token.usdValue)}
      </p>
    </motion.div>
  );
});
