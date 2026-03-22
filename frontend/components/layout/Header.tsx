'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAuth } from '@/lib/hooks/useAuth';
import { signOut } from 'next-auth/react';
import { useDisconnect, useAccount } from 'wagmi';
import {
  Menu, X, ShoppingBag, Wallet, Package,
  LogOut, User, Shield, Bell,
  TrendingUp, Zap, BarChart3, ChevronDown, Copy, Check,
  Building, Brain, Fish, Activity,
} from 'lucide-react';
import { useState, useEffect, memo, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { useTranslation } from 'react-i18next';
import { CoinImage } from '@/components/ui/CoinImage';
import { useCartStore } from '@/store/cart-store';
import { usePriceStore } from '@/store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { WhaleAlertBadge } from '@/components/whale-tracker/WhaleAlertBadge';
import { WhalePanelSlideOver } from '@/components/whale-tracker/WhalePanelSlideOver';

/* ─────────────────────────────────────────────────────────────────────────────
 * TickerItem — isolated memo component, only re-renders for its OWN symbol
 * This is the key fix: each coin renders independently → no full-list re-render
 * ───────────────────────────────────────────────────────────────────────────── */
const TICKER_SYMBOLS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC'];

const TickerCoin = memo(function TickerCoin({ short }: { short: string }) {
  // Subscribe only to this coin's slice — no re-render from other coins
  const data = usePriceStore((s) => s.prices[short + 'USDT']);
  const prevRef = useRef<number>(0);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (!data) return;
    const curr = data.price;
    const prev = prevRef.current;
    if (prev !== 0 && curr !== prev) {
      setFlash(curr > prev ? 'up' : 'down');
      const t = setTimeout(() => setFlash(null), 500);
      prevRef.current = curr;
      return () => clearTimeout(t);
    }
    prevRef.current = curr;
  }, [data?.price]);

  if (!data) return null;

  const p = data.price;
  const formatted = p >= 10000
    ? p.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : p >= 100
      ? p.toFixed(2)
      : p.toFixed(4);

  const isUp = data.change24h >= 0;
  const priceColor = flash === 'up' ? 'text-emerald-400' : flash === 'down' ? 'text-red-400' : 'text-foreground';

  return (
    <Link
      href={`/trading/${short}USDT`}
      className="flex items-center gap-1.5 hover:text-foreground transition-colors flex-shrink-0"
    >
      <CoinImage symbol={short} size={14} className="rounded-full flex-shrink-0" />
      <span className="font-semibold text-foreground text-[11px]">{short}</span>
      <span className={`font-mono text-[11px] price-num ${priceColor}`}>${formatted}</span>
      <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${isUp ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-500 bg-red-500/10'}`}>
        {isUp ? '+' : ''}{data.change24h.toFixed(2)}%
      </span>
    </Link>
  );
});

/* ─────────────────────────────────────────────────────────────────────────────
 * TickerBar — static outer shell: renders once, items re-render independently
 * Uses pure CSS marquee — NO JS animation loop, pure GPU compositing
 * ───────────────────────────────────────────────────────────────────────────── */
