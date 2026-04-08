'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Copy, ExternalLink, Shield, ShieldAlert, ShieldCheck, ShieldX,
    Star, Clock, Users, Droplets, Activity, X, Twitter, Globe,
    CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { fetchTokenInfo, fetchGoPlusSecurity, type TokenInfo, type GoPlusSecurityInfo } from '@/lib/whale-api';
import { useWhaleTrackerStore, CHAIN_LABELS } from '@/store/whale-tracker-store';
import type { TokenPair, SupportedChain } from '@/store/whale-tracker-store';
import { getTokenLogoUrl } from '@/lib/pair-tx-fetcher';

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
    const [err, setErr] = useState(false);
    const src = !err ? (pair.imageUrl || getTokenLogoUrl(pair.chain, pair.baseToken.address)) : null;
    if (!src) {
        return <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center text-sm font-black text-white/60">{pair.baseToken.symbol.slice(0, 2)}</div>;
    }
    return <img src={src} alt={pair.baseToken.symbol} width={40} height={40} className="rounded-full bg-white/5" onError={() => setErr(true)} />;
}

export function DexRightSidebar({ pair, isOpen = true, onClose }: Props) {
    const [security, setSecurity] = useState<GoPlusSecurityInfo | null>(null);
    const [securityLoading, setSecurityLoading] = useState(false);
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
                {/* ── Token Header ── */}
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
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-lg font-black text-white">{priceStr}</span>
                        <span className={`text-[11px] font-bold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                            {up ? '+' : ''}{pair.priceChange24h.toFixed(2)}%
                        </span>
                    </div>
                </div>

                {/* ── Pair Created + Pool Info ── */}
                <div className="px-3 py-2.5 border-b border-white/[0.06] space-y-1.5">
                    {pair.pairCreatedAt && (
                        <div className="flex items-center justify-between text-[9px]">
                            <span className="text-white/25 flex items-center gap-1"><Clock className="w-3 h-3" /> Pair created</span>
                            <span className="text-white/60 font-semibold">{fmtAge(pair.pairCreatedAt)} ago</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between text-[9px]">
                        <span className="text-white/25 flex items-center gap-1"><Droplets className="w-3 h-3" /> Liquidity</span>
                        <span className="text-white/60 font-semibold">{fmt(pair.liquidity)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[9px]">
                        <span className="text-white/25">Mkt Cap</span>
                        <span className="text-white/60 font-semibold">{fmt(pair.marketCap)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[9px]">
                        <span className="text-white/25">FDV</span>
                        <span className="text-white/60 font-semibold">{fmt(pair.fdv)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[9px]">
                        <span className="text-white/25">Vol 24h</span>
                        <span className="text-white/60 font-semibold">{fmt(pair.volume24h)}</span>
                    </div>
                </div>

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
                            <Twitter className="w-3 h-3" /> Search on Twitter
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

                {/* ── DEX badge ── */}
                <div className="px-3 py-2 text-[9px] text-white/15 border-t border-white/[0.04]">
                    <span className="font-mono">{pair.dexId}</span> · <span style={{ color: chain.color }}>{chain.name}</span>
                </div>
            </div>
        </div>
    );
}
