'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { getTimeOfDay } from '@/lib/utils/time-greeting';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ShoppingBag, Wallet, TrendingUp, Search } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { HeroSection } from '@/components/home/HeroSection';
import { StatsSection } from '@/components/home/StatsSection';
import { CategoriesSection } from '@/components/home/CategoriesSection';
import { HowItWorks } from '@/components/home/HowItWorks';

const BalanceOverview = dynamic(
  () => import('@/components/wallet/BalanceOverview').then((mod) => mod.BalanceOverview),
  { loading: () => <div className="h-44 skeleton rounded-xl" />, ssr: false }
);

const PriceTicker = dynamic(
  () => import('@/components/realtime/PriceTicker').then((mod) => mod.PriceTicker),
  { loading: () => <div className="h-12 skeleton" />, ssr: false }
);

const CoinGrid = dynamic(
  () => import('@/components/home/CoinGrid').then((mod) => mod.CoinGrid),
  { loading: () => <div className="h-48 skeleton rounded-xl" />, ssr: false }
);

const FeaturedProducts = dynamic(
  () => import('@/components/home/FeaturedProducts').then((mod) => mod.FeaturedProducts),
  { loading: () => <div className="h-64 skeleton rounded-xl" />, ssr: false }
);

export default function HomePage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const timeOfDay = getTimeOfDay();
  const greeting = t(`greeting.${timeOfDay}`);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) router.push(`/products?q=${searchQuery}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-12 h-12 rounded-full border-3 border-primary border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Price Ticker */}
      <div className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-16 z-40">
        <PriceTicker />
      </div>

      <main>
        {/* Hero */}
        <HeroSection
          isAuthenticated={isAuthenticated}
          userName={user?.name ?? undefined}
          greeting={greeting}
        />

        {/* Search */}
        <section className="py-6 -mt-8 relative z-10">
          <div className="container mx-auto px-4 max-w-2xl">
            <motion.form
              onSubmit={handleSearch}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="relative flex items-center bg-card rounded-xl shadow-lg border border-border overflow-hidden">
                <Search className="absolute left-4 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search products, categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-11 py-3.5 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
                />
                <Button type="submit" size="sm" className="m-1.5 px-5 rounded-lg bg-primary hover:bg-primary/90">
                  Search
                </Button>
              </div>
            </motion.form>
          </div>
        </section>

        {/* Authenticated: Balance + Market + Quick Actions */}
        {isAuthenticated && (
          <div className="container mx-auto px-4 max-w-6xl space-y-8 py-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <BalanceOverview />
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
              <CoinGrid />
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-3"
            >
              {[
                { href: '/products', icon: ShoppingBag, title: t('nav.products'), desc: 'Browse marketplace', gradient: 'from-ocean-500 to-ocean-600' },
                { href: '/wallet', icon: Wallet, title: t('nav.wallet'), desc: 'Manage assets', gradient: 'from-cyan-500 to-teal-500' },
                { href: '/products/create', icon: TrendingUp, title: t('nav.sell'), desc: 'List your product', gradient: 'from-emerald-500 to-green-500' },
              ].map((item) => (
                <Link key={item.href} href={item.href}>
                  <div className="p-4 bg-card rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-lg bg-gradient-to-br ${item.gradient} shadow-sm`}>
                        <item.icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{item.title}</h3>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </motion.div>
          </div>
        )}

        {/* Non-authenticated: Stats */}
        {!isAuthenticated && <StatsSection />}

        {/* Categories */}
        <CategoriesSection />

        {/* Featured Products */}
        <section className="py-10">
          <div className="container mx-auto px-4 max-w-6xl">
            <FeaturedProducts />
          </div>
        </section>

        {/* How It Works */}
        {!isAuthenticated && <HowItWorks />}
      </main>

      <Footer />
    </div>
  );
}
