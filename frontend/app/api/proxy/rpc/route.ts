/**
 * /api/proxy/rpc/route.ts — EVM JSON-RPC server-side proxy
 *
 * Routes eth_getLogs / eth_blockNumber / eth_call to Ankr or public nodes.
 * Keys are server-only (no NEXT_PUBLIC prefix — never in browser bundle).
 *
 * Node priority per chain:
 *   BSC: Ankr (key) → Pocket Network → PublicNode → Binance (limited)
 */
import { NextRequest, NextResponse } from 'next/server';

// ─── Per-node max block range cache (learned from errors) ─────────────────────
// Avoids sending eth_getLogs with ranges we already know will fail.
const nodeRangeLimit: Record<string, number> = {};
const FALLBACK_RANGE = 500; // safe default if a node hasn't been tested yet

function getAnkrKey(): string {
    return process.env.ANKR_API_KEY?.trim() ?? '';
}

function buildNodes(chainId: string): string[] {
    const key = getAnkrKey();
    const chain = ({ '56': 'bsc', '1': 'eth', '137': 'polygon' } as Record<string, string>)[chainId] ?? 'bsc';
    const nodes: string[] = [];
    if (key) nodes.push(`https://rpc.ankr.com/${chain}/${key}`);
    if (chainId === '56') {
        nodes.push(
            'https://bsc-pokt.nodies.app',
            'https://bsc.publicnode.com',
            'https://bsc-dataseed3.binance.org',
            'https://bsc-dataseed4.binance.org',
        );
    } else if (chainId === '1') {
        nodes.push('https://ethereum.publicnode.com');
    } else if (chainId === '137') {
        nodes.push('https://polygon.publicnode.com');
    }
    return nodes;
}

const ALLOWED = new Set(['eth_getLogs', 'eth_blockNumber', 'eth_call']);

// ─── Check if a request would exceed a node's known range limit ────────────────
function wouldExceedLimit(url: string, method: string, params: any[]): boolean {
    if (method !== 'eth_getLogs') return false;
    const filter = params[0];
    if (!filter?.fromBlock || !filter?.toBlock || filter.toBlock === 'latest') return false;
    const from = parseInt(filter.fromBlock, 16);
    const to = parseInt(filter.toBlock, 16);
    const range = to - from;
    const known = nodeRangeLimit[url];
    return known !== undefined && range > known;
}

export async function POST(req: NextRequest) {
    let body: { chainId?: string | number; method: string; params: any[] };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const { chainId = '56', method, params } = body;
    if (!ALLOWED.has(method)) {
        return NextResponse.json({ error: `Method ${method} not allowed` }, { status: 403 });
    }

    const nodes = buildNodes(String(chainId));
    const errors: string[] = [];

    for (const url of nodes) {
        // Skip nodes we know can't handle this range
        if (wouldExceedLimit(url, method, params)) continue;

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

            // Record range limit from error message
            const errMsg = (data.error?.message ?? '') as string;
            if (errMsg.toLowerCase().includes('block range') || errMsg.toLowerCase().includes('range is too large')) {
                const filter = params[0];
                if (filter?.fromBlock && filter?.toBlock !== 'latest') {
                    const range = parseInt(filter.toBlock, 16) - parseInt(filter.fromBlock, 16);
                    nodeRangeLimit[url] = Math.floor(range * 0.8); // store 80% of failed range
                }
                errors.push(`${url.split('/')[2]}: ${errMsg.slice(0, 60)}`);
            } else {
                errors.push(`${url.split('/')[2]}: ${errMsg.slice(0, 60)}`);
            }
        } catch (e: any) {
            errors.push(`${url.split('/')[2]}: timeout`);
        }
    }

    // Only log if ALL nodes failed (real error, not just fallback behavior)
    console.error('[rpc-proxy] All nodes failed:', errors.join(' | '));
    return NextResponse.json({ error: 'All nodes failed', jsonrpc: '2.0', id: 1 }, { status: 502 });
}
