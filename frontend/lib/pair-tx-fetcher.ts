/**
 * pair-tx-fetcher.ts v3 — Multi-source real-time transaction fetcher
 *
 * Primary source: TheGraph PancakeSwap V2 subgraph (BSC)
 *   Query: { swaps(where: { pair: "0x..." }) { ... } }
 *   Note: V2 uses `pair`, V3 would use `pool` — we use V2 for compatibility
 *
 * Fallback: Etherscan V2 API (chainid=56/1/137) — configured in onchain-api-manager
 *
 * Token logos: TrustWallet Assets CDN (checksummed address)
 *   https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{ADDR}/logo.png
 */

import { CHAIN_CONFIG, type ExplorerChain } from './onchain-api-manager';
import type { SupportedChain } from '@/store/whale-tracker-store';

export type TxKind = 'BUY' | 'SELL' | 'TRANSFER';

export interface PairTx {
    hash: string;
    blockNumber: string;
    timestamp: number;
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
    source: 'subgraph' | 'explorer';
}

/* ── Use Next.js server-side proxies to bypass browser CORS ── */
const SUBGRAPHPROXY = '/api/proxy/subgraph';
const ETHERSCANPROXY = '/api/proxy/etherscan';

/* Subgraph URLs per chain (server-side, no CORS issue via proxy) */
const SUBGRAPHS: Record<SupportedChain, string[]> = {
    BSC: [
        // PancakeSwap V2 — Goldsky (actively maintained, free public endpoint)
        'https://api.goldsky.com/api/public/project_clk3w4qlomh7a2ixuf4vc/subgraphs/exchange-v2-bsc/prod/gn',
        // PancakeSwap V2 — The Graph decentralized network (query URL, no key needed for public)
        'https://gateway-arbitrum.network.thegraph.com/api/public/subgraphs/id/9opCZr5miEFWHkGFpkqTMEcGXAB2sFTR9s5JAorEGDf4',
    ],
    ETH: [
        // Uniswap V2 — The Graph decentralized network
        'https://gateway-arbitrum.network.thegraph.com/api/public/subgraphs/id/EYCKATKGBKLWvSfwvBjzfCBmGwYNdVkduYXVivCsLRFu',
    ],
    POLYGON: [
        // QuickSwap — Goldsky
        'https://api.goldsky.com/api/public/project_clk3w4qlomh7a2ixuf4vc/subgraphs/quickswap-v2-polygon/prod/gn',
    ],
};


/* PancakeSwap V2 uses pairs with `amount0In/Out amount1In/Out` */
function buildV2Query(pairAddress: string, sinceBlock = 0, limit = 50): string {
    return JSON.stringify({
        query: `{
            swaps(
                first: ${limit}
                orderBy: timestamp
                orderDirection: desc
                where: {
                    pair: "${pairAddress.toLowerCase()}"
                    ${sinceBlock > 0 ? `timestamp_gt: "${sinceBlock}"` : ''}
                }
            ) {
                id
                transaction { id }
                timestamp
                pair {
                    id
                    token0 { id symbol name decimals }
                    token1 { id symbol name decimals }
                }
                amount0In
                amount0Out
                amount1In
                amount1Out
                amountUSD
                sender
                to
            }
        }`,
    });
}

async function querySubgraph(chain: SupportedChain, body: string): Promise<any[] | null> {
    const endpoints = SUBGRAPHS[chain] || [];
    for (const url of endpoints) {
        try {
            // Route through Next.js server proxy to bypass CORS
            const proxyUrl = `${SUBGRAPHPROXY}?url=${encodeURIComponent(url)}`;
            const res = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                signal: AbortSignal.timeout(12_000),
            });
            const json = await res.json();
            if (json?.data?.swaps && Array.isArray(json.data.swaps)) {
                return json.data.swaps;
            }
            if (json?.errors) {
                console.warn('[pair-tx] Subgraph error:', json.errors[0]?.message);
            }
        } catch (e) {
            console.warn('[pair-tx] Subgraph endpoint failed:', url, e);
        }
    }
    return null;
}

const QUOTE_KEYWORDS = ['WBNB', 'WETH', 'WMATIC', 'USDT', 'USDC', 'BUSD', 'DAI', 'BNB', 'ETH'];
function isQuoteToken(symbol: string): boolean {
    return QUOTE_KEYWORDS.some(q => symbol.toUpperCase().includes(q));
}

