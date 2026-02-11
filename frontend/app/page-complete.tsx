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
import { ShoppingBag, Wallet, TrendingUp, Sparkles, Shield, Zap, Search } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Lazy load heavy components
const BalanceOverview = dynamic(() => import('@/components/wallet/BalanceOverview').then(m => ({ default: m.BalanceOverview })), {
  loading: () => <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />,
  ssr: false,
});

const PriceTicker = dynamic(() => import('@/components/realtime/PriceTicker').then(m => ({ default: m.PriceTicker })), {
  loading: () => <div className="h-16 bg-gray-200 dark:bg-gray-800 animate-pulse" />,
  ssr: false,
});

const CoinGrid = dynamic(() => import('@/components/home/CoinGrid').then(m => ({ default: m.CoinGrid })), {
  loading: () => <div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" /></div>,
  ssr: false,
});

export default function HomePage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const timeOfDay = getTimeOfDay();
  const greeting = t(`greeting.${timeOfDay}`);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/products?q=${searchQuery}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Price Ticker */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="border-b bg-card sticky top-16 z-40"
      >
        <PriceTicker />
      </motion.div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center py-24 mb-16"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: 360 }}
            transition={{ duration: 0.8, delay: 0.2, type: 'spring' }}
            className="inline-block mb-8"
          >
            <div className="p-6 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-3xl shadow-2xl">
              <Sparkles className="w-16 h-16 text-white" />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="text-7xl md:text-8xl font-bold mb-6"
          >
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              {isAuthenticated ? `${greeting}, ${user?.name}!` : 'Crypto Marketplace'}
            </span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-2xl md:text-3xl text-muted-foreground mb-4 max-w-3xl mx-auto font-light"
          >
            {isAuthenticated ? 'Your Crypto Trading Dashboard' : 'The Future of E-commerce'}
          </motion.p>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto"
          >
            Buy and sell products with cryptocurrency. Fast, secure, and decentralized.
          </motion.p>

          {/* Conditional CTAs */}
          {!isAuthenticated && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
            >
              <Link href="/register">
                <Button size="lg" className="text-xl px-12 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="text-xl px-12 py-6 rounded-xl">
                  Sign In
                </Button>
              </Link>
            </motion.div>
          )}
        </motion.div>

        {/* Balance Overview - Only for logged in users */}
        {isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mb-12"
          >
            <BalanceOverview />
          </motion.div>
        )}

        {/* Search Bar - Center of page */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="max-w-3xl mx-auto mb-16"
        >
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            <input
              type="text"
              placeholder="Search products, coins, sellers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-6 py-6 pl-16 text-lg bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:border-primary shadow-lg"
            />
            <Button
              type="submit"
              size="lg"
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              Search
            </Button>
          </form>
        </motion.div>

        {/* Market Overview - Only for logged in users */}
        {isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            <CoinGrid />
          </motion.div>
        )}

        {/* Features - Only for non-logged in users */}
        {!isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24 max-w-5xl mx-auto"
          >
            {[
              { icon: Shield, color: 'blue', title: 'Secure', desc: 'Smart contract escrow protects your transactions' },
              { icon: Zap, color: 'purple', title: 'Fast', desc: 'Instant payments with cryptocurrency' },
              { icon: Wallet, color: 'pink', title: 'Multi-Currency', desc: 'Accept BTC, ETH, USDT, and more' },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.1 }}
                whileHover={{ scale: 1.05, y: -10 }}
                className="p-8 bg-card rounded-2xl border-2 border-transparent hover:border-primary/50 shadow-md hover:shadow-2xl transition-all"
              >
                <feature.icon className={`w-12 h-12 text-${feature.color}-500 mb-4 mx-auto`} />
                <h3 className="font-bold text-2xl mb-3">{feature.title}</h3>
                <p className="text-base text-muted-foreground leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Quick Actions - Only for authenticated users */}
        {isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
          >
            {[
              {
                href: '/products',
                icon: ShoppingBag,
                color: 'blue',
                title: t('nav.products'),
                desc: 'Browse marketplace',
              },
              {
                href: '/wallet',
                icon: Wallet,
                color: 'purple',
                title: t('nav.wallet'),
                desc: 'Manage assets',
              },
              {
                href: '/products/create',
                icon: TrendingUp,
                color: 'green',
                title: t('nav.sell'),
                desc: 'List your product',
              },
            ].map((item, index) => (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link href={item.href}>
                  <div className="p-6 bg-card rounded-xl border hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center gap-4 relative z-10">
                      <div className={`p-3 bg-${item.color}-100 dark:bg-${item.color}-900/20 rounded-lg group-hover:scale-110 transition-transform`}>
                        <item.icon className={`w-6 h-6 text-${item.color}-600 dark:text-${item.color}-400`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Featured Products */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="relative"
        >
          <div className="bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-3xl shadow-2xl overflow-hidden">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-300 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <div className="relative z-10 p-12 text-white">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="flex items-center gap-3 mb-6"
              >
                <ShoppingBag className="w-10 h-10" />
                <h2 className="text-4xl font-bold">Featured Products</h2>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="text-xl mb-8 text-white/90 max-w-2xl"
              >
                Discover trending items from our marketplace. Buy with cryptocurrency or PayPal.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.65 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link href="/products">
                  <Button size="lg" variant="secondary" className="text-xl px-10 py-6 rounded-xl shadow-xl hover:shadow-2xl group">
                    <ShoppingBag className="w-5 h-5 mr-2" />
                    Browse All Products
                    <motion.span
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="ml-3 text-2xl"
                    >
                      →
                    </motion.span>
                  </Button>
                </Link>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
