'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BalanceOverview } from '@/components/wallet/BalanceOverview';
import { LinkWalletSection } from '@/components/wallet/LinkWalletSection';
import { CoinGrid } from '@/components/home/CoinGrid';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Wallet } from 'lucide-react';

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <Wallet className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Wallet & Balances</h1>
        </div>
        <LinkWalletSection />
        <BalanceOverview />
        <section className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Coin balances</h2>
          <CoinGrid />
        </section>
      </main>
      <Footer />
    </div>
  );
}
