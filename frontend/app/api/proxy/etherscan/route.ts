/**
 * /api/proxy/etherscan/route.ts
 *
 * Routes blockchain explorer API calls server-side (no CORS).
 * Per-chain endpoints (same query format for all):
 *   BSC     → api.bscscan.com/api         (free, register at bscscan.com/myapikey)
 *   ETH     → api.etherscan.io/v2/api?chainid=1  (Etherscan V2 free covers ETH only)
 *   Polygon → api.polygonscan.com/api     (free, register at polygonscan.com/myapikey)
 *
 * NOTE: Etherscan V2 free tier does NOT cover BSC/Polygon — separate keys needed.
 */
import { NextRequest, NextResponse } from 'next/server';

// Per-chain base URLs — SAME query format (module/action/apikey), different host
const CHAIN_ENDPOINTS: Record<string, string> = {
    '56': 'https://api.bscscan.com/api',                        // BSC  → BSCScan (free)
    '1': 'https://api.etherscan.io/v2/api',                    // ETH  → Etherscan V2
    '137': 'https://api.polygonscan.com/api',                    // POLY → Polygonscan (free)
};

function pickKey(envVar: string | undefined): string {
    if (!envVar) return '';
    const keys = envVar.split(',').map(k => k.trim()).filter(k => k.length > 0);
    return keys.length > 0 ? keys[Math.floor(Math.random() * keys.length)] : '';
}

function getApiKey(chainid: string): string {
    if (chainid === '56') {
        return pickKey(process.env.BSCSCAN_API_KEY)
            || pickKey(process.env.ETHERSCAN_API_KEY);
    }
    if (chainid === '137') {
        return pickKey(process.env.POLYGONSCAN_API_KEY)
            || pickKey(process.env.ETHERSCAN_API_KEY);
    }
    return pickKey(process.env.ETHERSCAN_API_KEY);
}

export async function GET(req: NextRequest) {
    const params = req.nextUrl.searchParams;
    const chainid = params.get('chainid') ?? '56';

    const baseUrl = CHAIN_ENDPOINTS[chainid] ?? CHAIN_ENDPOINTS['56'];
    const apiKey = getApiKey(chainid);

    // Build query
    const query = new URLSearchParams();
    params.forEach((v, k) => { if (k !== 'apikey') query.set(k, v); });
    // For Etherscan V2 (ETH), keep chainid; for BSCScan/Polygonscan, remove it
    if (chainid !== '1') query.delete('chainid');
    if (apiKey) query.set('apikey', apiKey);

    if (!apiKey) {
        console.warn(`[explorer-proxy] ⚠️  No API key for chainid=${chainid}. Set NEXT_PUBLIC_BSCSCAN_API_KEY for BSC. Will try without key (rate limited).`);
    }

    const url = `${baseUrl}?${query.toString()}`;
    try {
        const upstream = await fetch(url, { signal: AbortSignal.timeout(12_000) });
        const data = await upstream.json();

        if (data.status === '1' && Array.isArray(data.result)) {
            console.info(`[explorer-proxy] ✅ chainid=${chainid} → ${baseUrl.split('/')[2]} returned ${data.result.length} results`);
            return NextResponse.json(data);
        }

        console.warn('[explorer-proxy] ❌ Error:', {
            host: baseUrl.split('/')[2],
            chainid,
            message: data.message,
            result: typeof data.result === 'string' ? data.result.slice(0, 200) : '(non-string)',
            keyPrefix: apiKey ? apiKey.slice(0, 6) + '...' : 'MISSING',
        });
        return NextResponse.json(data);
    } catch (e: any) {
        console.error('[explorer-proxy] Fetch error:', e?.message);
        return NextResponse.json({ status: '0', message: 'timeout', result: [] }, { status: 502 });
    }
}
