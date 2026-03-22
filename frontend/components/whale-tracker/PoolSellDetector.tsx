'use client';

import { useState } from 'react';
import { Search, ExternalLink, TrendingDown, TrendingUp, Loader2 } from 'lucide-react';
import { fetchPoolData, getSellPressureLabel } from '@/lib/whale-api';
import type { PoolInfo, SupportedChain } from '@/store/whale-tracker-store';
import Link from 'next/link';

interface Props {
    defaultToken?: string;
    defaultChain?: SupportedChain;
}

function PoolRow({ pool }: { pool: PoolInfo }) {
    const pressure = getSellPressureLabel(pool.sellRatio);
    const sellPct = (pool.sellRatio * 100).toFixed(0);
    const buyPct = (100 - pool.sellRatio * 100).toFixed(0);
    const dexScreenerUrl = `https://dexscreener.com/${pool.chainId}/${pool.poolAddress}`;

    return (
        <div className="rounded-xl border border-border bg-card/40 p-3 space-y-2.5">
            {/* Pool header */}
            <div className="flex items-start justify-between gap-2">
                <div>
                    <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-foreground">{pool.pairName}</span>
                        <span className="text-[10px] text-muted-foreground uppercase bg-accent/10 px-1.5 py-0.5 rounded">{pool.dexId}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        ${parseFloat(pool.priceUsd).toLocaleString('en-US', { maximumSignificantDigits: 6 })}
                        <span className={`ml-2 font-semibold ${pool.priceChange24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {pool.priceChange24h >= 0 ? '+' : ''}{pool.priceChange24h.toFixed(2)}%
                        </span>
                    </p>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${pressure.color}`}>{pressure.icon} {pressure.label}</span>
                    <Link href={dexScreenerUrl} target="_blank" className="text-muted-foreground hover:text-foreground transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </div>

            {/* Buy vs Sell bar */}
            <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-medium">
                    <span className="text-emerald-400 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> BUY {buyPct}%
                    </span>
                    <span className="text-red-400 flex items-center gap-1">
                        SELL {sellPct}% <TrendingDown className="w-3 h-3" />
                    </span>
                </div>
                <div className="h-2 rounded-full bg-accent/20 overflow-hidden flex">
                    <div
                        className="h-full bg-emerald-500/70 rounded-l-full transition-all duration-500"
                        style={{ width: `${buyPct}%` }}
                    />
                    <div
                        className="h-full bg-red-500/70 rounded-r-full transition-all duration-500"
                        style={{ width: `${sellPct}%` }}
                    />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div>
                    <p className="text-muted-foreground">Volume 24h</p>
                    <p className="font-semibold text-foreground">${(pool.volume24h / 1000).toFixed(1)}K</p>
                </div>
                <div>
                    <p className="text-muted-foreground">Thanh khoản</p>
                    <p className="font-semibold text-foreground">${(pool.liquidity / 1000).toFixed(1)}K</p>
                </div>
                <div>
                    <p className="text-muted-foreground">Áp lực xả</p>
                    <p className={`font-semibold ${pressure.color}`}>{sellPct}%</p>
                </div>
            </div>
        </div>
    );
}

const CHAINS: { value: SupportedChain; label: string }[] = [
    { value: 'BSC', label: 'BSC' },
    { value: 'ETH', label: 'ETH' },
    { value: 'POLYGON', label: 'MATIC' },
];

export function PoolSellDetector({ defaultToken = '', defaultChain = 'BSC' }: Props) {
    const [token, setToken] = useState(defaultToken);
    const [chain, setChain] = useState<SupportedChain>(defaultChain);
    const [pools, setPools] = useState<PoolInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const handleSearch = async () => {
        if (!token.trim()) return;
        setLoading(true);
        setSearched(true);
        try {
            const data = await fetchPoolData(token.trim(), chain);
            setPools(data);
        } finally {
            setLoading(false);
        }
    };

    const highSellPool = pools.find((p) => p.sellRatio >= 0.6);

    return (
        <div className="space-y-3">
            {/* Search bar */}
            <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-background border border-border focus-within:border-[#8247e5]/50 transition-colors">
                    <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <input
                        type="text"
                        placeholder="Contract address hoặc tên token (vd: SIREN)"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-w-0"
                    />
                </div>
                <div className="flex gap-1">
                    {CHAINS.map((c) => (
                        <button
                            key={c.value}
                            onClick={() => setChain(c.value)}
                            className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-colors ${chain === c.value
                                    ? 'bg-[#8247e5] text-white'
                                    : 'bg-accent/10 text-muted-foreground hover:bg-accent/20'
                                }`}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={handleSearch}
                    disabled={loading || !token.trim()}
                    className="px-4 py-2 rounded-xl bg-[#8247e5] text-white text-sm font-semibold hover:bg-[#8247e5]/90 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '🔍'}
                    {loading ? 'Đang tìm…' : 'Phân tích'}
                </button>
            </div>

            {/* Sell warning banner */}
            {highSellPool && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-sm">
                    <span className="text-lg">🚨</span>
                    <div>
                        <p className="font-bold text-red-400">Phát hiện xả hàng!</p>
                        <p className="text-xs text-red-300/80 mt-0.5">
                            Pool <strong>{highSellPool.pairName}</strong> ({highSellPool.dexId}) đang có{' '}
                            <strong>{(highSellPool.sellRatio * 100).toFixed(0)}% SELL volume</strong>.
                            Dev có thể đang xả qua pool này.
                        </p>
                    </div>
                </div>
            )}

            {/* Pool list */}
            {pools.length > 0 ? (
                <div className="space-y-2">
                    {pools.map((p) => (
                        <PoolRow key={p.poolAddress} pool={p} />
                    ))}
                </div>
            ) : searched && !loading ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                    Không tìm thấy pool nào. Thử nhập contract address chính xác.
                </div>
            ) : !searched ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                    Nhập contract address hoặc tên token để phân tích pool
                </div>
            ) : null}
        </div>
    );
}
