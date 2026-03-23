'use client';

/**
 * LiveTxFeed.tsx — DexScreener-style live transaction table
 *
 * Columns: DATE · TYPE · USD · TOKEN · QUOTE · PRICE · MAKER · TXN
 * Polls every 8 seconds for new transactions on a DEX pair.
 * Classifies each transfer as BUY (pair→trader) or SELL (trader→pair).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, ExternalLink, Wifi, WifiOff, Filter, ChevronDown } from 'lucide-react';
import {
    fetchPairTxs, mergeTxs, CHAIN_EXPLORERS, fmtTxAge, fmtUsd, fmtToken, fmtAddr,
    type PairTx,
} from '@/lib/pair-tx-fetcher';
import type { SupportedChain } from '@/store/whale-tracker-store';

type FilterKind = 'ALL' | 'BUY' | 'SELL';

interface Props {
    chain: SupportedChain;
    tokenAddress: string;
    pairAddress: string;
    tokenSymbol: string;
    quoteSymbol?: string;
    pollSeconds?: number;
}

/* ── Flash new rows for 3 seconds ── */
const NEW_HASH_TTL = 3_000;

export function LiveTxFeed({
    chain,
    tokenAddress,
    pairAddress,
    tokenSymbol,
    quoteSymbol = 'WBNB',
    pollSeconds = 8,
}: Props) {
    const [txs, setTxs] = useState<PairTx[]>([]);
    const [newHashes, setNewHashes] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState<FilterKind>('ALL');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [live, setLive] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<number | null>(null);
    const [pollCount, setPollCount] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const txsRef = useRef<PairTx[]>([]);
    txsRef.current = txs;

    const explorer = CHAIN_EXPLORERS[chain];

    /* ── Fetch + merge ── */
    const refresh = useCallback(async (initial = false) => {
        if (!tokenAddress || !pairAddress) return;
        if (!initial) setLoading(true);
        try {
            const sinceTs = txsRef.current.length > 0 && !initial
                ? txsRef.current[0].timestamp
                : 0;
            const incoming = await fetchPairTxs(chain, tokenAddress, pairAddress, initial ? 50 : 20, sinceTs);
            if (incoming.length > 0) {
                const merged = mergeTxs(txsRef.current, incoming, 500);
                setTxs(merged);
                // Mark new ones for highlight flash
                const incomingHashes = new Set(incoming.map(t => t.hash));
                setNewHashes(incomingHashes);
                setTimeout(() => setNewHashes(new Set()), NEW_HASH_TTL);
            }
            setLastUpdate(Date.now());
            setError(null);
            setPollCount(c => c + 1);
        } catch (err: any) {
            setError(err?.message || 'Fetch failed');
        } finally {
            setLoading(false);
        }
    }, [chain, tokenAddress, pairAddress]);

    /* ── Initial load ── */
    useEffect(() => {
        setTxs([]);
        refresh(true);
    }, [chain, tokenAddress, pairAddress, refresh]);

    /* ── Polling ── */
    useEffect(() => {
        if (!live) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }
        intervalRef.current = setInterval(() => refresh(false), pollSeconds * 1_000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [live, pollSeconds, refresh]);

    /* ── Filtered rows ── */
    const rows = filter === 'ALL' ? txs : txs.filter(t => t.kind === filter);
    const buyCount = txs.filter(t => t.kind === 'BUY').length;
    const sellCount = txs.filter(t => t.kind === 'SELL').length;

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* ── Toolbar ── */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/8 flex-shrink-0 flex-wrap gap-2">
                {/* Filter chips */}
                <div className="flex items-center gap-1">
                    {([
                        { key: 'ALL', label: `Tất cả`, count: txs.length },
                        { key: 'BUY', label: 'BUY', count: buyCount },
                        { key: 'SELL', label: 'SELL', count: sellCount },
                    ] as { key: FilterKind; label: string; count: number }[]).map(({ key, label, count }) => (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-md border transition-all ${filter === key
                                    ? key === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                        : key === 'SELL' ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                            : 'bg-violet-500/20 text-violet-400 border-violet-500/30'
                                    : 'text-white/30 border-transparent hover:text-white/60'
                                }`}
                        >
                            {key === 'BUY' ? '●' : key === 'SELL' ? '●' : ''}
                            {label}
                            <span className="opacity-60">({count})</span>
                        </button>
                    ))}
                </div>

                {/* Status + controls */}
                <div className="flex items-center gap-2">
                    {error && <span className="text-[9px] text-red-400">{error}</span>}
                    {lastUpdate && !error && (
                        <span className="text-[9px] text-white/20">{fmtTxAge(lastUpdate)} ago</span>
                    )}
                    <button
                        onClick={() => setLive(l => !l)}
                        className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-all font-bold ${live ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : 'border-white/10 text-white/30'
                            }`}
                    >
                        {live ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                        {live ? `LIVE ${pollSeconds}s` : 'PAUSED'}
                    </button>
                    <button
                        onClick={() => refresh(false)}
                        disabled={loading}
                        className="p-1.5 rounded-md text-white/30 hover:text-white border border-white/10 hover:border-white/20 transition-all"
                    >
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* ── Column headers ── */}
            <div className="grid grid-cols-[60px_42px_76px_96px_80px_80px_56px_28px] gap-1 px-3 py-1.5 bg-white/[0.01] border-b border-white/8 text-[9px] font-bold text-white/25 uppercase tracking-wider flex-shrink-0">
                <span>DATE</span>
                <span>TYPE</span>
                <span className="text-right">USD</span>
                <span className="text-right">{tokenSymbol}</span>
                <span className="text-right">{quoteSymbol}</span>
                <span className="text-right">PRICE</span>
                <span>MAKER</span>
                <span className="text-right">TXN</span>
            </div>

            {/* ── Rows ── */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-white/20 text-xs gap-2">
                        {loading ? (
                            <><RefreshCw className="w-4 h-4 animate-spin" /><span>Loading transactions…</span></>
                        ) : !pairAddress ? (
                            <span>Chọn token để xem giao dịch</span>
                        ) : (
                            <span>Chưa có giao dịch</span>
                        )}
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {rows.map((tx) => {
                            const isNew = newHashes.has(tx.hash);
                            const isBuy = tx.kind === 'BUY';
                            const isSell = tx.kind === 'SELL';
                            const price = tx.priceUsd;
                            const priceStr = price > 0
                                ? price < 0.0001 ? `$${price.toFixed(8)}`
                                    : price < 1 ? `$${price.toFixed(5)}`
                                        : `$${price.toFixed(4)}`
                                : '—';

                            return (
                                <motion.div
                                    key={tx.hash + tx.tokenAmount}
                                    initial={{ opacity: 0, x: -4 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={`grid grid-cols-[60px_42px_76px_96px_80px_80px_56px_28px] gap-1 px-3 py-[5px] items-center border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors cursor-default group ${isNew
                                            ? isBuy ? 'bg-emerald-500/8' : isSell ? 'bg-red-500/8' : 'bg-white/5'
                                            : ''
                                        }`}
                                >
                                    {/* DATE */}
                                    <span className="text-[10px] font-mono text-white/35 truncate">
                                        {fmtTxAge(tx.timestamp)}
                                    </span>

                                    {/* TYPE */}
                                    <span className={`text-[11px] font-bold ${isBuy ? 'text-emerald-400'
                                            : isSell ? 'text-red-400'
                                                : 'text-blue-400'
                                        }`}>
                                        {isBuy ? 'Buy' : isSell ? 'Sell' : 'Xfer'}
                                    </span>

                                    {/* USD */}
                                    <span className={`text-[11px] font-bold text-right ${isBuy ? 'text-emerald-400'
                                            : isSell ? 'text-red-400'
                                                : 'text-white/50'
                                        }`}>
                                        {tx.amountUsd > 0 ? fmtUsd(tx.amountUsd) : '—'}
                                    </span>

                                    {/* TOKEN amount */}
                                    <span className="text-[11px] text-white/70 font-mono text-right">
                                        {fmtToken(tx.tokenAmount)}
                                    </span>

                                    {/* QUOTE amount */}
                                    <span className="text-[11px] text-white/50 font-mono text-right">
                                        {tx.quoteAmount > 0 ? tx.quoteAmount.toFixed(4) : '—'}
                                    </span>

                                    {/* PRICE */}
                                    <span className="text-[11px] text-white/60 text-right font-mono">
                                        {priceStr}
                                    </span>

                                    {/* MAKER */}
                                    <span className="text-[10px] font-mono text-white/35 group-hover:text-white/60 transition-colors">
                                        {fmtAddr(tx.makerAddress)}
                                    </span>

                                    {/* TXN link */}
                                    <div className="flex justify-end">
                                        <a
                                            href={`${explorer}${tx.hash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={e => e.stopPropagation()}
                                            className="text-white/20 hover:text-violet-400 transition-colors"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>

            {/* ── Footer ── */}
            <div className="px-3 py-1.5 border-t border-white/8 flex items-center justify-between flex-shrink-0">
                <p className="text-[9px] text-white/15">
                    {rows.length} giao dịch · Poll #{pollCount}
                </p>
                <p className="text-[9px] text-white/15 font-mono">
                    {chain} · {pairAddress ? `${pairAddress.slice(0, 6)}…${pairAddress.slice(-4)}` : '—'}
                </p>
            </div>
        </div>
    );
}
