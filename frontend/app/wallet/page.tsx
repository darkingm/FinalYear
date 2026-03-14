'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BalanceOverview } from '@/components/wallet/BalanceOverview';
import { LinkWalletSection } from '@/components/wallet/LinkWalletSection';
import { CoinGrid } from '@/components/home/CoinGrid';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CreditScoreBadge } from '@/components/web3/CreditScoreBadge';
import { NFTOwnershipCard } from '@/components/web3/NFTOwnershipCard';
import { Wallet, Shield } from 'lucide-react';

export default function WalletPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden selection:bg-[#f0b90b] selection:text-black pt-20">
      {/* Ambient backgrounds */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#f0b90b]/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-5xl relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#f0b90b]/10 border border-[#f0b90b]/20 flex items-center justify-center shadow-[0_0_15px_rgba(240,185,11,0.15)]">
              <Wallet className="w-6 h-6 text-[#f0b90b]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Web3 Wallet</h1>
              <p className="text-sm text-gray-400 mt-1">Quản lý ví kết nối và số dư tài sản</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <BalanceOverview />
          </div>
          <div className="lg:col-span-1 space-y-6">
            <LinkWalletSection />
            <CreditScoreBadge variant="compact" />
          </div>
        </div>

        <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-xl">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-blue-500 rounded-full" />
            Tài sản được hỗ trợ (Thị trường)
          </h2>
          <CoinGrid />
        </section>
      </main>
      <Footer />
    </div>
  );
}
