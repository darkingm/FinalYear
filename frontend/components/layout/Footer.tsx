'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Github, Twitter, Mail, Globe } from 'lucide-react';

export function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-ocean-950 dark:bg-background border-t border-ocean-900 dark:border-border text-ocean-200 dark:text-muted-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-ocean-400 to-ocean-600 flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg">W</span>
              </div>
              <span className="text-xl font-bold text-white dark:text-foreground">Web3 Market</span>
            </div>
            <p className="text-sm mb-5 text-ocean-300 dark:text-muted-foreground leading-relaxed">
              The future of e-commerce. Buy and sell securely with cryptocurrency and smart contracts.
            </p>
            <div className="flex gap-3">
              {[
                { icon: Github, href: 'https://github.com', label: 'GitHub' },
                { icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
                { icon: Globe, href: '/', label: 'Website' },
                { icon: Mail, href: 'mailto:support@web3market.com', label: 'Email' },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-ocean-800 dark:bg-secondary flex items-center justify-center hover:bg-ocean-700 dark:hover:bg-muted transition-colors"
                  title={social.label}
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Marketplace */}
          <div>
            <h3 className="text-white dark:text-foreground font-semibold mb-4 text-sm uppercase tracking-wider">Marketplace</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/products" className="hover:text-ocean-400 transition-colors">Browse Products</Link></li>
              <li><Link href="/products/create" className="hover:text-ocean-400 transition-colors">Sell a Product</Link></li>
              <li><Link href="/wallet" className="hover:text-ocean-400 transition-colors">Wallet</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white dark:text-foreground font-semibold mb-4 text-sm uppercase tracking-wider">Support</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/help" className="hover:text-ocean-400 transition-colors">Help Center</Link></li>
              <li><Link href="/docs" className="hover:text-ocean-400 transition-colors">Documentation</Link></li>
              <li><Link href="/contact" className="hover:text-ocean-400 transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white dark:text-foreground font-semibold mb-4 text-sm uppercase tracking-wider">Legal</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/terms" className="hover:text-ocean-400 transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-ocean-400 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/refund" className="hover:text-ocean-400 transition-colors">Refund Policy</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-ocean-800 dark:border-border mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-ocean-400 dark:text-muted-foreground">
          <p>&copy; {currentYear} Web3 Market. All rights reserved.</p>
          <p className="text-xs">
            Powered by Ethereum Smart Contracts
          </p>
        </div>
      </div>
    </footer>
  );
}
