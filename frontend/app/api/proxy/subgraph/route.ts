/**
 * /api/proxy/subgraph/route.ts
 * Server-side proxy for TheGraph subgraph queries — avoids browser CORS.
 * Usage: POST /api/proxy/subgraph?url=<encoded-subgraph-url>
 * Body: { query: "..." }
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url');
    if (!url) {
        return NextResponse.json({ error: 'Missing url param' }, { status: 400 });
    }

    // Whitelist only trusted subgraph hosts
    const ALLOWED = [
        'api.thegraph.com',
        'gateway.thegraph.com',
        'gateway-arbitrum.network.thegraph.com',
        'bsc.streamingfast.io',
        'api.goldsky.com',
    ];
    let parsedUrl: URL;
    try { parsedUrl = new URL(url); } catch { return NextResponse.json({ error: 'Invalid url' }, { status: 400 }); }
    if (!ALLOWED.some(h => parsedUrl.hostname.endsWith(h))) {
        return NextResponse.json({ error: 'Host not allowed' }, { status: 403 });
    }

    try {
        const body = await req.text();
        const upstream = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            signal: AbortSignal.timeout(10_000),
        });
        const data = await upstream.json();
        return NextResponse.json(data);
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Upstream error' }, { status: 502 });
    }
}