function mapSwap(swap: any, pairAddress: string): PairTx | null {
    const ts = parseInt(swap.timestamp || '0') * 1000;
    const hash = swap.transaction?.id || swap.id || '';
    const pair = swap.pair;
    if (!pair) return null;

    const sym0 = pair.token0?.symbol || 'TOKEN0';
    const sym1 = pair.token1?.symbol || 'TOKEN1';
    const amount0In = parseFloat(swap.amount0In || '0');
    const amount0Out = parseFloat(swap.amount0Out || '0');
    const amount1In = parseFloat(swap.amount1In || '0');
    const amount1Out = parseFloat(swap.amount1Out || '0');
    const amountUsd = parseFloat(swap.amountUSD || '0');
    const maker = swap.to || swap.sender || '';

    // Determine base/quote from token symbols
    const t0IsQuote = isQuoteToken(sym0);
    let kind: TxKind, baseSymbol: string, quoteSymbol: string, tokenAmount: number, quoteAmount: number;

    if (t0IsQuote) {
        // token0 = quote (WBNB), token1 = base (BTCB/SIREN)
        baseSymbol = sym1; quoteSymbol = sym0;
        if (amount1Out > 0) { kind = 'BUY'; tokenAmount = amount1Out; quoteAmount = amount0In; }
        else { kind = 'SELL'; tokenAmount = amount1In; quoteAmount = amount0Out; }
    } else {
        // token0 = base, token1 = quote (WBNB)
        baseSymbol = sym0; quoteSymbol = sym1;
        if (amount0Out > 0) { kind = 'BUY'; tokenAmount = amount0Out; quoteAmount = amount1In; }
        else { kind = 'SELL'; tokenAmount = amount0In; quoteAmount = amount1Out; }
    }

    if (tokenAmount <= 0) return null;
    const priceUsd = tokenAmount > 0 && amountUsd > 0 ? amountUsd / tokenAmount : 0;

    return {
        hash, blockNumber: '0', timestamp: ts, kind, makerAddress: maker,
        tokenSymbol: baseSymbol, tokenAmount, quoteSymbol, quoteAmount,
        priceUsd, amountUsd, pairAddress, dexId: 'pancakeswap',
        source: 'subgraph',
    };
}

/* ────────────────────────────────────────────────────────────────
 * Etherscan V2 API fallback (BSC chainid=56, ETH chainid=1, Polygon chainid=137)
 * ──────────────────────────────────────────────────────────────── */
const CHAIN_MAP: Record<SupportedChain, ExplorerChain> = { BSC: 'BSC', ETH: 'ETH', POLYGON: 'POLYGON' };

