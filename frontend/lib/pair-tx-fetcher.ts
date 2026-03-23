/**
 * pair-tx-fetcher.ts v2 — Multi-source real-time transaction fetcher
 *
 * Data sources (priority order, fastest first):
 *  1. TheGraph/Subgraph  — PancakeSwap/Uniswap swap events (GraphQL, <300ms, real-time)
 *  2. BSCScan/Etherscan  — tokentx API (fallback, 1-2s, multi-key rotation)
 *
 * DexScreener API (300 req/min) is used ONLY for:
 *  - Pair price, volume stats (fetchPairStats)
 *  - Pool discovery (fetchTopPools)
 *
 * === WHY TheGraph is Best ===
 * - Free (500k queries/day on hosted service)
 * - Returns ACTUAL swap events decoded with exact token amounts
 * - Response in ~200-500ms
 * - PancakeSwap V2 BSC: api.thegraph.com/subgraphs/name/pancakeswap/exchange-v2-bsc
 * - PancakeSwap V3 BSC: thegraph.com/hosted-service/subgraph/pancakeswap/exchange-v3-bsc
 * - Uniswap V2 ETH:     api.thegraph.com/subgraphs/name/uniswap/uniswap-v2
 * - Uniswap V3 ETH:     api.thegraph.com/subgraphs/name/uniswap/uniswap-v3
 */

import { ApiKeyRotator, EXPLORER_CONFIG, type ExplorerChain } from './onchain-api-manager';
import type { SupportedChain } from '@/store/whale-tracker-store';

export type TxKind = 'BUY' | 'SELL' | 'TRANSFER';

export interface PairTx {
    hash: string;
    blockNumber: string;
    timestamp: number;           // ms
    kind: TxKind;
    makerAddress: string;
    tokenSymbol: string;
    tokenAmount: number;
    quoteSymbol: string;
    quoteAmount: number;
    priceUsd: number;
    amountUsd: number;
    pairAddress: string;
    dexId: string;
    source: 'subgraph' | 'bscscan';
}

/* ────────────────────────────────────────────────────────────────
 * TheGraph subgraph endpoints
 * ──────────────────────────────────────────────────────────────── */
const SUBGRAPHS: Record<string, string[]> = {
    // BSC — PancakeSwap (try V3 first, fall back to V2)
    bsc: [
        'https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc',
        'https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v2-bsc',
    ],
    // ETH — Uniswap (try V3 first)
    ethereum: [
        'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
        'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
    ],
    // Polygon — QuickSwap
    polygon: [
        'https://api.thegraph.com/subgraphs/name/sameepsi/quickswap06',
        'https://api.thegraph.com/subgraphs/name/nicholaspk/quickswapv3',
    ],
};

const CHAIN_TO_GRAPH_ID: Record<SupportedChain, string> = {
    BSC: 'bsc', ETH: 'ethereum', POLYGON: 'polygon',
};

const CHAIN_MAP: Record<SupportedChain, ExplorerChain> = {
    BSC: 'BSC', ETH: 'ETH', POLYGON: 'POLYGON',
};

/* ── GraphQL query for latest swaps on a pair ── */
function buildSwapQuery(pairAddress: string, sinceTs: number, limit: number) {
    return JSON.stringify({
        query: `{
            swaps(
                first: ${limit}
                orderBy: timestamp
                orderDirection: desc
                where: {
                    pair: "${pairAddress.toLowerCase()}"
                    ${sinceTs > 0 ? `timestamp_gt: "${Math.floor(sinceTs / 1000)}"` : ''}
                }
            ) {
                transaction { id }
                timestamp
                pair { id token0 { symbol decimals } token1 { symbol decimals } }
                amount0In amount0Out amount1In amount1Out
                amountUSD
                sender
                to
            }
        }`,
    });
}

