/**
 * /api/proxy/etherscan/route.ts
 * Server-side proxy for Etherscan V2 API — avoids CORS and keeps API key server-only.
 * Usage: GET /api/proxy/etherscan?chainid=56&module=account&action=tokentx&...
 */
import { NextRequest, NextResponse } from 'next/server';

const V2_BASE = 'https://api.etherscan.io/v2/api';

// Keys on server side (can use non-NEXT_PUBLIC_ for security, but NEXT_PUBLIC_ also works)
function getKey(): string {
    const keys = (
        process.env.NEXT_PUBLIC_ETHERSCAN_KEYS ||
        process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY ||
        ''
    ).split(',').map(k => k.trim()).filter(Boolean);
    return keys[Math.floor(Math.random() * keys.length)] || '';
}

export async function GET(req: NextRequest) {
    const params = req.nextUrl.searchParams;

    // Validate required params
    const chainid = params.get('chainid');
    const module = params.get('module');
    const action = params.get('action');
    if (!chainid || !module || !action) {
        return NextResponse.json({ status: '0', message: 'Missing params', result: [] }, { status: 400 });
    }

    // Forward all params except apikey (we inject our own)
    const query = new URLSearchParams();
    params.forEach((v, k) => { if (k !== 'apikey') query.set(k, v); });
    const apiKey = getKey();
    if (apiKey) query.set('apikey', apiKey);

    try {
        const url = `${V2_BASE}?${query.toString()}`;
        const upstream = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        const data = await upstream.json();

        // Detect rate limit
        if (typeof data.result === 'string' && data.result.toLowerCase().includes('rate limit')) {
            return NextResponse.json(data, { status: 429 });
        }
        return NextResponse.json(data);
    } catch (e: any) {
        return NextResponse.json({ status: '0', message: e?.message || 'Upstream error', result: [] }, { status: 502 });
    }
}
