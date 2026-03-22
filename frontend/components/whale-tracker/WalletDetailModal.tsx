'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useWhaleTrackerStore, CHAIN_LABELS, getBuySellCounts } from '@/store/whale-tracker-store';
import { fetchWalletTxsByToken, fetchAllWalletActivity } from '@/lib/whale-api';
import type { WatchedWallet, WhaleTx } from '@/store/whale-tracker-store';
import {
    ArrowUpRight, ArrowDownLeft, Repeat, ExternalLink,
    RefreshCw, TrendingDown, TrendingUp, Loader2,
} from 'lucide-react';

interface Props {
    wallet: WatchedWallet | null;
    open: boolean;
    onClose: () => void;
}

type TxFilter = 'ALL' | 'BUY' | 'SELL' | 'TRANSFER';

function relativeTime(ts: number): string {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(ts).toLocaleDateString('vi-VN');
}

function TxTableRow({ tx, explorerBase }: { tx: WhaleTx; explorerBase: string }) {
    const isBuy = tx.type === 'BUY';
    const isSell = tx.type === 'SELL';
    const typeColor = isBuy ? 'text-emerald-400' : isSell ? 'text-red-400' : 'text-muted-foreground';
    const typeBg = isBuy ? 'bg-emerald-500/10' : isSell ? 'bg-red-500/10' : 'bg-accent/10';
    const TxIcon = isBuy ? ArrowDownLeft : isSell ? ArrowUpRight : Repeat;

    return (
        <tr className="border-b border-border/50 hover:bg-accent/5 transition-colors group">
            {/* Date */}
            <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{relativeTime(tx.timestamp)}</td>

            {/* Type */}
            <td className="px-3 py-2">
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${typeBg} ${typeColor}`}>
                    <TxIcon className="w-3 h-3" />
                    {tx.type}
                </span>
            </td>

            {/* USD */}
            <td className="px-3 py-2 text-xs font-semibold text-foreground">
                {tx.valueUSD > 0 ? `$${tx.valueUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
            </td>

            {/* Token amount */}
            <td className={`px-3 py-2 text-xs font-mono font-semibold ${typeColor}`}>{tx.value}</td>

            {/* Pair token */}
            <td className="px-3 py-2 text-xs text-muted-foreground">
                {tx.pairTokenAmount ? `${tx.pairTokenAmount} ${tx.pairTokenSymbol}` : tx.pairTokenSymbol || '—'}
            </td>

            {/* Pool */}
            <td className="px-3 py-2 text-xs text-orange-400">{tx.pool || '—'}</td>

            {/* Maker (from addr) */}
            <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
                {tx.from ? `${tx.from.slice(0, 5)}…${tx.from.slice(-4)}` : '—'}
            </td>

            {/* TXN link */}
            <td className="px-3 py-2">
                <a href={`https://${explorerBase}/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-[#8247e5] transition-colors opacity-0 group-hover:opacity-100">
                    <ExternalLink className="w-3.5 h-3.5" />
                </a>
            </td>
        </tr>
    );
}

export function WalletDetailModal({ wallet, open, onClose }: Props) {
    const { txHistory, setTxHistory, setLoading, setLastFetched, isLoading } = useWhaleTrackerStore();
    const [filter, setFilter] = useState<TxFilter>('ALL');
    const [localTxs, setLocalTxs] = useState<WhaleTx[]>([]);

    const txs: WhaleTx[] = wallet ? (txHistory[wallet.id] || []) : [];
    const loading = wallet ? (isLoading[wallet.id] || false) : false;
    const { buys, sells, buyVolumeUSD, sellVolumeUSD } = getBuySellCounts(txs);

    const explorerBase = wallet?.chain === 'ETH' ? 'etherscan.io'
        : wallet?.chain === 'POLYGON' ? 'polygonscan.com'
            : 'bscscan.com';

    const chainLabel = wallet ? CHAIN_LABELS[wallet.chain] : null;

    // Fetch detail data when opening
    useEffect(() => {
        if (!open || !wallet) return;
        handleRefresh();
    }, [open, wallet?.id]); // eslint-disable-line

    const handleRefresh = async () => {
        if (!wallet) return;
        setLoading(wallet.id, true);
        try {
            let data: WhaleTx[];
            if (wallet.tokenAddress) {
                // Token-specific fetch — much more precise
                data = await fetchWalletTxsByToken(wallet.address, wallet.chain, wallet.tokenAddress, 50);
            } else {
                data = await fetchAllWalletActivity(wallet.address, wallet.chain);
            }
            setTxHistory(wallet.id, data);
            setLastFetched(wallet.id);
            setLocalTxs(data);
        } finally {
            setLoading(wallet.id, false);
        }
    };

    const displayTxs = (txs.length > 0 ? txs : localTxs).filter((tx) =>
        filter === 'ALL' ? true : tx.type === filter
    );

    if (!wallet) return null;

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-4xl w-full max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                {/* ── Header ──────────────────────────────────── */}
                <DialogHeader className="px-5 py-4 border-b border-border flex-shrink-0">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <DialogTitle className="flex items-center gap-2 text-base text-foreground">
                                🐋 {wallet.label}
                                {chainLabel && (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border"
                                        style={{ color: chainLabel.color, borderColor: chainLabel.color + '40', backgroundColor: chainLabel.color + '15' }}>
                                        {wallet.chain}
                                    </span>
                                )}
                                {wallet.tokenSymbol && (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#8247e5]/15 border border-[#8247e5]/30 text-[#8247e5]">
                                        {wallet.tokenSymbol}
                                    </span>
                                )}
                            </DialogTitle>
                            <p className="text-xs font-mono text-muted-foreground mt-1">{wallet.address}</p>
                        </div>
                        <button onClick={handleRefresh} disabled={loading}
                            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors disabled:opacity-50 flex-shrink-0">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 mt-3 flex-wrap">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-bold text-sm">{buys} BUY</span>
                            {buyVolumeUSD > 0 && <span className="text-emerald-400/70 text-xs">· ${(buyVolumeUSD / 1000).toFixed(1)}K</span>}
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20">
                            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                            <span className="text-red-400 font-bold text-sm">{sells} SELL</span>
                            {sellVolumeUSD > 0 && <span className="text-red-400/70 text-xs">· ${(sellVolumeUSD / 1000).toFixed(1)}K</span>}
                        </div>
                        <a href={`https://${explorerBase}/address/${wallet.address}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                            Xem trên Explorer <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>

                    {/* Filter chips */}
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                        {(['ALL', 'BUY', 'SELL', 'TRANSFER'] as TxFilter[]).map((f) => {
                            const count = f === 'ALL' ? txs.length : txs.filter((t) => t.type === f).length;
                            return (
                                <button key={f} onClick={() => setFilter(f)}
                                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${filter === f
                                            ? f === 'BUY' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                                : f === 'SELL' ? 'bg-red-500/20 border-red-500/50 text-red-400'
                                                    : 'bg-[#8247e5]/20 border-[#8247e5]/50 text-[#8247e5]'
                                            : 'border-border text-muted-foreground hover:border-border/80'
                                        }`}>
                                    {f === 'ALL' ? `Tất cả (${count})` : `${f} (${count})`}
                                </button>
                            );
                        })}
                    </div>
                </DialogHeader>

                {/* ── Table ───────────────────────────────────── */}
                <div className="flex-1 overflow-auto">
                    {loading && displayTxs.length === 0 ? (
                        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin" /> Đang tải lịch sử giao dịch…
                        </div>
                    ) : displayTxs.length === 0 ? (
                        <div className="text-center py-16 text-sm text-muted-foreground">
                            Không có giao dịch nào
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-background border-b border-border">
                                <tr>
                                    {['DATE', 'TYPE', 'USD', 'TOKEN', 'PAIR', 'POOL', 'MAKER', 'TXN'].map((col) => (
                                        <th key={col} className="px-3 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {displayTxs.map((tx) => (
                                    <TxTableRow key={tx.hash + tx.tokenSymbol} tx={tx} explorerBase={explorerBase} />
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
