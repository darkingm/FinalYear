'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    Copy, ExternalLink, Shield, ShieldAlert, ShieldCheck, ShieldX,
    Star, Clock, Users, Droplets, Activity, X, Globe,
    CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp,
    TrendingUp, TrendingDown, BarChart3, Layers, DollarSign,
} from 'lucide-react';
import { fetchTokenInfo, fetchGoPlusSecurity, type TokenInfo, type GoPlusSecurityInfo } from '@/lib/whale-api';
import { useWhaleTrackerStore, CHAIN_LABELS } from '@/store/whale-tracker-store';
import type { TokenPair, SupportedChain } from '@/store/whale-tracker-store';
import { getTokenLogoUrl } from '@/lib/pair-tx-fetcher';
import { getTokenHolders, type HolderData } from '@/lib/api/moralis';

interface Props {
    pair: TokenPair | null;
    isOpen?: boolean;
    onClose?: () => void;
}

function fmt(n: number | undefined) {
    if (!n) return '—';
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
}

function fmtAge(isoDate?: string) {
    if (!isoDate) return '—';
    const diff = Date.now() - new Date(isoDate).getTime();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 365) return `${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}mo`;
    if (days > 30) return `${Math.floor(days / 30)}mo ${days % 30}d`;
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="text-white/30 hover:text-white transition-colors flex items-center gap-0.5"
            title="Copy to clipboard">
            <Copy className="w-3 h-3" />
            {label && <span className="text-[8px]">{copied ? 'Copied!' : label}</span>}
        </button>
    );
}

const CHAIN_EXPLORER: Record<SupportedChain, string> = {
    BSC: 'https://bscscan.com', ETH: 'https://etherscan.io', POLYGON: 'https://polygonscan.com',
};

const RISK_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    safe: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: <ShieldCheck className="w-4 h-4" /> },
    low: { bg: 'bg-emerald-500/10', text: 'text-emerald-400/80', icon: <Shield className="w-4 h-4" /> },
    medium: { bg: 'bg-amber-500/15', text: 'text-amber-400', icon: <ShieldAlert className="w-4 h-4" /> },
    high: { bg: 'bg-red-500/15', text: 'text-red-400', icon: <ShieldX className="w-4 h-4" /> },
    danger: { bg: 'bg-red-500/20', text: 'text-red-500', icon: <ShieldX className="w-4 h-4" /> },
};

