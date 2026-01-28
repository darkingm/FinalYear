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
import { Menu, X, ShoppingBag, Wallet, Package, LogOut, User, Settings } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

export function Header() {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const { disconnect } = useDisconnect();
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
    // Disconnect wallet first
    disconnect();
    // Then sign out
    signOut({ callbackUrl: '/' });
    setProfileOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <span className="text-4xl">₿</span>
            <span className="font-bold text-2xl hidden sm:inline bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Crypto Market
            </span>
          </Link>

          {/* Search Bar - Desktop */}
          <div className="hidden md:flex flex-1 max-w-xl mx-8">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search products, coins..."
                className="w-full px-4 py-2 pl-10 bg-gray-100 dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    window.location.href = `/products?q=${e.currentTarget.value}`;
                  }
                }}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                🔍
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-base font-semibold hover:text-primary transition-colors whitespace-nowrap">
              {t('nav.home')}
            </Link>
            <Link href="/products" className="text-base font-semibold hover:text-primary transition-colors whitespace-nowrap">
              {t('nav.products')}
            </Link>
          </nav>

          {/* Right Side */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <LanguageSwitcher />
            
            {/* Wallet Connect - Only when authenticated */}
            {isAuthenticated && <ConnectButton showBalance={false} />}
            
            {isAuthenticated ? (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <p className="font-semibold">{user?.name || 'User'}</p>
                      <p className="text-sm text-gray-500">{user?.email}</p>
                    </div>
                    
                    <Link href="/profile" onClick={() => setProfileOpen(false)}>
                      <div className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 cursor-pointer">
                        <User className="w-4 h-4" />
                        <span>{t('nav.profile') || 'Profile'}</span>
                      </div>
                    </Link>
                    
                    <Link href="/orders" onClick={() => setProfileOpen(false)}>
                      <div className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 cursor-pointer">
                        <Package className="w-4 h-4" />
                        <span>{t('nav.orders') || 'Orders'}</span>
                      </div>
                    </Link>

                    <Link href="/settings" onClick={() => setProfileOpen(false)}>
                      <div className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 cursor-pointer">
                        <Settings className="w-4 h-4" />
                        <span>{t('nav.settings') || 'Settings'}</span>
                      </div>
                    </Link>
                    
                    <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{t('nav.logout')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm">Login</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">Sign Up</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <nav className="flex flex-col gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-sm font-medium hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                <ShoppingBag className="w-4 h-4" />
                {t('nav.home')}
              </Link>
              <Link
                href="/products"
                className="flex items-center gap-2 text-sm font-medium hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Package className="w-4 h-4" />
                {t('nav.products')}
              </Link>
              <Link
                href="/wallet"
                className="flex items-center gap-2 text-sm font-medium hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Wallet className="w-4 h-4" />
                {t('nav.wallet')}
              </Link>
              <div className="flex items-center gap-2 pt-4 border-t">
                <ThemeToggle />
                <LanguageSwitcher />
              </div>
              {isAuthenticated && (
                <Button variant="ghost" onClick={handleLogout} className="justify-start">
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
