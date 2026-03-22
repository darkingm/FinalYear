'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useWhaleTrackerStore } from '@/store/whale-tracker-store';
import { WalletWatchCard } from './WalletWatchCard';
import { AddWalletModal } from './AddWalletModal';
import { TokenSearchPanel } from './TokenSearchPanel';
import {
    Fish, Plus, Bell, BellOff, Check, AlertTriangle, Wallet2, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';

type PanelTab = 'wallets' | 'alerts' | 'search';

export function WhalePanelSlideOver({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { wallets, alerts, markAllRead, clearAlerts, unreadCount } = useWhaleTrackerStore();
    const [tab, setTab] = useState<PanelTab>('wallets');
    const [addOpen, setAddOpen] = useState(false);
    const unread = unreadCount();

    const TABS: { key: PanelTab; label: string; icon: React.ReactNode; badge?: number }[] = [
        { key: 'wallets', label: 'Ví', icon: <Wallet2 className="w-3.5 h-3.5" />, badge: wallets.length },
        { key: 'alerts', label: 'Cảnh báo', icon: <Bell className="w-3.5 h-3.5" />, badge: unread },
        { key: 'search', label: 'Token', icon: <Search className="w-3.5 h-3.5" /> },
    ];

    return (
        <>
            <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
                <SheetContent side="right" className="w-full sm:w-[440px] flex flex-col p-0 gap-0">

                    {/* ── Header ────────────────────────────── */}
                    <SheetHeader className="px-4 pt-4 pb-0 flex-shrink-0">
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#8247e5] to-[#5c2f99] flex items-center justify-center shadow-lg shadow-purple-500/20">
                                <Fish className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <SheetTitle className="text-base text-foreground leading-tight">Whale Tracker</SheetTitle>
                                <p className="text-[11px] text-muted-foreground">Theo dõi cá voi on-chain</p>
                            </div>
                            <Link href="/whale-tracker" onClick={onClose}
                                className="text-[11px] text-[#8247e5] hover:underline underline-offset-2 flex-shrink-0">
                                Toàn màn hình →
                            </Link>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-1 bg-accent/10 rounded-xl p-1">
                            {TABS.map((t) => (
                                <button key={t.key} onClick={() => setTab(t.key)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${tab === t.key
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                        }`}>
                                    {t.icon}
                                    {t.label}
                                    {t.badge !== undefined && t.badge > 0 && (
                                        <span className={`text-[10px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center ${t.key === 'alerts'
                                                ? 'bg-red-500 text-white'
                                                : 'bg-[#8247e5]/20 text-[#8247e5]'
                                            }`}>{t.badge}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </SheetHeader>

                    {/* ── Body ──────────────────────────────── */}
                    <div className="flex-1 overflow-hidden flex flex-col">

                        {/* === WALLETS TAB === */}
                        {tab === 'wallets' && (
                            <>
                                <div className="px-4 pt-3 pb-2 flex-shrink-0">
                                    <Button size="sm" onClick={() => setAddOpen(true)}
                                        className="w-full bg-[#8247e5] hover:bg-[#8247e5]/90 text-white text-xs h-8">
                                        <Plus className="w-3.5 h-3.5 mr-1.5" /> Thêm ví theo dõi
                                    </Button>
                                </div>
                                <ScrollArea className="flex-1 px-4 pb-4">
                                    {wallets.length === 0 ? (
                                        <div className="text-center py-10 space-y-3">
                                            <Fish className="w-10 h-10 text-muted-foreground mx-auto" />
                                            <p className="text-sm text-muted-foreground">Chưa có ví nào được theo dõi</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {wallets.map((w) => (
                                                <WalletWatchCard key={w.id} wallet={w} compact />
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </>
                        )}

                        {/* === ALERTS TAB === */}
                        {tab === 'alerts' && (
                            <>
                                <div className="px-4 pt-3 pb-2 flex-shrink-0 flex items-center gap-2">
                                    <button onClick={markAllRead}
                                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-accent/10">
                                        <Check className="w-3 h-3" /> Đọc hết
                                    </button>
                                    <button onClick={clearAlerts}
                                        className="flex items-center gap-1 text-xs text-destructive/70 hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-destructive/10">
                                        <BellOff className="w-3 h-3" /> Xóa tất cả
                                    </button>
                                </div>
                                <ScrollArea className="flex-1 px-4 pb-4">
                                    {alerts.length === 0 ? (
                                        <div className="text-center py-10 space-y-2">
                                            <Bell className="w-8 h-8 text-muted-foreground mx-auto" />
                                            <p className="text-sm text-muted-foreground">Chưa có cảnh báo</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {alerts.slice(0, 50).map((alert) => {
                                                const isSell = alert.tx.type === 'SELL';
                                                return (
                                                    <div key={alert.id}
                                                        className={`rounded-xl border p-2.5 text-xs transition-opacity ${alert.read ? 'border-border bg-card/20 opacity-60' : isSell ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/20 bg-emerald-500/5'
                                                            }`}>
                                                        <div className="flex items-start gap-1.5">
                                                            <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${isSell ? 'text-red-400' : 'text-emerald-400'}`} />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-semibold text-foreground truncate">{alert.walletLabel}</p>
                                                                <p className={`font-bold mt-0.5 ${isSell ? 'text-red-400' : 'text-emerald-400'}`}>
                                                                    {alert.tx.type} {alert.tx.value}
                                                                    {alert.tx.pool && <span className="text-orange-400 ml-1 font-normal">via {alert.tx.pool}</span>}
                                                                </p>
                                                                <p className="text-muted-foreground text-[10px] mt-0.5">{new Date(alert.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</p>
                                                            </div>
                                                            {!alert.read && <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </ScrollArea>
                            </>
                        )}

                        {/* === SEARCH TAB === */}
                        {tab === 'search' && (
                            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4">
                                <TokenSearchPanel
                                    compact
                                    onSelectForWallet={() => { setTab('wallets'); setAddOpen(true); }}
                                />
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            <AddWalletModal open={addOpen} onClose={() => setAddOpen(false)} />
        </>
    );
}
