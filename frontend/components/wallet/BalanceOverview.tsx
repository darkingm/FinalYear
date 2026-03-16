'use client';

import { useWallet } from '@/lib/hooks/useWallet';
import { useClientTranslation } from '@/lib/hooks/useClientTranslation';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/utils/format';
import { CoinCard } from './CoinCard';
import { Wallet, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function BalanceOverview() {
  const { t } = useClientTranslation();
  const { isConnected, tokenBalances, totalUSDT, isLoading, refetch } = useWallet();

  if (!isConnected) {
    return (
      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 backdrop-blur-md relative overflow-hidden flex flex-col items-center justify-center text-center h-full min-h-[300px]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 relative z-10 shadow-inner">
          <Wallet className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2 relative z-10">{t('wallet.connectWallet')}</h2>
        <p className="text-gray-400 text-sm max-w-sm relative z-10 mb-6">
          Vui lòng kết nối ví Web3 để xem số dư token mạng Polygon và bắt đầu quản lý tài sản thực sự phi tập trung.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 backdrop-blur-md relative overflow-hidden h-full">
      {/* Background decoration */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[80%] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[30%] h-[50%] bg-[#f0b90b]/5 blur-[80px] rounded-full pointer-events-none" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
              Tổng Tài Sản (Ước tính)
            </h2>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-bold font-mono text-white tracking-tight">
                {formatCurrency(totalUSDT)}
              </span>
              <span className="text-xl font-medium text-gray-500">USD</span>
            </div>
          </div>
          <button
            onClick={refetch}
            disabled={isLoading}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-8">
          <a
            href="/wallet/deposit"
            className="flex-1 py-3 text-center bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-sm transition-all shadow-[0_4px_14px_0_rgba(59,130,246,0.2)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.3)] hover:-translate-y-0.5"
          >
            💸 Nạp Token
          </a>
          <button
            onClick={() => {
              import('sonner').then(({ toast }) => toast.info('Chức năng rút tiền sắp ra mắt!'));
            }}
            className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl text-sm transition-all hover:border-white/20"
          >
            📤 Rút Tiền
          </button>
        </div>

        {/* Token Balances Grid */}
        <div>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
            Danh sách Token
          </h3>
          {tokenBalances.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {tokenBalances.map((token, index) => (
                <motion.div
                  key={token.symbol}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="bg-black/20 border border-white/5 rounded-2xl p-4 hover:border-white/10 hover:bg-white/5 transition-colors group cursor-default"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 p-1 flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform">
                      {/* Note: In a real app we'd load proper icons from coin-logos */}
                      <span className="text-xs font-bold text-white">{token.symbol[0]}</span>
                    </div>
                    <span className="font-bold text-white text-sm">{token.symbol}</span>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-lg font-bold font-mono text-white leading-none">
                      {Number(token.balance).toFixed(4)}
                    </p>
                    <p className="text-xs text-gray-500 font-medium">
                      ≈ {formatCurrency(token.usdValue)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-black/10 rounded-2xl border border-white/5 border-dashed">
              <p className="text-gray-500 text-sm">Chưa có token nào trong ví của bạn.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
