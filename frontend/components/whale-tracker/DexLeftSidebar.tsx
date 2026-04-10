'use client';

import { useState, useEffect } from 'react';
import { Search, Star, TrendingUp, Sparkles, ArrowUpRight, ArrowDownRight, ChevronRight, Loader2, X, Clock, Trash2 } from 'lucide-react';
import { fetchTrendingPairs, searchTokenPairs } from '@/lib/whale-api';
import { useWhaleTrackerStore, CHAIN_LABELS } from '@/store/whale-tracker-store';
import type { TokenPair, SupportedChain } from '@/store/whale-tracker-store';
import { getTokenLogoUrl } from '@/lib/pair-tx-fetcher';

type SidebarTab = 'search' | 'watchlist' | 'trending' | 'new' | 'gainers';

function formatK(n: number) {
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
}

function formatAge(isoDate?: string) {
    if (!isoDate) return '';
    const diff = Date.now() - new Date(isoDate).getTime();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 365) return `${Math.floor(days / 365)}y`;
    if (days > 30) return `${Math.floor(days / 30)}mo`;
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
}

function TokenLogo({ pair, size = 28 }: { pair: TokenPair; size?: number }) {
    const [err, setErr] = useState(false);
    const twUrl = pair.baseToken.address ? getTokenLogoUrl(pair.chain, pair.baseToken.address) : null;
    const src = !err ? (pair.imageUrl || twUrl) : null;
    if (!src) {
        return (
            <span style={{ width: size, height: size }} className="rounded-full bg-gradient-to-br from-violet-500/30 to-blue-500/20 flex items-center justify-center text-[9px] font-black text-white/60 flex-shrink-0">
                {pair.baseToken.symbol.slice(0, 2)}
            </span>
        );
    }
    return <img src={src} alt={pair.baseToken.symbol} width={size} height={size} className="rounded-full flex-shrink-0 bg-white/5" onError={() => setErr(true)} />;
}

