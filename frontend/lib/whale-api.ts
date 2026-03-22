/**
 * whale-api.ts — Blockchain explorer API helpers + DexScreener integration
 *
 * Uses 1 Etherscan API key for ALL chains via chainid parameter:
 *   chainid=1   → Ethereum
 *   chainid=56  → BNB Chain (BSC)
 *   chainid=137 → Polygon
 *
 * Set NEXT_PUBLIC_ETHERSCAN_API_KEY in .env.local
 */

import type { SupportedChain, WhaleTx, PoolInfo, TxType, TxDirection, TokenPair } from '@/store/whale-tracker-store';
import { classifyWhaleSize, CHAIN_LABELS, DEXSCREENER_CHAIN_MAP } from '@/store/whale-tracker-store';

/* ──────────────────────────────────────────
 * Single Etherscan API endpoint + chain IDs
 * ────────────────────────────────────────── */
const ETHERSCAN_API = 'https://api.etherscan.io/api';
const API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || '';

const CHAIN_CONFIG: Record<SupportedChain, { chainId: string; nativeSymbol: string; nativePriceUrl: string }> = {
    BSC: { chainId: '56', nativeSymbol: 'BNB', nativePriceUrl: 'https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT' },
    ETH: { chainId: '1', nativeSymbol: 'ETH', nativePriceUrl: 'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT' },
    POLYGON: { chainId: '137', nativeSymbol: 'MATIC', nativePriceUrl: 'https://api.binance.com/api/v3/ticker/price?symbol=MATICUSDT' },
};

/* ──────────────────────────────────────────
 * DEX Router addresses → classify SELL
 * ────────────────────────────────────────── */
const DEX_ROUTERS: Record<string, string> = {
    '0x10ed43c718714eb63d5aa57b78b54704e256024e': 'PancakeSwap V2',
    '0x13f4ea83d0bd40e75c8222255bc855a974568dd4': 'PancakeSwap V3',
    '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506': 'SushiSwap',
    '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2',
    '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3',
    '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': 'SushiSwap ETH',
    '0xef1c6e67703c7bd7107eed8303fbe6ec2554bf6b': 'Uniswap Universal Router',
    '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': 'Uniswap Universal Router V2',
    '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff': 'QuickSwap',
};

/* ──────────────────────────────────────────
 * Native price cache (60s TTL)
 * ────────────────────────────────────────── */
const priceCache: Record<string, { price: number; fetchedAt: number }> = {};

export async function getNativePrice(chain: SupportedChain): Promise<number> {
    const cfg = CHAIN_CONFIG[chain];
    const cached = priceCache[chain];
    if (cached && Date.now() - cached.fetchedAt < 60_000) return cached.price;
    try {
        const res = await fetch(cfg.nativePriceUrl);
        const data = await res.json();
        const price = parseFloat(data.price || '0');
        priceCache[chain] = { price, fetchedAt: Date.now() };
        return price;
    } catch {
        return cached?.price || 300;
    }
}

/* ──────────────────────────────────────────
 * fetchWalletTxs — native coin transactions
 * ────────────────────────────────────────── */
export async function fetchWalletTxs(address: string, chain: SupportedChain, limit = 20): Promise<WhaleTx[]> {
    const cfg = CHAIN_CONFIG[chain];
    const nativePrice = await getNativePrice(chain);

    const url = new URL(ETHERSCAN_API);
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', 'txlist');
    url.searchParams.set('address', address);
    url.searchParams.set('chainid', cfg.chainId);
    url.searchParams.set('startblock', '0');
    url.searchParams.set('endblock', '99999999');
    url.searchParams.set('page', '1');
    url.searchParams.set('offset', String(limit));
    url.searchParams.set('sort', 'desc');
    if (API_KEY) url.searchParams.set('apikey', API_KEY);

    try {
        const res = await fetch(url.toString());
        const data = await res.json();
        if (data.status !== '1') return [];

        return (data.result as any[]).map((tx) => {
            const valueEth = parseFloat(tx.value) / 1e18;
            const valueUSD = valueEth * nativePrice;
            const toAddr = (tx.to || '').toLowerCase();
            const routerName = DEX_ROUTERS[toAddr];
            const direction: TxDirection = tx.to?.toLowerCase() === address.toLowerCase() ? 'IN' : 'OUT';
            let type: TxType = routerName ? 'SELL' : 'TRANSFER';
            if (direction === 'IN' && !routerName) type = 'TRANSFER';

            return {
                hash: tx.hash, from: tx.from, to: tx.to,
                value: `${valueEth.toFixed(4)} ${cfg.nativeSymbol}`,
                valueUSD, tokenSymbol: cfg.nativeSymbol, type,
                timestamp: parseInt(tx.timeStamp) * 1000,
                pool: routerName, dexRouter: routerName ? toAddr : undefined,
                direction, blockNumber: tx.blockNumber,
                whaleSize: classifyWhaleSize(valueUSD),
            } satisfies WhaleTx;
        });
    } catch (e) {
        console.error('[whale-api] fetchWalletTxs error:', e);
        return [];
    }
}

