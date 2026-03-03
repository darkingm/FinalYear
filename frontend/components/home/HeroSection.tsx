'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Shield, Zap, Globe } from 'lucide-react';

interface HeroSectionProps {
  isAuthenticated: boolean;
  userName?: string;
  greeting?: string;
}

export function HeroSection({ isAuthenticated, userName, greeting }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden py-16 lg:py-24">
      {/* Ocean gradient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-ocean-50 via-white to-cyan-50 dark:from-ocean-950 dark:via-background dark:to-cyan-950/30" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-ocean-400/15 dark:bg-ocean-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-300/15 dark:bg-cyan-500/8 rounded-full blur-[100px]" />
      </div>

      {/* Subtle grid */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(hsl(210_100%_45%/0.03)_1px,transparent_1px),linear-gradient(90deg,hsl(210_100%_45%/0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />

      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-ocean-50 dark:bg-ocean-900/30 border border-ocean-200 dark:border-ocean-800"
          >
            <div className="w-2 h-2 rounded-full bg-ocean-500 animate-pulse" />
            <span className="text-sm font-medium text-ocean-700 dark:text-ocean-300">
              Web3 Powered &bull; Non-Custodial &bull; Multi-Chain
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold mb-5 leading-tight tracking-tight"
          >
            {isAuthenticated ? (
              <span className="text-gradient-primary">
                {greeting}, {userName}!
              </span>
            ) : (
              <>
                <span className="text-foreground">Secure Commerce</span>
                <br />
                <span className="text-gradient-primary">Powered by Blockchain</span>
              </>
            )}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
          >
            {isAuthenticated
              ? 'Your decentralized marketplace dashboard. Buy, sell, and trade securely.'
              : 'Buy and sell with cryptocurrency. Protected by smart contract escrow on Polygon & Arbitrum.'}
          </motion.p>

          {/* CTA */}
          {!isAuthenticated && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 justify-center mb-10"
            >
              <Link href="/register">
                <Button
                  size="lg"
                  className="group text-base px-7 py-5 rounded-xl bg-gradient-to-r from-ocean-500 to-ocean-600 hover:from-ocean-600 hover:to-ocean-700 shadow-lg shadow-ocean-500/25 hover:shadow-xl hover:shadow-ocean-500/30 transition-all"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>
              <Link href="/products">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base px-7 py-5 rounded-xl border-ocean-200 dark:border-ocean-800 hover:bg-ocean-50 dark:hover:bg-ocean-900/30"
                >
                  Explore Products
                </Button>
              </Link>
            </motion.div>
          )}

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-6 text-muted-foreground"
          >
            {[
              { icon: Shield, label: 'Smart Contract Protected', color: 'text-emerald-500' },
              { icon: Zap, label: 'Instant Settlements', color: 'text-amber-500' },
              { icon: Globe, label: 'Multi-Chain Support', color: 'text-ocean-500' },
            ].map((badge) => (
              <div key={badge.label} className="flex items-center gap-2">
                <badge.icon className={`w-4 h-4 ${badge.color}`} />
                <span className="text-sm">{badge.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