/* Try each subgraph endpoint until one succeeds */
async function querySubgraph(chain: SupportedChain, query: string): Promise<any[] | null> {
    const graphId = CHAIN_TO_GRAPH_ID[chain];
    const endpoints = SUBGRAPHS[graphId] || [];
    for (const url of endpoints) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: query,
                signal: AbortSignal.timeout(5000),
            });
            const data = await res.json();
            if (data?.data?.swaps?.length >= 0) return data.data.swaps;
        } catch { /* try next */ }
    }
    return null;
}

/* Map TheGraph swap → PairTx */
function mapSubgraphSwap(swap: any, pairAddress: string): PairTx {
    const ts = parseInt(swap.timestamp || '0') * 1000;
    const hash = swap.transaction?.id || '';
    const pair = swap.pair;
    const token0Sym = pair?.token0?.symbol || 'TOKEN0';
    const token1Sym = pair?.token1?.symbol || 'TOKEN1';

    const amount0In = parseFloat(swap.amount0In || '0');
    const amount0Out = parseFloat(swap.amount0Out || '0');
    const amount1In = parseFloat(swap.amount1In || '0');
    const amount1Out = parseFloat(swap.amount1Out || '0');
    const amountUsd = parseFloat(swap.amountUSD || '0');
    const maker = swap.to || swap.sender || '';

    // Determine which token is BASE and which is QUOTE
    // Heuristic: WBNB/WETH/USDT/USDC are usually quote tokens
    const QUOTE_SYMBOLS = ['WBNB', 'WETH', 'WMATIC', 'USDT', 'USDC', 'BUSD', 'DAI', 'BNB'];
    const token0IsQuote = QUOTE_SYMBOLS.some(q => token0Sym.toUpperCase().includes(q));

    let kind: TxKind;
    let baseSymbol: string;
    let quoteSymbol: string;
    let tokenAmount: number;
    let quoteAmount: number;

    if (token0IsQuote) {
        // token0 = quote (WBNB), token1 = base (SIREN)
        baseSymbol = token1Sym; quoteSymbol = token0Sym;
        if (amount1Out > 0) {
            // base token leaving pair → BUY
            kind = 'BUY'; tokenAmount = amount1Out; quoteAmount = amount0In;
        } else {
            // base token entering pair → SELL
            kind = 'SELL'; tokenAmount = amount1In; quoteAmount = amount0Out;
        }
    } else {
        // token0 = base (SIREN), token1 = quote (WBNB)
        baseSymbol = token0Sym; quoteSymbol = token1Sym;
        if (amount0Out > 0) {
            kind = 'BUY'; tokenAmount = amount0Out; quoteAmount = amount1In;
        } else {
            kind = 'SELL'; tokenAmount = amount0In; quoteAmount = amount1Out;
        }
    }

    const priceUsd = tokenAmount > 0 && amountUsd > 0 ? amountUsd / tokenAmount : 0;

    return {
        hash, blockNumber: '0',
        timestamp: ts, kind,
        makerAddress: maker,
        tokenSymbol: baseSymbol, tokenAmount,
        quoteSymbol, quoteAmount,
        priceUsd, amountUsd,
        pairAddress, dexId: 'graph',
        source: 'subgraph',
    };
}