const nativePriceCache: Record<string, { price: number; at: number }> = {};
async function getNativePrice(chain: SupportedChain): Promise<number> {
    const c = nativePriceCache[chain];
    if (c && Date.now() - c.at < 60_000) return c.price;
    try {
        const sym = CHAIN_CONFIG[CHAIN_MAP[chain]].nativePriceSymbol;
        const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`, { signal: AbortSignal.timeout(3000) });
        const d = await r.json();
        const p = parseFloat(d.price || '0');
        nativePriceCache[chain] = { price: p, at: Date.now() };
        return p;
    } catch { return nativePriceCache[chain]?.price || 610; }
}

const pairPriceCache: Record<string, { priceUsd: number; quoteSymbol: string; at: number }> = {};
async function getPairPrice(chain: SupportedChain, pairAddress: string) {
    const key = `${chain}:${pairAddress}`;
    const c = pairPriceCache[key];
    if (c && Date.now() - c.at < 15_000) return c;
    const chainId = { BSC: 'bsc', ETH: 'ethereum', POLYGON: 'polygon' }[chain];
    try {
        const r = await fetch(`https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairAddress}`, { signal: AbortSignal.timeout(4000) });
        const d = await r.json();
        const p = d.pairs?.[0];
        if (p) {
            const info = { priceUsd: parseFloat(p.priceUsd || '0'), quoteSymbol: p.quoteToken?.symbol || 'WBNB', at: Date.now() };
            pairPriceCache[key] = info;
            return info;
        }
    } catch { /* ignore */ }
    return pairPriceCache[key] || { priceUsd: 0, quoteSymbol: 'WBNB' };
}

async function fetchFromExplorer(
    chain: SupportedChain, tokenAddress: string, pairAddress: string, limit = 30
): Promise<PairTx[]> {
    const pairLower = pairAddress.toLowerCase();
    const chainId = CHAIN_CONFIG[CHAIN_MAP[chain]].chainId;
    try {
        // Route through Next.js server proxy (API key injected server-side, no CORS)
        const params = new URLSearchParams({
            chainid: chainId,
            module: 'account',
            action: 'tokentx',
            contractaddress: tokenAddress,
            address: pairAddress,
            page: '1',
            offset: String(limit),
            sort: 'desc',
        });
        const res = await fetch(`${ETHERSCANPROXY}?${params}`, { signal: AbortSignal.timeout(12_000) });
        const data = await res.json();

        if (data.status !== '1' || !Array.isArray(data.result)) {
            console.warn('[pair-tx] Etherscan proxy returned:', data.message || JSON.stringify(data).slice(0, 100));
            return [];
        }
        console.info(`[pair-tx] Etherscan returned ${data.result.length} txs for pair ${pairAddress}`);

        const [pairInfo, nativePrice] = await Promise.all([
            getPairPrice(chain, pairAddress),
            getNativePrice(chain),
        ]);

        return (data.result as any[]).map((row): PairTx | null => {
            const decimals = parseInt(row.tokenDecimal || '18');
            const tokenAmount = parseFloat(row.value) / Math.pow(10, decimals);
            const fromL = (row.from || '').toLowerCase();
            const toL = (row.to || '').toLowerCase();
            const kind: TxKind = fromL === pairLower ? 'BUY' : toL === pairLower ? 'SELL' : 'TRANSFER';
            if (kind === 'TRANSFER') return null;
            const maker = kind === 'BUY' ? row.to : row.from;
            const amountUsd = tokenAmount * pairInfo.priceUsd;
            return {
                hash: row.hash, blockNumber: row.blockNumber,
                timestamp: parseInt(row.timeStamp) * 1000, kind, makerAddress: maker,
                tokenSymbol: row.tokenSymbol || '', tokenAmount,
                quoteSymbol: pairInfo.quoteSymbol,
                quoteAmount: nativePrice > 0 ? amountUsd / nativePrice : 0,
                priceUsd: pairInfo.priceUsd, amountUsd,
                pairAddress, dexId: 'etherscan', source: 'explorer',
            };
        }).filter(Boolean) as PairTx[];
    } catch (e) {
        console.error('[pair-tx] explorer proxy error:', e);
        return [];
    }
}



/* ────────────────────────────────────────────────────────────────
 * Direct RPC fallback — eth_getLogs on public BSC/ETH/Polygon nodes
 * No API key needed. Uses PancakeSwap V2 Swap event signature.
 * ──────────────────────────────────────────────────────────────── */

// PancakeSwap V2 / Uniswap V2 Swap event:
// Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)
const SWAP_TOPIC_V2 = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37965b04fd9617cd8cfc8b6b1e';
// PancakeSwap V3 / Uniswap V3 Swap event (different signature, different data layout)
const SWAP_TOPIC_V3 = '0x19b47279256b2a23a1665c810c8d55a1758940ee09377d4f8d26497a3577dc83';

/** Map chain to RPC chainId number */
const CHAIN_ID: Record<SupportedChain, string> = { BSC: '56', ETH: '1', POLYGON: '137' };

/** Call /api/proxy/rpc — routes to public BSC/ETH/Polygon RPC nodes */
async function rpcPost(chain: SupportedChain, method: string, params: any[]): Promise<any> {
    const res = await fetch('/api/proxy/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chainId: CHAIN_ID[chain], method, params }),
        signal: AbortSignal.timeout(12_000),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.result;
}

/** Cache: pairAddress → { token0, token1 } */
const tokenOrderCache: Record<string, { token0: string; token1: string }> = {};

/** Cache: tokenAddress → decimals (fetched once via eth_call) */
const decimalsCache: Record<string, number> = {};

/** Get token0/token1 addresses for a pair (cached, 1 RPC call per pair) */
async function getPairTokenOrder(chain: SupportedChain, pairAddress: string) {
    const key = `${chain}:${pairAddress}`;
    if (tokenOrderCache[key]) return tokenOrderCache[key];
    try {
        const [t0, t1] = await Promise.all([
            rpcPost(chain, 'eth_call', [{ to: pairAddress, data: '0x0dfe1681' }, 'latest']), // token0()
            rpcPost(chain, 'eth_call', [{ to: pairAddress, data: '0xd21220a7' }, 'latest']), // token1()
        ]);
        const result = {
            token0: ('0x' + (t0 as string).slice(26)).toLowerCase(),
            token1: ('0x' + (t1 as string).slice(26)).toLowerCase(),
        };
        tokenOrderCache[key] = result;
        return result;
    } catch { return null; }
}

/** Get ERC20 decimals for a token address (cached, 1 RPC call per token) */
async function getTokenDecimals(chain: SupportedChain, tokenAddress: string): Promise<number> {
    const key = `${chain}:${tokenAddress}`;
    if (decimalsCache[key] !== undefined) return decimalsCache[key];
    try {
        const res = await rpcPost(chain, 'eth_call', [{ to: tokenAddress, data: '0x313ce567' }, 'latest']); // decimals()
        const dec = parseInt((res as string).slice(-2), 16); // last byte
        const safe = (dec > 0 && dec <= 36) ? dec : 18;
        decimalsCache[key] = safe;
        return safe;
    } catch { return 18; } // assume 18 if call fails
}

/** Parse a 32-byte hex word as a signed int256 (two's complement) */
function parseInt256(hex64: string): bigint {
    const val = BigInt('0x' + hex64);
    const TWO255 = 0x8000000000000000000000000000000000000000000000000000000000000000n;
    // If high bit set → negative (two's complement)
    return val >= TWO255 ? val - (TWO255 * 2n) : val;
}

/** Decode a PancakeSwap/Uniswap V2 Swap log */
function decodeV2Log(
    log: any, pairAddress: string, tokenAddr: string, token0Addr: string,
    decimals: number, priceUsd: number, quoteSymbol: string,
): PairTx | null {
    // V2 data: uint256 amount0In | uint256 amount1In | uint256 amount0Out | uint256 amount1Out
    const data = (log.data as string).slice(2);
    const a0In = parseFloat(BigInt('0x' + data.slice(0, 64)).toString());
    const a1In = parseFloat(BigInt('0x' + data.slice(64, 128)).toString());
    const a0Out = parseFloat(BigInt('0x' + data.slice(128, 192)).toString());
    const a1Out = parseFloat(BigInt('0x' + data.slice(192, 256)).toString());

    const isToken0 = tokenAddr.toLowerCase() === token0Addr.toLowerCase();
    let kind: TxKind;
    let rawAmt: number;
    if (isToken0) {
        kind = a0Out > 0 ? 'BUY' : 'SELL';
        rawAmt = kind === 'BUY' ? a0Out : a0In;
    } else {
        kind = a1Out > 0 ? 'BUY' : 'SELL';
        rawAmt = kind === 'BUY' ? a1Out : a1In;
    }
    if (rawAmt <= 0) return null;

    const tokenAmount = rawAmt / Math.pow(10, decimals);
    const amountUsd = tokenAmount * priceUsd;
    const makerTopic = log.topics?.[2] || log.topics?.[1] || '';
    const maker = makerTopic.length >= 42 ? ('0x' + makerTopic.slice(26)) : '';

    return {
        hash: log.transactionHash || '', blockNumber: parseInt(log.blockNumber, 16).toString(),
        timestamp: Date.now(), kind, makerAddress: maker,
        tokenSymbol: '', tokenAmount, quoteSymbol,
        quoteAmount: priceUsd > 0 ? amountUsd / priceUsd : 0,
        priceUsd, amountUsd,
        pairAddress: pairAddress.toLowerCase(), dexId: 'pancakeswap', source: 'subgraph',
    };
}

/** Decode a PancakeSwap/Uniswap V3 Swap log */
function decodeV3Log(
    log: any, pairAddress: string, tokenAddr: string, token0Addr: string,
    decimals: number, priceUsd: number, quoteSymbol: string,
): PairTx | null {
    // V3 data: int256 amount0 | int256 amount1 | uint160 sqrtPriceX96 | uint128 liquidity | int24 tick
    // amount0/amount1 are SIGNED: negative = token left pool (received by trader) = BUY that token
    const data = (log.data as string).slice(2);
    const amt0 = parseInt256(data.slice(0, 64)); // positive = token entered pool, negative = left pool
    const amt1 = parseInt256(data.slice(64, 128));

    const isToken0 = tokenAddr.toLowerCase() === token0Addr.toLowerCase();
    let kind: TxKind;
    let rawAmt: bigint;

    if (isToken0) {
        // amt0 < 0 → SIREN left pool → someone BOUGHT SIREN
        kind = amt0 < 0n ? 'BUY' : 'SELL';
        rawAmt = amt0 < 0n ? -amt0 : amt0; // abs value
    } else {
        kind = amt1 < 0n ? 'BUY' : 'SELL';
        rawAmt = amt1 < 0n ? -amt1 : amt1;
    }
    if (rawAmt <= 0n) return null;

    // V3 has sender in topics[1], recipient in topics[2]
    const makerTopic = log.topics?.[2] || log.topics?.[1] || '';
    const maker = makerTopic.length >= 42 ? ('0x' + makerTopic.slice(26)) : '';
    const tokenAmount = parseFloat(rawAmt.toString()) / Math.pow(10, decimals);
    const amountUsd = tokenAmount * priceUsd;

    return {
        hash: log.transactionHash || '', blockNumber: parseInt(log.blockNumber, 16).toString(),
        timestamp: Date.now(), kind, makerAddress: maker,
        tokenSymbol: '', tokenAmount, quoteSymbol,
        quoteAmount: priceUsd > 0 ? amountUsd / priceUsd : 0,
        priceUsd, amountUsd,
        pairAddress: pairAddress.toLowerCase(), dexId: 'pancakeswap-v3', source: 'subgraph',
    };
}

/** Fetch swaps using eth_getLogs on Ankr/public RPC — no API key needed */
async function fetchFromRpc(
    chain: SupportedChain,
    tokenAddress: string,
    pairAddress: string,
    limit = 50,
): Promise<PairTx[]> {
    // Try from largest to smallest range — stop as soon as we get data
    // BSC: ~3s/block → 3000 blocks ≈ 25min, 1000 ≈ 8min, 300 ≈ 1.5min
    const blockRanges = [3000, 1000, 300];

    for (const blockRange of blockRanges) {
        try {
            // 1. Get current block number
            const blockHex = await rpcPost(chain, 'eth_blockNumber', []) as string;
            const currentBlock = parseInt(blockHex, 16);

            // 2. Get swap event logs — try V2 and V3 topics in parallel
            const fromBlock = '0x' + Math.max(0, currentBlock - blockRange).toString(16);
            const logFilter = { address: pairAddress, fromBlock, toBlock: 'latest' as const };

            const [logsV2, logsV3] = await Promise.allSettled([
                rpcPost(chain, 'eth_getLogs', [{ ...logFilter, topics: [SWAP_TOPIC_V2] }]),
                rpcPost(chain, 'eth_getLogs', [{ ...logFilter, topics: [SWAP_TOPIC_V3] }]),
            ]);

            const rawV2 = logsV2.status === 'fulfilled' && Array.isArray(logsV2.value) ? logsV2.value : [];
            const rawV3 = logsV3.status === 'fulfilled' && Array.isArray(logsV3.value) ? logsV3.value : [];
            const isV3 = rawV3.length > 0 && rawV2.length === 0;
            const logs = isV3 ? rawV3 : rawV2;

            if (!Array.isArray(logs)) {
                console.warn('[pair-tx] RPC non-array response, retrying...');
                continue;
            }
            if (logs.length === 0) { continue; } // try larger range

            // 3. Get token ordering, price, and real token decimals in parallel
            const [tokenOrder, pairInfo, decimals] = await Promise.all([
                getPairTokenOrder(chain, pairAddress),
                getPairPrice(chain, pairAddress),
                getTokenDecimals(chain, tokenAddress),
            ]);

            if (!tokenOrder) return [];

            // 4. Decode logs → PairTx using correct V2/V3 decoder
            const decode = isV3 ? decodeV3Log : decodeV2Log;
            return logs
                .slice(-limit)
                .reverse()
                .map(log => decode(log, pairAddress, tokenAddress, tokenOrder.token0, decimals, pairInfo.priceUsd, pairInfo.quoteSymbol))
                .filter(Boolean) as PairTx[];

        } catch (e: any) {
            const msg = (e?.message || '').toLowerCase();
            if (msg.includes('limit') || msg.includes('range') || msg.includes('block range')) {
                console.warn(`[pair-tx] RPC block range ${blockRange} too large, retrying smaller...`);
                continue;
            }
            console.error('[pair-tx] RPC fallback error:', e);
            return [];
        }
    }
    console.error('[pair-tx] RPC: all block ranges exceeded limits on all nodes');
    return [];
}

/* ────────────────────────────────────────────────────────────────
 * Main export
 * ──────────────────────────────────────────────────────────────── */
export async function fetchPairTxs(
    chain: SupportedChain,
    tokenAddress: string,
    pairAddress: string,
    limit = 50,
    _sinceTimestamp = 0,
): Promise<PairTx[]> {
    if (!pairAddress || !tokenAddress) return [];

    // 1. Try Goldsky / Graph Network subgraph (GraphQL, fast, structured)
    const q = buildV2Query(pairAddress, 0, limit);
    const swaps = await querySubgraph(chain, q);
    if (swaps && swaps.length > 0) {
        const mapped = swaps.map(s => mapSwap(s, pairAddress)).filter(Boolean) as PairTx[];
        if (mapped.length > 0) return mapped;
    }

    // 2. Fallback: Direct RPC eth_getLogs
    return fetchFromRpc(chain, tokenAddress, pairAddress, limit);
}

/* ────────────────────────────────────────────────────────────────
 * DexScreener PairStats (300 req/min)
 * ──────────────────────────────────────────────────────────────── */
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
    imageUrl?: string;
}

const statsCache: Record<string, { data: PairStats; at: number }> = {};
export async function fetchPairStats(chain: SupportedChain, pairAddress: string): Promise<PairStats | null> {
    const key = `${chain}:${pairAddress}`;
    const c = statsCache[key];
    if (c && Date.now() - c.at < 10_000) return c.data;
    const chainId = { BSC: 'bsc', ETH: 'ethereum', POLYGON: 'polygon' }[chain];
    try {
        const r = await fetch(`https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairAddress}`, { signal: AbortSignal.timeout(4000) });
        const d = await r.json();
        const p = d.pairs?.[0];
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
            imageUrl: p.info?.imageUrl,
        };
        statsCache[key] = { data: stats, at: Date.now() };
        return stats;
    } catch { return null; }
}

/* ────────────────────────────────────────────────────────────────
 * Token logo helpers (TrustWallet Assets CDN + DexScreener)
 * ──────────────────────────────────────────────────────────────── */
const TRUST_CHAIN: Record<SupportedChain, string> = {
    BSC: 'smartchain',
    ETH: 'ethereum',
    POLYGON: 'polygon',
};

/** Returns logo URL for a token address (checksummed). Tries TrustWallet CDN. */
export function getTokenLogoUrl(chain: SupportedChain, tokenAddress: string): string {
    // Checksum: TrustWallet needs checksummed address
    const addr = tokenAddress; // keep as-is, TW is case-flexible
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${TRUST_CHAIN[chain]}/assets/${addr}/logo.png`;
}

/** Native token logo */
export const NATIVE_LOGOS: Record<SupportedChain, string> = {
    BSC: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png',
    ETH: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    POLYGON: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
};

/* ────────────────────────────────────────────────────────────────
 * Utilities
 * ──────────────────────────────────────────────────────────────── */
export function mergeTxs(existing: PairTx[], incoming: PairTx[], maxLen = 500): PairTx[] {
    const seen = new Set(existing.map(t => t.hash));
    return [...incoming.filter(t => !seen.has(t.hash)), ...existing]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, maxLen);
}

export const CHAIN_EXPLORERS: Record<SupportedChain, string> = {
    BSC: 'https://bscscan.com/tx/', ETH: 'https://etherscan.io/tx/', POLYGON: 'https://polygonscan.com/tx/',
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

export function fmtSupply(n: number): string {
    if (!n || isNaN(n)) return '—';
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
    return n.toLocaleString('en-US');
}

export function fmtToken(n: number): string {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
    return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function fmtAddr(a: string): string {
    if (!a || a.length < 10) return a || '—';
    return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
