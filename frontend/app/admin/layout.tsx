'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { motion } from 'framer-motion';
import {
    LayoutDashboard, ShoppingCart, Users, AlertTriangle, RefreshCcw,
    Package, Coins, FileText, ChevronLeft, ChevronRight, Shield, LogOut,
    Home, Zap, Tag, Bell, Menu, X, Fingerprint,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useDisconnect } from 'wagmi';
import { useClientTranslation } from '@/lib/hooks/useClientTranslation';

const NAV_KEYS = [
    { href: '/admin', labelKey: 'admin.dashboard', icon: LayoutDashboard, exact: true, badge: null },
    { href: '/admin/orders', labelKey: 'admin.orders', icon: ShoppingCart, badge: null },
    { href: '/admin/users', labelKey: 'admin.users', icon: Users, badge: null },
    { href: '/admin/products', labelKey: 'admin.products', icon: Package, badge: null },
    { href: '/admin/vouchers', labelKey: 'admin.vouchers', icon: Tag, badge: 'NEW' },
    { href: '/admin/disputes', labelKey: 'admin.disputes', icon: AlertTriangle, badge: null },
    { href: '/admin/refunds', labelKey: 'admin.refunds', icon: RefreshCcw, badge: null },
    { href: '/admin/escrow', labelKey: 'admin.smartContract', icon: Zap, badge: null },
    { href: '/admin/tokens', labelKey: 'admin.tokens', icon: Coins, badge: null },
    { href: '/admin/kyc', labelKey: 'KYC', icon: Fingerprint, badge: 'NEW' },
    { href: '/admin/audit-logs', labelKey: 'admin.auditLogs', icon: FileText, badge: null },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated, isLoading } = useAuth();
    const { t } = useClientTranslation();
    const router = useRouter();
    const pathname = usePathname();
    const { disconnect } = useDisconnect();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        if (!isLoading && (!isAuthenticated || (user as any)?.role !== 'admin')) {
            router.push('/login');
        }
    }, [isAuthenticated, isLoading, user, router]);

    if (isLoading || !isAuthenticated || (user as any)?.role !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0c0e14]">
                <div className="text-center">
                    <div className="w-10 h-10 rounded-full border-2 border-[#f0b90b] border-t-transparent animate-spin mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">{t('common.loading')}...</p>
                </div>
            </div>
        );
    }

    const navItems = NAV_KEYS.map(n => ({ ...n, label: t(n.labelKey) }));
    const handleLogout = () => { disconnect(); signOut({ callbackUrl: '/' }); };
    const isActive = (href: string, exact?: boolean) => exact ? pathname === href : pathname?.startsWith(href);
    const activePage = navItems.find(n => isActive(n.href, n.exact))?.label || 'Admin';

    const SidebarContent = () => (
        <div className={`flex flex-col h-full bg-[#1a1d26] border-r border-white/8 ${collapsed ? 'w-[68px]' : 'w-64'} transition-all duration-300`}>
            {/* Logo */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/8">
                {!collapsed && (
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#f0b90b] to-[#e6a800] flex items-center justify-center">
                            <Shield className="w-4 h-4 text-black" />
                        </div>
                        <div>
                            <p className="font-bold text-white text-sm">{t('admin.adminPanel')}</p>
                            <p className="text-[10px] text-gray-600">Web3Market</p>
                        </div>
                    </div>
                )}
                {collapsed && (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#f0b90b] to-[#e6a800] flex items-center justify-center mx-auto">
                        <Shield className="w-4 h-4 text-black" />
                    </div>
                )}
                {!collapsed && (
                    <button onClick={() => setCollapsed(true)} className="p-1 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Nav */}
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                {navItems.map((item) => {
                    const active = isActive(item.href, item.exact);
                    return (
                        <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${active
                                ? 'bg-[#f0b90b]/12 text-[#f0b90b] border border-[#f0b90b]/20'
                                : 'text-gray-500 hover:bg-white/5 hover:text-gray-200'
                                }`}>
                                <item.icon className={`flex-shrink-0 ${collapsed ? 'w-5 h-5 mx-auto' : 'w-4.5 h-4.5'} ${active ? 'text-[#f0b90b]' : 'text-gray-500 group-hover:text-gray-300'}`} style={{ width: '18px', height: '18px' }} />
                                {!collapsed && (
                                    <>
                                        <span className="flex-1">{item.label}</span>
                                        {item.badge && (
                                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#f0b90b] text-black rounded-full">{item.badge}</span>
                                        )}
                                    </>
                                )}
                            </div>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-3 border-t border-white/8 space-y-0.5">
                <Link href="/">
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-white/5 hover:text-gray-300 transition-colors">
                        <Home className="flex-shrink-0 text-gray-600" style={{ width: '18px', height: '18px' }} />
                        {!collapsed && <span>{t('admin.backToHome')}</span>}
                    </div>
                </Link>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500/70 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                    <LogOut className="flex-shrink-0" style={{ width: '18px', height: '18px' }} />
                    {!collapsed && <span>{t('admin.signOut')}</span>}
                </button>

                {!collapsed && (
                    <div className="px-3 py-3 mt-2 bg-white/3 rounded-xl border border-white/8">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#f0b90b] to-amber-600 flex items-center justify-center text-black font-bold text-xs">
                                {user?.name?.charAt(0).toUpperCase() || 'A'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                                <p className="text-[10px] text-gray-600 truncate">{user?.email}</p>
                            </div>
                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0" title="Online" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-[#0c0e14] overflow-hidden">
            {/* Collapse toggle when collapsed */}
            {collapsed && (
                <div className="hidden md:flex">
                    <div className="relative">
                        <SidebarContent />
                        <button
                            onClick={() => setCollapsed(false)}
                            className="absolute -right-3 top-16 z-10 w-6 h-6 bg-[#1a1d26] border border-white/10 rounded-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-[#f0b90b]/20 transition-colors"
                        >
                            <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            )}

            {/* Desktop Sidebar */}
            {!collapsed && (
                <div className="hidden md:flex">
                    <SidebarContent />
                </div>
            )}

            {/* Mobile Overlay */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
                    <div className="relative w-64 h-full">
                        <SidebarContent />
                    </div>
                </div>
            )}

            {/* Main */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top bar */}
                <div className="h-14 flex items-center justify-between px-4 md:px-6 bg-[#1a1d26] border-b border-white/8">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5">
                            <Menu className="w-5 h-5" />
                        </button>
                        <div>
                            <p className="text-xs text-gray-600 hidden md:block">Admin</p>
                            <h2 className="text-sm font-bold text-white">{activePage}</h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="relative p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
                            <Bell className="w-4.5 h-4.5" style={{ width: '18px', height: '18px' }} />
                            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
                        </button>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
                            <Shield className="w-3.5 h-3.5 text-[#f0b90b]" />
                            <span className="text-xs text-gray-400 font-medium hidden sm:inline">Administrator</span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    <motion.div
                        key={pathname}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {children}
                    </motion.div>
                </main>
            </div>
        </div>
    );
}
