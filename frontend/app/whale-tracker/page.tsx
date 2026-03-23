'use client';

/**
 * /whale-tracker — On-Chain Transaction Dashboard v3
 *
 * Layout (3-column):
 *  Left sidebar  — Token search + Token Info Panel (price/vol/supply/holders)
 *  Center col    — Live TX Feed (DexScreener-style 8-col table, real-time polling)
 *  Right sidebar — Wallet Watch List (persistent BUY/SELL counters from DB)
 *                + Alerts panel
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Fish, Plus, Bell, BellOff, Check, AlertTriangle,
    Activity, Zap, TrendingUp, TrendingDown, Settings2,
    Wallet2, ChevronDown, Info,
} from 'lucide-react';
import { useWhaleTrackerStore, getBuySellCounts, CHAIN_LABELS } from '@/store/whale-tracker-store';
import type { WatchedWallet, SupportedChain } from '@/store/whale-tracker-store';
import { WalletWatchCard } from '@/components/whale-tracker/WalletWatchCard';
import { AddWalletModal } from '@/components/whale-tracker/AddWalletModal';
import { TokenSearchPanel } from '@/components/whale-tracker/TokenSearchPanel';
import { TokenInfoPanel } from '@/components/whale-tracker/TokenInfoPanel';
import { LiveTxFeed } from '@/components/whale-tracker/LiveTxFeed';
import { WalletDetailModal } from '@/components/whale-tracker/WalletDetailModal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import type { TokenPair } from '@/store/whale-tracker-store';

/* ── API Provider Suggestion Banner ── */
const API_SUGGESTIONS = [
    { name: 'BSCScan', desc: 'BSC/BNB Chain, 5 req/s free', url: 'https://bscscan.com/myapikey', color: '#F0B90B' },
    { name: 'Etherscan', desc: 'ETH mainnet, 5 req/s free', url: 'https://etherscan.io/myapikey', color: '#627EEA' },
    { name: 'PolygonScan', desc: 'Polygon, 5 req/s free', url: 'https://polygonscan.com/myapikey', color: '#8247E5' },
    { name: 'GeckoTerminal', desc: 'OHLCV + token info, free', url: 'https://www.geckoterminal.com/dex-api', color: '#34D399' },
    { name: 'DexScreener', desc: 'Pair search + price, free', url: 'https://docs.dexscreener.com', color: '#06B6D4' },
    { name: 'Moralis', desc: 'Multi-chain decoded events', url: 'https://moralis.io/', color: '#8B5CF6' },
];

type AlertFilter = 'ALL' | 'SELL' | 'BUY' | 'TRANSFER';

function relativeTime(ts: number) {
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60) return `${d}s`;
    if (d < 3600) return `${Math.floor(d / 60)}m`;
    return `${Math.floor(d / 3600)}h`;
}

