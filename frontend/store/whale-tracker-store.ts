import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ──────────────────────────────────────────
 * Types
 * ────────────────────────────────────────── */
export type SupportedChain = 'BSC' | 'ETH' | 'POLYGON';
export type TxType = 'SELL' | 'BUY' | 'TRANSFER';
export type TxDirection = 'IN' | 'OUT';
export type WhaleSize = 'MEGA' | 'LARGE' | 'SHARK' | 'FISH';

export interface WatchedWallet {
    id: string;
    address: string;
    label: string;
    chain: SupportedChain;
    minValueUSD: number;
    addedAt: number;
    notes?: string;
    // v2: optional token filter
    tokenAddress?: string;   // if set, only track txs for this token contract
    tokenSymbol?: string;    // display name, e.g. "SIREN"
    pairAddress?: string;    // associated DEX pool address
}

export interface TokenPair {
    pairAddress: string;
    baseToken: { address: string; symbol: string; name: string };
    quoteToken: { address: string; symbol: string };
    dexId: string;
    priceUsd: string;
    volume24h: number;
    liquidity: number;
    chainId: string;         // dexscreener chain id (e.g. "bsc", "ethereum")
    chain: SupportedChain;
    priceChange24h: number;
    priceChange1h: number;
    marketCap: number;
    fdv: number;
    pairCreatedAt?: string;  // ISO date string
    imageUrl?: string;       // token logo from DexScreener info.imageUrl
}

export interface WhaleTx {
    hash: string;
    from: string;
    to: string;
    value: string;           // human-readable, e.g. "12.5 BNB"
    valueUSD: number;
    tokenSymbol: string;
    tokenAddress?: string;
    type: TxType;
    timestamp: number;
    pool?: string;           // DEX name if swap
    dexRouter?: string;
    direction: TxDirection;
    blockNumber?: string;
    whaleSize: WhaleSize;
    // v2 additions
    priceUsd?: number;         // token price at tx time
    pairTokenSymbol?: string;  // e.g. "WBNB", "USDT"
    pairTokenAmount?: string;  // amount of pair token exchanged
}

export interface WhaleAlert {
    id: string;
    walletId: string;
    walletLabel: string;
    walletAddress: string;
    chain: SupportedChain;
    tx: WhaleTx;
    createdAt: number;
    read: boolean;
}

export interface PoolInfo {
    poolAddress: string;
    dexId: string;
    pairName: string;
    priceUsd: string;
    volume24h: number;
    buyVolume24h: number;
    sellVolume24h: number;
    liquidity: number;
    sellRatio: number;
    priceChange24h: number;
    chainId: string;
}

/* ──────────────────────────────────────────
 * Derived helpers — BUY/SELL counts per wallet
 * ────────────────────────────────────────── */
export function getBuySellCounts(txs: WhaleTx[]): { buys: number; sells: number; buyVolumeUSD: number; sellVolumeUSD: number } {
    let buys = 0, sells = 0, buyVolumeUSD = 0, sellVolumeUSD = 0;
    for (const tx of txs) {
        if (tx.type === 'BUY') { buys++; buyVolumeUSD += tx.valueUSD; }
        if (tx.type === 'SELL') { sells++; sellVolumeUSD += tx.valueUSD; }
    }
    return { buys, sells, buyVolumeUSD, sellVolumeUSD };
}

/* ──────────────────────────────────────────
 * Store
 * ────────────────────────────────────────── */
export interface WhaleTrackerState {
    wallets: WatchedWallet[];
    txHistory: Record<string, WhaleTx[]>;   // walletId → txs (newest first)
    alerts: WhaleAlert[];
    isLoading: Record<string, boolean>;
    lastFetched: Record<string, number>;
    poolCache: Record<string, PoolInfo[]>;
    watchlistPairs: TokenPair[];            // saved pairs for watchlist
    recentSearchPairs: TokenPair[];         // recently viewed pairs (max 10)

    addWallet: (w: Omit<WatchedWallet, 'id' | 'addedAt'>) => string;
    removeWallet: (id: string) => void;
    updateWallet: (id: string, updates: Partial<Omit<WatchedWallet, 'id'>>) => void;
    setTxHistory: (walletId: string, txs: WhaleTx[]) => void;
    setLoading: (walletId: string, loading: boolean) => void;
    setLastFetched: (walletId: string) => void;
    setPoolCache: (tokenAddress: string, pools: PoolInfo[]) => void;
    addAlert: (a: Omit<WhaleAlert, 'id' | 'createdAt' | 'read'>) => void;
    markAllRead: () => void;
    markAlertRead: (id: string) => void;
    clearAlerts: () => void;
    unreadCount: () => number;
    addToWatchlist: (pair: TokenPair) => void;
    removeFromWatchlist: (pairAddress: string) => void;
    isInWatchlist: (pairAddress: string) => boolean;
    addRecentSearch: (pair: TokenPair) => void;
    clearRecentSearches: () => void;
}

