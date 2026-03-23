'use client';

/**
 * TokenInfoPanel v2 — DexScreener-style token fundamentals
 * Shows: price/24h%, vol 1h/24h, liquidity, market cap, FDV
 * Supply section: total | circulating | burned (🔥) with % progress bars
 * Data: DexScreener (price/vol) + GeckoTerminal (supply/holders) + Etherscan V2 (burn balance)
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    TrendingUp, TrendingDown, Droplets, Activity, Copy,
    ExternalLink, Clock, Users, Flame, Lock, Unlock,
} from 'lucide-react';
import { fetchTokenInfo, type TokenInfo } from '@/lib/whale-api';
import { getTokenLogoUrl } from '@/lib/pair-tx-fetcher';
import type { SupportedChain } from '@/store/whale-tracker-store';

interface Props {
    tokenAddress?: string;
    tokenSymbol?: string;
    chain: SupportedChain;
    onClose?: () => void;
}

/* ── Formatters ── */
function fmtUsd(n: number | undefined) {
    if (!n) return '—';
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
}

/** Format token count: 21,000,000 → "21.00M", with dot-separated full number */
function fmtSupply(raw: string | number | undefined, showFull = false): string {
    if (!raw) return '—';
    const n = typeof raw === 'string' ? parseFloat(raw) : raw;
    if (isNaN(n) || n === 0) return '—';
    const full = n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    const short = n >= 1_000_000_000_000 ? `${(n / 1_000_000_000_000).toFixed(2)}T`
        : n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(2)}B`
            : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M`
                : n >= 1_000 ? `${(n / 1_000).toFixed(2)}K`
                    : n.toFixed(2);
    return showFull ? `${short} (${full})` : short;
}

function fmtAge(s: number | undefined) {
    if (!s) return '—';
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    if (d > 365) return `${Math.floor(d / 365)}y ${Math.floor((d % 365) / 30)}m`;
    if (d > 30) return `${Math.floor(d / 30)}mo`;
    if (d > 0) return `${d}d ${h}h`;
    return `${h}h`;
}

