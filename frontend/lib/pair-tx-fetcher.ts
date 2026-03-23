/**
 * pair-tx-fetcher.ts — Fetches ALL transactions for a DEX pair
 *
 * Strategy:
 *  1. Query BSCScan tokentx with address=PAIR_ADDRESS + contractaddress=TOKEN_ADDR
 *  2. Each row: `from === pairAddress` → BUY (pair sent tokens to trader)
 *                `to   === pairAddress` → SELL (trader sent tokens to pair)
 *  3. USD value = tokenAmount × currentPriceUsd (from DexScreener cache)
 *  4. WBNB/ETH amount = counterpart value / nativePrice
 *
 * Supported chains: BSC, ETH, POLYGON
 */

import { ApiKeyRotator, EXPLORER_CONFIG, type ExplorerChain } from './onchain-api-manager';
import type { SupportedChain } from '@/store/whale-tracker-store';

export type TxKind = 'BUY' | 'SELL' | 'TRANSFER';

export interface PairTx {
    hash: string;
    blockNumber: string;
    timestamp: number;           // ms
    kind: TxKind;
    makerAddress: string;        // the actual trader (not pair/router)
    tokenSymbol: string;         // base token e.g. SIREN
    tokenAmount: number;
    quoteSymbol: string;         // e.g. WBNB / WETH
    quoteAmount: number;         // approximate
    priceUsd: number;            // price at tx time (approx)
    amountUsd: number;
    pairAddress: string;
    dexId: string;
}

const CHAIN_MAP: Record<SupportedChain, ExplorerChain> = {
    BSC: 'BSC', ETH: 'ETH', POLYGON: 'POLYGON',
};

/* ── Native price cache ── */
const nativePriceCache: Record<string, { price: number; at: number }> = {};

export async function getNativePriceCached(chain: SupportedChain): Promise<number> {
    const cached = nativePriceCache[chain];
    if (cached && Date.now() - cached.at < 60_000) return cached.price;
    try {
        const sym = EXPLORER_CONFIG[CHAIN_MAP[chain]].nativePriceSymbol;
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`);
        const data = await res.json();
        const price = parseFloat(data.price || '0');
        nativePriceCache[chain] = { price, at: Date.now() };
        return price;
    } catch {
        return nativePriceCache[chain]?.price || 610;
    }
}

/* ── DexScreener pair price cache ── */
const pairPriceCache: Record<string, { priceUsd: number; quoteSymbol: string; dexId: string; at: number }> = {};

export async function getPairInfo(
    chain: SupportedChain, pairAddress: string
): Promise<{ priceUsd: number; quoteSymbol: string; dexId: string }> {
    const key = `${chain}:${pairAddress}`;
    const cached = pairPriceCache[key];
    if (cached && Date.now() - cached.at < 30_000) {
        return { priceUsd: cached.priceUsd, quoteSymbol: cached.quoteSymbol, dexId: cached.dexId };
    }
    const chainId = chain === 'BSC' ? 'bsc' : chain === 'ETH' ? 'ethereum' : 'polygon';
    try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairAddress}`);
        const data = await res.json();
        const pair = data.pairs?.[0];
        if (pair) {
            const info = {
                priceUsd: parseFloat(pair.priceUsd || '0'),
                quoteSymbol: pair.quoteToken?.symbol || 'WBNB',
                dexId: pair.dexId || 'unknown',
                at: Date.now(),
            };
            pairPriceCache[key] = info;
            return info;
        }
    } catch { /* ignore */ }
    return { priceUsd: 0, quoteSymbol: 'WBNB', dexId: 'pancakeswap' };
}

/* ── Main fetcher ── */
export async function fetchPairTxs(
    chain: SupportedChain,
    tokenAddress: string,
    pairAddress: string,
    limit = 50,
    sinceTimestamp = 0,
): Promise<PairTx[]> {
    const explorer = CHAIN_MAP[chain];
    const pairLower = pairAddress.toLowerCase();

    try {
        // 1. Get token transfers for the pair address
        const data = await ApiKeyRotator.fetch(explorer, {
            module: 'account',
            action: 'tokentx',
            contractaddress: tokenAddress,
            address: pairAddress,
            page: '1',
            offset: String(limit),
            sort: 'desc',
        });

        if (data.status !== '1' || !Array.isArray(data.result)) return [];

        // 2. Get pair price + nativePrice for enrichment
        const [pairInfo, nativePrice] = await Promise.all([
            getPairInfo(chain, pairAddress),
            getNativePriceCached(chain),
        ]);

        const rows = data.result as any[];
        const txs: PairTx[] = [];

        for (const row of rows) {
            const ts = parseInt(row.timeStamp) * 1000;
            if (sinceTimestamp && ts <= sinceTimestamp) continue;

            const fromL = (row.from || '').toLowerCase();
            const toL = (row.to || '').toLowerCase();
            const decimals = parseInt(row.tokenDecimal || '18');
            const tokenAmount = parseFloat(row.value) / Math.pow(10, decimals);
            const symbol = row.tokenSymbol || '';

            // Classify: pair sends tokens → BUY; pair receives tokens → SELL
            let kind: TxKind;
            let makerAddress: string;
            if (fromL === pairLower) {
                kind = 'BUY';
                makerAddress = row.to || '';
            } else if (toL === pairLower) {
                kind = 'SELL';
                makerAddress = row.from || '';
            } else {
                kind = 'TRANSFER';
                makerAddress = row.from || '';
            }

            const priceUsd = pairInfo.priceUsd || 0;
            const amountUsd = tokenAmount * priceUsd;
            // Approximate quote amount (WBNB/ETH): amountUsd / nativePrice
            const quoteAmount = nativePrice > 0 ? amountUsd / nativePrice : 0;

            txs.push({
                hash: row.hash,
                blockNumber: row.blockNumber,
                timestamp: ts,
                kind,
                makerAddress,
                tokenSymbol: symbol,
                tokenAmount,
                quoteSymbol: pairInfo.quoteSymbol,
                quoteAmount,
                priceUsd,
                amountUsd,
                pairAddress,
                dexId: pairInfo.dexId,
            });
        }

        return txs;
    } catch (err) {
        console.error('[pair-tx-fetcher] error:', err);
        return [];
    }
}

/* ── Live polling hook helper ─ merge new txs without duplicates ── */
export function mergeTxs(existing: PairTx[], incoming: PairTx[], maxLen = 500): PairTx[] {
    const seen = new Set(existing.map(t => t.hash + t.tokenAmount));
    const newOnes = incoming.filter(t => !seen.has(t.hash + t.tokenAmount));
    const merged = [...newOnes, ...existing].sort((a, b) => b.timestamp - a.timestamp);
    return merged.slice(0, maxLen);
}

/* ── Helpers ── */
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
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
    return n.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

export function fmtAddr(a: string): string {
    if (!a || a.length < 10) return a;
    return a.slice(-6).toUpperCase();
}