export const useWhaleTrackerStore = create<WhaleTrackerState>()(
    persist(
        (set, get) => ({
            wallets: [],
            txHistory: {},
            alerts: [],
            isLoading: {},
            lastFetched: {},
            poolCache: {},
            watchlistPairs: [],
            recentSearchPairs: [],

            addWallet: (w) => {
                const id = crypto.randomUUID();
                set((s) => ({ wallets: [...s.wallets, { ...w, id, addedAt: Date.now() }] }));
                return id;
            },

            removeWallet: (id) =>
                set((s) => {
                    const { [id]: _tx, ...txHistory } = s.txHistory;
                    const { [id]: _lf, ...lastFetched } = s.lastFetched;
                    const { [id]: _ld, ...isLoading } = s.isLoading;
                    return {
                        wallets: s.wallets.filter((w) => w.id !== id),
                        txHistory, lastFetched, isLoading,
                        alerts: s.alerts.filter((a) => a.walletId !== id),
                    };
                }),

            updateWallet: (id, updates) =>
                set((s) => ({ wallets: s.wallets.map((w) => (w.id === id ? { ...w, ...updates } : w)) })),

            setTxHistory: (walletId, txs) =>
                set((s) => ({ txHistory: { ...s.txHistory, [walletId]: txs } })),

            setLoading: (walletId, loading) =>
                set((s) => ({ isLoading: { ...s.isLoading, [walletId]: loading } })),

            setLastFetched: (walletId) =>
                set((s) => ({ lastFetched: { ...s.lastFetched, [walletId]: Date.now() } })),

            setPoolCache: (tokenAddress, pools) =>
                set((s) => ({ poolCache: { ...s.poolCache, [tokenAddress.toLowerCase()]: pools } })),

            addAlert: (a) => {
                if (get().alerts.find((al) => al.tx.hash === a.tx.hash)) return;
                set((s) => ({
                    alerts: [
                        { ...a, id: crypto.randomUUID(), createdAt: Date.now(), read: false },
                        ...s.alerts.slice(0, 199),
                    ],
                }));
            },

            markAllRead: () => set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, read: true })) })),
            markAlertRead: (id) => set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)) })),
            clearAlerts: () => set({ alerts: [] }),
            unreadCount: () => get().alerts.filter((a) => !a.read).length,
            addToWatchlist: (pair) =>
                set((s) => {
                    if (s.watchlistPairs.find(p => p.pairAddress === pair.pairAddress)) return s;
                    return { watchlistPairs: [...s.watchlistPairs, pair] };
                }),
            removeFromWatchlist: (pairAddress) =>
                set((s) => ({ watchlistPairs: s.watchlistPairs.filter(p => p.pairAddress !== pairAddress) })),
            isInWatchlist: (pairAddress) =>
                get().watchlistPairs.some(p => p.pairAddress === pairAddress),
            addRecentSearch: (pair) =>
                set((s) => {
                    const filtered = s.recentSearchPairs.filter(p => p.pairAddress !== pair.pairAddress);
                    return { recentSearchPairs: [pair, ...filtered].slice(0, 10) };
                }),
            clearRecentSearches: () => set({ recentSearchPairs: [] }),
        }),
        {
            name: 'whale-tracker-store-v2',
            partialize: (state) => ({
                wallets: state.wallets,
                alerts: state.alerts.slice(0, 50),
                watchlistPairs: state.watchlistPairs,
                recentSearchPairs: state.recentSearchPairs,
            }),
        }
    )
);

/* ──────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────── */
export function classifyWhaleSize(valueUSD: number): WhaleSize {
    if (valueUSD >= 1_000_000) return 'MEGA';
    if (valueUSD >= 100_000) return 'LARGE';
    if (valueUSD >= 10_000) return 'SHARK';
    return 'FISH';
}

export const WHALE_SIZE_EMOJI: Record<WhaleSize, string> = {
    MEGA: '🐳', LARGE: '🐋', SHARK: '🦈', FISH: '🐟',
};

export const CHAIN_LABELS: Record<SupportedChain, { name: string; color: string; symbol: string; dexScreenerId: string }> = {
    BSC: { name: 'BNB Chain', color: '#F0B90B', symbol: 'BNB', dexScreenerId: 'bsc' },
    ETH: { name: 'Ethereum', color: '#627EEA', symbol: 'ETH', dexScreenerId: 'ethereum' },
    POLYGON: { name: 'Polygon', color: '#8247E5', symbol: 'MATIC', dexScreenerId: 'polygon' },
};

export const DEXSCREENER_CHAIN_MAP: Record<string, SupportedChain> = {
    bsc: 'BSC', ethereum: 'ETH', polygon: 'POLYGON',
};