function PctBadge({ v }: { v: number }) {
    const up = v >= 0;
    return (
        <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${up ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
            {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {up ? '+' : ''}{v.toFixed(2)}%
        </span>
    );
}

function SupplyBar({ label, value, max, color, icon }: {
    label: string; value: number; max: number;
    color: string; icon: React.ReactNode;
}) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-[9px]">
                <div className="flex items-center gap-1 text-white/40">
                    {icon}<span>{label}</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="font-bold text-white/70">{fmtSupply(value)}</span>
                    {max > 0 && <span className="text-white/25">({pct.toFixed(1)}%)</span>}
                </div>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

function TokenAvatar({ chain, address, symbol, logoUrl }: { chain: SupportedChain; address: string; symbol: string; logoUrl?: string }) {
    const [err, setErr] = useState(false);
    const src = logoUrl || (address ? getTokenLogoUrl(chain, address) : '');
    if (!err && src) {
        return <img src={src} alt={symbol} width={32} height={32} className="rounded-full" onError={() => setErr(true)} />;
    }
    return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center text-xs font-black text-white">
            {symbol.slice(0, 2)}
        </div>
    );
}

const CHAIN_EXPLORER: Record<SupportedChain, string> = {
    BSC: 'https://bscscan.com/token/',
    ETH: 'https://etherscan.io/token/',
    POLYGON: 'https://polygonscan.com/token/',
};

export function TokenInfoPanel({ tokenAddress, tokenSymbol, chain, onClose }: Props) {
    const [info, setInfo] = useState<TokenInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const query = tokenAddress || tokenSymbol;
        if (!query) return;
        setLoading(true);
        setInfo(null);
        fetchTokenInfo(query, chain)
            .then(setInfo)
            .finally(() => setLoading(false));
    }, [tokenAddress, tokenSymbol, chain]);

    const copy = () => {
        if (!info?.address) return;
        navigator.clipboard.writeText(info.address);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    if (loading) return (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3 animate-pulse">
            <div className="flex gap-3"><div className="w-8 h-8 rounded-full bg-white/10" /><div className="h-4 bg-white/10 rounded w-1/2" /></div>
            <div className="grid grid-cols-4 gap-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-white/5 rounded" />)}</div>
            <div className="h-10 bg-white/5 rounded" />
        </div>
    );

    if (!info) return (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-white/20 text-xs text-center">
            {tokenSymbol || tokenAddress ? `Không tìm thấy dữ liệu cho ${tokenSymbol || tokenAddress}` : 'Chọn token để xem thông tin'}
        </div>
    );

    const priceNum = parseFloat(info.priceUsd);
    const priceStr = priceNum < 0.0001 ? priceNum.toFixed(8) : priceNum < 1 ? priceNum.toFixed(5) : priceNum.toFixed(3);
    const totalNum = parseFloat(info.totalSupply || '0');
    const circNum = parseFloat(info.circulatingSupply || '0');
    const burnNum = parseFloat(info.burnedSupply || '0');
    const lockedNum = totalNum > 0 ? Math.max(0, totalNum - circNum - burnNum) : 0;
    const hasSupplyData = totalNum > 0;

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden text-white">

            {/* ── Header: logo + name + price ── */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/8">
                <div className="flex items-center gap-2">
                    <TokenAvatar chain={chain} address={info.address} symbol={info.symbol} logoUrl={info.logoUrl} />
                    <div>
                        <p className="text-sm font-bold leading-tight">{info.symbol}
                            <span className="text-white/35 font-normal text-xs ml-1">{info.name}</span>
                        </p>
                        <p className="text-[9px] text-white/25">{info.dexId} · {chain}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-base font-black">${priceStr}</p>
                    <PctBadge v={info.priceChange24h} />
                </div>
            </div>

            {/* ── Vol / Txn stats ── */}
            <div className="grid grid-cols-4 divide-x divide-white/8 border-b border-white/8">
                {[
                    { label: 'Vol 1h', value: fmtUsd(info.volume1h) },
                    { label: 'Vol 24h', value: fmtUsd(info.volume24h) },
                    { label: 'Mua 24h', value: info.buys24h.toLocaleString(), color: 'text-emerald-400' },
                    { label: 'Bán 24h', value: info.sells24h.toLocaleString(), color: 'text-red-400' },
                ].map(({ label, value, color }) => (
                    <div key={label} className="px-2 py-2 text-center">
                        <p className="text-[8px] text-white/25 mb-0.5">{label}</p>
                        <p className={`text-[10px] font-bold ${color || 'text-white'}`}>{value}</p>
                    </div>
                ))}
            </div>

            {/* ── Market metrics ── */}
            <div className="grid grid-cols-3 divide-x divide-white/8 border-b border-white/8">
                {[
                    { icon: <Droplets className="w-2.5 h-2.5" />, label: 'Liquidity', value: fmtUsd(info.liquidity) },
                    { icon: <Activity className="w-2.5 h-2.5" />, label: 'Mkt Cap', value: fmtUsd(info.marketCap || info.fdv) },
                    { icon: <TrendingUp className="w-2.5 h-2.5" />, label: 'FDV', value: fmtUsd(info.fdv) },
                ].map(({ icon, label, value }) => (
                    <div key={label} className="px-3 py-2 flex items-center gap-1.5">
                        <span className="text-white/25">{icon}</span>
                        <div>
                            <p className="text-[8px] text-white/25">{label}</p>
                            <p className="text-[10px] font-bold">{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Supply section ── */}
            {hasSupplyData && (
                <div className="px-3 py-2.5 border-b border-white/8 space-y-2">
                    <p className="text-[8px] font-bold text-white/25 uppercase tracking-wider">Supply</p>

                    {/* Total supply with large number */}
                    <div className="flex items-center justify-between text-[10px]">
                        <span className="text-white/30">Tổng cung</span>
                        <div className="text-right">
                            <span className="font-black text-white">{fmtSupply(totalNum)}</span>
                            <span className="text-white/20 text-[8px] ml-1">({totalNum.toLocaleString('en-US')})</span>
                        </div>
                    </div>

                    {/* Supply bars */}
                    <div className="space-y-1.5 mt-1">
                        {circNum > 0 && (
                            <SupplyBar label="Lưu thông" value={circNum} max={totalNum} color="bg-emerald-500/70" icon={<Unlock className="w-2.5 h-2.5" />} />
                        )}
                        {burnNum > 0 && (
                            <SupplyBar label="Đã đốt 🔥" value={burnNum} max={totalNum} color="bg-orange-500/70" icon={<Flame className="w-2.5 h-2.5" />} />
                        )}
                        {lockedNum > 0 && (
                            <SupplyBar label="Locked/Vest" value={lockedNum} max={totalNum} color="bg-violet-500/50" icon={<Lock className="w-2.5 h-2.5" />} />
                        )}
                    </div>

                    {/* Burned % badge */}
                    {info.burnedPercent && info.burnedPercent > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                            <Flame className="w-3 h-3 text-orange-400" />
                            <span className="text-[10px] text-orange-400 font-bold">{info.burnedPercent.toFixed(2)}% đã đốt</span>
                            <span className="text-[9px] text-white/20">({fmtSupply(burnNum)} token)</span>
                        </div>
                    )}
                </div>
            )}

            {/* ── Unlock schedule placeholder ── */}
            <div className="px-3 py-2 border-b border-white/8">
                <div className="flex items-center gap-1 text-[8px] text-white/20">
                    <Clock className="w-2.5 h-2.5" />
                    <span className="font-bold uppercase tracking-wider">Unlock Schedule</span>
                </div>
                <div className="mt-1.5 text-[9px] text-white/20 italic">
                    Dữ liệu unlock: Xem trên{' '}
                    <a href={`https://token.unlocks.app/`} target="_blank" rel="noopener noreferrer"
                        className="text-violet-400 hover:text-violet-300 not-italic">
                        token.unlocks.app ↗
                    </a>
                    {' '}·{' '}
                    <a href={`https://vestlab.io/`} target="_blank" rel="noopener noreferrer"
                        className="text-violet-400 hover:text-violet-300 not-italic">
                        vestlab.io ↗
                    </a>
                </div>
            </div>

            {/* ── Holders + Age ── */}
            <div className="flex items-center gap-3 px-3 py-2 border-b border-white/8 flex-wrap">
                {info.holders && (
                    <div className="flex items-center gap-1 text-[9px]">
                        <Users className="w-2.5 h-2.5 text-white/25" />
                        <span className="text-white/30">Holders:</span>
                        <span className="font-bold text-white/70">{info.holders.toLocaleString()}</span>
                    </div>
                )}
                {info.ageSeconds && (
                    <div className="flex items-center gap-1 text-[9px]">
                        <Clock className="w-2.5 h-2.5 text-white/25" />
                        <span className="text-white/30">Age:</span>
                        <span className="font-bold text-white/70">{fmtAge(info.ageSeconds)}</span>
                    </div>
                )}
                <div className="ml-auto flex items-center gap-1">
                    <PctBadge v={info.priceChange1h} />
                    <span className="text-[8px] text-white/20">1h</span>
                </div>
            </div>

            {/* ── Contract row ── */}
            <div className="flex items-center justify-between px-3 py-2">
                <p className="text-[9px] text-white/25 font-mono">
                    {info.address ? `${info.address.slice(0, 8)}…${info.address.slice(-6)}` : '—'}
                </p>
                <div className="flex items-center gap-2">
                    <button onClick={copy} className="text-[9px] text-white/30 hover:text-white flex items-center gap-1 transition-colors">
                        <Copy className="w-3 h-3" />{copied ? 'Copied!' : 'Copy'}
                    </button>
                    {info.address && (
                        <a href={`${CHAIN_EXPLORER[chain]}${info.address}`} target="_blank" rel="noopener noreferrer"
                            className="text-[9px] text-white/30 hover:text-white flex items-center gap-1 transition-colors">
                            <ExternalLink className="w-3 h-3" />Explorer
                        </a>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
