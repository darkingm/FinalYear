/**
 * whale-api.ts v3 — On-Chain Tracker API helpers
 *
 * Changes vs v2:
 * - Uses `ApiKeyRotator` for multi-key round-robin per chain
 * - Correct per-chain explorer endpoints (BSCScan / Etherscan / Polygonscan)
 * - `fetchTokenInfo()` — GeckoTerminal + DexScreener token fundamentals
 * - `recordTx()` — persists BUY/SELL to backend DB
 * - `getWalletStats()` — reads persistent counters from backend
 * - Improved BUY/SELL classification using full DEX router list
 */

import type { SupportedChain, WhaleTx, PoolInfo, TxType, TxDirection, TokenPair } from '@/store/whale-tracker-store';
import { classifyWhaleSize, CHAIN_LABELS, DEXSCREENER_CHAIN_MAP } from '@/store/whale-tracker-store';
import { ApiKeyRotator, EXPLORER_CONFIG, type ExplorerChain, classifyTxType } from './onchain-api-manager';

/* ── Mapped types ── */
const CHAIN_TO_EXPLORER: Record<SupportedChain, ExplorerChain> = {
    BSC: 'BSC', ETH: 'ETH', POLYGON: 'POLYGON',
};

/* ── Native price cache (60s TTL) ── */
const priceCache: Record<string, { price: number; at: number }> = {};

