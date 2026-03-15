'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAuth } from '@/lib/hooks/useAuth';
import { signOut } from 'next-auth/react';
import { useDisconnect } from 'wagmi';
import {
  Menu, X, ShoppingBag, Wallet, Package,
  LogOut, User, Shield, Search, Bell,
  TrendingUp, Zap, BarChart3, Settings, ChevronDown,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { useTranslation } from 'react-i18next';
import { getCoinLogo } from '@/lib/utils/coin-logos';
import { useCartStore } from '@/store/cart-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

export function Header() {
  const { isAuthenticated, user } = useAuth();
  const { disconnect } = useDisconnect();
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [tickers, setTickers] = useState<any[]>([]);
  const [, setLang] = useState(i18n.language);

  const { items: cartItems } = useCartStore();
  const cartItemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = () => setLang(i18n.language);
    i18n.on('languageChanged', handler);
    return () => { i18n.off('languageChanged', handler); };
  }, [i18n]);

  useEffect(() => {
    const fetchTickers = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        if (!res.ok) return;
        const data = await res.json();
        const topSymbols = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC'];
        const filtered = topSymbols.map(s => {
          const t = data.find((d: any) => d.symbol === s + 'USDT');
          if (!t) return null;
          return {
            s, p: Number(t.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 4 }),
            c: (Number(t.priceChangePercent) > 0 ? '+' : '') + Number(t.priceChangePercent).toFixed(2) + '%',
            pos: Number(t.priceChangePercent) >= 0
          };
        }).filter(Boolean);
        setTickers(filtered);
      } catch { }
    };
    fetchTickers();
    const interval = setInterval(fetchTickers, 60000);
    const onVisible = () => { if (!document.hidden) fetchTickers(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const handleLogout = () => { disconnect(); signOut({ callbackUrl: '/' }); };
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) { router.push(`/products?q=${searchQuery}`); setSearchQuery(''); }
  };

  const navLinks = [
    { href: '/', label: t('nav.home'), authRequired: false },
    { href: '/products', label: t('nav.products'), authRequired: false },
    { href: '/trading/BTCUSDT', label: t('nav.trading'), icon: TrendingUp, authRequired: false },
    { href: '/orders', label: t('nav.orders'), icon: ShoppingBag, hasBadge: true, authRequired: true },
    { href: '/wallet', label: t('nav.wallet'), authRequired: true },
  ].filter(link => !link.authRequired || isAuthenticated);

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname?.startsWith(href);
  const isAdmin = (user as any)?.role === 'admin' || (user as any)?.email === 'admin@marketplace.com';
  const userInitials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const headerBg = scrolled
    ? 'bg-background/95 backdrop-blur-md shadow-sm shadow-black/5'
    : 'bg-background';

  return (
    <TooltipProvider delayDuration={300}>
      <>
        {/* Ticker bar */}
        <div className="bg-background border-b border-border text-muted-foreground text-xs py-1.5 overflow-hidden hidden md:block">
          <div className="flex items-center gap-8 animate-marquee whitespace-nowrap w-max pr-8 hover:[animation-play-state:paused]">
            {tickers.length > 0 ? tickers.concat(tickers).map((coin, idx) => (
              <Link key={`${coin.s}-${idx}`} href={`/trading/${coin.s}USDT`}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <img src={getCoinLogo(coin.s)} alt={coin.s} className="w-4 h-4 object-contain" />
                <span className="font-semibold text-foreground">{coin.s}/USDT</span>
                <span>${coin.p}</span>
                <span className={coin.pos ? 'text-emerald-500 bg-emerald-500/10 px-1 py-0.5 rounded' : 'text-red-500 bg-red-500/10 px-1 py-0.5 rounded'}>
                  {coin.c}
                </span>
              </Link>
            )) : (
              <div className="flex items-center gap-8">
                {[1, 2, 3, 4, 5, 6, 7].map(i => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-border animate-pulse" />
                    <div className="w-12 h-3 rounded bg-border animate-pulse" />
                    <div className="w-16 h-3 rounded bg-border animate-pulse" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

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
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href}
                    className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
                      isActive(link.href)
                        ? 'text-[#f0b90b] bg-[#f0b90b]/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
                    }`}>
                    {link.icon && <link.icon className="w-3.5 h-3.5" />}
                    {link.label}
                    {link.hasBadge && cartItemCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow border-2 border-background">
                        {cartItemCount}
                      </span>
                    )}
                  </Link>
                ))}
                {isAdmin && (
                  <Link href="/admin"
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
                      pathname?.startsWith('/admin')
                        ? 'text-[#f0b90b] bg-[#f0b90b]/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
                    }`}>
                    <Shield className="w-3.5 h-3.5" /> Admin
                  </Link>
                )}
              </nav>

              {/* Search */}
              <div className="hidden md:flex flex-1 max-w-xs lg:max-w-sm">
                <form onSubmit={handleSearch} className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm sản phẩm..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-accent/10 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#f0b90b]/50 focus:bg-accent/20 transition-all"
                  />
                </form>
              </div>

              {/* Right Side */}
              <div className="hidden md:flex items-center gap-1.5">
                <ThemeToggle />
                <LanguageSwitcher />

                {isAuthenticated && (
                  <>
                    {/* Bell notification */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors">
                          <Bell className="w-5 h-5" />
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#f0b90b] rounded-full" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Thông báo</TooltipContent>
                    </Tooltip>

                    <Separator orientation="vertical" className="h-6 mx-1" />

                    {/* Web3 wallet connect */}
                    <div className="scale-[0.85] origin-right">
                      <ConnectButton showBalance={false} />
                    </div>
                  </>
                )}

                {/* Profile Dropdown using Radix DropdownMenu */}
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
                        { href: '/profile', icon: User,     label: t('nav.profile') },
                        { href: '/orders',  icon: Package,  label: t('nav.orders') },
                        { href: '/wallet',  icon: Wallet,   label: t('nav.wallet') },
                        { href: '/profile/credit', icon: Shield, label: 'AI Credit Score' },
                        { href: '/profile/nfts',   icon: Zap,    label: 'NFT Portfolio' },
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
                        <span>{t('nav.logout')}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <div className="flex gap-2">
                    <Link href="/login">
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground border border-border">
                        {t('auth.login')}
                      </Button>
                    </Link>
                    <Link href="/register">
                      <Button size="sm" className="bg-[#f0b90b] hover:bg-[#e6a800] text-black font-semibold shadow-lg shadow-yellow-500/20">
                        {t('auth.register')}
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
                <form onSubmit={handleSearch} className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm sản phẩm..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-accent/10 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#f0b90b]/50"
                  />
                </form>

                <nav className="flex flex-col gap-1">
                  {navLinks.map((link) => (
                    <Link key={link.href} href={link.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive(link.href) ? 'bg-[#f0b90b]/10 text-[#f0b90b]' : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
                      }`}
                      onClick={() => setMobileMenuOpen(false)}>
                      {link.icon && <link.icon className="w-4 h-4" />}
                      {link.label}
                      {link.hasBadge && cartItemCount > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{cartItemCount}</span>
                      )}
                    </Link>
                  ))}
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
                      <Button className="w-full bg-[#f0b90b] hover:bg-[#e6a800] text-black font-semibold">Đăng ký</Button>
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Mobile profile section */}
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
                      <span>{t('nav.logout')}</span>
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
