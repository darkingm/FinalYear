/**
 * /api/proxy/rpc/route.ts
 * Server-side JSON-RPC proxy for EVM chains.
 * Uses Ankr (with API key) → publicnode → Pocket fallback.
 * Methods: eth_getLogs, eth_blockNumber, eth_call
 */
import { NextRequest, NextResponse } from 'next/server';

function getAnkrKey(): string {
    return process.env.NEXT_PUBLIC_ANKR_API_KEY?.trim() ?? '';
}

function buildNodes(chainId: string): string[] {
    const key = getAnkrKey();
    const chain = { '56': 'bsc', '1': 'eth', '137': 'polygon' }[chainId] ?? 'bsc';

    const nodes: string[] = [];

    // 1. Ankr with key — best eth_getLogs support
    if (key) nodes.push(`https://rpc.ankr.com/${chain}/${key}`);

    // 2. Chain-specific public nodes that support eth_getLogs
    if (chainId === '56') {
        nodes.push(
            'https://bsc-pokt.nodies.app',          // Pocket Network BSC
            'https://bsc.publicnode.com',            // PublicNode BSC
            'https://bsc-dataseed3.binance.org',     // Binance (limited range)
            'https://bsc-dataseed4.binance.org',
        );
    } else if (chainId === '1') {
        nodes.push('https://ethereum.publicnode.com');
    } else if (chainId === '137') {
        nodes.push('https://polygon.publicnode.com');
    }

    return nodes;
}

const ALLOWED_METHODS = new Set(['eth_getLogs', 'eth_blockNumber', 'eth_call']);

export async function POST(req: NextRequest) {
    let body: { chainId?: string | number; method: string; params: any[] };
    try { body = await req.json(); } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { chainId = '56', method, params } = body;
    if (!ALLOWED_METHODS.has(method)) {
        return NextResponse.json({ error: `Method ${method} not allowed` }, { status: 403 });
    }

    const nodes = buildNodes(String(chainId));
    for (const url of nodes) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
                signal: AbortSignal.timeout(8_000),
            });
            const data = await res.json();

            if (data.result !== undefined) {
                const label = url.includes('ankr') ? 'Ankr' : url.split('/')[2];
                console.info(`[rpc-proxy] ✅ ${label} → ${method} OK`);
                return NextResponse.json(data);
            }

            const errMsg = data.error?.message ?? JSON.stringify(data.error ?? '').slice(0, 120);
            console.warn(`[rpc-proxy] ❌ ${url.split('/')[2]}: ${errMsg}`);
        } catch (e: any) {
            console.warn(`[rpc-proxy] Timeout: ${url.split('/')[2]} — ${e?.message}`);
        }
    }

    return NextResponse.json({ error: 'All RPC nodes failed', jsonrpc: '2.0', id: 1 }, { status: 502 });
}