export async function getNativePrice(chain: SupportedChain): Promise<number> {
    const cached = priceCache[chain];
    if (cached && Date.now() - cached.at < 60_000) return cached.price;
    try {
        const sym = EXPLORER_CONFIG[CHAIN_TO_EXPLORER[chain]].nativePriceSymbol;
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`);
        const data = await res.json();
        const price = parseFloat(data.price || '0');
        priceCache[chain] = { price, at: Date.now() };
        return price;
    } catch {
        return priceCache[chain]?.price || 300;
    }
}

/* ── Map Etherscan token tx row → WhaleTx ── */
function mapTokenTxRow(tx: any, walletAddress: string, nativeSymbol: string): WhaleTx {
    const decimals = parseInt(tx.tokenDecimal || '18');
    const rawValue = parseFloat(tx.value) / Math.pow(10, decimals);
    const { type, dexName } = classifyTxType(tx.to || '', tx.from || '', walletAddress);
    const direction: TxDirection = (tx.to || '').toLowerCase() === walletAddress.toLowerCase() ? 'IN' : 'OUT';

    return {
        hash: tx.hash, from: tx.from, to: tx.to,
        value: `${rawValue.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${tx.tokenSymbol}`,
        valueUSD: 0,
        tokenSymbol: tx.tokenSymbol,
        tokenAddress: tx.contractAddress,
        type, direction, timestamp: parseInt(tx.timeStamp) * 1000,
        pool: dexName, dexRouter: dexName ? (tx.to || '').toLowerCase() : undefined,
        blockNumber: tx.blockNumber,
        whaleSize: classifyWhaleSize(0),
        pairTokenSymbol: direction === 'OUT' ? nativeSymbol : undefined,
    };
}

/* ── Map native tx row → WhaleTx ── */
function mapNativeTxRow(tx: any, walletAddress: string, chain: SupportedChain, nativePrice: number): WhaleTx {
    const cfg = EXPLORER_CONFIG[CHAIN_TO_EXPLORER[chain]];
    const valueEth = parseFloat(tx.value) / 1e18;
    const valueUSD = valueEth * nativePrice;
    const { type, dexName } = classifyTxType(tx.to || '', tx.from || '', walletAddress);
    const direction: TxDirection = (tx.to || '').toLowerCase() === walletAddress.toLowerCase() ? 'IN' : 'OUT';

    return {
        hash: tx.hash, from: tx.from, to: tx.to,
        value: `${valueEth.toFixed(4)} ${cfg.nativeSymbol}`,
        valueUSD, tokenSymbol: cfg.nativeSymbol, type, direction,
        timestamp: parseInt(tx.timeStamp) * 1000,
        pool: dexName, dexRouter: dexName ? (tx.to || '').toLowerCase() : undefined,
        blockNumber: tx.blockNumber,
        whaleSize: classifyWhaleSize(valueUSD),
    };
}

/* ── fetchWalletTxs — native coin txs ── */
export async function fetchWalletTxs(address: string, chain: SupportedChain, limit = 20): Promise<WhaleTx[]> {
    const nativePrice = await getNativePrice(chain);
    const explorer = CHAIN_TO_EXPLORER[chain];
    try {
        const data = await ApiKeyRotator.fetch(explorer, {
            module: 'account', action: 'txlist',
            address, startblock: '0', endblock: '99999999',
            page: '1', offset: String(limit), sort: 'desc',
        });
        if (data.status !== '1') return [];
        return (data.result as any[]).map(tx => mapNativeTxRow(tx, address, chain, nativePrice));
    } catch (e) {
        console.error('[whale-api] fetchWalletTxs:', e);
        return [];
    }
}

/* ── fetchTokenTransfers — ERC20/BEP20 (all tokens) ── */
export async function fetchTokenTransfers(address: string, chain: SupportedChain, limit = 20): Promise<WhaleTx[]> {
    const cfg = EXPLORER_CONFIG[CHAIN_TO_EXPLORER[chain]];
    const explorer = CHAIN_TO_EXPLORER[chain];
    try {
        const data = await ApiKeyRotator.fetch(explorer, {
            module: 'account', action: 'tokentx',
            address, page: '1', offset: String(limit), sort: 'desc',
        });
        if (data.status !== '1') return [];
        return (data.result as any[]).map(tx => mapTokenTxRow(tx, address, cfg.nativeSymbol));
    } catch (e) {
        console.error('[whale-api] fetchTokenTransfers:', e);
        return [];
    }
}

/* ── fetchWalletTxsByToken — filter by specific token contract ── */
export async function fetchWalletTxsByToken(
    address: string, chain: SupportedChain, tokenAddress: string, limit = 50
): Promise<WhaleTx[]> {
    const cfg = EXPLORER_CONFIG[CHAIN_TO_EXPLORER[chain]];
    const explorer = CHAIN_TO_EXPLORER[chain];
    try {
        const data = await ApiKeyRotator.fetch(explorer, {
            module: 'account', action: 'tokentx',
            address, contractaddress: tokenAddress,
            page: '1', offset: String(limit), sort: 'desc',
        });
        if (data.status !== '1') return [];
        return (data.result as any[]).map(tx => mapTokenTxRow(tx, address, cfg.nativeSymbol));
    } catch (e) {
        console.error('[whale-api] fetchWalletTxsByToken:', e);
        return [];
    }
}

/* ── fetchAllWalletActivity -— native + token, deduped ── */
export async function fetchAllWalletActivity(address: string, chain: SupportedChain): Promise<WhaleTx[]> {
    const [native, tokens] = await Promise.all([
        fetchWalletTxs(address, chain, 15),
        fetchTokenTransfers(address, chain, 15),
    ]);
    const seen = new Set<string>();
    const all: WhaleTx[] = [];
    for (const tx of [...native, ...tokens]) {
        const key = tx.hash + tx.tokenSymbol;
        if (!seen.has(key)) { seen.add(key); all.push(tx); }
    }
    return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, 30);
}

/* ── searchTokenPairs — DexScreener ── */
export async function searchTokenPairs(query: string, chainFilter?: SupportedChain): Promise<TokenPair[]> {
    if (!query.trim()) return [];
    const url = query.startsWith('0x')
        ? `https://api.dexscreener.com/latest/dex/tokens/${query.trim()}`
        : `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(query.trim())}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        const SUPPORTED = new Set(['bsc', 'ethereum', 'polygon']);
        return (data.pairs || [])
            .filter((p: any) => {
                if (!SUPPORTED.has(p.chainId)) return false;
                if (chainFilter && DEXSCREENER_CHAIN_MAP[p.chainId] !== chainFilter) return false;
                return true;
            })
            .slice(0, 20)
            .map((p: any): TokenPair => ({
                pairAddress: p.pairAddress,
                baseToken: { address: p.baseToken?.address || '', symbol: p.baseToken?.symbol || '', name: p.baseToken?.name || '' },
                quoteToken: { address: p.quoteToken?.address || '', symbol: p.quoteToken?.symbol || '' },
                dexId: p.dexId || '', priceUsd: p.priceUsd || '0',
                volume24h: p.volume?.h24 || 0,
                liquidity: p.liquidity?.usd || 0,
                chainId: p.chainId,
                chain: DEXSCREENER_CHAIN_MAP[p.chainId] || 'BSC',
                priceChange24h: p.priceChange?.h24 || 0,
            }))
            .sort((a: TokenPair, b: TokenPair) => b.liquidity - a.liquidity);
    } catch (e) {
        console.error('[whale-api] searchTokenPairs:', e);
        return [];
    }
}

/* ── fetchTokenInfo — DexScreener + GeckoTerminal fundamentals ── */
export interface TokenInfo {
    symbol: string;
    name: string;
    address: string;
    chainId: string;
    priceUsd: string;
    priceChange1h: number;
    priceChange24h: number;
    volume1h: number;
    volume4h: number;
    volume24h: number;
    buys24h: number;
    sells24h: number;
    liquidity: number;
    fdv: number;
    marketCap: number;
    pairAddress: string;
    dexId: string;
    // GeckoTerminal extras
    totalSupply?: string;
    circulatingSupply?: string;
    holders?: number;
    ageSeconds?: number;
}

export async function fetchTokenInfo(tokenAddressOrSymbol: string, chain: SupportedChain): Promise<TokenInfo | null> {
    const dexChain = CHAIN_LABELS[chain].dexScreenerId;
    const isAddr = tokenAddressOrSymbol.startsWith('0x');
    const url = isAddr
        ? `https://api.dexscreener.com/latest/dex/tokens/${tokenAddressOrSymbol}`
        : `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(tokenAddressOrSymbol)}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        const pairs: any[] = (data.pairs || []).filter((p: any) => p.chainId === dexChain);
        if (!pairs.length) return null;

        // Take highest liquidity pair
        const p = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];

        const info: TokenInfo = {
            symbol: p.baseToken?.symbol || '',
            name: p.baseToken?.name || '',
            address: p.baseToken?.address || '',
            chainId: p.chainId,
            priceUsd: p.priceUsd || '0',
            priceChange1h: p.priceChange?.h1 || 0,
            priceChange24h: p.priceChange?.h24 || 0,
            volume1h: p.volume?.h1 || 0,
            volume4h: p.volume?.h6 || 0,   // DexScreener uses h6 for 4-6h
            volume24h: p.volume?.h24 || 0,
            buys24h: p.txns?.h24?.buys || 0,
            sells24h: p.txns?.h24?.sells || 0,
            liquidity: p.liquidity?.usd || 0,
            fdv: p.fdv || 0,
            marketCap: p.marketCap || 0,
            pairAddress: p.pairAddress || '',
            dexId: p.dexId || '',
        };

        // Try GeckoTerminal for extra token fundamentals (non-blocking)
        if (info.address) {
            fetchGeckoTerminalInfo(info.address, dexChain).then(extra => {
                if (extra) {
                    info.totalSupply = extra.totalSupply;
                    info.circulatingSupply = extra.circulatingSupply;
                    info.holders = extra.holders;
                    info.ageSeconds = extra.ageSeconds;
                }
            }).catch(() => {/* ignore */ });
        }

        return info;
    } catch (e) {
        console.error('[whale-api] fetchTokenInfo:', e);
        return null;
    }
}

async function fetchGeckoTerminalInfo(tokenAddress: string, geckoDexChain: string): Promise<{
    totalSupply?: string; circulatingSupply?: string; holders?: number; ageSeconds?: number;
} | null> {
    try {
        const chainMap: Record<string, string> = {
            bsc: 'bsc', ethereum: 'eth', polygon_pos: 'polygon_pos',
        };
        const chain = chainMap[geckoDexChain];
        if (!chain) return null;
        const url = `https://api.geckoterminal.com/api/v2/networks/${chain}/tokens/${tokenAddress}`;
        const res = await fetch(url, { headers: { Accept: 'application/json;version=20230302' } });
        const data = await res.json();
        const attr = data?.data?.attributes;
        if (!attr) return null;
        return {
            totalSupply: attr.total_supply,
            circulatingSupply: attr.circulating_supply,
            holders: attr.holders,
            ageSeconds: attr.pool_created_at
                ? Math.floor((Date.now() - new Date(attr.pool_created_at).getTime()) / 1000)
                : undefined,
        };
    } catch {
        return null;
    }
}

/* ── fetchPoolData — DexScreener pool info ── */
export async function fetchPoolData(tokenAddressOrSymbol: string, chain: SupportedChain): Promise<PoolInfo[]> {
    const chainId = CHAIN_LABELS[chain].dexScreenerId;
    const isAddress = tokenAddressOrSymbol.startsWith('0x');
    const url = isAddress
        ? `https://api.dexscreener.com/latest/dex/tokens/${tokenAddressOrSymbol}`
        : `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(tokenAddressOrSymbol)}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return (data.pairs || [])
            .filter((p: any) => p.chainId === chainId || !isAddress)
            .slice(0, 5)
            .map((p: any) => {
                const buys = p.txns?.h24?.buys || 0;
                const sells = p.txns?.h24?.sells || 1;
                const sellRatio = sells / (buys + sells);
                const totalVol = p.volume?.h24 || 0;
                return {
                    poolAddress: p.pairAddress,
                    dexId: p.dexId,
                    pairName: `${p.baseToken?.symbol}/${p.quoteToken?.symbol}`,
                    priceUsd: p.priceUsd || '0',
                    volume24h: totalVol,
                    buyVolume24h: totalVol * (1 - sellRatio),
                    sellVolume24h: totalVol * sellRatio,
                    liquidity: p.liquidity?.usd || 0,
                    sellRatio, priceChange24h: p.priceChange?.h24 || 0,
                    chainId: p.chainId,
                } satisfies PoolInfo;
            });
    } catch (e) {
        console.error('[whale-api] fetchPoolData:', e);
        return [];
    }
}

export async function detectSellPressure(tokenAddress: string, chain: SupportedChain): Promise<PoolInfo[]> {
    return (await fetchPoolData(tokenAddress, chain)).sort((a, b) => b.sellRatio - a.sellRatio);
}

export function getSellPressureLabel(r: number) {
    if (r >= 0.7) return { label: 'Xả mạnh', color: 'text-red-500', icon: '🚨' };
    if (r >= 0.55) return { label: 'Bán nhiều', color: 'text-orange-500', icon: '⚠️' };
    if (r >= 0.45) return { label: 'Cân bằng', color: 'text-yellow-500', icon: '⚖️' };
    return { label: 'Mua nhiều', color: 'text-emerald-500', icon: '🟢' };
}

/* ── Backend integration ── */
const BACKEND = '/api/onchain';

export interface WalletStats {
    wallet_address: string;
    chain: string;
    token_address: string;
    token_symbol?: string;
    buy_count: number;
    sell_count: number;
    transfer_count: number;
    buy_volume_usd: number;
    sell_volume_usd: number;
    last_tx_hash?: string;
    last_activity?: string;
}

/** Get persistent counters from backend (with Redis cache) */
export async function getWalletStats(
    wallet: string, chain: SupportedChain, token = 'native'
): Promise<WalletStats> {
    try {
        const res = await fetch(`${BACKEND}/wallet/${wallet}/stats?chain=${chain}&token=${token}`);
        if (res.ok) return res.json();
    } catch { /* fall to default */ }
    return {
        wallet_address: wallet, chain, token_address: token,
        buy_count: 0, sell_count: 0, transfer_count: 0,
        buy_volume_usd: 0, sell_volume_usd: 0,
    };
}

/** Record a TX to backend (idempotent — duplicate tx_hash ignored) */
export async function recordTx(payload: {
    walletAddress: string; chain: string;
    txHash: string; tokenAddress?: string; tokenSymbol?: string;
    txType: 'BUY' | 'SELL' | 'TRANSFER';
    amountToken?: number; amountUsd?: number; priceUsd?: number;
    pairSymbol?: string; dexName?: string;
    blockNumber?: number; txTimestamp?: number;
}): Promise<void> {
    try {
        await fetch(`${BACKEND}/tx/record`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (e) {
        console.warn('[whale-api] recordTx failed (non-critical):', e);
    }
}

/** Get full TX history from backend */
export async function getWalletHistory(
    wallet: string, chain: SupportedChain, token = 'native', limit = 50, type?: string
): Promise<any[]> {
    try {
        const params = new URLSearchParams({ chain, token, limit: String(limit) });
        if (type) params.set('type', type);
        const res = await fetch(`${BACKEND}/wallet/${wallet}/history?${params}`);
        if (res.ok) return res.json();
    } catch { /* ignore */ }
    return [];
}
