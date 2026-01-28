'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Github, Twitter, Mail } from 'lucide-react';

export function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300 mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-3xl">₿</span>
              <span className="text-xl font-bold text-white">Crypto Marketplace</span>
            </div>
            <p className="text-sm mb-4">
              The future of e-commerce. Buy and sell with cryptocurrency.
            </p>
            <div className="flex gap-3">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="mailto:support@marketplace.com" className="hover:text-blue-400 transition-colors">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-white font-semibold mb-4">Products</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/products" className="hover:text-blue-400 transition-colors">Browse</Link></li>
              <li><Link href="/products/create" className="hover:text-blue-400 transition-colors">Sell</Link></li>
              <li><Link href="/categories" className="hover:text-blue-400 transition-colors">Categories</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold mb-4">Support</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/help" className="hover:text-blue-400 transition-colors">Help Center</Link></li>
              <li><Link href="/docs" className="hover:text-blue-400 transition-colors">Documentation</Link></li>
              <li><Link href="/contact" className="hover:text-blue-400 transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/terms" className="hover:text-blue-400 transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-blue-400 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/refund" className="hover:text-blue-400 transition-colors">Refund Policy</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-8 pt-8 text-sm text-center">
          <p>© {currentYear} Crypto Marketplace. All rights reserved.</p>
          <p className="mt-2 text-xs text-gray-500">
            Smart Contract: {process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS || 'Not deployed'}
          </p>
        </div>
      </div>
    </footer>
  );
}
