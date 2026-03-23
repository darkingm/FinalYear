'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, ExternalLink, Wifi, WifiOff, ChevronDown } from 'lucide-react';
import {
    fetchPairTxs, fetchPairStats, mergeTxs,
    CHAIN_EXPLORERS, fmtTxAge, fmtUsd, fmtToken, fmtAddr, getTokenLogoUrl,
    type PairTx, type PairStats,
} from '@/lib/pair-tx-fetcher';
import type { SupportedChain } from '@/store/whale-tracker-store';

type FilterKind = 'ALL' | 'BUY' | 'SELL';
const NEW_HASH_TTL = 2_500;

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
        <span className={`text-[10px] font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
            {up ? '+' : ''}{v.toFixed(2)}%
        </span>
    );
}

function TokenLogo({ chain, tokenAddress, symbol, size = 14 }: {
    chain: SupportedChain; tokenAddress: string; symbol: string; size?: number;
}) {
    const [err, setErr] = useState(false);
    if (err || !tokenAddress) {
        return (
            <span style={{ width: size, height: size, minWidth: size }}
                className="rounded-full bg-white/10 flex items-center justify-center text-[7px] font-black text-white/40">
                {symbol.slice(0, 2)}
            </span>
        );
    }
    return (
        <img src={getTokenLogoUrl(chain, tokenAddress)} alt={symbol}
            width={size} height={size} style={{ minWidth: size }}
            className="rounded-full bg-white/5"
            onError={() => setErr(true)} />
    );
}

/* ─── Tabs ─────────────────────────────────────────────────── */
const TABS = ['Transactions', 'Top Traders', 'Holders', 'Liquidity', 'Bubblemaps'];

/* ─── Column config ── matches screenshot exactly ─────────── */
// DATE | TYPE | USD | TOKEN | QUOTE | PRICE | MAKER | TXN
const COL = '64px 54px 1fr 1fr 1fr 72px 64px 24px';

export function LiveTxFeed({ chain, tokenAddress, pairAddress, tokenSymbol, quoteSymbol = 'WBNB', pollSeconds = 8 }: Props) {
    const [txs, setTxs] = useState<PairTx[]>([]);
    const [stats, setStats] = useState<PairStats | null>(null);
    const [newHashes, setNewHashes] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState<FilterKind>('ALL');
    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [live, setLive] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<number | null>(null);
    const [source, setSource] = useState<string | null>(null);
    const txsRef = useRef<PairTx[]>([]);
    txsRef.current = txs;
    const explorer = CHAIN_EXPLORERS[chain];

    const refreshTxs = useCallback(async (initial = false) => {
        if (!tokenAddress || !pairAddress) return;
        if (initial) setLoading(true);
        try {
            const incoming = await fetchPairTxs(chain, tokenAddress, pairAddress, initial ? 50 : 20, 0);
            if (incoming.length > 0) {
                const merged = initial ? incoming : mergeTxs(txsRef.current, incoming, 500);
                setTxs(merged);
                if (!initial) {
                    const hs = new Set(incoming.map(t => t.hash));
                    setNewHashes(hs);
                    setTimeout(() => setNewHashes(new Set()), NEW_HASH_TTL);
                }
                setSource(incoming[0]?.source || null);
            }
            setLastUpdate(Date.now());
        } finally { setLoading(false); }
    }, [chain, tokenAddress, pairAddress]);

    const refreshStats = useCallback(async () => {
        if (!pairAddress) return;
        const s = await fetchPairStats(chain, pairAddress);
        if (s) setStats(s);
    }, [chain, pairAddress]);

    useEffect(() => {
        setTxs([]); setStats(null); setSource(null); setLastUpdate(null); setTab(0); setFilter('ALL');
        refreshTxs(true);
        refreshStats();
    }, [chain, tokenAddress, pairAddress, refreshTxs, refreshStats]);

    useEffect(() => {
        if (!live) return;
        const tx = setInterval(() => refreshTxs(false), pollSeconds * 1_000);
        const st = setInterval(refreshStats, 15_000);
        return () => { clearInterval(tx); clearInterval(st); };
    }, [live, pollSeconds, refreshTxs, refreshStats]);

    const rows = filter === 'ALL' ? txs : txs.filter(t => t.kind === filter);
    const buyCount = txs.filter(t => t.kind === 'BUY').length;
    const sellCount = txs.filter(t => t.kind === 'SELL').length;
    const priceNum = parseFloat(stats?.priceUsd || '0');
    const priceStr = priceNum > 0
        ? priceNum < 0.0001 ? `$${priceNum.toFixed(8)}`
            : priceNum < 1 ? `$${priceNum.toFixed(5)}`
                : `$${priceNum.toFixed(4)}`
        : '—';

    const detectedQuote = txs[0]?.quoteSymbol || stats?.quoteToken.symbol || quoteSymbol;
    const detectedToken = txs[0]?.tokenSymbol || stats?.baseToken.symbol || tokenSymbol;
    const tokenAddr = stats?.baseToken.address || tokenAddress;

    return (
        <div className="flex flex-col h-full min-h-0 select-none text-white bg-[#0b0b12] font-sans">

            {/* ── Stats bar ─────────────────────────────────── */}
            <div className="flex items-center gap-4 px-4 py-2 border-b border-white/[0.06] flex-shrink-0 flex-wrap">
                {/* Logo + price */}
                <div className="flex items-center gap-2">
                    <TokenLogo chain={chain} tokenAddress={tokenAddr} symbol={detectedToken} size={20} />
                    <span className="font-black text-sm text-white">{priceStr}</span>
                    {stats && <PctBadge v={stats.priceChange.h24} />}
                </div>
                {/* Divider */}
                <div className="h-4 w-px bg-white/10" />
                {/* Stats pills */}
                <div className="flex items-center gap-4 flex-wrap">
                    {[
                        { l: 'LIQ', v: stats ? fmt(stats.liquidity) : '—', c: '' },
                        { l: 'VOL 24H', v: stats ? fmt(stats.volume.h24) : '—', c: '' },
                        { l: 'BUY 1H', v: stats ? String(stats.txns.h1.buys) : `${buyCount}`, c: 'text-emerald-400' },
                        { l: 'SELL 1H', v: stats ? String(stats.txns.h1.sells) : `${sellCount}`, c: 'text-red-400' },
                    ].map(({ l, v, c }) => (
                        <div key={l} className="flex items-baseline gap-1">
                            <span className="text-[9px] text-white/25 font-semibold tracking-wider">{l}</span>
                            <span className={`text-[11px] font-bold ${c || 'text-white/60'}`}>{v}</span>
                        </div>
                    ))}
                </div>
                <div className="flex-1" />
                {/* Live toggle + refresh */}
                <div className="flex items-center gap-2">
                    {source && (
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${source === 'subgraph' ? 'bg-violet-500/15 text-violet-400' : 'bg-sky-500/15 text-sky-400'
                            }`}>
                            ⚡{source === 'subgraph' ? ' RPC' : ' Explorer'}
                        </span>
                    )}
                    {lastUpdate && (
                        <span className="text-[8px] text-white/15">{fmtTxAge(lastUpdate)} ago</span>
                    )}
                    <button onClick={() => setLive(l => !l)}
                        className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded border font-bold transition-all ${live ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'border-white/10 text-white/30'
                            }`}>
                        {live ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                        {live ? `${pollSeconds}s` : 'OFF'}
                    </button>
                    <button onClick={() => { refreshTxs(true); refreshStats(); }} disabled={loading}
                        className="p-1 rounded text-white/25 hover:text-white transition-colors">
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* ── Tab bar ─────────────────────────────────────── */}
            <div className="flex items-center border-b border-white/[0.06] flex-shrink-0 px-2">
                {TABS.map((t, i) => (
                    <button key={t} onClick={() => setTab(i)}
                        className={`px-3 py-2.5 text-[11px] font-semibold border-b-2 transition-colors whitespace-nowrap ${tab === i
                                ? 'border-white text-white'
                                : 'border-transparent text-white/30 hover:text-white/60'
                            }`}>
                        {t}
                    </button>
                ))}
                {/* BUY / SELL filter on the right */}
                <div className="ml-auto flex gap-1 pr-1">
                    {(['ALL', 'BUY', 'SELL'] as FilterKind[]).map(k => (
                        <button key={k} onClick={() => setFilter(k)}
                            className={`text-[9px] font-bold px-2 py-0.5 rounded transition-all ${filter === k
                                    ? k === 'BUY' ? 'bg-emerald-500/20 text-emerald-400'
                                        : k === 'SELL' ? 'bg-red-500/20 text-red-400'
                                            : 'bg-white/10 text-white/70'
                                    : 'text-white/25 hover:text-white/50'
                                }`}>
                            {k === 'ALL' ? `All (${txs.length})` : k === 'BUY' ? `Buy (${buyCount})` : `Sell (${sellCount})`}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Column headers ─────────────────────────────── */}
            <div className="grid px-3 py-1.5 border-b border-white/[0.06] flex-shrink-0 text-[10px] font-semibold text-white/30 uppercase tracking-wider"
                style={{ gridTemplateColumns: COL }}>
                <span className="flex items-center gap-0.5">DATE <ChevronDown className="w-2.5 h-2.5 opacity-50" /></span>
                <span className="flex items-center gap-0.5">TYPE <ChevronDown className="w-2.5 h-2.5 opacity-50" /></span>
                <span className="text-right flex items-center justify-end gap-0.5">USD <ChevronDown className="w-2.5 h-2.5 opacity-50" /></span>
                <span className="text-right flex items-center justify-end gap-0.5">{detectedToken} <ChevronDown className="w-2.5 h-2.5 opacity-50" /></span>
                <span className="text-right flex items-center justify-end gap-0.5">{detectedQuote} <ChevronDown className="w-2.5 h-2.5 opacity-50" /></span>
                <span className="text-right flex items-center justify-end gap-0.5">PRICE <ChevronDown className="w-2.5 h-2.5 opacity-50" /></span>
                <span className="flex items-center gap-0.5">MAKER <ChevronDown className="w-2.5 h-2.5 opacity-50" /></span>
                <span />
            </div>

            {/* ── Rows ───────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-white/10">
                {tab !== 0 ? (
                    <div className="flex items-center justify-center h-32 text-white/20 text-xs">
                        {TABS[tab]} — coming soon
                    </div>
                ) : rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-white/20 text-xs gap-2">
                        {loading
                            ? <><RefreshCw className="w-5 h-5 animate-spin text-violet-400/50" /><span>Đang tải giao dịch…</span></>
                            : !pairAddress
                                ? <span>Chọn pair để bắt đầu</span>
                                : <><span className="text-sm">Chưa có giao dịch trong 25 phút qua</span>
                                    <span className="text-[10px] text-white/10">Pair này ít giao dịch — thử CAKE, BNB hoặc pair khác</span></>}
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {rows.map(tx => {
                            const isNew = newHashes.has(tx.hash);
                            const isBuy = tx.kind === 'BUY';
                            const isSell = tx.kind === 'SELL';
                            const p = tx.priceUsd;
                            const ps = p > 0
                                ? p < 0.0001 ? `$${p.toFixed(8)}`
                                    : p < 1 ? `$${p.toFixed(5)}`
                                        : `$${p.toFixed(4)}`
                                : '—';
                            const color = isBuy ? 'text-emerald-400' : isSell ? 'text-red-400' : 'text-blue-400';

                            return (
                                <motion.div key={tx.hash + tx.tokenAmount}
                                    initial={{ opacity: 0, y: -4, backgroundColor: isBuy ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)' }}
                                    animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(0,0,0,0)' }}
                                    transition={{ duration: isNew ? 0.8 : 0.2 }}
                                    className={`grid px-3 items-center border-b border-white/[0.035] hover:bg-white/[0.03] transition-colors group cursor-default ${isNew ? (isBuy ? 'bg-emerald-500/[0.04]' : 'bg-red-500/[0.04]') : ''
                                        }`}
                                    style={{ gridTemplateColumns: COL, minHeight: 31 }}>

                                    {/* DATE */}
                                    <span className="text-[10px] font-mono text-white/35">
                                        {fmtTxAge(tx.timestamp)}
                                    </span>

                                    {/* TYPE */}
                                    <span className={`text-[11px] font-bold ${color}`}>
                                        {isBuy ? 'Buy' : isSell ? 'Sell' : 'Xfer'}
                                    </span>

                                    {/* USD */}
                                    <span className={`text-[11px] font-semibold text-right font-mono ${color}`}>
                                        {tx.amountUsd > 0 ? fmtUsd(tx.amountUsd) : '—'}
                                    </span>

                                    {/* TOKEN AMOUNT */}
                                    <span className={`text-[11px] font-mono text-right ${color}`}>
                                        {fmtToken(tx.tokenAmount)}
                                    </span>

                                    {/* QUOTE AMOUNT */}
                                    <span className={`text-[11px] font-mono text-right ${color}`}>
                                        {tx.quoteAmount > 0 ? tx.quoteAmount.toFixed(4) : '—'}
                                    </span>

                                    {/* PRICE */}
                                    <span className="text-[10px] text-white/50 text-right font-mono">{ps}</span>

                                    {/* MAKER */}
                                    <a href={`${explorer}address/${tx.makerAddress}`}
                                        target="_blank" rel="noopener noreferrer"
                                        onClick={e => e.stopPropagation()}
                                        className="text-[10px] font-mono text-white/40 hover:text-violet-400 transition-colors flex items-center gap-0.5"
                                        title={tx.makerAddress}>
                                        {fmtAddr(tx.makerAddress)}
                                        <ChevronDown className="w-2 h-2 opacity-40 -rotate-90" />
                                    </a>

                                    {/* TXN link */}
                                    <a href={`${explorer}${tx.hash}`} target="_blank" rel="noopener noreferrer"
                                        onClick={e => e.stopPropagation()}
                                        className="text-white/20 hover:text-violet-400 transition-colors flex justify-end">
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>

            {/* ── Footer ─────────────────────────────────────── */}
            <div className="px-3 py-1 border-t border-white/[0.06] flex items-center justify-between flex-shrink-0 bg-black/20">
                <span className="text-[8px] text-white/15 font-mono">
                    {rows.length} txs · {source === 'subgraph' ? 'RPC/Graph' : 'Explorer'} · {pairAddress ? `${pairAddress.slice(0, 6)}…${pairAddress.slice(-4)}` : '—'}
                </span>
                <span className="text-[8px] text-white/10">{chain}</span>
            </div>
        </div>
    );
}
