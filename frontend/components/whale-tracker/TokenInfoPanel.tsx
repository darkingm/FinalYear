'use client';

/**
 * TokenInfoPanel — displays comprehensive on-chain token fundamentals
 * Data: DexScreener (price/volume/txns) + GeckoTerminal (supply/holders)
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Droplets, Activity, Copy, ExternalLink, Clock, Users } from 'lucide-react';
import { fetchTokenInfo, type TokenInfo } from '@/lib/whale-api';
import type { SupportedChain } from '@/store/whale-tracker-store';

interface Props {
    tokenAddress?: string;
    tokenSymbol?: string;
    chain: SupportedChain;
    onClose?: () => void;
}

function fmt(n: number | undefined) {
    if (!n) return '—';
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
}

function fmtNum(n: string | number | undefined) {
    if (!n) return '—';
    const num = typeof n === 'string' ? parseFloat(n) : n;
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function fmtAge(s: number | undefined) {
    if (!s) return '—';
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    if (d > 0) return `${d}d ${h}h`;
    return `${h}h`;
}

function PctBadge({ v }: { v: number }) {
    const up = v >= 0;
    return (
        <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded ${up ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
            {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {up ? '+' : ''}{v.toFixed(2)}%
        </span>
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

    if (loading) {
        return (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 animate-pulse">
                <div className="h-4 bg-white/10 rounded w-1/2 mb-3" />
                <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-white/5 rounded" />)}
                </div>
                <div className="h-3 bg-white/5 rounded w-3/4 mt-3" />
            </div>
        );
    }

    if (!info) {
        return (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-white/30 text-xs text-center">
                {tokenSymbol || tokenAddress ? `Không tìm thấy dữ liệu cho ${tokenSymbol || tokenAddress}` : 'Chọn token để xem thông tin'}
            </div>
        );
    }

    const priceNum = parseFloat(info.priceUsd);
    const priceStr = priceNum < 0.001 ? priceNum.toFixed(8) : priceNum < 1 ? priceNum.toFixed(6) : priceNum.toFixed(4);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center text-xs font-black text-white">
                        {info.symbol.slice(0, 2)}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white">{info.symbol} <span className="text-white/40 font-normal text-xs">/ {info.name}</span></p>
                        <p className="text-[10px] text-white/30">{info.dexId} · {chain}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-base font-black text-white">${priceStr}</span>
                    <PctBadge v={info.priceChange24h} />
                </div>
            </div>

            {/* 1h / Vol stats row */}
            <div className="grid grid-cols-4 divide-x divide-white/8 border-b border-white/8">
                {[
                    { label: 'Vol 1h', value: fmt(info.volume1h) },
                    { label: 'Vol 24h', value: fmt(info.volume24h) },
                    { label: 'Mua 24h', value: info.buys24h.toLocaleString() },
                    { label: 'Bán 24h', value: info.sells24h.toLocaleString() },
                ].map(({ label, value }) => (
                    <div key={label} className="px-3 py-2.5 text-center">
                        <p className="text-[10px] text-white/30 mb-0.5">{label}</p>
                        <p className="text-xs font-bold text-white">{value}</p>
                    </div>
                ))}
            </div>

            {/* Liquidity + Market cap */}
            <div className="grid grid-cols-3 divide-x divide-white/8 border-b border-white/8">
                {[
                    { icon: Droplets, label: 'Liquidity', value: fmt(info.liquidity) },
                    { icon: Activity, label: 'Market Cap', value: fmt(info.marketCap || info.fdv) },
                    { icon: TrendingUp, label: 'FDV', value: fmt(info.fdv) },
                ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="px-3 py-2 flex items-center gap-2">
                        <Icon className="w-3 h-3 text-white/30 flex-shrink-0" />
                        <div>
                            <p className="text-[9px] text-white/30">{label}</p>
                            <p className="text-xs font-bold text-white">{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Supply / Holders / Age */}
            <div className="px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1 border-b border-white/8">
                {info.circulatingSupply && (
                    <div className="text-[10px]">
                        <span className="text-white/30">Lưu thông: </span>
                        <span className="text-white/70 font-bold">{fmtNum(info.circulatingSupply)} {info.symbol}</span>
                    </div>
                )}
                {info.totalSupply && (
                    <div className="text-[10px]">
                        <span className="text-white/30">Tổng cung: </span>
                        <span className="text-white/70 font-bold">{fmtNum(info.totalSupply)} {info.symbol}</span>
                    </div>
                )}
                {info.holders && (
                    <div className="text-[10px] flex items-center gap-1">
                        <Users className="w-2.5 h-2.5 text-white/30" />
                        <span className="text-white/30">Holders: </span>
                        <span className="text-white/70 font-bold">{info.holders.toLocaleString()}</span>
                    </div>
                )}
                {info.ageSeconds && (
                    <div className="text-[10px] flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-white/30" />
                        <span className="text-white/30">Age: </span>
                        <span className="text-white/70 font-bold">{fmtAge(info.ageSeconds)}</span>
                    </div>
                )}
                <PctBadge v={info.priceChange1h} />
                <span className="text-[9px] text-white/20">1h</span>
            </div>

            {/* Contract row */}
            <div className="flex items-center justify-between px-4 py-2">
                <p className="text-[10px] text-white/30 font-mono">
                    {info.address ? `${info.address.slice(0, 8)}…${info.address.slice(-6)}` : '—'}
                </p>
                <div className="flex items-center gap-2">
                    <button onClick={copy} className="text-[10px] text-white/40 hover:text-white flex items-center gap-1">
                        <Copy className="w-3 h-3" />{copied ? 'Copied!' : 'Copy'}
                    </button>
                    {info.address && (
                        <a href={`${CHAIN_EXPLORER[chain]}${info.address}`} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] text-white/40 hover:text-white flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />Explorer
                        </a>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