/* ──────────────────────────────────────────
 * fetchTokenTransfers — ERC20/BEP20 transfers (all tokens)
 * ────────────────────────────────────────── */
export async function fetchTokenTransfers(address: string, chain: SupportedChain, limit = 20): Promise<WhaleTx[]> {
    const cfg = CHAIN_CONFIG[chain];

    const url = new URL(ETHERSCAN_API);
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', 'tokentx');
    url.searchParams.set('address', address);
    url.searchParams.set('chainid', cfg.chainId);
    url.searchParams.set('page', '1');
    url.searchParams.set('offset', String(limit));
    url.searchParams.set('sort', 'desc');
    if (API_KEY) url.searchParams.set('apikey', API_KEY);

    try {
        const res = await fetch(url.toString());
        const data = await res.json();
        if (data.status !== '1') return [];
        return mapTokenTxs(data.result, address, cfg.nativeSymbol);
    } catch (e) {
        console.error('[whale-api] fetchTokenTransfers error:', e);
        return [];
    }
}

/* ──────────────────────────────────────────
 * fetchWalletTxsByToken — filter by specific token contract (v2)
 * Uses contractaddress param so only txs for that token are returned
 * ────────────────────────────────────────── */
export async function fetchWalletTxsByToken(
    address: string,
    chain: SupportedChain,
    tokenAddress: string,
    limit = 50
): Promise<WhaleTx[]> {
    const cfg = CHAIN_CONFIG[chain];

    const url = new URL(ETHERSCAN_API);
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', 'tokentx');
    url.searchParams.set('address', address);
    url.searchParams.set('contractaddress', tokenAddress);  // ← key filter
    url.searchParams.set('chainid', cfg.chainId);
    url.searchParams.set('page', '1');
    url.searchParams.set('offset', String(limit));
    url.searchParams.set('sort', 'desc');
    if (API_KEY) url.searchParams.set('apikey', API_KEY);

    try {
        const res = await fetch(url.toString());
        const data = await res.json();
        if (data.status !== '1') return [];
        return mapTokenTxs(data.result, address, cfg.nativeSymbol);
    } catch (e) {
        console.error('[whale-api] fetchWalletTxsByToken error:', e);
        return [];
    }
}

/* ──────────────────────────────────────────
 * Helper: map Etherscan token tx rows → WhaleTx[]
 * ────────────────────────────────────────── */
function mapTokenTxs(rows: any[], walletAddress: string, nativeSymbol: string): WhaleTx[] {
    return rows.map((tx) => {
        const decimals = parseInt(tx.tokenDecimal || '18');
        const rawValue = parseFloat(tx.value) / Math.pow(10, decimals);
        const toAddr = (tx.to || '').toLowerCase();
        const routerName = DEX_ROUTERS[toAddr];
        const direction: TxDirection = tx.to?.toLowerCase() === walletAddress.toLowerCase() ? 'IN' : 'OUT';

        let type: TxType;
        if (routerName) {
            type = direction === 'OUT' ? 'SELL' : 'BUY';
        } else {
            type = direction === 'OUT' ? 'TRANSFER' : 'TRANSFER';
        }

        return {
            hash: tx.hash, from: tx.from, to: tx.to,
            value: `${rawValue.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${tx.tokenSymbol}`,
            valueUSD: 0,
            tokenSymbol: tx.tokenSymbol,
            tokenAddress: tx.contractAddress,
            type,
            timestamp: parseInt(tx.timeStamp) * 1000,
            pool: routerName,
            dexRouter: routerName ? toAddr : undefined,
            direction, blockNumber: tx.blockNumber,
            whaleSize: classifyWhaleSize(0),
            pairTokenSymbol: direction === 'OUT' ? nativeSymbol : undefined,
        } satisfies WhaleTx;
    });
}

/* ──────────────────────────────────────────
 * fetchAllWalletActivity — native + token, deduped + sorted
 * ────────────────────────────────────────── */
export async function fetchAllWalletActivity(address: string, chain: SupportedChain): Promise<WhaleTx[]> {
    const [native, tokens] = await Promise.all([
        fetchWalletTxs(address, chain, 15),
        fetchTokenTransfers(address, chain, 15),
    ]);
    const seen = new Set<string>();
    const all: WhaleTx[] = [];
    for (const tx of [...native, ...tokens]) {
        if (!seen.has(tx.hash + tx.tokenSymbol)) {
            seen.add(tx.hash + tx.tokenSymbol);
            all.push(tx);
        }
    }
    return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, 30);
}