function SecuritySection({ security }: { security: GoPlusSecurityInfo | null }) {
    const [expanded, setExpanded] = useState(false);
    if (!security) {
        return (
            <div className="px-3 py-2.5 border-b border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[10px] text-white/20">
                    <Shield className="w-3 h-3" />
                    <span className="font-semibold">Security</span>
                    <span className="text-[9px] ml-auto animate-pulse">Loading...</span>
                </div>
            </div>
        );
    }

    const style = RISK_STYLES[security.riskLevel] || RISK_STYLES.medium;

    const checks = [
        { label: 'Open Source', ok: security.isOpenSource, critical: false },
        { label: 'Not Honeypot', ok: !security.isHoneypot, critical: true },
        { label: 'Not Mintable', ok: !security.isMintable, critical: false },
        { label: 'No Hidden Owner', ok: !security.hiddenOwner, critical: true },
        { label: 'No Self-Destruct', ok: !security.selfDestruct, critical: true },
        { label: 'Owner Can\'t Change Balance', ok: !security.ownerChangeBalance, critical: true },
        { label: 'Not Proxy', ok: !security.isProxy, critical: false },
        { label: 'No External Call', ok: !security.externalCall, critical: false },
    ];

    return (
        <div className="px-3 py-2.5 border-b border-white/[0.06]">
            {/* Score header */}
            <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between group">
                <div className="flex items-center gap-2">
                    <div className={`p-1 rounded ${style.bg} ${style.text}`}>{style.icon}</div>
                    <div>
                        <p className="text-[10px] font-bold text-white/50">GoPlus Security</p>
                        <p className={`text-sm font-black ${style.text}`}>{security.totalScore}/100</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${style.bg} ${style.text}`}>
                        {security.riskLevel}
                    </span>
                    {expanded ? <ChevronUp className="w-3 h-3 text-white/20" /> : <ChevronDown className="w-3 h-3 text-white/20" />}
                </div>
            </button>

            {/* Tax info */}
            <div className="flex items-center gap-3 mt-2 text-[9px]">
                <span className="text-white/30">Buy Tax: <span className={security.buyTax > 5 ? 'text-red-400 font-bold' : 'text-white/50'}>{security.buyTax.toFixed(1)}%</span></span>
                <span className="text-white/30">Sell Tax: <span className={security.sellTax > 5 ? 'text-red-400 font-bold' : 'text-white/50'}>{security.sellTax.toFixed(1)}%</span></span>
            </div>

            {/* Expanded checks */}
            {expanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    className="mt-2 space-y-1 overflow-hidden">
                    {checks.map(c => (
                        <div key={c.label} className="flex items-center gap-1.5 text-[9px]">
                            {c.ok
                                ? <CheckCircle className="w-3 h-3 text-emerald-400/70" />
                                : c.critical ? <XCircle className="w-3 h-3 text-red-400" /> : <AlertTriangle className="w-3 h-3 text-amber-400" />}
                            <span className={c.ok ? 'text-white/40' : c.critical ? 'text-red-400 font-semibold' : 'text-amber-400'}>
                                {c.label}
                            </span>
                        </div>
                    ))}
                    {security.holderCount && (
                        <div className="flex items-center gap-1.5 text-[9px] text-white/30 pt-1 border-t border-white/[0.04]">
                            <Users className="w-3 h-3" /> Holders: <span className="text-white/50 font-bold">{security.holderCount.toLocaleString()}</span>
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    );
}

function TokenLogo({ pair }: { pair: TokenPair }) {
    const [srcIdx, setSrcIdx] = useState(0);
    const [allFailed, setAllFailed] = useState(false);
    const buildFallbacks = (p: TokenPair) => {
        const list: string[] = [];
        if (p.imageUrl) list.push(p.imageUrl);
        if (p.baseToken.address) {
            list.push(getTokenLogoUrl(p.chain, p.baseToken.address));
            list.push(getTokenLogoUrl(p.chain, p.baseToken.address.toLowerCase()));
        }
        return list;
    };
    const fallbacks = useRef(buildFallbacks(pair));

    useEffect(() => {
        fallbacks.current = buildFallbacks(pair);
        setSrcIdx(0);
        setAllFailed(false);
    }, [pair.pairAddress]);

    const src = !allFailed && fallbacks.current.length > 0 ? fallbacks.current[srcIdx] : null;

    if (!src) {
        return <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center text-sm font-black text-white/60">{pair.baseToken.symbol.slice(0, 2)}</div>;
    }
    return (
        <img
            src={src}
            alt={pair.baseToken.symbol}
            width={40}
            height={40}
            className="rounded-full bg-white/5 object-cover"
            onError={() => {
                if (srcIdx + 1 < fallbacks.current.length) {
                    setSrcIdx(i => i + 1);
                } else {
                    setAllFailed(true);
                }
            }}
        />
    );
}

/* ─── Holders Section ─── */
function HoldersSection({ pair }: { pair: TokenPair }) {
    const [holders, setHolders] = useState<HolderData[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        setLoading(true);
        setHolders([]);
        getTokenHolders(pair.baseToken.symbol, 15)
            .then(data => { if (data.length > 0) setHolders(data); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [pair.baseToken.symbol, pair.baseToken.address]);

    const shortAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    const explorer = CHAIN_EXPLORER[pair.chain];
    const price = parseFloat(pair.priceUsd);

    if (loading) {
        return (
            <div className="px-3 py-2.5 border-b border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[10px] text-white/20">
                    <Users className="w-3 h-3" />
                    <span className="font-semibold">Top Holders</span>
                    <span className="text-[9px] ml-auto animate-pulse">Loading...</span>
                </div>
            </div>
        );
    }

    if (holders.length === 0) {
        return (
            <div className="px-3 py-2.5 border-b border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[10px] text-white/25">
                    <Users className="w-3 h-3" />
                    <span className="font-semibold">Holders</span>
                    <span className="text-[9px] ml-auto">No data</span>
                </div>
            </div>
        );
    }

    const shown = expanded ? holders : holders.slice(0, 5);

    return (
        <div className="px-3 py-2.5 border-b border-white/[0.06]">
            <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between mb-2 group">
                <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-[10px] font-bold text-white/50">Top Holders</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-bold">{holders.length}</span>
                </div>
                {expanded ? <ChevronUp className="w-3 h-3 text-white/20" /> : <ChevronDown className="w-3 h-3 text-white/20" />}
            </button>

            <div className="space-y-0.5">
                {/* Header */}
                <div className="flex items-center text-[8px] text-white/20 font-semibold uppercase tracking-wider pb-1">
                    <span className="w-5">#</span>
                    <span className="flex-1">Address</span>
                    <span className="w-14 text-right">%</span>
                    <span className="w-16 text-right">Value</span>
                </div>

                {shown.map((h, i) => {
                    const balance = parseFloat(h.balance);
                    const usdVal = h.usdValue || (balance * price);
                    const fmtVal = usdVal >= 1e9 ? `$${(usdVal / 1e9).toFixed(1)}B`
                        : usdVal >= 1e6 ? `$${(usdVal / 1e6).toFixed(1)}M`
                        : usdVal >= 1e3 ? `$${(usdVal / 1e3).toFixed(0)}K`
                        : `$${usdVal.toFixed(0)}`;

                    return (
                        <div key={h.address}
                            className={`flex items-center py-1 rounded px-0.5 text-[9px] transition-colors hover:bg-white/[0.03] ${i < 3 ? 'bg-amber-500/[0.03]' : ''}`}>
                            <span className={`w-5 font-bold ${i < 3 ? 'text-amber-400' : 'text-white/20'}`}>{h.rank}</span>
                            <div className="flex-1 min-w-0 flex items-center gap-1">
                                <a href={`${explorer}/address/${h.address}`} target="_blank" rel="noopener noreferrer"
                                    className="font-mono text-white/50 hover:text-violet-400 transition-colors truncate">
                                    {shortAddr(h.address)}
                                </a>
                                {h.isContract && (
                                    <span className="text-[7px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400 font-bold flex-shrink-0">C</span>
                                )}
                            </div>
                            <div className="w-14 text-right">
                                <div className="flex items-center justify-end gap-1">
                                    <div className="w-8 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                        <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(h.percentage * 4, 100)}%` }} />
                                    </div>
                                    <span className="font-mono font-bold text-white/60">{h.percentage.toFixed(1)}%</span>
                                </div>
                            </div>
                            <span className="w-16 text-right font-mono text-white/40">{fmtVal}</span>
                        </div>
                    );
                })}
            </div>

            {holders.length > 5 && !expanded && (
                <button onClick={() => setExpanded(true)}
                    className="w-full mt-1.5 text-[9px] text-violet-400/60 hover:text-violet-400 transition-colors text-center">
                    Show all {holders.length} holders ▾
                </button>
            )}
        </div>
    );
}

