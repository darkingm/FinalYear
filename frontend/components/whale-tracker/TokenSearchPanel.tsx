'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, ExternalLink, Plus, Check } from 'lucide-react';
import { searchTokenPairs } from '@/lib/whale-api';
import { useWhaleTrackerStore, CHAIN_LABELS } from '@/store/whale-tracker-store';
import type { TokenPair, SupportedChain } from '@/store/whale-tracker-store';

const CHAIN_FILTERS: { value: SupportedChain | 'ALL'; label: string }[] = [
    { value: 'ALL', label: 'Tất cả' },
    { value: 'BSC', label: '🟡 BSC' },
    { value: 'ETH', label: '🔵 ETH' },
    { value: 'POLYGON', label: '🟣 MATIC' },
];

interface Props {
    /** When a pair is selected to attach to a new wallet */
    onSelectForWallet?: (pair: TokenPair) => void;
    /** Compact mode for slide panel */
    compact?: boolean;
}

function formatK(n: number) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
}

function PairRow({ pair, onSelect }: { pair: TokenPair; onSelect?: () => void }) {
    const chain = CHAIN_LABELS[pair.chain];
    const price = parseFloat(pair.priceUsd);
    const priceUp = pair.priceChange24h >= 0;
    const dexUrl = `https://dexscreener.com/${pair.chainId}/${pair.pairAddress}`;

    const dexLabel: Record<string, string> = {
        pancakeswap: 'PancakeSwap', uniswap: 'Uniswap',
        quickswap: 'QuickSwap', sushiswap: 'SushiSwap',
    };
    const dexName = dexLabel[pair.dexId?.toLowerCase()] || pair.dexId;

    return (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border hover:border-[#8247e5]/30 hover:bg-[#8247e5]/5 transition-all group">
            {/* Token info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm text-foreground">
                        {pair.baseToken.symbol}
                        <span className="text-muted-foreground font-normal">/{pair.quoteToken.symbol}</span>
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border"
                        style={{ color: chain.color, borderColor: chain.color + '40', backgroundColor: chain.color + '15' }}>
                        {pair.chain}
                    </span>
                    <span className="text-[10px] text-muted-foreground bg-accent/10 px-1.5 py-0.5 rounded">{dexName}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                    <span className="font-mono font-medium text-foreground">
                        ${price >= 1 ? price.toFixed(4) : price.toExponential(3)}
                    </span>
                    <span className={priceUp ? 'text-emerald-400' : 'text-red-400'}>
                        {priceUp ? '+' : ''}{pair.priceChange24h.toFixed(2)}%
                    </span>
                    <span>Vol: {formatK(pair.volume24h)}</span>
                    <span>Liq: {formatK(pair.liquidity)}</span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={dexUrl} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
                    onClick={(e) => e.stopPropagation()}>
                    <ExternalLink className="w-3.5 h-3.5" />
                </a>
                {onSelect && (
                    <button onClick={onSelect}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#8247e5]/10 border border-[#8247e5]/30 text-[#8247e5] text-xs font-semibold hover:bg-[#8247e5]/20 transition-colors">
                        <Plus className="w-3 h-3" /> Theo dõi
                    </button>
                )}
            </div>
        </div>
    );
}

export function TokenSearchPanel({ onSelectForWallet, compact = false }: Props) {
    const [query, setQuery] = useState('');
    const [chainFilter, setChainFilter] = useState<SupportedChain | 'ALL'>('ALL');
    const [pairs, setPairs] = useState<TokenPair[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();

    // Debounced search
    useEffect(() => {
        if (!query.trim()) { setPairs([]); setSearched(false); return; }
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setLoading(true); setSearched(true);
            try {
                const results = await searchTokenPairs(query, chainFilter === 'ALL' ? undefined : chainFilter);
                setPairs(results);
            } finally { setLoading(false); }
        }, 500);
        return () => clearTimeout(debounceRef.current);
    }, [query, chainFilter]);

    return (
        <div className="space-y-3">
            {/* Search input */}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-background border border-border focus-within:border-[#8247e5]/50 transition-colors">
                {loading ? <Loader2 className="w-4 h-4 text-[#8247e5] animate-spin flex-shrink-0" />
                    : <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                <input
                    type="text"
                    placeholder="Nhập tên token hoặc contract (vd: SIREN, 0x...)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-w-0"
                />
                {query && (
                    <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground transition-colors text-xs">✕</button>
                )}
            </div>

            {/* Chain filter */}
            <div className="flex gap-1.5 flex-wrap">
                {CHAIN_FILTERS.map((f) => (
                    <button key={f.value} onClick={() => setChainFilter(f.value)}
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${chainFilter === f.value
                                ? 'bg-[#8247e5]/20 border-[#8247e5]/50 text-[#8247e5]'
                                : 'border-border text-muted-foreground hover:border-[#8247e5]/30'
                            }`}>
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Results */}
            {pairs.length > 0 ? (
                <div className={`space-y-1.5 ${compact ? 'max-h-[300px] overflow-y-auto' : ''}`}>
                    <p className="text-xs text-muted-foreground px-1">{pairs.length} pool tìm thấy</p>
                    {pairs.map((p) => (
                        <PairRow
                            key={p.pairAddress}
                            pair={p}
                            onSelect={onSelectForWallet ? () => onSelectForWallet(p) : undefined}
                        />
                    ))}
                </div>
            ) : searched && !loading ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                    Không tìm thấy pool nào. Thử nhập contract address chính xác.
                </div>
            ) : !searched ? (
                <div className="text-center py-8 space-y-2">
                    <p className="text-2xl">🔍</p>
                    <p className="text-sm text-muted-foreground">Tìm bất kỳ token nào trên PancakeSwap, Uniswap, QuickSwap...</p>
                    <p className="text-xs text-muted-foreground">Kể cả token nhỏ ít người biết</p>
                </div>
            ) : null}
        </div>
    );
}
