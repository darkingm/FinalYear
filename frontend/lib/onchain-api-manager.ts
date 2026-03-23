/**
 * onchain-api-manager.ts — Multi-key round-robin rotator for block explorer APIs
 *
 * Supports multiple API keys per chain to avoid rate limiting.
 * Keys are read from env vars (comma-separated):
 *   NEXT_PUBLIC_BSCSCAN_KEYS=key1,key2,key3
 *   NEXT_PUBLIC_ETHERSCAN_KEYS=key1,key2
 *   NEXT_PUBLIC_POLYGONSCAN_KEYS=key1
 *
 * Usage:
 *   const key = ApiKeyRotator.getKey('BSC');
 *   const url = ApiKeyRotator.buildUrl('BSC', params);
 */

export type ExplorerChain = 'BSC' | 'ETH' | 'POLYGON';

/* ── Chain configuration ── */
export const EXPLORER_CONFIG: Record<ExplorerChain, {
    baseUrl: string;
    nativeSymbol: string;
    chainId: string;
    nativePriceSymbol: string;
}> = {
    BSC: {
        baseUrl: 'https://api.bscscan.com/api',
        nativeSymbol: 'BNB',
        chainId: '56',
        nativePriceSymbol: 'BNBUSDT',
    },
    ETH: {
        baseUrl: 'https://api.etherscan.io/api',
        nativeSymbol: 'ETH',
        chainId: '1',
        nativePriceSymbol: 'ETHUSDT',
    },
    POLYGON: {
        baseUrl: 'https://api.polygonscan.com/api',
        nativeSymbol: 'MATIC',
        chainId: '137',
        nativePriceSymbol: 'MATICUSDT',
    },
};

/* ── Key pool ── */
function parseKeys(envValue: string | undefined, fallback: string): string[] {
    const raw = envValue || fallback;
    return raw.split(',').map(k => k.trim()).filter(Boolean);
}

const KEY_POOLS: Record<ExplorerChain, string[]> = {
    BSC: parseKeys(
        process.env.NEXT_PUBLIC_BSCSCAN_KEYS,
        process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || ''
    ),
    ETH: parseKeys(
        process.env.NEXT_PUBLIC_ETHERSCAN_KEYS,
        process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || ''
    ),
    POLYGON: parseKeys(
        process.env.NEXT_PUBLIC_POLYGONSCAN_KEYS,
        process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || ''
    ),
};

/* ── Pointer state (client-side only) ── */
const pointers: Record<ExplorerChain, number> = { BSC: 0, ETH: 0, POLYGON: 0 };

/* ── 429 / error tracking: skip burning keys ── */
const rateLimitedUntil: Record<string, number> = {}; // key -> timestamp ms

function markRateLimited(key: string) {
    rateLimitedUntil[key] = Date.now() + 30_000; // 30s cooldown
}

function isRateLimited(key: string): boolean {
    return (rateLimitedUntil[key] || 0) > Date.now();
}

export const ApiKeyRotator = {
    /**
     * Get next available key for chain, skipping rate-limited ones.
     * Falls back to '' if all keys exhausted.
     */
    getKey(chain: ExplorerChain): string {
        const pool = KEY_POOLS[chain];
        if (!pool.length) return '';

        let attempts = pool.length;
        while (attempts-- > 0) {
            const idx = pointers[chain] % pool.length;
            pointers[chain] = (pointers[chain] + 1) % pool.length;
            const key = pool[idx];
            if (!isRateLimited(key)) return key;
        }
        // All rate-limited — use first key anyway
        return pool[0];
    },

    markKeyRateLimited(key: string) {
        markRateLimited(key);
    },

    /**
     * Build full URL for a chain's explorer API with params.
     * Automatically appends the next rotated API key.
     */
    buildUrl(chain: ExplorerChain, params: Record<string, string>): string {
        const cfg = EXPLORER_CONFIG[chain];
        const url = new URL(cfg.baseUrl);
        for (const [k, v] of Object.entries(params)) {
            url.searchParams.set(k, v);
        }
        const key = ApiKeyRotator.getKey(chain);
        if (key) url.searchParams.set('apikey', key);
        return url.toString();
    },

    /**
     * Fetch with auto rate-limit detection.
     * Returns parsed JSON or throws.
     */
    async fetch(chain: ExplorerChain, params: Record<string, string>): Promise<any> {
        const cfg = EXPLORER_CONFIG[chain];
        const url = new URL(cfg.baseUrl);
        for (const [k, v] of Object.entries(params)) {
            url.searchParams.set(k, v);
        }
        const key = ApiKeyRotator.getKey(chain);
        if (key) url.searchParams.set('apikey', key);

        const res = await fetch(url.toString());

        if (res.status === 429) {
            if (key) markRateLimited(key);
            throw new Error(`Rate limited on ${chain}`);
        }

        const data = await res.json();

        // Etherscan rate limit shows as result "Max rate limit reached"
        if (typeof data.result === 'string' && data.result.includes('rate limit')) {
            if (key) markRateLimited(key);
            throw new Error(`Rate limited (API): ${chain}`);
        }

        return data;
    },
};

/* ── DEX Router addresses (all chains) ── */
export const DEX_ROUTERS: Record<string, string> = {
    // BSC — PancakeSwap
    '0x10ed43c718714eb63d5aa57b78b54704e256024e': 'PancakeSwap V2',
    '0x13f4ea83d0bd40e75c8222255bc855a974568dd4': 'PancakeSwap V3',
    '0xcf0febd3f17cef5b47b0cd257acf6025c5bff3b7': 'ApeSwap',
    '0x05ff2b0db69458a0750badebc4f9e13add608c7f': 'PancakeSwap V1',
    // ETH — Uniswap
    '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2',
    '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3',
    '0xef1c6e67703c7bd7107eed8303fbe6ec2554bf6b': 'Uniswap Universal',
    '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': 'Uniswap Universal V2',
    // ETH — SushiSwap
    '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': 'SushiSwap',
    '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506': 'SushiSwap BSC',
    // Polygon
    '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff': 'QuickSwap',
    '0xf5b509bb0909a69b1c207e495f687a596c168e12': 'QuickSwap V3',
    // Multi-chain
    '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch V5',
    '0x1111111254fb6c44bac0bed2854e76f90643097d': '1inch V4',
    '0x6131b5fae19ea4f9d964eac0408e4408b66337b5': 'KyberSwap',
};

export function classifyTxType(
    toAddr: string,
    fromAddr: string,
    walletAddress: string
): { type: 'BUY' | 'SELL' | 'TRANSFER'; dexName?: string } {
    const to = toAddr.toLowerCase();
    const from = fromAddr.toLowerCase();
    const wallet = walletAddress.toLowerCase();
    const dexName = DEX_ROUTERS[to] || DEX_ROUTERS[from];

    if (dexName) {
        // If wallet is sending to router → SELL
        // If wallet is receiving from router → BUY
        const type = from === wallet ? 'SELL' : 'BUY';
        return { type, dexName };
    }
    return { type: 'TRANSFER' };
}
