'use client';

/**
 * WalletDetailModal v3 — DexScreener-style 8-col transaction table
 * Shows full on-chain tx history: DB history + live chain data combined
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, RefreshCw, Filter, TrendingUp, TrendingDown, ArrowRightLeft, ChevronDown } from 'lucide-react';
import type { WatchedWallet } from '@/store/whale-tracker-store';
import { CHAIN_LABELS } from '@/store/whale-tracker-store';
import { fetchWalletTxsByToken, fetchAllWalletActivity, getWalletHistory, getWalletStats, type WalletStats } from '@/lib/whale-api';
import type { WhaleTx } from '@/store/whale-tracker-store';

interface Props {
    wallet: WatchedWallet;
    onClose: () => void;
}

type FilterType = 'ALL' | 'BUY' | 'SELL' | 'TRANSFER';

const CHAIN_EXPLORERS: Record<string, string> = {
    BSC: 'https://bscscan.com/',
    ETH: 'https://etherscan.io/',
    POLYGON: 'https://polygonscan.com/',
};

function fmtUsd(n: number) {
    if (!n) return '$0';
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
}
function fmtAddr(a: string) { return `${a.slice(0, 6)}…${a.slice(-4)}`; }
function fmtAge(ts: number) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
}
function TxTypeBadge({ type }: { type: string }) {
    const s = {
        BUY: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        SELL: 'bg-red-500/15 text-red-400 border-red-500/30',
        TRANSFER: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    }[type] ?? 'bg-white/10 text-white/40';
    return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${s}`}>{type}</span>;
}

export function WalletDetailModal({ wallet, onClose }: Props) {
    const [liveTxs, setLiveTxs] = useState<WhaleTx[]>([]);
    const [dbTxs, setDbTxs] = useState<any[]>([]);
    const [stats, setStats] = useState<WalletStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<FilterType>('ALL');
    const [source, setSource] = useState<'live' | 'db'>('live');
    const chainInfo = CHAIN_LABELS[wallet.chain];
    const explorer = CHAIN_EXPLORERS[wallet.chain] || '';

    const loadLive = useCallback(async () => {
        setLoading(true);
        try {
            let txs: WhaleTx[];
            if (wallet.tokenAddress) {
                txs = await fetchWalletTxsByToken(wallet.address, wallet.chain, wallet.tokenAddress, 50);
            } else {
                txs = await fetchAllWalletActivity(wallet.address, wallet.chain);
            }
            setLiveTxs(txs);
        } finally {
            setLoading(false);
        }
    }, [wallet]);

    const loadDb = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await getWalletHistory(
                wallet.address, wallet.chain,
                wallet.tokenAddress || 'native', 100
            );
            setDbTxs(rows);
        } finally {
            setLoading(false);
        }
    }, [wallet]);

    useEffect(() => {
        loadLive();
        getWalletStats(wallet.address, wallet.chain, wallet.tokenAddress || 'native').then(setStats);
    }, [wallet, loadLive]);

    // Merge display rows
    const rawRows = source === 'live' ? liveTxs : dbTxs.map(r => ({
        hash: r.tx_hash, from: wallet.address, to: '',
        value: `${r.amount_token ?? '—'} ${r.token_symbol || ''}`,
        valueUSD: parseFloat(r.amount_usd) || 0,
        tokenSymbol: r.token_symbol,
        type: r.tx_type as any,
        timestamp: r.tx_timestamp ? new Date(r.tx_timestamp).getTime() : 0,
        pool: r.dex_name, direction: 'OUT' as any,
        blockNumber: r.block_number, whaleSize: 'medium' as any,
    }));

    const displayRows = filter === 'ALL' ? rawRows : rawRows.filter(r => r.type === filter);

    const totalBuy = stats?.buy_count ?? 0;
    const totalSell = stats?.sell_count ?? 0;
    const buyVol = stats?.buy_volume_usd ?? 0;
    const sellVol = stats?.sell_volume_usd ?? 0;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border border-white/10 bg-[#0c0c18]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                        <div className="flex items-center gap-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-white">{wallet.label || fmtAddr(wallet.address)}</span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                        style={{ color: chainInfo.color, background: `${chainInfo.color}20`, border: `1px solid ${chainInfo.color}40` }}>
                                        {wallet.chain}
                                    </span>
                                    {wallet.tokenSymbol && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-violet-400 bg-violet-400/10 border border-violet-400/20">
                                            {wallet.tokenSymbol}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] font-mono text-white/30 mt-0.5">{wallet.address}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={source === 'live' ? loadLive : loadDb} disabled={loading}
                                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-all">
                                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                            <button onClick={onClose} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/10">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Stats summary */}
                    <div className="grid grid-cols-4 divide-x divide-white/8 border-b border-white/8">
                        {[
                            { label: 'Tổng BUY', value: totalBuy, color: 'text-emerald-400', sub: buyVol > 0 ? fmtUsd(buyVol) : undefined },
                            { label: 'Tổng SELL', value: totalSell, color: 'text-red-400', sub: sellVol > 0 ? fmtUsd(sellVol) : undefined },
                            { label: 'Tổng TX hiển thị', value: displayRows.length, color: 'text-white', sub: filter !== 'ALL' ? `filter: ${filter}` : undefined },
                            { label: 'Sell pressure', value: totalBuy + totalSell > 0 ? `${Math.round(totalSell / (totalBuy + totalSell) * 100)}%` : '—', color: totalSell > totalBuy ? 'text-red-400' : 'text-emerald-400' },
                        ].map(({ label, value, color, sub }) => (
                            <div key={label} className="px-4 py-3 text-center">
                                <p className="text-[9px] text-white/30 mb-0.5">{label}</p>
                                <p className={`text-xl font-black ${color}`}>{value}</p>
                                {sub && <p className="text-[9px] text-white/20">{sub}</p>}
                            </div>
                        ))}
                    </div>

                    {/* Filter + source tabs */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-white/8 bg-white/[0.01]">
                        <div className="flex gap-1">
                            {(['ALL', 'BUY', 'SELL', 'TRANSFER'] as FilterType[]).map(f => (
                                <button key={f} onClick={() => setFilter(f)}
                                    className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all ${filter === f
                                            ? f === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                : f === 'SELL' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                    : f === 'TRANSFER' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                        : 'bg-white/10 text-white border border-white/20'
                                            : 'text-white/30 hover:text-white'
                                        }`}>
                                    {f === 'BUY' ? `🟢 ${f}` : f === 'SELL' ? `🔴 ${f}` : f === 'TRANSFER' ? `💜 ${f}` : f}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-1">
                            {(['live', 'db'] as const).map(s => (
                                <button key={s} onClick={() => { setSource(s); s === 'db' ? loadDb() : loadLive(); }}
                                    className={`text-[10px] px-2.5 py-1 rounded-md font-bold transition-all ${source === s ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-white/30 hover:text-white'
                                        }`}>
                                    {s === 'live' ? '⚡ Live chain' : '🗃️ Lịch sử DB'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-y-auto">
                        {/* Column headers */}
                        <div className="sticky top-0 grid grid-cols-[70px_50px_80px_120px_80px_80px_100px_50px] gap-2 px-4 py-2 bg-[#0c0c18]/90 border-b border-white/8 text-[9px] font-bold text-white/30 uppercase tracking-wider">
                            <span>DATE</span><span>TYPE</span><span>USD</span>
                            <span>AMOUNT</span><span>TOKEN</span><span>DEX</span>
                            <span>WALLET</span><span className="text-right">TXN</span>
                        </div>

                        {loading && displayRows.length === 0 ? (
                            <div className="flex items-center justify-center py-12 text-white/20 text-sm">
                                <RefreshCw className="w-4 h-4 animate-spin mr-2" />Loading…
                            </div>
                        ) : displayRows.length === 0 ? (
                            <div className="flex items-center justify-center py-12 text-white/20 text-sm">Không có giao dịch</div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {displayRows.map((tx, i) => (
                                    <motion.div
                                        key={tx.hash + i}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: Math.min(i * 0.02, 0.3) }}
                                        className="grid grid-cols-[70px_50px_80px_120px_80px_80px_100px_50px] gap-2 px-4 py-2 hover:bg-white/[0.02] transition-colors items-center"
                                    >
                                        {/* DATE */}
                                        <span className="text-[10px] text-white/40 font-mono">{fmtAge(tx.timestamp)}</span>

                                        {/* TYPE */}
                                        <TxTypeBadge type={tx.type} />

                                        {/* USD */}
                                        <span className={`text-xs font-bold ${tx.type === 'BUY' ? 'text-emerald-400' : tx.type === 'SELL' ? 'text-red-400' : 'text-white/60'
                                            }`}>
                                            {tx.valueUSD > 0 ? fmtUsd(tx.valueUSD) : '—'}
                                        </span>

                                        {/* AMOUNT */}
                                        <span className="text-[10px] text-white/70 font-mono truncate">{tx.value}</span>

                                        {/* TOKEN */}
                                        <span className="text-[10px] font-bold text-violet-300">{tx.tokenSymbol || '—'}</span>

                                        {/* DEX */}
                                        <span className="text-[9px] text-white/30 truncate">{tx.pool || '—'}</span>

                                        {/* WALLET */}
                                        <span className="text-[10px] font-mono text-white/30">
                                            {fmtAddr(tx.type === 'BUY' ? (tx.from || '') : (tx.to || ''))}
                                        </span>

                                        {/* TXN link */}
                                        <div className="flex justify-end">
                                            <a href={`${explorer}tx/${tx.hash}`} target="_blank" rel="noopener noreferrer"
                                                className="text-white/20 hover:text-violet-400 transition-colors">
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 border-t border-white/8 flex items-center justify-between">
                        <p className="text-[10px] text-white/20">
                            {displayRows.length} giao dịch · {source === 'live' ? '⚡ Từ blockchain' : '🗃️ Từ DB'}
                        </p>
                        <a href={`${explorer}address/${wallet.address}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />Xem trên Explorer
                        </a>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
