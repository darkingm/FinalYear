/**
 * /api/proxy/etherscan/route.ts
 * Server-side proxy for Etherscan API V2 — the unified multichain API.
 *
 * As of Aug 15, 2025, Etherscan V1 is DEPRECATED.
 * V2 uses ONE endpoint + chainid param for all 60+ networks:
 *   Base URL: https://api.etherscan.io/v2/api
 *   BSC:      ?chainid=56&module=...&action=...&apikey=KEY
 *   ETH:      ?chainid=1&module=...&action=...&apikey=KEY
 *   Polygon:  ?chainid=137&module=...&action=...&apikey=KEY
 *
 * One Etherscan API key (registered at etherscan.io) works for ALL chains.
 * Docs: https://docs.etherscan.io/v2-migration
 */
import { NextRequest, NextResponse } from 'next/server';

const V2_BASE = 'https://api.etherscan.io/v2/api';

function getApiKey(): string {
    const keys = (process.env.NEXT_PUBLIC_ETHERSCAN_KEYS ?? process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY ?? '')
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);
    return keys.length > 0 ? keys[Math.floor(Math.random() * keys.length)] : '';
}

export async function GET(req: NextRequest) {
    const params = req.nextUrl.searchParams;

    // Build query: forward all params, inject API key
    const query = new URLSearchParams();
    params.forEach((v, k) => { if (k !== 'apikey') query.set(k, v); });

    const apiKey = getApiKey();
    if (apiKey) {
        query.set('apikey', apiKey);
    } else {
        console.error('[etherscan-proxy] ⚠️  No API key found! Set NEXT_PUBLIC_ETHERSCAN_API_KEY in .env.local and RESTART the dev server.');
    }

    const url = `${V2_BASE}?${query.toString()}`;

    try {
        const upstream = await fetch(url, { signal: AbortSignal.timeout(12_000) });
        const data = await upstream.json();

        if (data.status === '1' && Array.isArray(data.result)) {
            console.info(`[etherscan-proxy] ✅ chainid=${params.get('chainid')} returned ${data.result.length} results`);
            return NextResponse.json(data);
        }

        // Log the actual Etherscan error message (not just "NOTOK")
        console.warn('[etherscan-proxy] ❌ Etherscan V2 error:', {
            chainid: params.get('chainid'),
            module: params.get('module'),
            action: params.get('action'),
            status: data.status,
            message: data.message,
            result: typeof data.result === 'string' ? data.result : JSON.stringify(data.result).slice(0, 200),
            keyPrefix: apiKey ? apiKey.slice(0, 6) + '...' : 'MISSING — restart dev server after setting .env.local',
        });

        return NextResponse.json(data);
    } catch (e: any) {
        console.error('[etherscan-proxy] Fetch error:', e?.message);
        return NextResponse.json({ status: '0', message: 'upstream_error', result: e?.message }, { status: 502 });
    }
}
