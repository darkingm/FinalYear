'use client';

/**
 * LiveTxFeed.tsx v2 — Real-time DexScreener-style transaction table
 *
 * Data source priority:
 *  1. TheGraph subgraph  (PancakeSwap/Uniswap GraphQL, <300ms response)
 *  2. BSCScan tokentx API (fallback, 1-2s)
 *
 * Stats header: DexScreener /pairs API (300 req/min) → price, vol 1h/24h, buys/sells
 * Polling: TX every 5s, Stats every 10s
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, ExternalLink, Wifi, WifiOff, TrendingUp, TrendingDown, Droplets } from 'lucide-react';
import {
    fetchPairTxs, fetchPairStats, mergeTxs,
    CHAIN_EXPLORERS, fmtTxAge, fmtUsd, fmtToken, fmtAddr,
    type PairTx, type PairStats,
} from '@/lib/pair-tx-fetcher';
import type { SupportedChain } from '@/store/whale-tracker-store';

type FilterKind = 'ALL' | 'BUY' | 'SELL';
const NEW_HASH_TTL = 3_000;

interface Props {
    chain: SupportedChain;
    tokenAddress: string;
    pairAddress: string;
    tokenSymbol: string;
    quoteSymbol?: string;
    pollSeconds?: number;
}

function fmt(n: number) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
}

function PctBadge({ v }: { v: number }) {
    const up = v >= 0;
    return (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${up ? 'text-emerald-400' : 'text-red-400'}`}>
            {up ? '▲' : '▼'}{Math.abs(v).toFixed(2)}%
        </span>
    );
}

export function LiveTxFeed({ chain, tokenAddress, pairAddress, tokenSymbol, quoteSymbol = 'WBNB', pollSeconds = 3 }: Props) {
    const [txs, setTxs] = useState<PairTx[]>([]);
    const [stats, setStats] = useState<PairStats | null>(null);
    const [newHashes, setNewHashes] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState<FilterKind>('ALL');
    const [loading, setLoading] = useState(false);
    const [live, setLive] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<number | null>(null);
    const [source, setSource] = useState<'subgraph' | 'bscscan' | null>(null);
    const txsRef = useRef<PairTx[]>([]);
    txsRef.current = txs;
    const explorer = CHAIN_EXPLORERS[chain];

    /* ── Fetch transactions ── */
    const refreshTxs = useCallback(async (initial = false) => {
        if (!tokenAddress || !pairAddress) return;
        if (initial) setLoading(true);
        try {
            const sinceTs = txsRef.current.length > 0 && !initial ? txsRef.current[0].timestamp : 0;
            const incoming = await fetchPairTxs(chain, tokenAddress, pairAddress, initial ? 50 : 20, 0); // always fetch latest
            if (incoming.length > 0) {
                const merged = initial ? incoming : mergeTxs(txsRef.current, incoming, 500);
                setTxs(merged);
                if (!initial && incoming.length > 0) {
                    const incomingHashes = new Set(incoming.map(t => t.hash));
                    setNewHashes(incomingHashes);
                    setTimeout(() => setNewHashes(new Set()), NEW_HASH_TTL);
                }
                setSource(incoming[0]?.source || null);
            }
            setLastUpdate(Date.now());
        } finally {
            setLoading(false);
        }
    }, [chain, tokenAddress, pairAddress]);

    /* ── Fetch pair stats (price, vol) ── */
    const refreshStats = useCallback(async () => {
        if (!pairAddress) return;
        const s = await fetchPairStats(chain, pairAddress);
        if (s) setStats(s);
    }, [chain, pairAddress]);

    /* ── Init ── */
    useEffect(() => {
        setTxs([]); setStats(null); setSource(null); setLastUpdate(null);
        refreshTxs(true);
        refreshStats();
    }, [chain, tokenAddress, pairAddress, refreshTxs, refreshStats]);

    /* ── Polling ── */
    useEffect(() => {
        if (!live) return;
        const txInterval = setInterval(() => refreshTxs(false), pollSeconds * 1_000);
        const statInterval = setInterval(refreshStats, 10_000);
        return () => { clearInterval(txInterval); clearInterval(statInterval); };
    }, [live, pollSeconds, refreshTxs, refreshStats]);

    /* ── Filtered rows ── */
    const rows = filter === 'ALL' ? txs : txs.filter(t => t.kind === filter);
    const buyCount = txs.filter(t => t.kind === 'BUY').length;
    const sellCount = txs.filter(t => t.kind === 'SELL').length;
    const priceNum = parseFloat(stats?.priceUsd || '0');
    const priceStr = priceNum > 0
        ? priceNum < 0.0001 ? `$${priceNum.toFixed(8)}`
            : priceNum < 1 ? `$${priceNum.toFixed(5)}`
                : `$${priceNum.toFixed(4)}`
        : '—';

    const detectedQuote = (txs.length > 0 ? txs[0].quoteSymbol : null) || stats?.quoteToken.symbol || quoteSymbol;
    const detectedToken = (txs.length > 0 ? txs[0].tokenSymbol : null) || stats?.baseToken.symbol || tokenSymbol;

    return (
        <div className="flex flex-col h-full min-h-0 select-none">
            {/* ── Stats Header (DexScreener-style) ── */}
            <div className="px-3 py-2 border-b border-white/8 bg-white/[0.01] flex-shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Price */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-base font-black text-white">{priceStr}</span>
                        {stats && <PctBadge v={stats.priceChange.h1} />}
                        <span className="text-[9px] text-white/25">1h</span>
                        {stats && <PctBadge v={stats.priceChange.h24} />}
                        <span className="text-[9px] text-white/25">24h</span>
                    </div>

                    <div className="flex-1" />

                    {/* Stats grid */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {[
                            { label: 'Liq', value: stats ? fmt(stats.liquidity) : '—' },
                            { label: 'Vol 1h', value: stats ? fmt(stats.volume.h1) : '—' },
                            { label: 'Vol 24h', value: stats ? fmt(stats.volume.h24) : '—' },
                            { label: 'Buys 1h', value: stats ? String(stats.txns.h1.buys) : '—', color: 'text-emerald-400' },
                            { label: 'Sells 1h', value: stats ? String(stats.txns.h1.sells) : '—', color: 'text-red-400' },
                        ].map(({ label, value, color }) => (
                            <div key={label} className="text-center">
                                <p className={`text-[10px] font-black ${color || 'text-white/70'}`}>{value}</p>
                                <p className="text-[8px] text-white/25">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Source indicator */}
                {source && (
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${source === 'subgraph' ? 'bg-violet-500/15 text-violet-400' : 'bg-yellow-500/15 text-yellow-400'}`}>
                            {source === 'subgraph' ? '⚡ TheGraph' : '📡 BSCScan'}
                        </span>
                        {lastUpdate && (
                            <span className="text-[8px] text-white/15">{fmtTxAge(lastUpdate)} ago</span>
                        )}
                        {stats && (
                            <span className="text-[8px] text-white/15">{stats.dexId}</span>
                        )}
                    </div>
                )}
            </div>

            {/* ── Toolbar ── */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/8 flex-shrink-0">
                {/* Filter chips */}
                <div className="flex items-center gap-1">
                    {([
                        { key: 'ALL' as FilterKind, label: 'Tất cả', count: txs.length },
                        { key: 'BUY' as FilterKind, label: 'BUY', count: buyCount },
                        { key: 'SELL' as FilterKind, label: 'SELL', count: sellCount },
                    ]).map(({ key, label, count }) => (
                        <button key={key} onClick={() => setFilter(key)}
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-md border transition-all ${filter === key
                                ? key === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                    : key === 'SELL' ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                        : 'bg-violet-500/20 text-violet-400 border-violet-500/30'
                                : 'text-white/30 border-transparent hover:text-white/60'
                                }`}>
                            {label} <span className="opacity-50">({count})</span>
                        </button>
                    ))}
                </div>
                {/* Controls */}
                <div className="flex items-center gap-1.5">
                    <button onClick={() => setLive(l => !l)}
                        className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-md border font-bold transition-all ${live ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'border-white/10 text-white/30'
                            }`}>
                        {live ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                        {live ? `${pollSeconds}s` : 'OFF'}
                    </button>
                    <button onClick={() => { refreshTxs(true); refreshStats(); }} disabled={loading}
                        className="p-1 rounded-md text-white/25 hover:text-white transition-colors">
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* ── Column headers ── */}
            <div className="grid gap-1 px-3 py-1 bg-white/[0.01] border-b border-white/8 text-[8px] font-bold text-white/20 uppercase tracking-wider flex-shrink-0"
                style={{ gridTemplateColumns: '56px 36px 72px 96px 80px 72px 52px 24px' }}>
                <span>DATE</span><span>TYPE</span>
                <span className="text-right">USD</span>
                <span className="text-right">{detectedToken}</span>
                <span className="text-right">{detectedQuote}</span>
                <span className="text-right">PRICE</span>
                <span>MAKER</span>
                <span />
            </div>

            {/* ── Rows ── */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-white/20 text-xs gap-2">
                        {loading
                            ? <><RefreshCw className="w-4 h-4 animate-spin" /><span>Đang tải dữ liệu từ blockchain…</span></>
                            : !pairAddress
                                ? <span>Chọn token / pool để bắt đầu</span>
                                : <><span>Không có giao dịch</span><span className="text-[10px] text-white/10">Thử pool khác hoặc chờ TX mới</span></>
                        }
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {rows.map((tx) => {
                            const isNew = newHashes.has(tx.hash);
                            const isBuy = tx.kind === 'BUY';
                            const isSell = tx.kind === 'SELL';
                            const p = tx.priceUsd;
                            const priceStr = p > 0
                                ? p < 0.0001 ? `$${p.toFixed(8)}`
                                    : p < 1 ? `$${p.toFixed(5)}`
                                        : `$${p.toFixed(4)}`
                                : '—';

                            return (
                                <motion.div
                                    key={tx.hash + tx.tokenAmount + tx.timestamp}
                                    initial={{ opacity: 0, backgroundColor: isBuy ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)' }}
                                    animate={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0)' }}
                                    transition={{ duration: 0.6 }}
                                    className={`grid gap-1 px-3 py-[4px] items-center border-b border-white/[0.03] hover:bg-white/[0.025] transition-colors group ${isNew ? (isBuy ? 'bg-emerald-500/5' : 'bg-red-500/5') : ''
                                        }`}
                                    style={{ gridTemplateColumns: '56px 36px 72px 96px 80px 72px 52px 24px' }}
                                >
                                    <span className="text-[9px] font-mono text-white/30">{fmtTxAge(tx.timestamp)}</span>
                                    <span className={`text-[10px] font-black ${isBuy ? 'text-emerald-400' : isSell ? 'text-red-400' : 'text-blue-400'}`}>
                                        {isBuy ? 'Buy' : isSell ? 'Sell' : 'Xfer'}
                                    </span>
                                    <span className={`text-[10px] font-bold text-right ${isBuy ? 'text-emerald-400' : isSell ? 'text-red-400' : 'text-white/50'}`}>
                                        {tx.amountUsd > 0 ? fmtUsd(tx.amountUsd) : '—'}
                                    </span>
                                    <span className="text-[10px] text-white/65 font-mono text-right">{fmtToken(tx.tokenAmount)}</span>
                                    <span className="text-[10px] text-white/40 font-mono text-right">
                                        {tx.quoteAmount > 0 ? tx.quoteAmount.toFixed(4) : '—'}
                                    </span>
                                    <span className="text-[10px] text-white/50 text-right font-mono">{priceStr}</span>
                                    <span className="text-[9px] font-mono text-white/30 group-hover:text-white/60 transition-colors">
                                        {fmtAddr(tx.makerAddress)}
                                    </span>
                                    <a href={`${explorer}${tx.hash}`} target="_blank" rel="noopener noreferrer"
                                        onClick={e => e.stopPropagation()}
                                        className="text-white/20 hover:text-violet-400 transition-colors flex justify-end">
                                        <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>

            {/* Footer */}
            <div className="px-3 py-1 border-t border-white/8 flex items-center justify-between flex-shrink-0">
                <span className="text-[8px] text-white/15">{rows.length} txs · {source === 'subgraph' ? 'TheGraph' : 'BSCScan'}</span>
                <span className="text-[8px] font-mono text-white/10">
                    {pairAddress ? `${pairAddress.slice(0, 6)}…${pairAddress.slice(-4)}` : '—'}
                </span>
            </div>
        </div>
    );
}