/* ── BSCScan fallback ── */
const nativePriceCache: Record<string, { price: number; at: number }> = {};
async function getNativePrice(chain: SupportedChain): Promise<number> {
    const cached = nativePriceCache[chain];
    if (cached && Date.now() - cached.at < 60_000) return cached.price;
    try {
        const sym = EXPLORER_CONFIG[CHAIN_MAP[chain]].nativePriceSymbol;
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`, {
            signal: AbortSignal.timeout(3000),
        });
        const data = await res.json();
        const price = parseFloat(data.price || '0');
        nativePriceCache[chain] = { price, at: Date.now() };
        return price;
    } catch {
        return nativePriceCache[chain]?.price || 610;
    }
}

const pairPriceCache: Record<string, { priceUsd: number; quoteSymbol: string; at: number }> = {};
async function getPairPrice(chain: SupportedChain, pairAddress: string): Promise<{ priceUsd: number; quoteSymbol: string }> {
    const key = `${chain}:${pairAddress}`;
    const cached = pairPriceCache[key];
    if (cached && Date.now() - cached.at < 15_000) return cached;
    const chainId = chain === 'BSC' ? 'bsc' : chain === 'ETH' ? 'ethereum' : 'polygon';
    try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairAddress}`, {
            signal: AbortSignal.timeout(3000),
        });
        const data = await res.json();
        const pair = data.pairs?.[0];
        if (pair) {
            const info = {
                priceUsd: parseFloat(pair.priceUsd || '0'),
                quoteSymbol: pair.quoteToken?.symbol || 'WBNB',
                at: Date.now(),
            };
            pairPriceCache[key] = info;
            return info;
        }
    } catch { /* fallback */ }
    return pairPriceCache[key] || { priceUsd: 0, quoteSymbol: 'WBNB' };
}

async function fetchFromBSCScan(
    chain: SupportedChain,
    tokenAddress: string,
    pairAddress: string,
    limit = 30,
): Promise<PairTx[]> {
    const explorer = CHAIN_MAP[chain];
    const pairLower = pairAddress.toLowerCase();
    try {
        const data = await ApiKeyRotator.fetch(explorer, {
            module: 'account', action: 'tokentx',
            contractaddress: tokenAddress,
            address: pairAddress,
            page: '1', offset: String(limit), sort: 'desc',
        });
        if (data.status !== '1' || !Array.isArray(data.result)) return [];
        const [pairInfo, nativePrice] = await Promise.all([
            getPairPrice(chain, pairAddress),
            getNativePrice(chain),
        ]);
        return (data.result as any[]).map((row): PairTx => {
            const decimals = parseInt(row.tokenDecimal || '18');
            const tokenAmount = parseFloat(row.value) / Math.pow(10, decimals);
            const fromL = (row.from || '').toLowerCase();
            const toL = (row.to || '').toLowerCase();
            const kind: TxKind = fromL === pairLower ? 'BUY' : toL === pairLower ? 'SELL' : 'TRANSFER';
            const maker = kind === 'BUY' ? row.to : row.from;
            const amountUsd = tokenAmount * pairInfo.priceUsd;
            const quoteAmount = nativePrice > 0 ? amountUsd / nativePrice : 0;
            return {
                hash: row.hash, blockNumber: row.blockNumber,
                timestamp: parseInt(row.timeStamp) * 1000, kind, makerAddress: maker,
                tokenSymbol: row.tokenSymbol || '', tokenAmount,
                quoteSymbol: pairInfo.quoteSymbol, quoteAmount,
                priceUsd: pairInfo.priceUsd, amountUsd,
                pairAddress, dexId: 'bscscan', source: 'bscscan',
            };
        }).filter(t => t.kind !== 'TRANSFER');
    } catch { return []; }
}

/* ────────────────────────────────────────────────────────────────
 * Main exported function — tries TheGraph first, falls back to BSCScan
 * ──────────────────────────────────────────────────────────────── */
export async function fetchPairTxs(
    chain: SupportedChain,
    tokenAddress: string,
    pairAddress: string,
    limit = 50,
    sinceTimestamp = 0,
): Promise<PairTx[]> {
    if (!pairAddress || !tokenAddress) return [];

    // 1. Try TheGraph first (fastest, structured swap data)
    const gq = buildSwapQuery(pairAddress, sinceTimestamp, limit);
    const swaps = await querySubgraph(chain, gq);
    if (swaps && swaps.length > 0) {
        return swaps
            .map(s => mapSubgraphSwap(s, pairAddress))
            .filter(t => t.tokenAmount > 0);
    }

    // 2. Fallback to BSCScan tokentx
    return fetchFromBSCScan(chain, tokenAddress, pairAddress, limit);
}