const TickerBar = memo(function TickerBar() {
  const { connect: priceConnect } = usePriceStore();
  useEffect(() => {
    priceConnect(TICKER_SYMBOLS.map(s => s + 'USDT'));
  }, []); // eslint-disable-line

  // Duplicate items for seamless infinite scroll (CSS handles the loop)
  const items = [...TICKER_SYMBOLS, ...TICKER_SYMBOLS];

  return (
    <div className="bg-background border-b border-border text-muted-foreground text-xs py-1.5 overflow-hidden hidden md:block">
      <div className="flex items-center gap-8 animate-marquee whitespace-nowrap w-max pr-8">
        {items.map((short, idx) => (
          <TickerCoin key={`${short}-${idx}`} short={short} />
        ))}
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────────────────────────────────────
 * Header
 * ───────────────────────────────────────────────────────────────────────────── */
export function Header() {
  const { isAuthenticated, user } = useAuth();
  const { disconnect } = useDisconnect();
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [, setLang] = useState(i18n.language);
  const [addrCopied, setAddrCopied] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [whaleOpen, setWhaleOpen] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = () => setLang(i18n.language);
    i18n.on('languageChanged', handler);
    return () => { i18n.off('languageChanged', handler); };
  }, [i18n]);

  const handleLogout = () => { disconnect(); signOut({ callbackUrl: '/' }); };

  // Click handler for auth-required links — redirect to login if not logged in
  const handleAuthLink = (href: string) => (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault();
      router.push(`/login?callbackUrl=${encodeURIComponent(href)}`);
    }
  };

  const navLinks = [
    { href: '/', label: 'Trang chủ', authRequired: false },
    { href: '/products', label: 'Sản phẩm', authRequired: false },
    { href: '/trading/BTCUSDT', label: 'Giao dịch', icon: TrendingUp, authRequired: false },
    { href: '/whale-tracker', label: 'On-Chain', icon: Activity, authRequired: false },
    { href: '/orders', label: 'Đơn hàng', icon: ShoppingBag, authRequired: true },
    { href: '/wallet', label: 'Ví', authRequired: true },
  ];

  const specialNavLinks = [
    { href: '/assets', label: 'RWA', icon: Building, authRequired: false },
    { href: '/profile/credit', label: 'AI Credit', icon: Brain, authRequired: true },
  ];

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname?.startsWith(href);
  const isAdmin = (user as any)?.role === 'admin' || (user as any)?.email === 'admin@marketplace.com';
  const userInitials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const headerBg = scrolled
    ? 'bg-background/95 backdrop-blur-md shadow-sm shadow-black/5'
    : 'bg-background';

  return (
    <TooltipProvider delayDuration={300}>
      <>
        <WhalePanelSlideOver open={whaleOpen} onClose={() => setWhaleOpen(false)} />
        {/* Ticker bar — isolated TickerCoin memos, smooth CSS marquee */}
        <TickerBar />

        <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${headerBg} border-b border-border`}>
          <div className="container mx-auto px-4">
            <div className="flex h-16 items-center justify-between gap-4">

              {/* Logo */}
              <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#f0b90b] to-[#e6a800] flex items-center justify-center shadow-lg shadow-yellow-500/20 group-hover:shadow-yellow-500/40 transition-shadow">
                  <Zap className="w-4 h-4 text-black fill-black" />
                </div>
                <span className="font-bold text-xl text-foreground hidden sm:inline">
                  Web3<span className="text-[#f0b90b]">Market</span>
                </span>
              </Link>

              {/* Desktop Nav */}
              <nav className="hidden lg:flex items-center gap-0.5">
                {navLinks.map((link) => {
                  const show = !link.authRequired || isAuthenticated;
                  if (!show) return null;
                  return (
                    <Link key={link.href} href={link.href}
                      className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${isActive(link.href)
                        ? 'text-[#8247e5] bg-[#8247e5]/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
                        }`}>
                      {link.icon && <link.icon className="w-3.5 h-3.5" />}
                      {link.label}
                    </Link>
                  );
                })}

                {/* Special links: always visible, redirect to login if not authed */}
                {specialNavLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={isAuthenticated ? link.href : `/login?callbackUrl=${encodeURIComponent(link.href)}`}
                    className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${isActive(link.href)
                      ? 'text-[#8247e5] bg-[#8247e5]/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
                      }`}
                  >
                    <link.icon className="w-3.5 h-3.5" />
                    {link.label}
                    {!isAuthenticated && (
                      <span className="ml-0.5 text-[9px] font-bold px-1 py-0.5 rounded bg-[#8247e5]/15 text-[#8247e5]">
                        Login
                      </span>
                    )}
                  </Link>
                ))}

                {isAdmin && (
                  <Link href="/admin"
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${pathname?.startsWith('/admin')
                      ? 'text-[#8247e5] bg-[#8247e5]/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
                      }`}>
                    <Shield className="w-3.5 h-3.5" /> Admin
                  </Link>
                )}
              </nav>

              <div className="flex-1" />

              {/* Right Side */}
              <div className="hidden md:flex items-center gap-1.5">

                {/* Whale Tracker Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setWhaleOpen(true)}
                      className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
                      aria-label="Whale Tracker"
                    >
                      <Fish className="w-5 h-5" />
                      <WhaleAlertBadge />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Theo dõi cá voi</TooltipContent>
                </Tooltip>

                <ThemeToggle />
                <LanguageSwitcher />

                {isAuthenticated && (
                  <>
                    {/* Bell notification */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors">
                          <Bell className="w-5 h-5" />
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#8247e5] rounded-full" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Thông báo</TooltipContent>
                    </Tooltip>

                    <Separator orientation="vertical" className="h-6 mx-1" />

                    {/* Web3 wallet */}
                    <ConnectButton.Custom>
                      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                        if (!mounted) return null;
                        const connected = !!(account && chain);
                        return (
                          <div className="flex items-center gap-1">
                            {connected ? (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={openChainModal}
                                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-accent/10 border border-border hover:bg-accent/20 transition-colors text-xs"
                                    >
                                      {chain.hasIcon && chain.iconUrl && (
                                        <img src={chain.iconUrl} alt={chain.name} className="w-4 h-4 rounded-full" />
                                      )}
                                      <span className="hidden lg:block font-medium text-foreground max-w-[70px] truncate">{chain.name}</span>
                                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>Đổi mạng</TooltipContent>
                                </Tooltip>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#f0b90b] to-[#8247e5] flex-shrink-0" />
                                      <span className="text-xs font-mono font-semibold text-emerald-400">
                                        {account.address.slice(0, 6)}…{account.address.slice(-4)}
                                      </span>
                                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-64">
                                    <DropdownMenuLabel>
                                      <p className="text-xs text-muted-foreground mb-1">Ví đang kết nối</p>
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#f0b90b] to-[#8247e5] flex-shrink-0" />
                                        <p className="font-mono text-xs text-foreground truncate flex-1">{account.address}</p>
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(account.address);
                                            setAddrCopied(true);
                                            setTimeout(() => setAddrCopied(false), 2000);
                                          }}
                                          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                                        >
                                          {addrCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                      </div>
                                      {account.displayBalance && (
                                        <p className="text-[11px] text-muted-foreground mt-1">Số dư: <span className="text-foreground font-semibold">{account.displayBalance}</span></p>
                                      )}
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={openAccountModal} className="gap-2">
                                      <Wallet className="w-4 h-4" />
                                      Quản lý ví / Đổi tài khoản
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={openChainModal} className="gap-2">
                                      {chain.hasIcon && chain.iconUrl
                                        ? <img src={chain.iconUrl} alt={chain.name} className="w-4 h-4 rounded-full" />
                                        : <Shield className="w-4 h-4" />}
                                      Đổi mạng ({chain.name})
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => disconnect()}
                                      className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2"
                                    >
                                      <LogOut className="w-4 h-4" />
                                      Ngắt kết nối ví
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </>
                            ) : (
                              <button
                                onClick={openConnectModal}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#8247e5]/10 border border-[#8247e5]/30 hover:bg-[#8247e5]/20 transition-colors text-xs font-bold text-[#8247e5]"
                              >
                                <Wallet className="w-3.5 h-3.5" />
                                Kết nối ví
                              </button>
                            )}
                          </div>
                        );
                      }}
                    </ConnectButton.Custom>
                  </>
                )}

                {/* Profile Dropdown */}
                {isAuthenticated ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-accent/10 transition-colors border border-border hover:border-border/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Avatar className="h-7 w-7 rounded-lg">
                          <AvatarImage src={(user as any)?.image} alt={user?.name || ''} />
                          <AvatarFallback className="rounded-lg text-xs font-bold bg-gradient-to-br from-[#f0b90b] to-[#e6a800] text-black">
                            {userInitials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-muted-foreground hidden xl:block max-w-[80px] truncate">{user?.name || 'User'}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-semibold text-foreground">{user?.name || 'User'}</p>
                          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />

                      {[
                        { href: '/profile', icon: User, label: t('nav.profile') },
                        { href: '/orders', icon: Package, label: t('nav.orders') },
                        { href: '/wallet', icon: Wallet, label: t('nav.wallet') },
                        { href: '/seller/dashboard', icon: BarChart3, label: 'Seller Dashboard' },
                        ...(isAdmin ? [{ href: '/admin', icon: Shield, label: 'Admin Panel' }] : []),
                      ].map((item) => (
                        <DropdownMenuItem key={item.href} asChild>
                          <Link href={item.href} className="flex items-center gap-2 cursor-pointer">
                            <item.icon className="w-4 h-4 text-muted-foreground" />
                            <span>{item.label}</span>
                          </Link>
                        </DropdownMenuItem>
                      ))}

                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleLogout}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <LogOut className="w-4 h-4" />
                        <span suppressHydrationWarning>{isMounted ? t('nav.logout') : 'Logout'}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <div className="flex gap-2">
                    <Link href="/login">
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground border border-border" suppressHydrationWarning>
                        {isMounted ? t('auth.login') : 'Login'}
                      </Button>
                    </Link>
                    <Link href="/register">
                      <Button size="sm" className="btn-purple-rainbow font-semibold shadow-lg shadow-purple-500/20" suppressHydrationWarning>
                        {isMounted ? t('auth.register') : 'Register'}
                      </Button>
                    </Link>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-border bg-background animate-fade-in">
              <div className="container mx-auto px-4 py-4 space-y-3">
                <nav className="flex flex-col gap-1">
                  {navLinks.map((link) => {
                    const href = (!link.authRequired || isAuthenticated)
                      ? link.href
                      : `/login?callbackUrl=${encodeURIComponent(link.href)}`;
                    return (
                      <Link key={link.href} href={href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive(link.href) ? 'bg-[#8247e5]/10 text-[#8247e5]' : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
                          }`}
                        onClick={() => setMobileMenuOpen(false)}>
                        {link.icon && <link.icon className="w-4 h-4" />}
                        {link.label}
                      </Link>
                    );
                  })}
                  {/* Special nav links in mobile too */}
                  {specialNavLinks.map((link) => {
                    const href = isAuthenticated ? link.href : `/login?callbackUrl=${encodeURIComponent(link.href)}`;
                    return (
                      <Link key={link.href} href={href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive(link.href) ? 'bg-[#8247e5]/10 text-[#8247e5]' : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'}`}
                        onClick={() => setMobileMenuOpen(false)}>
                        <link.icon className="w-4 h-4" />
                        {link.label}
                        {!isAuthenticated && <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#8247e5]/15 text-[#8247e5]">Login</span>}
                      </Link>
                    );
                  })}
                  {isAdmin && (
                    <Link href="/admin"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/10"
                      onClick={() => setMobileMenuOpen(false)}>
                      <Shield className="w-4 h-4" /> Admin Panel
                    </Link>
                  )}
                </nav>

                <div className="flex items-center gap-3 pt-3 border-t border-border">
                  <ThemeToggle />
                  <LanguageSwitcher />
                </div>

                {!isAuthenticated ? (
                  <div className="flex gap-2">
                    <Link href="/login" className="flex-1">
                      <Button variant="outline" className="w-full border-border">Đăng nhập</Button>
                    </Link>
                    <Link href="/register" className="flex-1">
                      <Button className="w-full btn-purple-rainbow font-semibold">Đăng ký</Button>
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 py-2">
                      <Avatar className="h-9 w-9 rounded-xl">
                        <AvatarImage src={(user as any)?.image} />
                        <AvatarFallback className="rounded-xl bg-gradient-to-br from-[#f0b90b] to-[#e6a800] text-black font-bold text-sm">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{user?.name}</p>
                        <p className="text-xs text-muted-foreground">{user?.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-destructive hover:bg-destructive/10 rounded-lg text-sm transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span suppressHydrationWarning>{isMounted ? t('nav.logout') : 'Logout'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </header>
      </>
    </TooltipProvider>
  );
}