export default function WhaleTrackerPage() {
    const { wallets, alerts, txHistory, markAllRead, clearAlerts, unreadCount } = useWhaleTrackerStore();
    const [addOpen, setAddOpen] = useState(false);
    const [alertFilter, setAlertFilter] = useState<AlertFilter>('ALL');
    const [detailWallet, setDetailWallet] = useState<WatchedWallet | null>(null);
    const [showApiTips, setShowApiTips] = useState(false);

    // Selected token/pair for LiveTxFeed
    const [selectedPair, setSelectedPair] = useState<{
        chain: SupportedChain;
        tokenAddress: string;
        pairAddress: string;
        tokenSymbol: string;
        quoteSymbol: string;
    } | null>(null);

    const unread = unreadCount();
    const filteredAlerts = alertFilter === 'ALL' ? alerts : alerts.filter(a => a.tx.type === alertFilter);

    // Summary stats from live txHistory (Zustand in-memory)
    const totalBuys = wallets.reduce((s, w) => s + getBuySellCounts(txHistory[w.id] || []).buys, 0);
    const totalSells = wallets.reduce((s, w) => s + getBuySellCounts(txHistory[w.id] || []).sells, 0);

    const handleSelectPair = (pair: TokenPair) => {
        setSelectedPair({
            chain: pair.chain,
            tokenAddress: pair.baseToken.address,
            pairAddress: pair.pairAddress,
            tokenSymbol: pair.baseToken.symbol,
            quoteSymbol: pair.quoteToken.symbol,
        });
    };

    return (
        <div className="min-h-screen bg-[#060612] text-white flex flex-col">
            {/* ── Top Header ─────────────────────────────────────── */}
            <div className="border-b border-white/8 bg-black/20 backdrop-blur-sm sticky top-0 z-20">
                <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
                    {/* Brand */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                            <Activity className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-white leading-none">On-Chain Tracker</h1>
                            <p className="text-[9px] text-white/30 mt-0.5">Live · BSC · ETH · Polygon</p>
                        </div>
                    </div>

                    {/* Stats bar */}
                    <div className="hidden md:flex items-center gap-4">
                        {[
                            { label: 'Ví theo dõi', value: wallets.length, color: 'text-white' },
                            { label: 'BUY (live)', value: totalBuys, color: 'text-emerald-400' },
                            { label: 'SELL (live)', value: totalSells, color: 'text-red-400' },
                            { label: 'Cảnh báo', value: unread, color: 'text-orange-400' },
                        ].map(({ label, value, color }) => (
                            <div key={label} className="text-center">
                                <p className={`text-base font-black ${color} leading-none`}>{value}</p>
                                <p className="text-[9px] text-white/25 mt-0.5">{label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowApiTips(v => !v)}
                            className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white border border-white/10 hover:border-white/20 px-2.5 py-1.5 rounded-lg transition-all"
                        >
                            <Settings2 className="w-3 h-3" /> API Keys
                        </button>
                        {unread > 0 && (
                            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                                <Bell className="w-3 h-3 text-red-400" />
                                <span className="text-[10px] font-bold text-red-400">{unread}</span>
                            </div>
                        )}
                        <Button
                            onClick={() => setAddOpen(true)}
                            size="sm"
                            className="bg-violet-600 hover:bg-violet-600/90 text-white text-xs h-8"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Thêm ví
                        </Button>
                    </div>
                </div>

                {/* API tips banner */}
                <AnimatePresence>
                    {showApiTips && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t border-white/8"
                        >
                            <div className="max-w-[1800px] mx-auto px-4 py-3">
                                <p className="text-[10px] text-white/40 mb-2 font-bold">
                                    💡 Web APIs ổn định để xem on-chain data — đăng ký key miễn phí:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {API_SUGGESTIONS.map(api => (
                                        <a key={api.name} href={api.url} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-all">
                                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: api.color }} />
                                            <div>
                                                <p className="text-[10px] font-bold text-white">{api.name}</p>
                                                <p className="text-[9px] text-white/30">{api.desc}</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                                <p className="text-[9px] text-white/20 mt-2">
                                    Thêm vào <code className="text-violet-400">.env.local</code>:
                                    {' '}<code className="text-yellow-400/70">NEXT_PUBLIC_BSCSCAN_KEYS=key1,key2,key3</code>
                                    {' — '}nhiều key sẽ rotate tự động, tránh rate limit
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Main layout ─────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden max-w-[1800px] mx-auto w-full">

                {/* ── LEFT SIDEBAR: Token Search + Info ── */}
                <div className="w-72 xl:w-80 flex-shrink-0 border-r border-white/8 flex flex-col overflow-hidden">
                    <ScrollArea className="flex-1">
                        <div className="p-3 space-y-3">
                            {/* Search */}
                            <div>
                                <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2">🔍 Tìm Token</p>
                                <TokenSearchPanel
                                    compact
                                    onSelectForWallet={handleSelectPair}
                                />
                            </div>

                            {/* Token Info Panel */}
                            {selectedPair && (
                                <div>
                                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2">📋 Token Info</p>
                                    <TokenInfoPanel
                                        tokenAddress={selectedPair.tokenAddress}
                                        tokenSymbol={selectedPair.tokenSymbol}
                                        chain={selectedPair.chain}
                                    />
                                </div>
                            )}

                            {/* No token selected placeholder */}
                            {!selectedPair && (
                                <div className="rounded-xl border border-dashed border-white/10 p-5 text-center space-y-2">
                                    <Activity className="w-7 h-7 text-white/15 mx-auto" />
                                    <p className="text-[10px] text-white/25">
                                        Tìm và chọn token để xem giao dịch live
                                    </p>
                                    <p className="text-[9px] text-white/15">
                                        Ví dụ: SIREN, CAKE, BNB…
                                    </p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* ── CENTER: Live TX Feed ── */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-white/8">
                    {/* Pair header */}
                    {selectedPair ? (
                        <div className="px-4 py-2.5 border-b border-white/8 flex items-center gap-3 flex-shrink-0 bg-white/[0.015]">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-white">
                                        {selectedPair.tokenSymbol}
                                        <span className="text-white/30 font-normal">/{selectedPair.quoteSymbol}</span>
                                    </span>
                                    <span
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                        style={{
                                            color: CHAIN_LABELS[selectedPair.chain].color,
                                            background: `${CHAIN_LABELS[selectedPair.chain].color}20`,
                                            border: `1px solid ${CHAIN_LABELS[selectedPair.chain].color}40`,
                                        }}
                                    >
                                        {selectedPair.chain}
                                    </span>
                                    <span className="flex items-center gap-1 text-[9px] text-emerald-400/80">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        LIVE
                                    </span>
                                </div>
                                <p className="text-[9px] font-mono text-white/20 mt-0.5">
                                    {selectedPair.pairAddress.slice(0, 10)}…{selectedPair.pairAddress.slice(-6)}
                                </p>
                            </div>
                            <div className="ml-auto flex gap-2 text-[10px]">
                                <div className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400 font-bold">
                                    {txHistory ? 0 : 0} BUY
                                </div>
                                <div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-red-400 font-bold">
                                    0 SELL
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="px-4 py-2.5 border-b border-white/8 flex items-center gap-2 flex-shrink-0">
                            <Zap className="w-3.5 h-3.5 text-white/20" />
                            <span className="text-xs text-white/25">Chọn token ở bên trái để xem giao dịch live</span>
                        </div>
                    )}

                    {/* Live TX Feed */}
                    <div className="flex-1 overflow-hidden">
                        {selectedPair ? (
                            <LiveTxFeed
                                chain={selectedPair.chain}
                                tokenAddress={selectedPair.tokenAddress}
                                pairAddress={selectedPair.pairAddress}
                                tokenSymbol={selectedPair.tokenSymbol}
                                quoteSymbol={selectedPair.quoteSymbol}
                                pollSeconds={8}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-white/15">
                                <Activity className="w-12 h-12 opacity-30" />
                                <div className="text-center">
                                    <p className="text-sm font-bold">Live Transaction Feed</p>
                                    <p className="text-xs mt-1">Date · Type · USD · Token · Quote · Price · Maker · TXN</p>
                                    <p className="text-xs mt-3 text-white/10">
                                        Tìm token → chọn pair → giao dịch cập nhật mỗi 8 giây
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT SIDEBAR: Wallet Watch + Alerts ── */}
                <div className="w-72 xl:w-80 flex-shrink-0 flex flex-col overflow-hidden">
                    <ScrollArea className="flex-1">
                        <div className="p-3 space-y-4">
                            {/* Wallet section */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider flex items-center gap-1.5">
                                        <Wallet2 className="w-3 h-3" /> Ví Theo Dõi ({wallets.length})
                                    </p>
                                    <button
                                        onClick={() => setAddOpen(true)}
                                        className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> Thêm
                                    </button>
                                </div>

                                {wallets.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-white/10 p-5 text-center space-y-2">
                                        <Fish className="w-6 h-6 text-white/20 mx-auto" />
                                        <p className="text-[10px] text-white/25">Chưa có ví nào</p>
                                        <button
                                            onClick={() => setAddOpen(true)}
                                            className="text-[10px] text-violet-400 hover:text-violet-300 border border-violet-400/20 px-3 py-1 rounded-lg"
                                        >
                                            + Thêm ví đầu tiên
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <AnimatePresence>
                                            {wallets.map(w => (
                                                <WalletWatchCard key={w.id} wallet={w} />
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>

                            {/* Alerts section */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider flex items-center gap-1.5">
                                        <Bell className="w-3 h-3" /> Cảnh Báo
                                        {unread > 0 && (
                                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-red-500 text-white">
                                                {unread}
                                            </span>
                                        )}
                                    </p>
                                    <div className="flex gap-1">
                                        <button onClick={markAllRead} className="text-[9px] text-white/25 hover:text-white/60 px-1.5 py-0.5 rounded hover:bg-white/5">
                                            Đọc hết
                                        </button>
                                        <button onClick={clearAlerts} className="text-[9px] text-red-400/40 hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-red-500/5">
                                            Xóa
                                        </button>
                                    </div>
                                </div>

                                {/* Filter chips */}
                                <div className="flex gap-1 mb-2 flex-wrap">
                                    {(['ALL', 'SELL', 'BUY'] as AlertFilter[]).map(f => {
                                        const count = f === 'ALL' ? alerts.length : alerts.filter(a => a.tx.type === f).length;
                                        return (
                                            <button key={f} onClick={() => setAlertFilter(f)}
                                                className={`text-[9px] px-2 py-0.5 rounded-full border font-bold transition-all ${alertFilter === f
                                                        ? f === 'SELL' ? 'bg-red-500/20 border-red-500/40 text-red-400'
                                                            : f === 'BUY' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                                                : 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                                                        : 'border-white/10 text-white/25 hover:text-white/50'
                                                    }`}>
                                                {f} ({count})
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                                    {filteredAlerts.length === 0 ? (
                                        <p className="text-center text-[10px] text-white/15 py-4">Không có cảnh báo</p>
                                    ) : filteredAlerts.slice(0, 30).map(alert => {
                                        const isSell = alert.tx.type === 'SELL';
                                        return (
                                            <div key={alert.id}
                                                className={`rounded-lg border p-2 text-[10px] ${alert.read ? 'border-white/8 opacity-50'
                                                        : isSell ? 'border-red-500/20 bg-red-500/5'
                                                            : 'border-emerald-500/15 bg-emerald-500/5'
                                                    }`}>
                                                <div className="flex items-start gap-1.5">
                                                    <AlertTriangle className={`w-3 h-3 flex-shrink-0 mt-0.5 ${isSell ? 'text-red-400' : 'text-emerald-400'}`} />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-bold text-white/70 truncate">{alert.walletLabel}</span>
                                                            {!alert.read && <span className="w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />}
                                                        </div>
                                                        <p className={`font-bold mt-0.5 ${isSell ? 'text-red-400' : 'text-emerald-400'}`}>
                                                            {alert.tx.type} {alert.tx.value}
                                                            {alert.tx.pool && <span className="text-orange-400 font-normal"> via {alert.tx.pool}</span>}
                                                        </p>
                                                        <p className="text-white/20 text-[9px] mt-0.5">
                                                            {relativeTime(alert.createdAt)} ago
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </div>
            </div>

            {/* ── Modals ── */}
            <AddWalletModal open={addOpen} onClose={() => setAddOpen(false)} />
            {detailWallet && (
                <WalletDetailModal wallet={detailWallet} onClose={() => setDetailWallet(null)} />
            )}
        </div>
    );
}
