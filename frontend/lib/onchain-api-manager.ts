/**
 * onchain-api-manager.ts — Etherscan API V2 (unified multichain)
 *
 * V2: ONE key, ONE endpoint, ALL chains via chainid param.
 * Base URL: https://api.etherscan.io/v2/api?chainid={chainId}&apikey=KEY
 * Docs: https://docs.etherscan.io/v2-migration
 */

export type ExplorerChain = 'BSC' | 'ETH' | 'POLYGON';

const V2_BASE = 'https://api.etherscan.io/v2/api';

export const CHAIN_CONFIG: Record<ExplorerChain, {
    chainId: string;
    nativeSymbol: string;
    nativePriceSymbol: string;
    blockExplorer: string;
}> = {
    ETH: { chainId: '1', nativeSymbol: 'ETH', nativePriceSymbol: 'ETHUSDT', blockExplorer: 'https://etherscan.io/tx/' },
    BSC: { chainId: '56', nativeSymbol: 'BNB', nativePriceSymbol: 'BNBUSDT', blockExplorer: 'https://bscscan.com/tx/' },
    POLYGON: { chainId: '137', nativeSymbol: 'MATIC', nativePriceSymbol: 'MATICUSDT', blockExplorer: 'https://polygonscan.com/tx/' },
};

// Backward-compat alias
export const EXPLORER_CONFIG = Object.fromEntries(
    Object.entries(CHAIN_CONFIG).map(([k, v]) => [k, { ...v, baseUrl: V2_BASE }])
) as Record<ExplorerChain, typeof CHAIN_CONFIG[ExplorerChain] & { baseUrl: string }>;

/* ── Key pool ── */
function parseKeys(): string[] {
    const multi = process.env.NEXT_PUBLIC_ETHERSCAN_KEYS ?? '';
    const single = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY ?? '';
    return (multi || single).split(',').map(k => k.trim()).filter(Boolean);
}

const KEY_POOL: string[] = parseKeys();
let pointer = 0;
const rateLimitedUntil: Record<string, number> = {};

function isRateLimited(key: string) { return (rateLimitedUntil[key] || 0) > Date.now(); }
function markRateLimited(key: string) { rateLimitedUntil[key] = Date.now() + 30_000; }

/* ── DEX router addresses for transaction classification ── */
const DEX_ROUTERS: Record<string, string> = {
    // PancakeSwap
    '0x10ed43c718714eb63d5aa57b78b54704e256024e': 'PancakeSwap V2',
    '0x13f4ea83d0bd40e75c8222255bc855a974568dd4': 'PancakeSwap V3',
    '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73': 'PancakeSwap LP',
    // Uniswap
    '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2',
    '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3',
    // QuickSwap (Polygon)
    '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff': 'QuickSwap',
    // SushiSwap
    '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': 'SushiSwap',
    '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506': 'SushiSwap',
    // 1inch
    '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch V5',
    '0x1111111254fb6c44bac0bed2854e76f90643097d': '1inch V4',
};

export function classifyTxType(to: string, from: string, walletAddress: string): { type: 'BUY' | 'SELL' | 'TRANSFER'; dexName?: string } {
    const toLower = to.toLowerCase();
    const fromLower = from.toLowerCase();
    const walletLower = walletAddress.toLowerCase();
    const dexName = DEX_ROUTERS[toLower] || DEX_ROUTERS[fromLower];
    if (dexName) {
        const type = fromLower === walletLower ? 'SELL' : 'BUY';
        return { type, dexName };
    }
    return { type: 'TRANSFER' };
}

/* ── ApiKeyRotator — calls Etherscan V2 endpoint directly ── */
export const ApiKeyRotator = {
    getKey(_chain?: ExplorerChain): string {
        const available = KEY_POOL.filter(k => !isRateLimited(k));
        if (available.length === 0) return KEY_POOL[0] || '';
        const key = available[pointer % available.length];
        pointer = (pointer + 1) % available.length;
        return key;
    },

    /**
     * Calls Etherscan V2: https://api.etherscan.io/v2/api?chainid=56&module=...&apikey=KEY
     * NOTE: From frontend code, use /api/proxy/etherscan instead to avoid CORS.
     *       This method is for server-side / backend use only.
     */
    async fetch(chain: ExplorerChain, params: Record<string, string>): Promise<any> {
        const key = this.getKey(chain);
        const cfg = CHAIN_CONFIG[chain];
        const query = new URLSearchParams({
            chainid: cfg.chainId,
            ...params,
            ...(key ? { apikey: key } : {}),
        });
        const url = `${V2_BASE}?${query.toString()}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        const data = await res.json();

        // Handle rate limit
        if (typeof data.result === 'string' && data.result.toLowerCase().includes('rate limit')) {
            markRateLimited(key);
        }
        return data;
    },
};