/* ── DexScreener pair stats (300 req/min) — for price/vol display ── */
export interface PairStats {
    priceUsd: string;
    priceChange: { h1: number; h6: number; h24: number };
    volume: { h1: number; h6: number; h24: number };
    txns: { h1: { buys: number; sells: number }; h24: { buys: number; sells: number } };
    liquidity: number;
    fdv: number;
    pairAddress: string;
    dexId: string;
    baseToken: { symbol: string; name: string; address: string };
    quoteToken: { symbol: string };
}

const statsCache: Record<string, { data: PairStats; at: number }> = {};

export async function fetchPairStats(chain: SupportedChain, pairAddress: string): Promise<PairStats | null> {
    const key = `${chain}:${pairAddress}`;
    const cached = statsCache[key];
    if (cached && Date.now() - cached.at < 10_000) return cached.data;

    const chainId = { BSC: 'bsc', ETH: 'ethereum', POLYGON: 'polygon' }[chain];
    try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairAddress}`, {
            signal: AbortSignal.timeout(4000),
        });
        const data = await res.json();
        const p = data.pairs?.[0];
        if (!p) return null;
        const stats: PairStats = {
            priceUsd: p.priceUsd || '0',
            priceChange: { h1: p.priceChange?.h1 || 0, h6: p.priceChange?.h6 || 0, h24: p.priceChange?.h24 || 0 },
            volume: { h1: p.volume?.h1 || 0, h6: p.volume?.h6 || 0, h24: p.volume?.h24 || 0 },
            txns: {
                h1: { buys: p.txns?.h1?.buys || 0, sells: p.txns?.h1?.sells || 0 },
                h24: { buys: p.txns?.h24?.buys || 0, sells: p.txns?.h24?.sells || 0 },
            },
            liquidity: p.liquidity?.usd || 0,
            fdv: p.fdv || 0,
            pairAddress: p.pairAddress || pairAddress,
            dexId: p.dexId || '',
            baseToken: p.baseToken || { symbol: '', name: '', address: '' },
            quoteToken: p.quoteToken || { symbol: 'WBNB' },
        };
        statsCache[key] = { data: stats, at: Date.now() };
        return stats;
    } catch { return null; }
}

/* fetch best pools for a token (DexScreener /token-pairs/v1/:chainId/:tokenAddress) */
export async function fetchTokenPools(chain: SupportedChain, tokenAddress: string): Promise<any[]> {
    const chainId = { BSC: 'bsc', ETH: 'ethereum', POLYGON: 'polygon' }[chain];
    try {
        const res = await fetch(`https://api.dexscreener.com/token-pairs/v1/${chainId}/${tokenAddress}`, {
            signal: AbortSignal.timeout(5000),
        });
        const data = await res.json();
        // V2: pairs array | V3: might be direct
        const pairs = Array.isArray(data) ? data : data.pairs || [];
        return pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    } catch { return []; }
}

/* ── Helpers ── */
export function mergeTxs(existing: PairTx[], incoming: PairTx[], maxLen = 500): PairTx[] {
    const seen = new Set(existing.map(t => t.hash));
    const newOnes = incoming.filter(t => !seen.has(t.hash));
    const merged = [...newOnes, ...existing].sort((a, b) => b.timestamp - a.timestamp);
    return merged.slice(0, maxLen);
}

export const CHAIN_EXPLORERS: Record<SupportedChain, string> = {
    BSC: 'https://bscscan.com/tx/',
    ETH: 'https://etherscan.io/tx/',
    POLYGON: 'https://polygonscan.com/tx/',
};

export function fmtTxAge(ts: number): string {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
}

export function fmtUsd(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 10_000) return `$${(n / 1_000).toFixed(1)}K`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
    return `$${n.toFixed(2)}`;
}

export function fmtToken(n: number): string {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
    return n.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

export function fmtAddr(a: string): string {
    if (!a || a.length < 10) return a;
    return a.slice(-6).toUpperCase();
}
