'use client';

import Link from 'next/link';
import { ShoppingBag, Shield, Wallet, Package, Mail, MapPin, Phone, Github, Twitter, TrendingUp, Zap, ExternalLink, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import i18n from '@/lib/i18n/config';

export function Footer() {
  const { t } = useTranslation();
  const [, setLang] = useState(i18n.language);

  // Re-render on language change
  useEffect(() => {
    const handler = () => setLang(i18n.language);
    i18n.on('languageChanged', handler);
    window.addEventListener('languagechange', handler);
    return () => {
      i18n.off('languageChanged', handler);
      window.removeEventListener('languagechange', handler);
    };
  }, []);

  const shopLinks = [
    { href: '/products', label: t('product.products'), icon: ShoppingBag },
    { href: '/orders', label: t('order.myOrders'), icon: Package },
    { href: '/wallet', label: t('wallet.yourWallet'), icon: Wallet },
    { href: '/disputes', label: t('common.error'), icon: Shield },
  ];

  const supportLinks = [
    { href: '/disputes', label: t('common.tryAgain') },
    { href: '#', label: 'FAQ' },
    { href: '#', label: t('auth.agreeToTerms').replace('Tôi đồng ý với ', '').replace("I agree to the ", '') },
    { href: '#', label: t('auth.agreeToTerms') },
  ];

  return (
    <footer className="bg-background text-muted-foreground border-t border-border">
      {/* Stats bar */}
      <div className="border-b border-border py-6">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: i18n.language === 'vi' ? 'Người dùng hoạt động' : 'Active Users', value: '10K+', icon: '👥', color: 'text-blue-500' },
              { label: i18n.language === 'vi' ? 'Sản phẩm' : 'Products', value: '5,000+', icon: '📦', color: 'text-emerald-500' },
              { label: i18n.language === 'vi' ? 'Bảo vệ bởi Escrow' : 'Escrow Protected', value: '100%', icon: '🛡️', color: 'text-purple-500' },
              { label: i18n.language === 'vi' ? 'Khối lượng giao dịch' : 'Trading Volume', value: '$2M+', icon: '💹', color: 'text-yellow-500' },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-3">
                <span className="text-2xl">{stat.icon}</span>
                <div>
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground/60">{stat.label}</p>
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
            <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-xs">
              {i18n.language === 'vi'
                ? 'Sàn thương mại điện tử Web3 hàng đầu — mua sắm và thanh toán bằng crypto với sự bảo vệ của hợp đồng thông minh Escrow.'
                : 'The leading Web3 e-commerce platform — shop and pay with crypto, protected by smart contract Escrow.'}
            </p>

            {/* Newsletter */}
            <div className="mb-6">
              <p className="text-sm font-semibold text-foreground mb-2">
                {i18n.language === 'vi' ? 'Nhận thông báo mới nhất' : 'Subscribe to updates'}
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder={i18n.language === 'vi' ? 'Email của bạn...' : 'Your email...'}
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
                { icon: Twitter, label: 'Twitter', color: 'hover:bg-sky-500/20 hover:text-sky-500' },
                { icon: Github, label: 'GitHub', color: 'hover:bg-foreground/10 hover:text-foreground' },
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
            <h4 className="font-semibold text-foreground mb-5 text-sm uppercase tracking-wider">
              {i18n.language === 'vi' ? 'Mua sắm' : 'Shopping'}
            </h4>
            <ul className="space-y-3">
              {[
                { href: '/products', label: i18n.language === 'vi' ? 'Tất cả sản phẩm' : 'All Products', icon: ShoppingBag },
                { href: '/orders', label: i18n.language === 'vi' ? 'Đơn hàng của tôi' : 'My Orders', icon: Package },
                { href: '/wallet', label: i18n.language === 'vi' ? 'Ví crypto' : 'Crypto Wallet', icon: Wallet },
                { href: '/disputes', label: i18n.language === 'vi' ? 'Tranh chấp' : 'Disputes', icon: Shield },
              ].map(item => (
                <li key={item.href}>
                  <Link href={item.href}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#f0b90b] transition-colors group">
                    <item.icon className="w-3.5 h-3.5 group-hover:text-[#f0b90b]" />
                    {item.label}
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
            <h4 className="font-semibold text-foreground mb-5 text-sm uppercase tracking-wider">
              {i18n.language === 'vi' ? 'Hỗ trợ' : 'Support'}
            </h4>
            <ul className="space-y-3">
              {[
                { href: '/disputes', label: i18n.language === 'vi' ? 'Báo cáo vấn đề' : 'Report Issue' },
                { href: '#', label: 'FAQ' },
                { href: '#', label: i18n.language === 'vi' ? 'Chính sách bảo mật' : 'Privacy Policy' },
                { href: '#', label: i18n.language === 'vi' ? 'Điều khoản sử dụng' : 'Terms of Service' },
              ].map(item => (
                <li key={item.label}>
                  <Link href={item.href}
                    className="text-sm text-muted-foreground hover:text-[#f0b90b] transition-colors flex items-center gap-1.5">
                    <ExternalLink className="w-3 h-3" />
                    {item.label}
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
              {i18n.language === 'vi' ? 'Bảo vệ bởi Smart Contract Escrow' : 'Protected by Smart Contract Escrow'}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              {i18n.language === 'vi' ? 'Hệ thống hoạt động bình thường' : 'Systems operational'}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
