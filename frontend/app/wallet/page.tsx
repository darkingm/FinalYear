'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BalanceOverview } from '@/components/wallet/BalanceOverview';
import { LinkWalletSection } from '@/components/wallet/LinkWalletSection';
import { CreditScoreBadge } from '@/components/web3/CreditScoreBadge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Wallet, Shield, ArrowDownLeft, ArrowUpRight, History,
  Package, RefreshCw, TrendingUp, Star, ExternalLink,
} from 'lucide-react';

interface Transaction {
  order_id: number;
  internal_order_id: string;
  product_name: string;
  price_usd: number;
  token_symbol?: string;
  amount_token?: number;
  status: string;
  payment_method: string;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: 'text-emerald-400',
  PAID: 'text-emerald-400',
  UNPAID: 'text-orange-400',
  CANCELLED: 'text-gray-500',
  REFUNDED: 'text-purple-400',
  DISPUTED: 'text-red-400',
  DELIVERING: 'text-blue-400',
};

export default function WalletPage() {
  const { isAuthenticated, isLoading, session } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [stats, setStats] = useState({ total_spent: 0, total_orders: 0, completed: 0 });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchTransactions();
  }, [isAuthenticated]);

  const fetchTransactions = async () => {
    setTxLoading(true);
    try {
      const res = await apiClient.get('/api/orders?limit=10');
      const orders: Transaction[] = res.data.orders ?? res.data.data?.orders ?? [];
      setTransactions(orders);

      // Compute stats
      const completed = orders.filter(o => ['COMPLETED', 'PAID', 'PAID_PAYPAL'].includes(o.status));
      const totalSpent = completed.reduce((sum, o) => sum + Number(o.price_usd || 0), 0);
      setStats({ total_spent: totalSpent, total_orders: orders.length, completed: completed.length });
    } catch {
      toast.error('Không thể tải lịch sử giao dịch');
    } finally {
      setTxLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden selection:bg-[#f0b90b] selection:text-black">
      {/* Ambient backgrounds */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#f0b90b]/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

      <Header />

      <main className="container mx-auto px-4 py-8 max-w-6xl relative z-10 mt-16">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#f0b90b]/10 border border-[#f0b90b]/20 flex items-center justify-center shadow-[0_0_20px_rgba(240,185,11,0.15)]">
              <Wallet className="w-6 h-6 text-[#f0b90b]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Web3 Wallet</h1>
              <p className="text-sm text-gray-400 mt-1">Quản lý ví kết nối, tài sản và lịch sử giao dịch</p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex gap-3">
            <Link href="/wallet/deposit">
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-semibold hover:bg-emerald-500/20 transition-all"
              >
                <ArrowDownLeft className="w-4 h-4" />
                Nạp tiền
              </motion.button>
            </Link>
            <Link href="/wallet/withdraw">
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl text-sm font-semibold hover:bg-blue-500/20 transition-all"
              >
                <ArrowUpRight className="w-4 h-4" />
                Rút tiền
              </motion.button>
            </Link>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Đơn đã đặt', value: stats.total_orders, icon: Package, color: 'blue' },
            { label: 'Hoàn thành', value: stats.completed, icon: Star, color: 'emerald' },
            { label: 'Tổng chi tiêu', value: `$${stats.total_spent.toFixed(2)}`, icon: TrendingUp, color: 'yellow' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 backdrop-blur-md"
            >
              <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">{s.label}</p>
              <p className={`text-2xl font-bold font-mono ${
                s.color === 'blue' ? 'text-blue-400' : s.color === 'emerald' ? 'text-emerald-400' : 'text-[#f0b90b]'
              }`}>{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 space-y-6">
            <BalanceOverview />
            {/* NFT Gallery Link */}
            <Link href="/profile/nfts">
              <motion.div
                whileHover={{ scale: 1.01 }}
                className="bg-gradient-to-br from-purple-900/20 via-blue-900/10 to-card border border-purple-500/20 rounded-3xl p-5 cursor-pointer hover:border-purple-500/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm">NFT Tài sản của tôi</p>
                      <p className="text-xs text-gray-400">Xem các tài sản đã token hóa trên Blockchain</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-500" />
                </div>
              </motion.div>
            </Link>
          </div>
          <div className="space-y-6">
            <LinkWalletSection />
            <CreditScoreBadge variant="compact" />
          </div>
        </div>

        {/* Transaction History */}
        <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-[#f0b90b]" />
              Lịch sử giao dịch
            </h2>
            <button
              onClick={fetchTransactions}
              className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${txLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {txLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="md" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">Chưa có giao dịch nào</p>
              <Link href="/products" className="text-[#f0b90b] text-sm mt-2 inline-block hover:underline">
                Mua sắm ngay →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx, i) => (
                <motion.div
                  key={tx.order_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/10 hover:bg-white/[0.04] transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#f0b90b]/10 border border-[#f0b90b]/20 flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-[#f0b90b]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white text-sm truncate max-w-[200px]">{tx.product_name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(tx.created_at).toLocaleDateString('vi-VN')} · {tx.payment_method?.toUpperCase() || 'CRYPTO'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-white font-mono text-sm">
                        {tx.amount_token && tx.token_symbol
                          ? `${Number(tx.amount_token).toFixed(4)} ${tx.token_symbol}`
                          : `$${Number(tx.price_usd).toFixed(2)}`}
                      </p>
                      <p className={`text-xs font-medium ${STATUS_COLOR[tx.status] || 'text-gray-400'}`}>
                        {tx.status}
                      </p>
                    </div>
                    <Link href={`/orders/${tx.internal_order_id || tx.order_id}`}>
                      <ExternalLink className="w-4 h-4 text-gray-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100" />
                    </Link>
                  </div>
                </motion.div>
              ))}

              {transactions.length >= 10 && (
                <Link href="/orders" className="block text-center text-sm text-[#f0b90b] hover:underline py-3">
                  Xem tất cả đơn hàng →
                </Link>
              )}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
