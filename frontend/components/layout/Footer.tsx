'use client';

import Link from 'next/link';
import {
  ShoppingBag,
  Shield,
  Wallet,
  Package,
  Mail,
  MapPin,
  Phone,
  TrendingUp,
  Zap,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { FaGithub, FaXTwitter } from 'react-icons/fa6';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

export function Footer() {
  const { t } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Helper: only translate after mount (avoids SSR/client mismatch)
  const vi = (viText: string, enText: string) => isMounted ? viText : enText;

  return (
    <footer className="bg-background text-muted-foreground border-t border-border">
      {/* Stats bar */}
      <div className="border-b border-border py-6">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { labelVi: 'Người dùng hoạt động', labelEn: 'Active Users', value: '10K+', icon: '👥', color: 'text-blue-500' },
              { labelVi: 'Sản phẩm', labelEn: 'Products', value: '5,000+', icon: '📦', color: 'text-emerald-500' },
              { labelVi: 'Bảo vệ bởi Escrow', labelEn: 'Escrow Protected', value: '100%', icon: '🛡️', color: 'text-purple-500' },
              { labelVi: 'Khối lượng giao dịch', labelEn: 'Trading Volume', value: '$2M+', icon: '💹', color: 'text-yellow-500' },
            ].map((stat) => (
              <div key={stat.labelEn} className="flex items-center gap-3">
                <span className="text-2xl">{stat.icon}</span>
                <div>
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground/60" suppressHydrationWarning>
                    {vi(stat.labelVi, stat.labelEn)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="container mx-auto px-4 py-14 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f0b90b] to-[#e6a800] flex items-center justify-center shadow-lg shadow-yellow-500/20">
                <Zap className="w-5 h-5 text-black fill-black" />
              </div>
              <span className="font-bold text-xl text-foreground">
                Web3<span className="text-[#f0b90b]">Market</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-xs" suppressHydrationWarning>
              {vi(
                'Sàn thương mại điện tử Web3 hàng đầu — mua sắm và thanh toán bằng crypto với sự bảo vệ của hợp đồng thông minh Escrow.',
                'The leading Web3 e-commerce platform — shop and pay with crypto, protected by smart contract Escrow.'
              )}
            </p>

            {/* Newsletter */}
            <div className="mb-6">
              <p className="text-sm font-semibold text-foreground mb-2" suppressHydrationWarning>
                {vi('Nhận thông báo mới nhất', 'Subscribe to updates')}
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder={vi('Email của bạn...', 'Your email...')}
                  className="flex-1 px-3 py-2 bg-accent/10 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#f0b90b]/50 transition-all"
                />
                <button className="px-4 py-2 bg-[#f0b90b] hover:bg-[#e6a800] text-black text-sm font-semibold rounded-lg transition-colors">
                  OK
                </button>
              </div>
            </div>

            {/* Social */}
            <div className="flex gap-2">
              {[
                { icon: FaXTwitter, label: 'Twitter', color: 'hover:bg-sky-500/20 hover:text-sky-500' },
                { icon: FaGithub, label: 'GitHub', color: 'hover:bg-foreground/10 hover:text-foreground' },
                { icon: MessageCircle, label: 'Discord', color: 'hover:bg-indigo-500/20 hover:text-indigo-500' },
              ].map(({ icon: Icon, label, color }) => (
                <a key={label} href="#" title={label}
                  className={`w-9 h-9 rounded-lg bg-accent/10 border border-border flex items-center justify-center transition-all ${color}`}>
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Shopping Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-5 text-sm uppercase tracking-wider" suppressHydrationWarning>
              {vi('Mua sắm', 'Shopping')}
            </h4>
            <ul className="space-y-3">
              {[
                { href: '/products', labelVi: 'Tất cả sản phẩm', labelEn: 'All Products', icon: ShoppingBag },
                { href: '/orders', labelVi: 'Đơn hàng của tôi', labelEn: 'My Orders', icon: Package },
                { href: '/wallet', labelVi: 'Ví crypto', labelEn: 'Crypto Wallet', icon: Wallet },
                { href: '/disputes', labelVi: 'Tranh chấp', labelEn: 'Disputes', icon: Shield },
              ].map(item => (
                <li key={item.href}>
                  <Link href={item.href}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#f0b90b] transition-colors group">
                    <item.icon className="w-3.5 h-3.5 group-hover:text-[#f0b90b]" />
                    <span suppressHydrationWarning>{vi(item.labelVi, item.labelEn)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Crypto */}
          <div>
            <h4 className="font-semibold text-foreground mb-5 text-sm uppercase tracking-wider">Crypto</h4>
            <ul className="space-y-3">
              {[
                { href: '/trading/BTCUSDT', label: 'Bitcoin (BTC)', tag: 'HOT' },
                { href: '/trading/ETHUSDT', label: 'Ethereum (ETH)' },
                { href: '/trading/BNBUSDT', label: 'BNB' },
                { href: '/trading/SOLUSDT', label: 'Solana (SOL)' },
                { href: '/trading/XRPUSDT', label: 'XRP' },
              ].map(item => (
                <li key={item.href}>
                  <Link href={item.href}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#f0b90b] transition-colors">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {item.label}
                    {item.tag && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#f0b90b]/20 text-[#f0b90b] rounded font-bold">{item.tag}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-foreground mb-5 text-sm uppercase tracking-wider" suppressHydrationWarning>
              {vi('Hỗ trợ', 'Support')}
            </h4>
            <ul className="space-y-3">
              {[
                { href: '/disputes', labelVi: 'Báo cáo vấn đề', labelEn: 'Report Issue' },
                { href: '/faq', labelVi: 'FAQ', labelEn: 'FAQ' },
                { href: '/privacy', labelVi: 'Chính sách bảo mật', labelEn: 'Privacy Policy' },
                { href: '/terms', labelVi: 'Điều khoản sử dụng', labelEn: 'Terms of Service' },
              ].map(item => (
                <li key={item.labelEn}>
                  <Link href={item.href}
                    className="text-sm text-muted-foreground hover:text-[#f0b90b] transition-colors flex items-center gap-1.5">
                    <ExternalLink className="w-3 h-3" />
                    <span suppressHydrationWarning>{vi(item.labelVi, item.labelEn)}</span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-6 space-y-2.5">
              {[
                { icon: Mail, text: 'support@web3market.com' },
                { icon: Phone, text: '+1 (555) 123-4567' },
                { icon: MapPin, text: 'Decentralized, Worldwide' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-sm text-muted-foreground/60">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-border">
        <div className="container mx-auto px-4 py-5 max-w-7xl flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground/60">© 2026 Web3Market. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <Shield className="w-3.5 h-3.5 text-[#f0b90b]" />
              <span suppressHydrationWarning>
                {vi('Bảo vệ bởi Smart Contract Escrow', 'Protected by Smart Contract Escrow')}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span suppressHydrationWarning>
                {vi('Hệ thống hoạt động bình thường', 'Systems operational')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
