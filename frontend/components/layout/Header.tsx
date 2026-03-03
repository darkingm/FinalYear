'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAuth } from '@/lib/hooks/useAuth';
import { signOut } from 'next-auth/react';
import { useDisconnect } from 'wagmi';
import {
  Menu, X, ShoppingBag, Wallet, Package,
  LogOut, User, Shield, Heart, Search,
  TrendingUp, Bell, ChevronDown, Zap,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { useTranslation } from 'react-i18next';
import { getCoinLogo } from '@/lib/utils/coin-logos';

export function Header() {
  const { isAuthenticated, user } = useAuth();
  const { disconnect } = useDisconnect();
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [tickers, setTickers] = useState<any[]>([]);
  const profileRef = useRef<HTMLDivElement>(null);
  // force re-render on language change
  const [, setLang] = useState(i18n.language);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Re-render when language changes (dispatched by LanguageSwitcher)
  useEffect(() => {
    const handler = () => setLang(i18n.language);
    i18n.on('languageChanged', handler);
    window.addEventListener('languagechange', handler);
    return () => {
      i18n.off('languageChanged', handler);
      window.removeEventListener('languagechange', handler);
    };
  }, [i18n]);

  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        const data = await res.json();
        const topSymbols = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC'];
        const filtered = topSymbols.map(s => {
          const t = data.find((d: any) => d.symbol === s + 'USDT');
          if (!t) return null;
          return {
            s,
            p: Number(t.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 4 }),
            c: (Number(t.priceChangePercent) > 0 ? '+' : '') + Number(t.priceChangePercent).toFixed(2) + '%',
            pos: Number(t.priceChangePercent) >= 0
          };
        }).filter(Boolean);
        setTickers(filtered);
      } catch (error) {
        console.error('Failed to fetch tickers', error);
      }
    };
    fetchTickers();
    const interval = setInterval(fetchTickers, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    disconnect();
    signOut({ callbackUrl: '/' });
    setProfileOpen(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/products?q=${searchQuery}`);
      setSearchQuery('');
    }
  };

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/products', label: 'Products' },
    { href: '/trading/BTCUSDT', label: 'Trading', icon: TrendingUp },
    { href: '/orders', label: 'Orders' },
    { href: '/wallet', label: 'Wallet' },
  ];

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href);
  const isAdmin = (user as any)?.role === 'admin';

  // Adaptive classes that work in both dark and light mode
  const headerBg = scrolled
    ? 'bg-background/98 backdrop-blur-md shadow-lg shadow-black/10 dark:shadow-black/30'
    : 'bg-background';

  return (
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
              <span className={coin.pos ? 'text-emerald-500 bg-emerald-500/10 px-1 py-0.5 rounded' : 'text-red-500 bg-red-500/10 px-1 py-0.5 rounded'}>{coin.c}</span>
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
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${isActive(link.href)
                    ? 'text-[#f0b90b] bg-[#f0b90b]/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
                    }`}>
                  {link.icon && <link.icon className="w-3.5 h-3.5" />}
                  {link.label}
                </Link>
              ))}
              {isAdmin && (
                <Link href="/admin"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${pathname?.startsWith('/admin')
                    ? 'text-[#f0b90b] bg-[#f0b90b]/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
                    }`}>
                  <Shield className="w-3.5 h-3.5" />
                  Admin
                </Link>
              )}
            </nav>

            {/* Search */}
            <div className="hidden md:flex flex-1 max-w-xs lg:max-w-sm">
              <form onSubmit={handleSearch} className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-accent/10 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#f0b90b]/50 focus:bg-accent/20 transition-all"
                />
              </form>
            </div>

            {/* Right Side */}
            <div className="hidden md:flex items-center gap-2">
              <ThemeToggle />
              <LanguageSwitcher />

              {isAuthenticated && (
                <>
                  <Link href="/wishlist"
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-accent/10 transition-colors">
                    <Heart className="w-5 h-5" />
                  </Link>
                  <button className="p-2 rounded-lg text-muted-foreground hover:text-yellow-500 hover:bg-accent/10 transition-colors relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-[#f0b90b] rounded-full" />
                  </button>
                  <div className="h-8 w-px bg-border mx-1" />
                  <div className="scale-85">
                    <ConnectButton showBalance={false} />
                  </div>
                </>
              )}

              {isAuthenticated ? (
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-accent/10 transition-colors border border-border hover:border-border/80"
                  >
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#f0b90b] to-[#e6a800] flex items-center justify-center text-black font-bold text-sm shadow-sm">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm text-muted-foreground hidden xl:block max-w-[80px] truncate">{user?.name || 'User'}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-60 bg-popover border border-border rounded-xl shadow-2xl shadow-black/20 py-1.5 z-50 animate-scale-in">
                      <div className="px-4 py-3 border-b border-border">
                        <p className="font-semibold text-sm text-foreground">{user?.name || 'User'}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email}</p>
                      </div>

                      {[
                        { href: '/profile', icon: User, label: 'Profile' },
                        { href: '/orders', icon: Package, label: 'Orders' },
                        { href: '/wallet', icon: Wallet, label: 'Wallet' },
                        ...(isAdmin ? [{ href: '/admin', icon: Shield, label: 'Admin Panel' }] : []),
                      ].map((item) => (
                        <Link key={item.href} href={item.href} onClick={() => setProfileOpen(false)}>
                          <div className="px-4 py-2.5 hover:bg-accent/10 flex items-center gap-2.5 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                            <item.icon className="w-4 h-4" />
                            <span>{item.label}</span>
                          </div>
                        </Link>
                      ))}

                      <div className="border-t border-border mt-1 pt-1">
                        <button
                          onClick={handleLogout}
                          className="w-full px-4 py-2.5 hover:bg-destructive/10 flex items-center gap-2.5 text-destructive hover:text-destructive/80 text-sm transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Logout</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <Link href="/login">
                    <Button variant="ghost" size="sm"
                      className="text-muted-foreground hover:text-foreground hover:bg-accent/10 border border-border">
                      Login
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button size="sm"
                      className="bg-[#f0b90b] hover:bg-[#e6a800] text-black font-semibold shadow-lg shadow-yellow-500/20">
                      Register
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-border bg-background animate-slide-down">
            <div className="container mx-auto px-4 py-4">
              <form onSubmit={handleSearch} className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t('common.search') + '...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-accent/10 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#f0b90b]/50"
                />
              </form>

              <nav className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive(link.href)
                      ? 'bg-[#f0b90b]/10 text-[#f0b90b]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
                      }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.icon && <link.icon className="w-4 h-4" />}
                    {link.label}
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

              {/* Mobile lang + theme */}
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
                <ThemeToggle />
                <LanguageSwitcher />
              </div>

              {!isAuthenticated && (
                <div className="flex gap-2 mt-3">
                  <Link href="/login" className="flex-1">
                    <Button variant="outline" className="w-full border-border text-muted-foreground hover:text-foreground">
                      Login
                    </Button>
                  </Link>
                  <Link href="/register" className="flex-1">
                    <Button className="w-full bg-[#f0b90b] hover:bg-[#e6a800] text-black font-semibold">
                      Register
                    </Button>
                  </Link>
                </div>
              )}

              {isAuthenticated && (
                <button
                  onClick={handleLogout}
                  className="w-full mt-4 pt-4 border-t border-border flex items-center gap-2.5 text-destructive text-sm px-3 py-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
