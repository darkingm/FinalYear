'use client';

import { useState } from 'react';
import { useWhaleTrackerStore, getBuySellCounts, CHAIN_LABELS } from '@/store/whale-tracker-store';
import { WalletWatchCard } from '@/components/whale-tracker/WalletWatchCard';
import { AddWalletModal } from '@/components/whale-tracker/AddWalletModal';
import { TokenSearchPanel } from '@/components/whale-tracker/TokenSearchPanel';
import { PoolSellDetector } from '@/components/whale-tracker/PoolSellDetector';
import { WalletDetailModal } from '@/components/whale-tracker/WalletDetailModal';
import type { WatchedWallet, WhaleTx } from '@/store/whale-tracker-store';
import {
    Fish, Plus, Bell, BellOff, Check, AlertTriangle,
    TrendingDown, TrendingUp, ArrowUpRight, ArrowDownLeft, Repeat, Wallet2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

type AlertFilter = 'ALL' | 'SELL' | 'BUY' | 'TRANSFER';

function relativeTime(ts: number) {
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60) return `${d}s ago`;
    if (d < 3600) return `${Math.floor(d / 60)}m ago`;
    if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
    return new Date(ts).toLocaleDateString('vi-VN');
}

export default function WhaleTrackerPage() {
    const { wallets, alerts, txHistory, markAllRead, clearAlerts, unreadCount } = useWhaleTrackerStore();
    const [addOpen, setAddOpen] = useState(false);
    const [alertFilter, setAlertFilter] = useState<AlertFilter>('ALL');
    const [detailWallet, setDetailWallet] = useState<WatchedWallet | null>(null);

    const unread = unreadCount();

    // Flatten all txs for the feed
    const allTxs: (WhaleTx & { walletLabel: string; walletChain: typeof wallets[0]['chain']; walletId: string })[] =
        wallets
            .flatMap((w) => (txHistory[w.id] || []).map((tx) => ({ ...tx, walletLabel: w.label, walletChain: w.chain, walletId: w.id })))
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 50);

    const filteredAlerts = alertFilter === 'ALL' ? alerts : alerts.filter((a) => a.tx.type === alertFilter);

    // Summary stats
    const totalBuys = wallets.reduce((s, w) => s + getBuySellCounts(txHistory[w.id] || []).buys, 0);
    const totalSells = wallets.reduce((s, w) => s + getBuySellCounts(txHistory[w.id] || []).sells, 0);

    return (
        <div className="min-h-screen bg-background">
            {/* ── Page header ─────────────────────────── */}
            <div className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-10">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8247e5] to-[#5c2f99] flex items-center justify-center shadow-lg shadow-purple-500/20">
                            <Fish className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-foreground">Whale Tracker</h1>
                            <p className="text-xs text-muted-foreground">Theo dõi ví cá voi — BSC / ETH / Polygon</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {unread > 0 && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30">
                                <Bell className="w-3.5 h-3.5 text-red-400" />
                                <span className="text-xs font-bold text-red-400">{unread} mới</span>
                            </div>
                        )}
                        <Button onClick={() => setAddOpen(true)} size="sm" className="bg-[#8247e5] hover:bg-[#8247e5]/90 text-white">
                            <Plus className="w-4 h-4 mr-1.5" /> Thêm ví
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Stats bar ───────────────────────────── */}
            <div className="container mx-auto px-4 pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    {[
                        { label: 'Ví theo dõi', value: wallets.length, icon: Wallet2, color: 'text-[#8247e5]', bg: 'bg-[#8247e5]/10' },
                        { label: 'Tổng BUY', value: totalBuys, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                        { label: 'Tổng SELL', value: totalSells, icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10' },
                        { label: 'Chưa đọc', value: unread, icon: Bell, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                    ].map((s) => (
                        <div key={s.label} className="rounded-xl border border-border bg-card/40 p-3 flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
                                <s.icon className={`w-4.5 h-4.5 ${s.color}`} />
                            </div>
                            <div>
                                <p className="text-xl font-bold text-foreground">{s.value}</p>
                                <p className="text-xs text-muted-foreground">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Main layout ─────────────────────────── */}
            <div className="container mx-auto px-4 pb-8">
                <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_320px] gap-5">

                    {/* ── Col 1: Watched Wallets ──────────── */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-foreground">Ví theo dõi</h2>
                            <button onClick={() => setAddOpen(true)}
                                className="flex items-center gap-1 text-xs text-[#8247e5] hover:text-[#8247e5]/80 transition-colors">
                                <Plus className="w-3.5 h-3.5" /> Thêm
                            </button>
                        </div>

                        {wallets.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-3">
                                <Fish className="w-8 h-8 text-muted-foreground mx-auto" />
                                <p className="text-xs text-muted-foreground">Chưa có ví nào</p>
                                <Button onClick={() => setAddOpen(true)} size="sm" variant="outline" className="text-xs">
                                    <Plus className="w-3.5 h-3.5 mr-1" /> Thêm ví đầu tiên
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {wallets.map((w) => (
                                    <WalletWatchCard key={w.id} wallet={w} compact />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Col 2: Live TX Feed ─────────────── */}
                    <div className="space-y-3">
                        <h2 className="text-sm font-bold text-foreground">
                            Feed giao dịch
                            <span className="ml-2 text-xs font-normal text-muted-foreground">({allTxs.length} giao dịch gần nhất)</span>
                        </h2>

                        {allTxs.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border p-10 text-center space-y-2">
                                <Fish className="w-10 h-10 text-muted-foreground mx-auto" />
                                <p className="text-sm text-muted-foreground">Thêm ví và chờ polling (30s) để thấy giao dịch</p>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-border overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-accent/5 border-b border-border">
                                        <tr>
                                            {['DATE', 'TYPE', 'TOKEN', 'VÍ', 'POOL'].map((c) => (
                                                <th key={c} className="px-3 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{c}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allTxs.map((tx) => {
                                            const isSell = tx.type === 'SELL';
                                            const isBuy = tx.type === 'BUY';
                                            const chainLabel = CHAIN_LABELS[tx.walletChain];
                                            const Icon = isSell ? ArrowUpRight : isBuy ? ArrowDownLeft : Repeat;
                                            const wallet = wallets.find((w) => w.id === tx.walletId);

                                            return (
                                                <tr key={tx.hash + tx.tokenSymbol + tx.walletId}
                                                    className="border-b border-border/50 hover:bg-accent/5 transition-colors group cursor-pointer"
                                                    onClick={() => wallet && setDetailWallet(wallet)}>
                                                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{relativeTime(tx.timestamp)}</td>
                                                    <td className="px-3 py-2">
                                                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${isSell ? 'bg-red-500/10 text-red-400' : isBuy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-accent/10 text-muted-foreground'
                                                            }`}>
                                                            <Icon className="w-3 h-3" />{tx.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-xs font-semibold text-foreground">{tx.value}</td>
                                                    <td className="px-3 py-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs text-foreground">{tx.walletLabel}</span>
                                                            <span className="text-[10px] font-bold px-1 py-0.5 rounded"
                                                                style={{ color: chainLabel.color, backgroundColor: chainLabel.color + '18' }}>
                                                                {tx.walletChain}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-xs text-orange-400">{tx.pool || '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* ── Col 3: Search + Pool + Alerts ───── */}
                    <div className="space-y-5">
                        {/* Token Search */}
                        <div className="space-y-2">
                            <h2 className="text-sm font-bold text-foreground">🔍 Tìm token</h2>
                            <div className="rounded-xl border border-border bg-card/40 p-3">
                                <TokenSearchPanel compact />
                            </div>
                        </div>

                        {/* Pool Sell Detector */}
                        <div className="space-y-2">
                            <h2 className="text-sm font-bold text-foreground">📊 Pool xả hàng</h2>
                            <div className="rounded-xl border border-border bg-card/40 p-3">
                                <PoolSellDetector />
                            </div>
                        </div>

                        {/* Alerts */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-bold text-foreground">
                                    Cảnh báo
                                    {unread > 0 && <span className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">{unread}</span>}
                                </h2>
                                <div className="flex gap-1">
                                    <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-accent/10">
                                        <Check className="w-3 h-3" /> Đọc hết
                                    </button>
                                    <button onClick={clearAlerts} className="text-xs text-destructive/70 hover:text-destructive transition-colors flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-destructive/10">
                                        <BellOff className="w-3 h-3" /> Xóa
                                    </button>
                                </div>
                            </div>

                            {/* Filter chips */}
                            <div className="flex gap-1.5 flex-wrap">
                                {(['ALL', 'SELL', 'BUY', 'TRANSFER'] as AlertFilter[]).map((f) => {
                                    const count = f === 'ALL' ? alerts.length : alerts.filter((a) => a.tx.type === f).length;
                                    return (
                                        <button key={f} onClick={() => setAlertFilter(f)}
                                            className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${alertFilter === f
                                                    ? f === 'SELL' ? 'bg-red-500/20 border-red-500/50 text-red-400'
                                                        : f === 'BUY' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                                            : 'bg-[#8247e5]/20 border-[#8247e5]/50 text-[#8247e5]'
                                                    : 'border-border text-muted-foreground'
                                                }`}>
                                            {f === 'ALL' ? `Tất cả (${count})` : `${f} (${count})`}
                                        </button>
                                    );
                                })}
                            </div>

                            <ScrollArea className="max-h-[350px]">
                                <div className="space-y-1.5 pr-1">
                                    {filteredAlerts.length === 0 ? (
                                        <div className="text-center py-6 text-xs text-muted-foreground">Không có cảnh báo</div>
                                    ) : filteredAlerts.slice(0, 30).map((alert) => {
                                        const isSell = alert.tx.type === 'SELL';
                                        return (
                                            <div key={alert.id}
                                                className={`rounded-xl border p-2.5 text-xs ${alert.read ? 'border-border bg-card/20 opacity-60' : isSell ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/20 bg-emerald-500/5'
                                                    }`}>
                                                <div className="flex items-start gap-1.5">
                                                    <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${isSell ? 'text-red-400' : 'text-emerald-400'}`} />
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-semibold text-foreground">{alert.walletLabel}</span>
                                                        {!alert.read && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />}
                                                        <p className={`mt-0.5 font-bold ${isSell ? 'text-red-400' : 'text-emerald-400'}`}>
                                                            {alert.tx.type} {alert.tx.value}
                                                            {alert.tx.pool && <span className="text-orange-400 ml-1 font-normal">via {alert.tx.pool}</span>}
                                                        </p>
                                                        <p className="text-muted-foreground text-[10px]">{new Date(alert.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </div>
            </div>

            <AddWalletModal open={addOpen} onClose={() => setAddOpen(false)} />
            <WalletDetailModal wallet={detailWallet} open={!!detailWallet} onClose={() => setDetailWallet(null)} />
        </div>
    );
}
