'use client';

/**
 * WalletWatchCard v3 — Persistent BUY/SELL counters from backend DB
 * Polls /api/onchain/wallet/:addr/stats every 15s
 * Auto-records new txs to backend for persistence
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X, Eye, AlertTriangle, TrendingDown, Activity } from 'lucide-react';
import type { WatchedWallet } from '@/store/whale-tracker-store';
import { useWhaleTrackerStore, CHAIN_LABELS } from '@/store/whale-tracker-store';
import { fetchAllWalletActivity, fetchWalletTxsByToken, getWalletStats, recordTx, type WalletStats } from '@/lib/whale-api';
import type { WhaleTx } from '@/store/whale-tracker-store';
import { WalletDetailModal } from './WalletDetailModal';

interface Props {
    wallet: WatchedWallet;
    compact?: boolean;  // accepted for backward compat (v2 callers), unused in v3
}

function fmtUsd(n: number) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
}
function fmtAddr(a: string) { return `${a.slice(0, 6)}…${a.slice(-4)}`; }
function fmtTime(ts: number) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
}

export function WalletWatchCard({ wallet }: Props) {
    const { removeWallet, setTxHistory } = useWhaleTrackerStore();

    const [stats, setStats] = useState<WalletStats | null>(null);
    const [recentTxs, setRecentTxs] = useState<WhaleTx[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [sellFlash, setSellFlash] = useState(false);
    const prevSellRef = useRef(0);

    const chainInfo = CHAIN_LABELS[wallet.chain];

    // Poll backend stats every 15s
    const refreshStats = useCallback(async () => {
        const token = wallet.tokenAddress || 'native';
        const s = await getWalletStats(wallet.address, wallet.chain, token);
        setStats(s);
        // Flash if sell count increased
        if (s.sell_count > prevSellRef.current && prevSellRef.current > 0) {
            setSellFlash(true);
            setTimeout(() => setSellFlash(false), 2000);
        }
        prevSellRef.current = s.sell_count;
    }, [wallet.address, wallet.chain, wallet.tokenAddress]);

    // Fetch on-chain txs and POST new ones to backend
    const refreshTxs = useCallback(async () => {
        setLoading(true);
        try {
            let txs: WhaleTx[];
            if (wallet.tokenAddress) {
                txs = await fetchWalletTxsByToken(wallet.address, wallet.chain, wallet.tokenAddress, 20);
            } else {
                txs = await fetchAllWalletActivity(wallet.address, wallet.chain);
            }

            setRecentTxs(txs.slice(0, 5));
            setTxHistory(wallet.id, txs);

            setLastRefresh(new Date());

            // Persist new txs to backend (non-blocking, idempotent)
            for (const tx of txs.slice(0, 10)) {
                if (tx.type === 'BUY' || tx.type === 'SELL' || tx.type === 'TRANSFER') {
                    recordTx({
                        walletAddress: wallet.address,
                        chain: wallet.chain,
                        txHash: tx.hash,
                        tokenAddress: tx.tokenAddress || wallet.tokenAddress || 'native',
                        tokenSymbol: tx.tokenSymbol,
                        txType: tx.type,
                        amountUsd: tx.valueUSD,
                        dexName: tx.pool,
                        blockNumber: Number(tx.blockNumber),
                        txTimestamp: tx.timestamp,
                    }).catch(() => {/* non-critical */ });
                }
            }
        } finally {
            setLoading(false);
        }
    }, [wallet, setTxHistory]);


    useEffect(() => {
        refreshStats();
        refreshTxs();
        const statPoll = setInterval(refreshStats, 15_000);
        const txPoll = setInterval(refreshTxs, 30_000);
        return () => { clearInterval(statPoll); clearInterval(txPoll); };
    }, [refreshStats, refreshTxs]);

    const buyCount = stats?.buy_count ?? 0;
    const sellCount = stats?.sell_count ?? 0;
    const buyVol = stats?.buy_volume_usd ?? 0;
    const sellVol = stats?.sell_volume_usd ?? 0;
    const hasSellActivity = sellCount > 0;
    const recentSell = recentTxs.find(t => t.type === 'SELL');

    return (
        <>
            <motion.div
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`relative rounded-xl border overflow-hidden transition-all ${sellFlash
                    ? 'border-red-500/50 bg-red-500/5 shadow-red-500/10 shadow-lg'
                    : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
                    }`}
            >
                {/* Header row */}
                <div className="flex items-center justify-between px-3 pt-3 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                        {/* Chain badge */}
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                            style={{ color: chainInfo.color, borderColor: `${chainInfo.color}40`, background: `${chainInfo.color}15` }}>
                            {wallet.chain}
                        </span>
                        {/* Token badge */}
                        {wallet.tokenSymbol && (
                            <span className="text-[10px] font-bold text-violet-400 bg-violet-400/10 border border-violet-400/20 px-1.5 py-0.5 rounded">
                                {wallet.tokenSymbol}
                            </span>
                        )}
                        {/* Label */}
                        <span className="text-xs font-bold text-white/80 truncate">{wallet.label || fmtAddr(wallet.address)}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={refreshTxs} disabled={loading}
                            className="p-1 rounded text-white/30 hover:text-white transition-colors">
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={() => removeWallet(wallet.id)}
                            className="p-1 rounded text-white/30 hover:text-red-400 transition-colors">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Wallet address */}
                <div className="px-3 pb-2">
                    <p className="text-[10px] font-mono text-white/30">{fmtAddr(wallet.address)}</p>
                </div>

                {/* BUY / SELL counters */}
                <div className="grid grid-cols-2 gap-2 px-3 pb-2">
                    {/* BUY */}
                    <div className="flex flex-col items-center py-2.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                            <span className="text-xs font-black text-emerald-400">BUY</span>
                        </div>
                        <motion.p
                            key={buyCount}
                            initial={{ scale: 1.3, color: '#34d399' }}
                            animate={{ scale: 1, color: '#fff' }}
                            className="text-2xl font-black text-white leading-none"
                        >
                            {buyCount}
                        </motion.p>
                        {buyVol > 0 && (
                            <p className="text-[9px] text-emerald-400/60 mt-0.5">{fmtUsd(buyVol)}</p>
                        )}
                    </div>

                    {/* SELL */}
                    <div className={`flex flex-col items-center py-2.5 rounded-lg border transition-all ${hasSellActivity ? 'bg-red-500/8 border-red-500/20' : 'bg-white/[0.02] border-white/10'
                        }`}>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full ${hasSellActivity ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/50' : 'bg-white/20'}`} />
                            <span className={`text-xs font-black ${hasSellActivity ? 'text-red-400' : 'text-white/30'}`}>SELL</span>
                        </div>
                        <motion.p
                            key={sellCount}
                            initial={{ scale: 1.3, color: '#f87171' }}
                            animate={{ scale: 1, color: sellCount > 0 ? '#f87171' : 'rgba(255,255,255,0.4)' }}
                            className="text-2xl font-black leading-none"
                        >
                            {sellCount}
                        </motion.p>
                        {sellVol > 0 && (
                            <p className="text-[9px] text-red-400/60 mt-0.5">{fmtUsd(sellVol)}</p>
                        )}
                    </div>
                </div>

                {/* Sell alert banner */}
                <AnimatePresence>
                    {recentSell && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="mx-3 mb-2 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                                <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                                <p className="text-[10px] text-red-300">
                                    Xả gần đây — {fmtTime(recentSell.timestamp)}
                                    {recentSell.valueUSD > 0 && ` · ${fmtUsd(recentSell.valueUSD)}`}
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Mini TX feed */}
                {recentTxs.length > 0 && (
                    <div className="mx-3 mb-2 space-y-0.5">
                        {recentTxs.slice(0, 3).map(tx => (
                            <div key={tx.hash} className="flex items-center justify-between text-[9px] py-0.5">
                                <span className={`font-bold px-1 py-0.5 rounded ${tx.type === 'BUY' ? 'text-emerald-400 bg-emerald-400/10'
                                    : tx.type === 'SELL' ? 'text-red-400 bg-red-400/10'
                                        : 'text-blue-400 bg-blue-400/10'
                                    }`}>{tx.type}</span>
                                <span className="text-white/40 font-mono truncate mx-1">{tx.value}</span>
                                <span className="text-white/20">{fmtTime(tx.timestamp)}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between px-3 pb-3 pt-1">
                    {lastRefresh && (
                        <p className="text-[9px] text-white/20">{fmtTime(lastRefresh.getTime())}</p>
                    )}
                    <button
                        onClick={() => setDetailOpen(true)}
                        className="ml-auto flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 transition-colors font-bold"
                    >
                        <Eye className="w-3 h-3" />
                        Xem chi tiết →
                    </button>
                </div>
            </motion.div>

            {detailOpen && (
                <WalletDetailModal
                    wallet={wallet}
                    onClose={() => setDetailOpen(false)}
                />
            )}
        </>
    );
}
