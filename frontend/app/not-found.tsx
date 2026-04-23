'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingBag, Package, Wallet, Search, ArrowLeft, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export default function NotFound() {
  const pathname = usePathname();

  const links = [
    { href: '/', icon: Home, label: 'Trang chủ' },
    { href: '/products', icon: ShoppingBag, label: 'Sản phẩm' },
    { href: '/orders', icon: Package, label: 'Đơn hàng' },
    { href: '/wallet', icon: Wallet, label: 'Ví crypto' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-[400px] h-[400px] bg-[#f0b90b]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[350px] h-[350px] bg-[#8247e5]/5 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 text-center max-w-lg"
      >
        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2 mb-10 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f0b90b] to-[#e6a800] flex items-center justify-center shadow-lg shadow-yellow-500/20 group-hover:scale-110 transition-transform">
            <Zap className="w-5 h-5 text-black fill-black" />
          </div>
          <span className="font-bold text-xl text-foreground">
            Web3<span className="text-[#f0b90b]">Market</span>
          </span>
        </Link>

        {/* 404 */}
        <div className="mb-6">
          <h1 className="text-8xl font-black bg-gradient-to-r from-[#f0b90b] via-[#8247e5] to-[#627eea] bg-clip-text text-transparent mb-4">
            404
          </h1>
          <h2 className="text-2xl font-bold text-foreground mb-3">
            Trang không tồn tại
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Đường dẫn{' '}
            <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono text-foreground">
              {pathname || '/unknown'}
            </code>{' '}
            không tìm thấy trên hệ thống.
          </p>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {links.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border hover:border-[#f0b90b]/30 hover:bg-[#f0b90b]/5 transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-[#f0b90b]/10 transition-colors">
                <Icon className="w-4 h-4 text-muted-foreground group-hover:text-[#f0b90b] transition-colors" />
              </div>
              <span className="text-sm font-medium text-foreground">{label}</span>
            </Link>
          ))}
        </div>

        {/* Search hint */}
        <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground mb-6">
          <Search className="w-3.5 h-3.5" />
          <span>Thử tìm kiếm sản phẩm hoặc dùng thanh điều hướng ở trên</span>
        </div>

        {/* Back button */}
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại trang trước
        </button>
      </motion.div>
    </div>
  );
}