/* ──────────────────────────────────────────
 * searchTokenPairs — DexScreener search (v2)
 * Returns pairs from ALL DEXes: PancakeSwap V2/V3, Uniswap, QuickSwap etc.
 * Works for small/unknown tokens too
 * ────────────────────────────────────────── */
export async function searchTokenPairs(query: string, chainFilter?: SupportedChain): Promise<TokenPair[]> {
    if (!query.trim()) return [];

    const url = query.startsWith('0x')
        ? `https://api.dexscreener.com/latest/dex/tokens/${query.trim()}`
        : `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(query.trim())}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        const pairs: any[] = data.pairs || [];

        const SUPPORTED_CHAINS = new Set(['bsc', 'ethereum', 'polygon']);

        return pairs
            .filter((p) => {
                if (!SUPPORTED_CHAINS.has(p.chainId)) return false;
                if (chainFilter) {
                    const mapped = DEXSCREENER_CHAIN_MAP[p.chainId];
                    if (mapped !== chainFilter) return false;
                }
                return true;
            })
            .slice(0, 20)
            .map((p): TokenPair => ({
                pairAddress: p.pairAddress,
                baseToken: {
                    address: p.baseToken?.address || '',
                    symbol: p.baseToken?.symbol || '',
                    name: p.baseToken?.name || '',
                },
                quoteToken: {
                    address: p.quoteToken?.address || '',
                    symbol: p.quoteToken?.symbol || '',
                },
                dexId: p.dexId || '',
                priceUsd: p.priceUsd || '0',
                volume24h: p.volume?.h24 || 0,
                liquidity: p.liquidity?.usd || 0,
                chainId: p.chainId,
                chain: DEXSCREENER_CHAIN_MAP[p.chainId] || 'BSC',
                priceChange24h: p.priceChange?.h24 || 0,
            }))
            .sort((a, b) => b.liquidity - a.liquidity);
    } catch (e) {
        console.error('[whale-api] searchTokenPairs error:', e);
        return [];
    }
}

/* ──────────────────────────────────────────
 * fetchPoolData — DexScreener pool info
 * ────────────────────────────────────────── */
export async function fetchPoolData(tokenAddressOrSymbol: string, chain: SupportedChain): Promise<PoolInfo[]> {
    const chainId = CHAIN_LABELS[chain].dexScreenerId;
    const isAddress = tokenAddressOrSymbol.startsWith('0x');
    const url = isAddress
        ? `https://api.dexscreener.com/latest/dex/tokens/${tokenAddressOrSymbol}`
        : `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(tokenAddressOrSymbol)}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        const pairs: any[] = data.pairs || [];

        return pairs
            .filter((p) => p.chainId === chainId || !isAddress)
            .slice(0, 5)
            .map((p) => {
                const buys = p.txns?.h24?.buys || 0;
                const sells = p.txns?.h24?.sells || 1;
                const totalVol = p.volume?.h24 || 0;
                const sellRatio = sells / (buys + sells);
                return {
                    poolAddress: p.pairAddress,
                    dexId: p.dexId,
                    pairName: `${p.baseToken?.symbol}/${p.quoteToken?.symbol}`,
                    priceUsd: p.priceUsd || '0',
                    volume24h: totalVol,
                    buyVolume24h: totalVol * (1 - sellRatio),
                    sellVolume24h: totalVol * sellRatio,
                    liquidity: p.liquidity?.usd || 0,
                    sellRatio,
                    priceChange24h: p.priceChange?.h24 || 0,
                    chainId: p.chainId,
                } satisfies PoolInfo;
            });
    } catch (e) {
        console.error('[whale-api] fetchPoolData error:', e);
        return [];
    }
}

export async function detectSellPressure(tokenAddress: string, chain: SupportedChain): Promise<PoolInfo[]> {
    const pools = await fetchPoolData(tokenAddress, chain);
    return pools.sort((a, b) => b.sellRatio - a.sellRatio);
}

export function getSellPressureLabel(sellRatio: number): { label: string; color: string; icon: string } {
    if (sellRatio >= 0.7) return { label: 'Xả mạnh', color: 'text-red-500', icon: '🚨' };
    if (sellRatio >= 0.55) return { label: 'Bán nhiều', color: 'text-orange-500', icon: '⚠️' };
    if (sellRatio >= 0.45) return { label: 'Cân bằng', color: 'text-yellow-500', icon: '⚖️' };
    return { label: 'Mua nhiều', color: 'text-emerald-500', icon: '🟢' };
}
