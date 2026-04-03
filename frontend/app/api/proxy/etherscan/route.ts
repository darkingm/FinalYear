/**
 * /api/proxy/etherscan/route.ts
 *
 * Routes blockchain explorer API calls server-side (no CORS).
 * Uses Etherscan V2 unified API for supported chains only.
 *
 * IMPORTANT: Free tier only supports ETH mainnet (chainid=1).
 * BSC (56) and Polygon (137) require paid plan — we skip them
 * and let the frontend fall back to direct RPC (eth_getLogs).
 *
 * See: https://docs.etherscan.io/v2-migration
 */
import { NextRequest, NextResponse } from 'next/server';

const ETHERSCAN_V2_BASE = 'https://api.etherscan.io/v2/api';

// Chains supported by Etherscan V2 FREE tier
const FREE_TIER_CHAINS = new Set(['1']); // Only ETH mainnet

function pickKey(envVar: string | undefined): string {
    if (!envVar) return '';
    const keys = envVar.split(',').map(k => k.trim()).filter(k => k.length > 0);
    return keys.length > 0 ? keys[Math.floor(Math.random() * keys.length)] : '';
}

function getApiKey(): string {
    return pickKey(process.env.ETHERSCAN_API_KEY)
        || pickKey(process.env.BSCSCAN_API_KEY);
}

export async function GET(req: NextRequest) {
    const params = req.nextUrl.searchParams;
    const chainid = params.get('chainid') ?? '56';

    // ── Skip unsupported chains silently ──────────────────────────────
    // BSC (56), Polygon (137) etc. are NOT free on Etherscan V2.
    // Frontend should use direct RPC (eth_getLogs) or subgraph for these.
    if (!FREE_TIER_CHAINS.has(chainid)) {
        return NextResponse.json({
            status: '0',
            message: 'NOTOK',
            result: [],
            _note: `Chain ${chainid} not supported on free Etherscan tier. Use RPC fallback.`,
        });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
        return NextResponse.json({
            status: '0',
            message: 'NOTOK',
            result: [],
            _note: 'No ETHERSCAN_API_KEY configured.',
        });
    }

    // Build query for supported chain
    const query = new URLSearchParams();
    params.forEach((v, k) => { if (k !== 'apikey') query.set(k, v); });
    query.set('chainid', chainid);
    query.set('apikey', apiKey);

    const url = `${ETHERSCAN_V2_BASE}?${query.toString()}`;
    try {
        const upstream = await fetch(url, { signal: AbortSignal.timeout(12_000) });
        const data = await upstream.json();

        if (data.status === '1' && Array.isArray(data.result)) {
            return NextResponse.json(data);
        }

        // Log only real errors, not "chain not supported" noise
        if (data.message !== 'NOTOK') {
            console.warn('[explorer-proxy] ❌ Unexpected:', {
                chainid,
                message: data.message,
                result: typeof data.result === 'string' ? data.result.slice(0, 120) : '(non-string)',
            });
        }
        return NextResponse.json(data);
    } catch (e: any) {
        console.error('[explorer-proxy] Fetch error:', e?.message);
        return NextResponse.json({ status: '0', message: 'timeout', result: [] }, { status: 502 });
    }
}
