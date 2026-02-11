'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAuth } from '@/lib/hooks/useAuth';
import { signOut } from 'next-auth/react';
import { useDisconnect } from 'wagmi';
import {
  Menu, X, ShoppingBag, Wallet, Package,
  LogOut, User, Settings, LayoutDashboard, TrendingUp,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function Header() {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const { disconnect } = useDisconnect();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    disconnect();
    signOut({ callbackUrl: '/' });
    setProfileOpen(false);
  };

  const navLinks = [
    { href: '/', label: t('nav.home'), icon: TrendingUp },
    { href: '/products', label: t('nav.products'), icon: ShoppingBag },
    { href: '/orders', label: t('nav.orders'), icon: Package },
    { href: '/wallet', label: t('nav.wallet'), icon: Wallet },
  ];

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 glass-strong">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-ocean-500 to-ocean-700 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
              <span className="text-white font-bold text-lg">W</span>
            </div>
            <span className="font-bold text-xl hidden sm:inline text-gradient-primary">
              Web3 Market
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive(link.href)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Side */}
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />

            {isAuthenticated && (
              <div className="ml-1">
                <ConnectButton showBalance={false} />
              </div>
            )}

            {isAuthenticated ? (
              <div className="relative ml-1" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-muted transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ocean-400 to-ocean-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-card rounded-xl shadow-xl border border-border py-1.5 z-50 animate-scale-in">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="font-semibold text-sm">{user?.name || 'User'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>

                    {[
                      { href: '/profile', icon: User, label: t('nav.profile') || 'Profile' },
                      { href: '/orders', icon: Package, label: t('nav.orders') || 'Orders' },
                      { href: '/products/create', icon: LayoutDashboard, label: 'Dashboard' },
                      { href: '/settings', icon: Settings, label: t('nav.settings') || 'Settings' },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setProfileOpen(false)}
                      >
                        <div className="px-4 py-2 hover:bg-muted flex items-center gap-2.5 cursor-pointer text-sm transition-colors">
                          <item.icon className="w-4 h-4 text-muted-foreground" />
                          <span>{item.label}</span>
                        </div>
                      </Link>
                    ))}

                    <div className="border-t border-border mt-1 pt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-2 hover:bg-destructive/10 flex items-center gap-2.5 text-destructive text-sm transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{t('nav.logout')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-2 ml-1">
                <Link href="/login">
                  <Button variant="ghost" size="sm">Login</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="bg-gradient-to-r from-ocean-500 to-ocean-600 hover:from-ocean-600 hover:to-ocean-700 text-white shadow-md">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border animate-slide-down">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              ))}
              <div className="flex items-center gap-2 pt-3 mt-2 border-t border-border">
                <ThemeToggle />
                <LanguageSwitcher />
              </div>
              {isAuthenticated && (
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="justify-start text-destructive hover:text-destructive mt-2"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {t('nav.logout')}
                </Button>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
