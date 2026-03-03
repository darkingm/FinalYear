'use client';

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ShoppingBag, Users, Wallet, TrendingUp } from 'lucide-react';

function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => {
    if (value >= 1000000) return (Math.round(latest / 100000) / 10).toFixed(1) + 'M' + suffix;
    if (value >= 1000) return Math.round(latest / 1000) + 'K' + suffix;
    return Math.round(latest) + suffix;
  });
  const [displayValue, setDisplayValue] = useState('0');

  useEffect(() => {
    const controls = animate(count, value, { duration: 2, ease: 'easeOut' });
    const unsub = rounded.on('change', (v) => setDisplayValue(v));
    return () => { controls.stop(); unsub(); };
  }, [value, count, rounded]);

  return <span>{displayValue}</span>;
}

const stats = [
  { icon: ShoppingBag, value: 15000, suffix: '+', label: 'Products Listed' },
  { icon: Users, value: 8500, suffix: '+', label: 'Active Users' },
  { icon: Wallet, value: 2500000, suffix: '', label: 'Total Volume (USD)' },
  { icon: TrendingUp, value: 99, suffix: '%', label: 'Success Rate' },
];

export function StatsSection() {
  return (
    <section className="py-14 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-ocean-500/5 rounded-full blur-[80px]" />
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-[80px]" />
      </div>

      <div className="container mx-auto px-4 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Trusted by{' '}
            <span className="text-gradient-primary">Thousands</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm">
            Join our growing community of buyers and sellers using cryptocurrency for secure transactions.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              className="bg-card rounded-xl border border-border p-5 text-center hover:shadow-md transition-shadow"
            >
              <div className="inline-flex p-2.5 rounded-xl bg-ocean-50 dark:bg-ocean-900/20 mb-3">
                <stat.icon className="w-5 h-5 text-ocean-600 dark:text-ocean-400" />
              </div>
              <div className="text-2xl md:text-3xl font-bold mb-1">
                <AnimatedCounter value={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-xs text-muted-foreground font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