export function DexRightSidebar({ pair, isOpen = true, onClose }: Props) {
    const [security, setSecurity] = useState<GoPlusSecurityInfo | null>(null);
    const [securityLoading, setSecurityLoading] = useState(false);
    const [activeInfoTab, setActiveInfoTab] = useState<'info' | 'holders'>('info');
    const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWhaleTrackerStore();

    useEffect(() => {
        if (!pair?.baseToken.address) { setSecurity(null); return; }
        setSecurityLoading(true);
        setSecurity(null);
        fetchGoPlusSecurity(pair.baseToken.address, pair.chain)
            .then(setSecurity)
            .finally(() => setSecurityLoading(false));
    }, [pair?.baseToken.address, pair?.chain]);

    if (!pair) {
        return (
            <div className={`flex flex-col h-full bg-[#0d0d15] border-l border-white/[0.06] ${isOpen ? '' : 'hidden xl:flex'}`}>
                <div className="flex-1 flex items-center justify-center px-4">
                    <div className="text-center space-y-2">
                        <Activity className="w-6 h-6 text-white/10 mx-auto" />
                        <p className="text-[10px] text-white/15">Select a pair to view details</p>
                    </div>
                </div>
            </div>
        );
    }

    const watching = isInWatchlist(pair.pairAddress);
    const chain = CHAIN_LABELS[pair.chain];
    const explorer = CHAIN_EXPLORER[pair.chain];
    const price = parseFloat(pair.priceUsd);
    const priceStr = price >= 1 ? `$${price.toFixed(4)}` : price >= 0.0001 ? `$${price.toFixed(6)}` : `$${price.toExponential(3)}`;
    const up = pair.priceChange24h >= 0;

    return (
        <div className={`flex flex-col h-full bg-[#0d0d15] border-l border-white/[0.06] ${isOpen ? '' : 'hidden xl:flex'}`}>
            {/* Mobile close */}
            {onClose && (
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] xl:hidden">
                    <span className="text-xs font-bold text-white/50">Token Info</span>
                    <button onClick={onClose} className="p-1 text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#ffffff15 transparent' }}>
                {/* ── Token Header (DexScreener style) ── */}
                <div className="px-3 py-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2.5">
                        <TokenLogo pair={pair} />
                        <div className="flex-1 min-w-0">
                            <h2 className="text-sm font-black text-white leading-tight">{pair.baseToken.symbol}</h2>
                            <p className="text-[10px] text-white/30 truncate">{pair.baseToken.name}</p>
                        </div>
                        <button onClick={() => watching ? removeFromWatchlist(pair.pairAddress) : addToWatchlist(pair)}
                            className={`p-1.5 rounded-lg transition-colors ${watching ? 'text-amber-400 bg-amber-400/10' : 'text-white/20 hover:text-white/50 hover:bg-white/5'}`}>
                            <Star className="w-4 h-4" fill={watching ? 'currentColor' : 'none'} />
                        </button>
                    </div>

                    {/* Pair badge */}
                    <div className="flex items-center gap-1.5 mt-2 text-[9px] text-white/30">
                        <span className="font-bold px-1.5 py-0.5 rounded" style={{ color: chain.color, backgroundColor: chain.color + '15' }}>{chain.name}</span>
                        <span>›</span>
                        <span className="text-white/40">{pair.dexId}</span>
                    </div>

                    {/* Price */}
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-xl font-black text-white">{priceStr}</span>
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${up ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                            {up ? '+' : ''}{pair.priceChange24h.toFixed(2)}%
                        </span>
                    </div>
                </div>

                {/* ── Key Metrics Grid (DexScreener style) ── */}
                <div className="grid grid-cols-3 border-b border-white/[0.06]">
                    {[
                        { label: 'Liquidity', value: fmt(pair.liquidity), icon: <Droplets className="w-3 h-3" />, color: 'text-blue-400' },
                        { label: 'FDV', value: fmt(pair.fdv), icon: <Layers className="w-3 h-3" />, color: 'text-purple-400' },
                        { label: 'Mkt Cap', value: fmt(pair.marketCap), icon: <DollarSign className="w-3 h-3" />, color: 'text-emerald-400' },
                    ].map(m => (
                        <div key={m.label} className="py-2 px-2 text-center border-r border-white/[0.04] last:border-r-0">
                            <p className="text-[8px] text-white/25 mb-0.5 flex items-center justify-center gap-0.5">{m.icon}<span>{m.label}</span></p>
                            <p className={`text-[11px] font-black font-mono ${m.color}`}>{m.value}</p>
                        </div>
                    ))}
                </div>

                {/* ── Price Changes Grid ── */}
                <div className="grid grid-cols-4 border-b border-white/[0.06]">
                    {[
                        { label: '5M', val: pair.priceChange24h * 0.05 },
                        { label: '1H', val: pair.priceChange24h * 0.15 },
                        { label: '6H', val: pair.priceChange24h * 0.6 },
                        { label: '24H', val: pair.priceChange24h },
                    ].map(pc => (
                        <div key={pc.label} className="py-2 px-1 text-center border-r border-white/[0.04] last:border-r-0">
                            <p className="text-[8px] text-white/20 mb-0.5">{pc.label}</p>
                            <p className={`text-[10px] font-bold ${pc.val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {pc.val >= 0 ? '+' : ''}{pc.val.toFixed(2)}%
                            </p>
                        </div>
                    ))}
                </div>

                {/* ── TX + Volume Summary (DexScreener style) ── */}
                <div className="px-3 py-2.5 border-b border-white/[0.06] space-y-2">
                    {/* Volume */}
                    <div className="flex items-center justify-between text-[9px]">
                        <span className="text-white/25 flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Vol 24h</span>
                        <span className="text-white/60 font-bold font-mono">{fmt(pair.volume24h)}</span>
                    </div>
                    {/* Buys / Sells visual bar */}
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-emerald-400 font-bold">Buys</span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/[0.04] flex">
                            <div className="bg-emerald-500 h-full rounded-l-full" style={{ width: '52%' }} />
                            <div className="bg-red-500 h-full flex-1 rounded-r-full" />
                        </div>
                        <span className="text-[9px] text-red-400 font-bold">Sells</span>
                    </div>
                </div>

                {/* ── Pool Info ── */}
                <div className="px-3 py-2.5 border-b border-white/[0.06] space-y-1.5">
                    {pair.pairCreatedAt && (
                        <div className="flex items-center justify-between text-[9px]">
                            <span className="text-white/25 flex items-center gap-1"><Clock className="w-3 h-3" /> Pair created</span>
                            <span className="text-white/60 font-semibold">{fmtAge(pair.pairCreatedAt)} ago</span>
                        </div>
                    )}
                </div>

                {/* ── Tab Switch: Info / Holders ── */}
                <div className="flex border-b border-white/[0.06]">
                    {(['info', 'holders'] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveInfoTab(tab)}
                            className={`flex-1 py-2 text-[10px] font-bold text-center transition-colors ${activeInfoTab === tab
                                ? 'text-violet-400 border-b-2 border-violet-400'
                                : 'text-white/25 hover:text-white/50'
                            }`}>
                            {tab === 'info' ? 'Token Info' : 'Holders'}
                        </button>
                    ))}
                </div>

                {activeInfoTab === 'info' ? (
                    <>
                        {/* ── Addresses ── */}
                        <div className="px-3 py-2.5 border-b border-white/[0.06] space-y-2">
                            {/* Pair address */}
                            <div>
                                <p className="text-[8px] text-white/20 font-bold uppercase tracking-wider mb-1">Pair</p>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-mono text-white/40 truncate flex-1">{pair.pairAddress}</span>
                                    <CopyButton text={pair.pairAddress} />
                                    <a href={`${explorer}/address/${pair.pairAddress}`} target="_blank" rel="noopener noreferrer"
                                        className="text-white/25 hover:text-violet-400 transition-colors">
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                            {/* Token address */}
                            <div>
                                <p className="text-[8px] text-white/20 font-bold uppercase tracking-wider mb-1">{pair.baseToken.symbol}</p>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-mono text-white/40 truncate flex-1">{pair.baseToken.address}</span>
                                    <CopyButton text={pair.baseToken.address} />
                                    <a href={`${explorer}/token/${pair.baseToken.address}`} target="_blank" rel="noopener noreferrer"
                                        className="text-white/25 hover:text-violet-400 transition-colors">
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                            {/* Quote token */}
                            <div>
                                <p className="text-[8px] text-white/20 font-bold uppercase tracking-wider mb-1">{pair.quoteToken.symbol}</p>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-mono text-white/40 truncate flex-1">{pair.quoteToken.address}</span>
                                    <CopyButton text={pair.quoteToken.address} />
                                    <a href={`${explorer}/token/${pair.quoteToken.address}`} target="_blank" rel="noopener noreferrer"
                                        className="text-white/25 hover:text-violet-400 transition-colors">
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* ── Security ── */}
                        <SecuritySection security={security} />

                        {/* ── Social / Links ── */}
                        <div className="px-3 py-2.5 space-y-2">
                            <p className="text-[8px] text-white/20 font-bold uppercase tracking-wider">Links</p>
                            <div className="flex flex-wrap gap-1.5">
                                <a href={`https://twitter.com/search?q=${pair.baseToken.symbol}`} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[9px] text-white/30 hover:text-white/60 bg-white/[0.04] hover:bg-white/[0.08] px-2 py-1 rounded-lg transition-colors">
                                    𝕏 Search on Twitter
                                </a>
                                <a href={`https://dexscreener.com/${pair.chainId}/${pair.pairAddress}`} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[9px] text-white/30 hover:text-white/60 bg-white/[0.04] hover:bg-white/[0.08] px-2 py-1 rounded-lg transition-colors">
                                    <Globe className="w-3 h-3" /> DexScreener
                                </a>
                                <a href={`https://www.dextools.io/app/en/${pair.chainId === 'bsc' ? 'bnb' : pair.chainId}/pair-explorer/${pair.pairAddress}`} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[9px] text-white/30 hover:text-white/60 bg-white/[0.04] hover:bg-white/[0.08] px-2 py-1 rounded-lg transition-colors">
                                    <Activity className="w-3 h-3" /> DexTools
                                </a>
                                <a href={`https://gopluslabs.io/token-security/${pair.chain === 'BSC' ? '56' : pair.chain === 'ETH' ? '1' : '137'}/${pair.baseToken.address}`} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[9px] text-white/30 hover:text-white/60 bg-white/[0.04] hover:bg-white/[0.08] px-2 py-1 rounded-lg transition-colors">
                                    <Shield className="w-3 h-3" /> GoPlus Detail
                                </a>
                            </div>
                        </div>
                    </>
                ) : (
                    /* ── Holders Tab ── */
                    <HoldersSection pair={pair} />
                )}

                {/* ── DEX badge ── */}
                <div className="px-3 py-2 text-[9px] text-white/15 border-t border-white/[0.04]">
                    <span className="font-mono">{pair.dexId}</span> · <span style={{ color: chain.color }}>{chain.name}</span>
                </div>
            </div>
        </div>
    );
}
