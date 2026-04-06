'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, ExternalLink, Wifi, WifiOff, ChevronDown, Copy, Check, Tag, X, MessageSquare } from 'lucide-react';
import {
    fetchPairTxs, fetchPairStats, mergeTxs, recordTxsBatch, fetchTopTraders,
    CHAIN_EXPLORERS, fmtTxAge, fmtUsd, fmtToken, fmtAddr, getTokenLogoUrl,
    type PairTx, type PairStats, type TopTrader,
} from '@/lib/pair-tx-fetcher';
import type { SupportedChain } from '@/store/whale-tracker-store';

type FilterKind = 'ALL' | 'BUY' | 'SELL';
type ActiveTab = 'txs' | 'traders' | 'holders' | 'liquidity' | 'bubblemaps';
const NEW_HASH_TTL = 2_500;

interface MakerStat { buys: number; sells: number; totalUsd: number; buyToken: number; sellToken: number; }
interface WhaleNote { label: string; color: string; }

interface Props {
    chain: SupportedChain;
    tokenAddress: string;
    pairAddress: string;
    tokenSymbol: string;
    quoteSymbol?: string;
    pollSeconds?: number;
}

/* ─── Helpers ── */
function fmt(n: number) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
}
function PctBadge({ v }: { v: number }) {
    const up = v >= 0;
    return <span className={`text-[10px] font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}>{up ? '+' : ''}{v.toFixed(2)}%</span>;
}
function TokenLogo({ chain, tokenAddress, symbol, size = 18 }: {
    chain: SupportedChain; tokenAddress: string; symbol: string; size?: number;
}) {
    const [err, setErr] = useState(false);
    if (err || !tokenAddress) return (
        <span style={{ width: size, height: size, minWidth: size }}
            className="rounded-full bg-white/10 flex items-center justify-center text-[7px] font-black text-white/40">
            {symbol.slice(0, 2)}
        </span>
    );
    return <img src={getTokenLogoUrl(chain, tokenAddress)} alt={symbol} width={size} height={size}
        style={{ minWidth: size }} className="rounded-full bg-white/5" onError={() => setErr(true)} />;
}

/* ─── Live ticking age — updates every second ── */
function LiveAge({ timestamp }: { timestamp: number }) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);
    const diffS = Math.max(0, Math.floor((now - timestamp) / 1000));
    if (diffS < 60) return <span>{diffS}s</span>;
    if (diffS < 3600) return <span>{Math.floor(diffS / 60)}m</span>;
    return <span>{Math.floor(diffS / 3600)}h</span>;
}

/* ─── Copy address button ── */
function CopyAddr({ address }: { address: string }) {
    const [copied, setCopied] = useState(false);
    const copy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(address).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
    };
    return (
        <button onClick={copy} className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 rounded transition-all" title="Copy address">
            {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5 text-white/50" />}
        </button>
    );
}

/* ─── Whale Notes — localStorage persistence ── */
const NOTE_COLORS = ['#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#fb923c'];
function getWhaleNotes(): Record<string, WhaleNote> {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem('whale_notes') || '{}'); } catch { return {}; }
}
function saveWhaleNotes(notes: Record<string, WhaleNote>) {
    localStorage.setItem('whale_notes', JSON.stringify(notes));
}

/* ─── Inline whale note editor ── */
function WhaleNoteEditor({ address, note, onChange }: {
    address: string; note?: WhaleNote; onChange: (addr: string, note: WhaleNote | null) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [label, setLabel] = useState(note?.label || '');
    const [color, setColor] = useState(note?.color || NOTE_COLORS[0]);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

    if (note && !editing) {
        return (
            <button onClick={(e) => { e.stopPropagation(); setEditing(true); setLabel(note.label); setColor(note.color); }}
                className="text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0 cursor-pointer hover:brightness-125 transition-all"
                style={{ backgroundColor: `${note.color}20`, color: note.color, borderColor: `${note.color}40`, borderWidth: 1 }}>
                <Tag className="w-2 h-2" />{note.label}
            </button>
        );
    }

    if (editing) {
        return (
            <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <input ref={inputRef} value={label} onChange={e => setLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && label.trim()) { onChange(address, { label: label.trim(), color }); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
                    placeholder="Binance, Gate..."
                    className="w-20 text-[9px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white outline-none focus:border-violet-500/50" />
                <div className="flex gap-0.5">
                    {NOTE_COLORS.map(c => (
                        <button key={c} onClick={() => setColor(c)}
                            className={`w-3 h-3 rounded-full border ${color === c ? 'border-white scale-125' : 'border-transparent'}`}
                            style={{ backgroundColor: c }} />
                    ))}
                </div>
                <button onClick={() => { if (label.trim()) { onChange(address, { label: label.trim(), color }); } setEditing(false); }}
                    className="text-[8px] text-emerald-400 font-bold hover:text-emerald-300">✓</button>
                {note && <button onClick={() => { onChange(address, null); setEditing(false); }}
                    className="text-[8px] text-red-400 font-bold hover:text-red-300"><X className="w-2.5 h-2.5" /></button>}
                <button onClick={() => setEditing(false)}
                    className="text-[8px] text-white/30 hover:text-white/60">✕</button>
            </div>
        );
    }

    return (
        <button onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className="opacity-0 group-hover:opacity-40 hover:!opacity-80 text-white/30 hover:text-violet-400 transition-all flex-shrink-0"
            title="Add whale note">
            <Tag className="w-2.5 h-2.5" />
        </button>
    );
}

const TABS: { key: ActiveTab; label: string }[] = [
    { key: 'txs', label: 'Transactions' },
    { key: 'traders', label: 'Top Traders' },
    { key: 'holders', label: 'Holders' },
    { key: 'liquidity', label: 'Liquidity' },
    { key: 'bubblemaps', label: 'Bubblemaps' },
];

// Column layout: DATE | TYPE | USD | TOKEN | QUOTE | PRICE | gap | MAKER | BOUGHT | SOLD | TXN
const COL = '40px 38px 66px 72px 62px 62px 12px 1fr 58px 58px 24px';

export function LiveTxFeed({ chain, tokenAddress, pairAddress, tokenSymbol, quoteSymbol = 'WBNB', pollSeconds = 5 }: Props) {
    const [txs, setTxs] = useState<PairTx[]>([]);
    const [stats, setStats] = useState<PairStats | null>(null);
    const [newHashes, setNewHashes] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState<FilterKind>('ALL');
    const [tab, setTab] = useState<ActiveTab>('txs');
    const [loading, setLoading] = useState(false);
    const [live, setLive] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<number | null>(null);
    const [whaleNotes, setWhaleNotes] = useState<Record<string, WhaleNote>>({});
    const txsRef = useRef<PairTx[]>([]);
    txsRef.current = txs;
    const explorer = CHAIN_EXPLORERS[chain];

    // Load whale notes from localStorage
    useEffect(() => { setWhaleNotes(getWhaleNotes()); }, []);
    const updateNote = useCallback((addr: string, note: WhaleNote | null) => {
        setWhaleNotes(prev => {
            const next = { ...prev };
            if (note) next[addr.toLowerCase()] = note;
            else delete next[addr.toLowerCase()];
            saveWhaleNotes(next);
            return next;
        });
    }, []);

    // ── Per-maker stats (computed from local TX history) ─────────────────────
    const makerStats = useMemo<Record<string, MakerStat>>(() => {
        const m: Record<string, MakerStat> = {};
        for (const tx of txs) {
            const addr = tx.makerAddress.toLowerCase();
            if (!m[addr]) m[addr] = { buys: 0, sells: 0, totalUsd: 0, buyToken: 0, sellToken: 0 };
            if (tx.kind === 'BUY') { m[addr].buys++; m[addr].buyToken += tx.tokenAmount || 0; }
            if (tx.kind === 'SELL') { m[addr].sells++; m[addr].sellToken += tx.tokenAmount || 0; }
            m[addr].totalUsd += tx.amountUsd || 0;
        }
        return m;
    }, [txs]);

    // ── Data fetchers ─────────────────────────────────────────────────────────
    const refreshTxs = useCallback(async (initial = false) => {
        if (!tokenAddress || !pairAddress) return;
        if (initial) setLoading(true);
        try {
            const incoming = await fetchPairTxs(chain, tokenAddress, pairAddress, initial ? 100 : 20, 0);
            if (incoming.length > 0) {
                const merged = initial ? incoming : mergeTxs(txsRef.current, incoming, 500);
                setTxs(merged);
                // Persist to backend DB (fire-and-forget)
                recordTxsBatch(chain, incoming);
                if (!initial) {
                    const hs = new Set(incoming.map(t => t.hash));
                    setNewHashes(hs);
                    setTimeout(() => setNewHashes(new Set()), NEW_HASH_TTL);
                }
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
        setTxs([]); setStats(null); setLastUpdate(null); setTab('txs'); setFilter('ALL');
        refreshTxs(true); refreshStats();
    }, [chain, tokenAddress, pairAddress, refreshTxs, refreshStats]);

    useEffect(() => {
        if (!live) return;
        const tx = setInterval(() => refreshTxs(false), pollSeconds * 1_000);
        const st = setInterval(refreshStats, 10_000);
        return () => { clearInterval(tx); clearInterval(st); };
    }, [live, pollSeconds, refreshTxs, refreshStats]);

    // ── Live ping display ────────────────────────────────────────────────────
    const [pingAge, setPingAge] = useState(0);
    useEffect(() => {
        const id = setInterval(() => {
            setPingAge(lastUpdate ? Math.floor((Date.now() - lastUpdate) / 1000) : 0);
        }, 1000);
        return () => clearInterval(id);
    }, [lastUpdate]);

    // ── Derived ───────────────────────────────────────────────────────────────
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

    // ── Top Traders derived ───────────────────────────────────────────────────
    const topTraders = useMemo(() =>
        Object.entries(makerStats)
            .map(([addr, s]) => ({ addr, ...s, txCount: s.buys + s.sells }))
            .sort((a, b) => b.totalUsd - a.totalUsd)
            .slice(0, 50),
        [makerStats]);

    return (
        <div className="flex flex-col h-full min-h-0 select-none text-white bg-[#0b0b12]">

            {/* Stats bar */}
            <div className="flex items-center gap-4 px-4 py-2 border-b border-white/[0.06] flex-shrink-0 flex-wrap">
                <div className="flex items-center gap-2">
                    <TokenLogo chain={chain} tokenAddress={tokenAddr} symbol={detectedToken} />
                    <span className="font-black text-sm">{priceStr}</span>
                    {stats && <PctBadge v={stats.priceChange.h24} />}
                </div>
                <div className="h-4 w-px bg-white/10" />
                <div className="flex items-center gap-4 flex-wrap">
                    {[
                        { l: 'LIQ', v: stats ? fmt(stats.liquidity) : '—', c: '' },
                        { l: 'VOL 24H', v: stats ? fmt(stats.volume.h24) : '—', c: '' },
                        { l: 'BUY 1H', v: stats ? `${stats.txns.h1.buys}` : `${buyCount}`, c: 'text-emerald-400' },
                        { l: 'SELL 1H', v: stats ? `${stats.txns.h1.sells}` : `${sellCount}`, c: 'text-red-400' },
                        { l: 'TRADERS', v: `${Object.keys(makerStats).length}`, c: 'text-violet-400' },
                    ].map(({ l, v, c }) => (
                        <div key={l} className="flex items-baseline gap-1">
                            <span className="text-[9px] text-white/25 font-semibold tracking-wider">{l}</span>
                            <span className={`text-[11px] font-bold ${c || 'text-white/60'}`}>{v}</span>
                        </div>
                    ))}
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-2">
                    {lastUpdate && <span className="text-[8px] text-white/25 font-mono tabular-nums">{pingAge}s ago</span>}
                    <button onClick={() => setLive(l => !l)}
                        className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded border font-bold ${live ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'border-white/10 text-white/30'
                            }`}>
                        {live ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                        {live ? `${pollSeconds}s` : 'OFF'}
                    </button>
                    <button onClick={() => { refreshTxs(true); refreshStats(); }} disabled={loading}
                        className="p-1 rounded text-white/25 hover:text-white">
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Tab bar + filter pills */}
            <div className="flex items-center border-b border-white/[0.06] flex-shrink-0 px-2 bg-black/10">
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`px-3 py-2.5 text-[11px] font-semibold border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? 'border-white text-white' : 'border-transparent text-white/30 hover:text-white/60'
                            }`}>
                        {t.label}
                    </button>
                ))}
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

            {/* ── TRANSACTIONS tab ── */}
            {tab === 'txs' && (
                <>
                    {/* Column headers */}
                    <div className="grid px-4 py-1.5 border-b border-white/[0.06] flex-shrink-0 text-[9px] font-semibold text-white/30 uppercase tracking-wider"
                        style={{ gridTemplateColumns: COL }}>
                        <span className="flex items-center gap-0.5">DATE <ChevronDown className="w-2 h-2 opacity-40" /></span>
                        <span className="flex items-center gap-0.5">TYPE</span>
                        <span className="text-right flex items-center justify-end gap-0.5">USD</span>
                        <span className="text-right flex items-center justify-end gap-0.5">{detectedToken}</span>
                        <span className="text-right flex items-center justify-end gap-0.5">{detectedQuote}</span>
                        <span className="text-right flex items-center justify-end gap-0.5">PRICE</span>
                        <span />{/* spacer */}
                        <span className="flex items-center gap-0.5">MAKER</span>
                        <span className="text-right text-emerald-400/60">BOUGHT</span>
                        <span className="text-right text-red-400/60">SOLD</span>
                        <span />
                    </div>

                    {/* Rows */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {rows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-white/20 text-xs gap-2">
                                {loading
                                    ? <><RefreshCw className="w-5 h-5 animate-spin text-violet-400/50" /><span>Đang tải giao dịch…</span></>
                                    : <><span className="text-sm">Chưa có giao dịch trong 25 phút</span>
                                        <span className="text-[10px] text-white/10">Thử CAKE/WBNB hoặc pair có volume cao hơn</span></>}
                            </div>
                        ) : (
                            <AnimatePresence initial={false}>
                                {rows.map(tx => {
                                    const isNew = newHashes.has(tx.hash);
                                    const isBuy = tx.kind === 'BUY';
                                    const isSell = tx.kind === 'SELL';
                                    const color = isBuy ? 'text-emerald-400' : isSell ? 'text-red-400' : 'text-blue-400';
                                    const p = tx.priceUsd;
                                    const ps = p > 0 ? p < 0.0001 ? `$${p.toFixed(8)}` : p < 1 ? `$${p.toFixed(5)}` : `$${p.toFixed(4)}` : '—';
                                    const ms = makerStats[tx.makerAddress.toLowerCase()];

                                    return (
                                        <motion.div key={tx.hash + tx.tokenAmount}
                                            initial={{ opacity: 0, y: -3, backgroundColor: isBuy ? 'rgba(52,211,153,0.10)' : 'rgba(248,113,113,0.10)' }}
                                            animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(0,0,0,0)' }}
                                            transition={{ duration: isNew ? 0.7 : 0.15 }}
                                            className={`grid px-4 items-center border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors group cursor-default ${isNew ? (isBuy ? 'bg-emerald-500/[0.04]' : 'bg-red-500/[0.04]') : ''
                                                }`}
                                            style={{ gridTemplateColumns: COL, minHeight: 32 }}>

                                            {/* DATE — live ticking seconds */}
                                            <span className="text-[10px] font-mono text-white/35">
                                                <LiveAge timestamp={tx.timestamp} />
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

                                            {/* SPACER between PRICE and MAKER */}
                                            <span />

                                            {/* MAKER — address + whale note + buy/sell badges */}
                                            <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                                                {/* Whale note tag (if exists) */}
                                                <WhaleNoteEditor
                                                    address={tx.makerAddress}
                                                    note={whaleNotes[tx.makerAddress.toLowerCase()]}
                                                    onChange={updateNote}
                                                />
                                                <a href={`${explorer}address/${tx.makerAddress}`}
                                                    target="_blank" rel="noopener noreferrer"
                                                    onClick={e => e.stopPropagation()}
                                                    className="text-[10px] font-mono text-white/50 hover:text-violet-400 transition-colors truncate min-w-0"
                                                    title={`View on explorer: ${tx.makerAddress}`}>
                                                    {tx.makerAddress}
                                                </a>
                                                <CopyAddr address={tx.makerAddress} />
                                                <a href={`${explorer}address/${tx.makerAddress}`}
                                                    target="_blank" rel="noopener noreferrer"
                                                    onClick={e => e.stopPropagation()}
                                                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-white/40 hover:text-violet-400 transition-all flex-shrink-0"
                                                    title="View on explorer">
                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                </a>
                                                {ms && (
                                                    <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto">
                                                        {ms.buys > 0 && (
                                                            <span className="text-[8px] font-black text-emerald-400 bg-emerald-400/10 px-1 rounded leading-tight">
                                                                {ms.buys}
                                                            </span>
                                                        )}
                                                        {ms.sells > 0 && (
                                                            <span className="text-[8px] font-black text-red-400 bg-red-400/10 px-1 rounded leading-tight">
                                                                {ms.sells}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* BOUGHT — cumulative buy volume for this maker */}
                                            <span className="text-[9px] font-mono text-right text-emerald-400/70 tabular-nums">
                                                {ms && ms.buyToken > 0 ? fmtToken(ms.buyToken) : '—'}
                                            </span>

                                            {/* SOLD — cumulative sell volume for this maker */}
                                            <span className="text-[9px] font-mono text-right text-red-400/70 tabular-nums">
                                                {ms && ms.sellToken > 0 ? fmtToken(ms.sellToken) : '—'}
                                            </span>

                                            {/* TXN */}
                                            <a href={`${explorer}tx/${tx.hash}`} target="_blank" rel="noopener noreferrer"
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
                </>
            )}

            {/* ── TOP TRADERS tab ── */}
            {tab === 'traders' && (
                <div className="flex-1 overflow-y-auto min-h-0">
                    {topTraders.length === 0 ? (
                        <div className="flex items-center justify-center h-40 text-white/20 text-sm">
                            Chưa có dữ liệu — chờ TX feed tải xong
                        </div>
                    ) : (
                        <>
                            {/* Table header */}
                            <div className="grid px-4 py-2 border-b border-white/[0.06] text-[10px] font-semibold text-white/30 uppercase tracking-wider sticky top-0 bg-[#0b0b12]"
                                style={{ gridTemplateColumns: '32px 1fr 100px 60px 60px 60px 80px' }}>
                                <span>#</span>
                                <span>MAKER</span>
                                <span>NOTE</span>
                                <span className="text-right">BUYS</span>
                                <span className="text-right">SELLS</span>
                                <span className="text-right">TXS</span>
                                <span className="text-right">VOL USD</span>
                            </div>
                            {topTraders.map((t, i) => {
                                const note = whaleNotes[t.addr.toLowerCase()];
                                return (
                                    <div key={t.addr} className="grid px-4 items-center border-b border-white/[0.03] hover:bg-white/[0.025] transition-colors group"
                                        style={{ gridTemplateColumns: '32px 1fr 100px 60px 60px 60px 80px', minHeight: 36 }}>
                                        <span className="text-[10px] text-white/20 font-bold">{i + 1}</span>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <a href={`${explorer}address/${t.addr}`}
                                                target="_blank" rel="noopener noreferrer"
                                                className="text-[10px] font-mono text-white/60 hover:text-violet-400 transition-colors truncate"
                                                title={t.addr}>
                                                {t.addr}
                                            </a>
                                            <CopyAddr address={t.addr} />
                                        </div>
                                        <div className="flex items-center">
                                            <WhaleNoteEditor address={t.addr} note={note} onChange={updateNote} />
                                        </div>
                                        <span className={`text-[11px] font-bold text-right ${t.buys > 0 ? 'text-emerald-400' : 'text-white/20'}`}>
                                            {t.buys > 0 ? t.buys : '—'}
                                        </span>
                                        <span className={`text-[11px] font-bold text-right ${t.sells > 0 ? 'text-red-400' : 'text-white/20'}`}>
                                            {t.sells > 0 ? t.sells : '—'}
                                        </span>
                                        <span className="text-[10px] text-white/40 text-right">{t.txCount}</span>
                                        <span className="text-[11px] font-mono text-right text-white/60">{fmt(t.totalUsd)}</span>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            )}

            {/* ── HOLDERS tab ── */}
            {tab === 'holders' && (
                <div className="flex-1 overflow-y-auto min-h-0 flex flex-col items-center justify-start pt-8 gap-4">
                    <div className="w-full max-w-lg px-4">
                        {stats ? (
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
                                <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Số holder (DexScreener)</p>
                                <p className="text-4xl font-black text-white">{stats.fdv > 0 ? fmt(stats.fdv) : '—'}</p>
                                <p className="text-xs text-white/20 mt-2">
                                    Holder data yêu cầu on-chain scan. Dùng{' '}
                                    <a href={`https://bscscan.com/token/${tokenAddress}#balances`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="text-violet-400 hover:text-violet-300">
                                        BSCScan Token Holders
                                    </a>
                                </p>
                                <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                                    <div className="rounded-lg bg-white/[0.03] p-3">
                                        <p className="text-[10px] text-white/25 mb-1">FDV</p>
                                        <p className="text-sm font-bold text-white">{stats.fdv > 0 ? fmt(stats.fdv) : '—'}</p>
                                    </div>
                                    <div className="rounded-lg bg-white/[0.03] p-3">
                                        <p className="text-[10px] text-white/25 mb-1">FDV</p>
                                        <p className="text-sm font-bold text-white">{stats.fdv > 0 ? fmt(stats.fdv) : '—'}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-white/20 text-sm">Chờ load stats…</p>
                        )}
                    </div>
                </div>
            )}

            {/* ── LIQUIDITY tab ── */}
            {tab === 'liquidity' && (
                <div className="flex-1 flex flex-col items-center justify-start pt-8 px-4 gap-4">
                    {stats ? (
                        <div className="w-full max-w-lg rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
                            <h3 className="text-sm font-bold text-white">Liquidity Pool</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { l: 'Total Liquidity', v: fmt(stats.liquidity) },
                                    { l: 'Volume 1h', v: fmt(stats.volume.h1) },
                                    { l: 'Volume 6h', v: fmt(stats.volume.h6) },
                                    { l: 'Volume 24h', v: fmt(stats.volume.h24) },
                                    { l: 'Buys 1h', v: String(stats.txns.h1.buys) },
                                    { l: 'Sells 1h', v: String(stats.txns.h1.sells) },
                                ].map(({ l, v }) => (
                                    <div key={l} className="rounded-lg bg-white/[0.03] p-3">
                                        <p className="text-[10px] text-white/25 mb-1">{l}</p>
                                        <p className="text-sm font-bold text-white">{v}</p>
                                    </div>
                                ))}
                            </div>
                            <a href={`https://dexscreener.com/${chain.toLowerCase()}/${pairAddress}`}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 text-xs text-violet-400 hover:text-violet-300">
                                <ExternalLink className="w-3 h-3" />
                                Xem chi tiết trên DexScreener
                            </a>
                        </div>
                    ) : <p className="text-white/20 text-sm">Chờ load…</p>}
                </div>
            )}

            {/* ── BUBBLEMAPS tab ── */}
            {tab === 'bubblemaps' && (
                <div className="flex-1 flex flex-col items-center justify-start pt-8 px-4">
                    <div className="w-full max-w-xl rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                            <h3 className="text-sm font-bold text-white">Bubblemaps</h3>
                            <a href={`https://app.bubblemaps.io/${chain.toLowerCase()}/token/${tokenAddress}`}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300">
                                <ExternalLink className="w-3 h-3" /> Open Bubblemaps
                            </a>
                        </div>
                        <div className="p-8 text-center space-y-4">
                            <div className="text-4xl">🫧</div>
                            <p className="text-sm text-white/50">
                                Bubblemaps blocks iframe embedding (X-Frame-Options).
                                Click the button above to open in a new tab.
                            </p>
                            <a href={`https://app.bubblemaps.io/${chain.toLowerCase()}/token/${tokenAddress}`}
                                target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors text-sm font-semibold">
                                <ExternalLink className="w-4 h-4" /> Open Bubblemaps
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer — data source info */}
            <div className="px-4 py-1.5 border-t border-white/[0.06] flex items-center justify-between flex-shrink-0 bg-black/20">
                <span className="text-[8px] text-white/15 font-mono">
                    {rows.length} txs · {Object.keys(makerStats).length} traders
                    {Object.keys(whaleNotes).length > 0 && <> · <Tag className="w-2 h-2 inline" /> {Object.keys(whaleNotes).length} notes</>}
                    {' · '}{pairAddress ? `${pairAddress.slice(0, 10)}…${pairAddress.slice(-6)}` : '—'}
                </span>
                <div className="flex items-center gap-3">
                    {/* Data source badge */}
                    {txs.length > 0 && (
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${
                            txs[0].source === 'subgraph'
                                ? 'bg-violet-500/15 text-violet-400'
                                : 'bg-cyan-500/15 text-cyan-400'
                        }`} title={
                            txs[0].source === 'subgraph'
                                ? 'Data from PancakeSwap subgraph (GraphQL) or Direct RPC eth_getLogs'
                                : 'Data from Etherscan V2 API (explorer)'
                        }>
                            {txs[0].source === 'subgraph' ? '⚡ RPC/Subgraph' : '🔍 Explorer API'}
                        </span>
                    )}
                    <span className="text-[8px] text-white/10">{chain} · poll {pollSeconds}s</span>
                </div>
            </div>
        </div>
    );
}
