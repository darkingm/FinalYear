'use client';

import { useWallet } from '@/lib/hooks/useWallet';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/utils/format';
import { CoinCard } from './CoinCard';
import { Wallet, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function BalanceOverview() {
  const { t } = useTranslation();
  const { isConnected, tokenBalances, totalUSDT, isLoading, refetch } = useWallet();

  if (!isConnected) {
    return (
      <div className="bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-900 dark:to-purple-900 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-3 mb-4">
          <Wallet className="w-8 h-8" />
          <h2 className="text-2xl font-bold">{t('wallet.connectWallet')}</h2>
        </div>
        <p className="text-white/80 mb-6">
          Connect your wallet to view your balance and start trading
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-900 dark:to-purple-900 rounded-2xl p-8 text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-semibold mb-1 text-white/80">
              {t('wallet.totalBalance')}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-4xl">💰</span>
              <span className="text-5xl font-bold">
                {formatCurrency(totalUSDT)}
              </span>
              <span className="text-2xl text-white/80">USDT</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={refetch}
            disabled={isLoading}
            className="text-white hover:bg-white/20"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Token Balances Grid */}
        {tokenBalances.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {tokenBalances.map((token, index) => (
              <motion.div
                key={token.symbol}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <CoinCard token={token} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-white/60">
            <p>No tokens found in your wallet</p>
          </div>
        )}
      </div>
    </div>
  );
}
