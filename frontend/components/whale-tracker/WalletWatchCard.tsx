'use client';

import { useState } from 'react';
import { Trash2, RefreshCw, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useWhaleTrackerStore, CHAIN_LABELS, getBuySellCounts } from '@/store/whale-tracker-store';
import type { WatchedWallet } from '@/store/whale-tracker-store';
import { fetchAllWalletActivity, fetchWalletTxsByToken } from '@/lib/whale-api';
import { WalletDetailModal } from './WalletDetailModal';
import Link from 'next/link';

interface Props {
    wallet: WatchedWallet;
    compact?: boolean;
}

export function WalletWatchCard({ wallet, compact = false }: Props) {
    const { txHistory, isLoading, removeWallet, setTxHistory, setLoading, setLastFetched, lastFetched } = useWhaleTrackerStore();
    const [expanded, setExpanded] = useState(!compact);
    const [detailOpen, setDetailOpen] = useState(false);

    const txs = txHistory[wallet.id] || [];
    const loading = isLoading[wallet.id] || false;
    const chain = CHAIN_LABELS[wallet.chain];
    const lastFetch = lastFetched[wallet.id];

    const { buys, sells } = getBuySellCounts(txs);
    const hasSellAlert = sells > 0 && txs.slice(0, 3).some((t) => t.type === 'SELL');

    const refresh = async () => {
        setLoading(wallet.id, true);
        try {
            const data = wallet.tokenAddress
                ? await fetchWalletTxsByToken(wallet.address, wallet.chain, wallet.tokenAddress, 50)
                : await fetchAllWalletActivity(wallet.address, wallet.chain);
            setTxHistory(wallet.id, data);
            setLastFetched(wallet.id);
        } finally { setLoading(wallet.id, false); }
    };

    const addrShort = `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`;
    const explorerBase = wallet.chain === 'ETH' ? 'etherscan.io'
        : wallet.chain === 'POLYGON' ? 'polygonscan.com' : 'bscscan.com';

    return (
        <>
            <div className={`rounded-xl border transition-all ${hasSellAlert ? 'border-red-500/40 bg-red-500/5' : 'border-border bg-card/50'
                }`}>
                {/* ── Card header ───────────────────────── */}
                <div className="flex items-center gap-2 px-3 py-2.5">
                    {/* Status dot */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hasSellAlert ? 'bg-red-500 animate-pulse' : sells > 0 ? 'bg-orange-400' : 'bg-emerald-500'
                        }`} />

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-foreground truncate">{wallet.label}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border"
                                style={{ color: chain.color, borderColor: chain.color + '40', backgroundColor: chain.color + '15' }}>
                                {wallet.chain}
                            </span>
                            {wallet.tokenSymbol && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#8247e5]/15 border border-[#8247e5]/30 text-[#8247e5]">
                                    {wallet.tokenSymbol}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-muted-foreground font-mono">{addrShort}</span>
                            <a href={`https://${explorerBase}/address/${wallet.address}`} target="_blank" rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground transition-colors">
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                        {lastFetch && (
                            <span className="text-[10px] text-muted-foreground hidden sm:block">
                                {new Date(lastFetch).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                        <button onClick={refresh} disabled={loading}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors disabled:opacity-50">
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        {compact && (
                            <button onClick={() => setExpanded((v) => !v)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors">
                                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                        )}
                        <button onClick={() => removeWallet(wallet.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* ── BUY / SELL counter badges ──────────── */}
                {expanded && (
                    <div className="px-3 pb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* BUY badge */}
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-emerald-400 text-xs font-bold">{buys}</span>
                                <span className="text-emerald-400/70 text-xs">BUY</span>
                            </div>

                            {/* SELL badge */}
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${sells > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-accent/5 border-border'
                                }`}>
                                <div className={`w-2 h-2 rounded-full ${sells > 0 ? 'bg-red-500 animate-pulse' : 'bg-muted-foreground'}`} />
                                <span className={`text-xs font-bold ${sells > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{sells}</span>
                                <span className={`text-xs ${sells > 0 ? 'text-red-400/70' : 'text-muted-foreground/70'}`}>SELL</span>
                            </div>

                            {/* Sell alert */}
                            {hasSellAlert && (
                                <span className="text-xs text-red-400 font-semibold animate-pulse">🚨 Xả gần đây!</span>
                            )}

                            {/* No data yet */}
                            {txs.length === 0 && !loading && (
                                <span className="text-xs text-muted-foreground">Chưa có dữ liệu — nhấn refresh ↺</span>
                            )}
                            {loading && (
                                <span className="text-xs text-muted-foreground animate-pulse">Đang tải…</span>
                            )}

                            {/* Detail button */}
                            {txs.length > 0 && (
                                <button onClick={() => setDetailOpen(true)}
                                    className="ml-auto text-xs text-[#8247e5] hover:text-[#8247e5]/80 transition-colors font-semibold flex items-center gap-1">
                                    Xem chi tiết →
                                </button>
                            )}
                        </div>

                        {/* Latest SELL alert */}
                        {hasSellAlert && txs.slice(0, 3).filter(t => t.type === 'SELL').slice(0, 1).map(tx => (
                            <div key={tx.hash} className="mt-2 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5">
                                🚨
                                <span className="font-semibold">SELL {tx.value}</span>
                                {tx.pool && <span className="text-orange-400">via {tx.pool}</span>}
                                <span className="ml-auto text-red-400/60">{new Date(tx.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Bottom padding ──────────────────────── */}
                {expanded && <div className="pb-2" />}
            </div>

            <WalletDetailModal wallet={wallet} open={detailOpen} onClose={() => setDetailOpen(false)} />
        </>
    );
}
