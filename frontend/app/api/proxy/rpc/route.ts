/**
 * /api/proxy/rpc/route.ts
 * Server-side JSON-RPC proxy for EVM chains (BSC, ETH, Polygon).
 * Routes to public RPC nodes — no API key needed, no CORS issues.
 *
 * Methods allowed: eth_getLogs, eth_blockNumber, eth_call
 */
import { NextRequest, NextResponse } from 'next/server';

const RPC_NODES: Record<string, string[]> = {
    '56': [  // BSC — ordered by eth_getLogs permissiveness
        'https://rpc.ankr.com/bsc',           // Ankr — best limits, no key needed
        'https://bsc.meowrpc.com',             // MeowRPC — generous public BSC node
        'https://bsc-pokt.nodies.app',         // Pocket Network
        'https://bsc.publicnode.com',          // PublicNode
        'https://bsc-dataseed3.binance.org',   // Binance — strict limits, last resort
        'https://bsc-dataseed4.binance.org',
    ],
    '1': [  // Ethereum
        'https://rpc.ankr.com/eth',
        'https://ethereum.publicnode.com',
    ],
    '137': [  // Polygon
        'https://rpc.ankr.com/polygon',
        'https://polygon.publicnode.com',
    ],
};


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

    const nodes = RPC_NODES[String(chainId)] ?? RPC_NODES['56'];
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
                return NextResponse.json(data);
            }
            console.warn('[rpc-proxy] Node error:', url, data.error?.message);
        } catch (e: any) {
            console.warn('[rpc-proxy] Node unreachable:', url, e?.message);
        }
    }
    return NextResponse.json({ error: 'All RPC nodes failed', jsonrpc: '2.0', id: 1 }, { status: 502 });
}
