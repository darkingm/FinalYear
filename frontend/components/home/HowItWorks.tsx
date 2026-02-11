'use client';

import { motion } from 'framer-motion';
import { Wallet, Search, ShoppingCart, Shield, Check } from 'lucide-react';

const steps = [
  { icon: Wallet, title: 'Connect Wallet', desc: 'Connect MetaMask or WalletConnect to get started.' },
  { icon: Search, title: 'Browse Products', desc: 'Explore products from verified sellers.' },
  { icon: ShoppingCart, title: 'Place Order', desc: 'Choose items and pay with crypto or PayPal.' },
  { icon: Shield, title: 'Escrow Protection', desc: 'Funds held in smart contract until delivery.' },
  { icon: Check, title: 'Complete', desc: 'Confirm receipt; payment auto-released to seller.' },
];

export function HowItWorks() {
  return (
    <section className="py-14 bg-ocean-50/50 dark:bg-secondary/30">
      <div className="container mx-auto px-4 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-xl md:text-2xl font-bold mb-2">
            How It <span className="text-gradient-primary">Works</span>
          </h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Get started in minutes. Our escrow system protects both buyers and sellers.
          </p>
        </motion.div>

        {/* Desktop */}
        <div className="hidden lg:grid grid-cols-5 gap-4 relative">
          {/* Line */}
          <div className="absolute top-10 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-ocean-300 via-ocean-500 to-ocean-300 dark:from-ocean-700 dark:via-ocean-500 dark:to-ocean-700 rounded-full" />

          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="text-center relative"
            >
              <div className="w-8 h-8 mx-auto mb-4 rounded-full bg-gradient-to-br from-ocean-500 to-ocean-600 flex items-center justify-center text-white font-bold text-sm shadow-md relative z-10">
                {i + 1}
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="w-9 h-9 mx-auto mb-2 rounded-lg bg-ocean-50 dark:bg-ocean-900/20 flex items-center justify-center">
                  <step.icon className="w-4 h-4 text-ocean-600 dark:text-ocean-400" />
                </div>
                <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile */}
        <div className="lg:hidden space-y-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="flex gap-3"
            >
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-ocean-500 to-ocean-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                  {i + 1}
                </div>
                {i < steps.length - 1 && <div className="w-0.5 flex-1 bg-ocean-200 dark:bg-ocean-800 my-1" />}
              </div>
              <div className="flex-1 pb-2">
                <div className="bg-card rounded-lg border border-border p-3 flex items-start gap-3">
                  <div className="p-1.5 rounded-md bg-ocean-50 dark:bg-ocean-900/20 shrink-0">
                    <step.icon className="w-4 h-4 text-ocean-600 dark:text-ocean-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{step.title}</h3>
                    <p className="text-xs text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