/* ── Mini pair row for sidebar lists ── */
function MiniPairRow({ pair, onClick, isSelected, showWatchlist }: {
    pair: TokenPair; onClick?: () => void; isSelected?: boolean; showWatchlist?: boolean;
}) {
    const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWhaleTrackerStore();
    const watching = isInWatchlist(pair.pairAddress);
    const up = pair.priceChange24h >= 0;
    const chain = CHAIN_LABELS[pair.chain];
    const price = parseFloat(pair.priceUsd);

    return (
        <div onClick={onClick}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all group ${isSelected
                ? 'bg-violet-500/10 border border-violet-500/30'
                : 'hover:bg-white/[0.04] border border-transparent'
                }`}>
            <TokenLogo pair={pair} size={28} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-white truncate">{pair.baseToken.symbol}</span>
                    <span className="text-[9px] text-white/25">/{pair.quoteToken.symbol}</span>
                    <span className="text-[8px] px-1 py-0 rounded font-semibold"
                        style={{ color: chain.color, backgroundColor: chain.color + '15' }}>
                        {pair.chain}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-white/30">
                    <span className="font-mono text-white/50">${price >= 1 ? price.toFixed(2) : price < 0.0001 ? price.toExponential(2) : price.toFixed(5)}</span>
                    <span>Vol: {formatK(pair.volume24h)}</span>
                </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                <span className={`text-[10px] font-bold flex items-center gap-0.5 ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                    {up ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                    {up ? '+' : ''}{pair.priceChange24h.toFixed(1)}%
                </span>
                {showWatchlist && (
                    <button onClick={(e) => { e.stopPropagation(); watching ? removeFromWatchlist(pair.pairAddress) : addToWatchlist(pair); }}
                        className={`p-0.5 rounded transition-colors ${watching ? 'text-amber-400' : 'text-white/15 hover:text-white/40'}`}>
                        <Star className="w-3 h-3" fill={watching ? 'currentColor' : 'none'} />
                    </button>
                )}
            </div>
        </div>
    );
}

interface Props {
    onSelectPair: (pair: TokenPair) => void;
    selectedPairAddress?: string;
    isOpen?: boolean;
    onClose?: () => void;
}

export function DexLeftSidebar({ onSelectPair, selectedPairAddress, isOpen = true, onClose }: Props) {
    const [tab, setTab] = useState<SidebarTab>('search');
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<TokenPair[]>([]);
    const [trendingPairs, setTrendingPairs] = useState<TokenPair[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const { watchlistPairs, recentSearchPairs, addRecentSearch, clearRecentSearches } = useWhaleTrackerStore();
    const debounceRef = useState<ReturnType<typeof setTimeout>>(null!);

    // Wrap onSelectPair to also save to recent searches
    const handleSelectPair = (pair: TokenPair) => {
        addRecentSearch(pair);
        onSelectPair(pair);
    };

    // Fetch trending on mount
    useEffect(() => {
        fetchTrendingPairs().then(setTrendingPairs);
    }, []);

    // Debounced search
    useEffect(() => {
        if (!query.trim()) { setSearchResults([]); setSearched(false); return; }
        if (debounceRef[0]) clearTimeout(debounceRef[0]);
        const timer = setTimeout(async () => {
            setLoading(true); setSearched(true);
            try {
                const results = await searchTokenPairs(query);
                setSearchResults(results);
            } finally { setLoading(false); }
        }, 400);
        debounceRef[0] = timer;
        return () => clearTimeout(timer);
    }, [query]);

    const newPairs = trendingPairs.filter(p => {
        if (!p.pairCreatedAt) return false;
        const age = Date.now() - new Date(p.pairCreatedAt).getTime();
        return age < 7 * 86400000; // < 7 days
    });

    const gainers = [...trendingPairs].sort((a, b) => b.priceChange24h - a.priceChange24h).slice(0, 15);
    const losers = [...trendingPairs].sort((a, b) => a.priceChange24h - b.priceChange24h).slice(0, 15);

    const TABS: { key: SidebarTab; icon: React.ReactNode; label: string }[] = [
        { key: 'search', icon: <Search className="w-3.5 h-3.5" />, label: 'Search' },
        { key: 'watchlist', icon: <Star className="w-3.5 h-3.5" />, label: 'Watchlist' },
        { key: 'trending', icon: <TrendingUp className="w-3.5 h-3.5" />, label: 'Trending' },
        { key: 'new', icon: <Sparkles className="w-3.5 h-3.5" />, label: 'New' },
        { key: 'gainers', icon: <ArrowUpRight className="w-3.5 h-3.5" />, label: 'Top' },
    ];

    return (
        <div className={`flex flex-col h-full bg-[#0d0d15] border-r border-white/[0.06] ${isOpen ? '' : 'hidden lg:flex'}`}>
            {/* Mobile close */}
            {onClose && (
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] lg:hidden">
                    <span className="text-xs font-bold text-white/50">Menu</span>
                    <button onClick={onClose} className="p-1 text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Tab buttons */}
            <div className="flex border-b border-white/[0.06] flex-shrink-0">
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[8px] font-semibold transition-colors ${tab === t.key ? 'text-white bg-white/[0.04] border-b-2 border-violet-500' : 'text-white/30 hover:text-white/50'}`}>
                        {t.icon}
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Search input (always visible for search tab) */}
            {tab === 'search' && (
                <div className="px-2.5 py-2 flex-shrink-0">
                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] focus-within:border-violet-500/40 transition-colors">
                        {loading ? <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin flex-shrink-0" />
                            : <Search className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />}
                        <input type="text" placeholder="Search token or paste address..."
                            value={query} onChange={(e) => setQuery(e.target.value)}
                            className="flex-1 bg-transparent text-[11px] text-white placeholder:text-white/20 focus:outline-none min-w-0" />
                        {query && <button onClick={() => setQuery('')} className="text-white/20 hover:text-white text-[10px]">✕</button>}
                    </div>
                </div>
            )}

            {/* Content area */}
            <div className="flex-1 overflow-y-auto min-h-0 px-1.5 pb-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#ffffff15 transparent' }}>
                {/* SEARCH TAB */}
                {tab === 'search' && (
                    <>
                        {searchResults.length > 0 ? (
                            <div className="space-y-0.5">
                                <p className="text-[9px] text-white/20 px-2 py-1">{searchResults.length} kết quả</p>
                                {searchResults.map(p => (
                                    <MiniPairRow key={p.pairAddress} pair={p}
                                        onClick={() => handleSelectPair(p)} isSelected={selectedPairAddress === p.pairAddress} showWatchlist />
                                ))}
                            </div>
                        ) : searched && !loading ? (
                            <div className="text-center py-8 text-[11px] text-white/20">Không tìm thấy pool nào</div>
                        ) : !searched ? (
                            <>
                                {/* Recent Searches */}
                                {recentSearchPairs.length > 0 ? (
                                    <div className="space-y-0.5">
                                        <div className="flex items-center justify-between px-2 py-1">
                                            <p className="text-[9px] text-white/25 flex items-center gap-1">
                                                <Clock className="w-2.5 h-2.5" /> Đã xem gần đây
                                            </p>
                                            <button onClick={clearRecentSearches}
                                                className="text-[8px] text-white/15 hover:text-red-400 transition-colors flex items-center gap-0.5">
                                                <Trash2 className="w-2.5 h-2.5" /> Xóa
                                            </button>
                                        </div>
                                        {recentSearchPairs.map(p => (
                                            <MiniPairRow key={p.pairAddress} pair={p}
                                                onClick={() => handleSelectPair(p)} isSelected={selectedPairAddress === p.pairAddress} showWatchlist />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 space-y-1.5">
                                        <Search className="w-6 h-6 text-white/10 mx-auto" />
                                        <p className="text-[10px] text-white/20">Tìm token trên BSC, ETH, Polygon</p>
                                    </div>
                                )}
                            </>
                        ) : null}
                    </>
                )}

                {/* WATCHLIST TAB */}
                {tab === 'watchlist' && (
                    <div className="space-y-0.5">
                        {watchlistPairs.length > 0 ? (
                            <>
                                <p className="text-[9px] text-white/20 px-2 py-1 flex items-center gap-1">
                                    <Star className="w-2.5 h-2.5" fill="currentColor" /> {watchlistPairs.length} pairs saved
                                </p>
                                {watchlistPairs.map(p => (
                                    <MiniPairRow key={p.pairAddress} pair={p}
                                        onClick={() => handleSelectPair(p)} isSelected={selectedPairAddress === p.pairAddress} showWatchlist />
                                ))}
                            </>
                        ) : (
                            <div className="text-center py-8 space-y-2">
                                <Star className="w-6 h-6 text-white/10 mx-auto" />
                                <p className="text-[10px] text-white/20">Chưa có pair nào trong watchlist</p>
                                <p className="text-[9px] text-white/15">Click ⭐ trên kết quả search để thêm</p>
                            </div>
                        )}
                    </div>
                )}

                {/* TRENDING TAB */}
                {tab === 'trending' && (
                    <div className="space-y-0.5">
                        <p className="text-[9px] text-white/20 px-2 py-1 flex items-center gap-1">
                            <TrendingUp className="w-2.5 h-2.5" /> Hot pairs by volume
                        </p>
                        {trendingPairs.length > 0 ? trendingPairs.slice(0, 20).map(p => (
                            <MiniPairRow key={p.pairAddress} pair={p}
                                onClick={() => handleSelectPair(p)} isSelected={selectedPairAddress === p.pairAddress} showWatchlist />
                        )) : (
                            <div className="text-center py-8 text-[10px] text-white/20">
                                <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2 text-violet-400/50" />
                                Loading trending...
                            </div>
                        )}
                    </div>
                )}

                {/* NEW PAIRS TAB */}
                {tab === 'new' && (
                    <div className="space-y-0.5">
                        <p className="text-[9px] text-white/20 px-2 py-1 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> Pairs &lt; 7 days old
                        </p>
                        {newPairs.length > 0 ? newPairs.map(p => (
                            <MiniPairRow key={p.pairAddress} pair={p}
                                onClick={() => handleSelectPair(p)} isSelected={selectedPairAddress === p.pairAddress} showWatchlist />
                        )) : (
                            <div className="text-center py-8 text-[10px] text-white/20">Không có pair mới trong trending</div>
                        )}
                    </div>
                )}

                {/* GAINERS/LOSERS TAB */}
                {tab === 'gainers' && (
                    <div className="space-y-2">
                        <div>
                            <p className="text-[9px] text-emerald-400/60 px-2 py-1 font-bold flex items-center gap-1">
                                <ArrowUpRight className="w-2.5 h-2.5" /> Top Gainers 24h
                            </p>
                            {gainers.slice(0, 8).map(p => (
                                <MiniPairRow key={p.pairAddress} pair={p} onClick={() => handleSelectPair(p)} isSelected={selectedPairAddress === p.pairAddress} />
                            ))}
                        </div>
                        <div className="border-t border-white/[0.06] pt-1">
                            <p className="text-[9px] text-red-400/60 px-2 py-1 font-bold flex items-center gap-1">
                                <ArrowDownRight className="w-2.5 h-2.5" /> Top Losers 24h
                            </p>
                            {losers.slice(0, 8).map(p => (
                                <MiniPairRow key={p.pairAddress} pair={p} onClick={() => handleSelectPair(p)} isSelected={selectedPairAddress === p.pairAddress} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
