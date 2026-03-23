/**
 * onchain-api-manager.ts v2 — Etherscan API V2 (unified multichain)
 *
 * As of Aug 2025, Etherscan V1 endpoints are DEPRECATED.
 * V2 uses a SINGLE endpoint + chainid param for all 60+ networks.
 * ONE API key works for: ETH (1), BSC (56), Polygon (137), and 60+ more.
 *
 * Base URL: https://api.etherscan.io/v2/api?chainid={chainId}&...&apikey=KEY
 *
 * Env vars (single key for ALL chains):
 *   NEXT_PUBLIC_ETHERSCAN_API_KEY=your_key_here
 *   NEXT_PUBLIC_ETHERSCAN_KEYS=key1,key2,key3   (multi-key rotation, optional)
 */

export type ExplorerChain = 'BSC' | 'ETH' | 'POLYGON';

/* ── V2 Unified endpoint + chain IDs ── */
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

/* Backward compat alias */
export const EXPLORER_CONFIG = Object.fromEntries(
    Object.entries(CHAIN_CONFIG).map(([k, v]) => [k, { ...v, baseUrl: V2_BASE }])
) as Record<ExplorerChain, typeof CHAIN_CONFIG[ExplorerChain] & { baseUrl: string }>;

/* ── Key pool (one pool for ALL chains since V2 is unified) ── */
function parseKeys(envValue: string | undefined, fallback: string): string[] {
    const raw = envValue || fallback;
    return raw.split(',').map(k => k.trim()).filter(Boolean);
}

const KEY_POOL: string[] = parseKeys(
    process.env.NEXT_PUBLIC_ETHERSCAN_KEYS,
    process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || ''
);

/* ── Pointer + rate limit state ── */
let pointer = 0;
const rateLimitedUntil: Record<string, number> = {};

function markRateLimited(key: string) {
    rateLimitedUntil[key] = Date.now() + 30_000;
}
function isRateLimited(key: string): boolean {
    return (rateLimitedUntil[key] || 0) > Date.now();
}

/* ── Rotator ── */
export const ApiKeyRotator = {
    getKey(_chain?: ExplorerChain): string {
        if (!KEY_POOL.length) return '';
        let attempts = KEY_POOL.length;
        while (attempts-- > 0) {
            const idx = pointer % KEY_POOL.length;
            pointer = (pointer + 1) % KEY_POOL.length;
            const key = KEY_POOL[idx];
            if (!isRateLimited(key)) return key;
        }
        return KEY_POOL[0]; // all rate-limited, use first anyway
    },

    markKeyRateLimited(key: string) { markRateLimited(key); },

    /**
     * Build URL for Etherscan V2 API.
     * Automatically includes chainid and apikey.
     */
    buildUrl(chain: ExplorerChain, params: Record<string, string>): string {
        const url = new URL(V2_BASE);
        url.searchParams.set('chainid', CHAIN_CONFIG[chain].chainId);
        for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
        const key = ApiKeyRotator.getKey(chain);
        if (key) url.searchParams.set('apikey', key);
        return url.toString();
    },

    /**
     * Fetch with auto rate-limit detection.
     */
    async fetch(chain: ExplorerChain, params: Record<string, string>): Promise<any> {
        const url = new URL(V2_BASE);
        url.searchParams.set('chainid', CHAIN_CONFIG[chain].chainId);
        for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
        const key = ApiKeyRotator.getKey(chain);
        if (key) url.searchParams.set('apikey', key);

        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });

        if (res.status === 429) {
            if (key) markRateLimited(key);
            throw new Error(`Rate limited: ${chain}`);
        }

        const data = await res.json();

        // V2 deprecation or rate-limit messages
        if (typeof data.result === 'string') {
            const r = data.result.toLowerCase();
            if (r.includes('rate limit') || r.includes('max rate')) {
                if (key) markRateLimited(key);
                throw new Error(`Rate limited (API): ${chain}`);
            }
            if (r.includes('deprecated')) {
                throw new Error(`Etherscan V1 deprecated — already using V2, check params`);
            }
        }

        return data;
    },

    /** Current key pool status for debugging */
    status() {
        return KEY_POOL.map(k => ({
            key: k.slice(0, 8) + '…',
            rateLimited: isRateLimited(k),
            cooldownMs: Math.max(0, (rateLimitedUntil[k] || 0) - Date.now()),
        }));
    },
};

/* ── DEX Router addresses ── */
export const DEX_ROUTERS: Record<string, string> = {
    '0x10ed43c718714eb63d5aa57b78b54704e256024e': 'PancakeSwap V2',
    '0x13f4ea83d0bd40e75c8222255bc855a974568dd4': 'PancakeSwap V3',
    '0xcf0febd3f17cef5b47b0cd257acf6025c5bff3b7': 'ApeSwap',
    '0x05ff2b0db69458a0750badebc4f9e13add608c7f': 'PancakeSwap V1',
    '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2',
    '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3',
    '0xef1c6e67703c7bd7107eed8303fbe6ec2554bf6b': 'Uniswap Universal',
    '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': 'Uniswap Universal V2',
    '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': 'SushiSwap',
    '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506': 'SushiSwap BSC',
    '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff': 'QuickSwap',
    '0xf5b509bb0909a69b1c207e495f687a596c168e12': 'QuickSwap V3',
    '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch V5',
    '0x6131b5fae19ea4f9d964eac0408e4408b66337b5': 'KyberSwap',
};

export function classifyTxType(toAddr: string, fromAddr: string, walletAddress: string) {
    const to = toAddr.toLowerCase();
    const from = fromAddr.toLowerCase();
    const wallet = walletAddress.toLowerCase();
    const dexName = DEX_ROUTERS[to] || DEX_ROUTERS[from];
    if (dexName) {
        return { type: from === wallet ? 'SELL' as const : 'BUY' as const, dexName };
    }
    return { type: 'TRANSFER' as const };
}
