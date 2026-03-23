/**
 * /api/proxy/etherscan/route.ts
 * Server-side proxy — tries BSCScan first (for BSC), then Etherscan V2 fallback.
 * Avoids CORS, keeps API keys server-side.
 * Usage: GET /api/proxy/etherscan?chainid=56&module=account&action=tokentx&...
 */
import { NextRequest, NextResponse } from 'next/server';

const V2_BASE = 'https://api.etherscan.io/v2/api';
const BSCSCAN_BASE = 'https://api.bscscan.com/api';

function pickKey(envVar: string | undefined): string {
    if (!envVar) return '';
    const keys = envVar.split(',').map(k => k.trim()).filter(k => k.length > 0);
    return keys.length > 0 ? keys[Math.floor(Math.random() * keys.length)] : '';
}

export async function GET(req: NextRequest) {
    const params = req.nextUrl.searchParams;
    const chainid = params.get('chainid') ?? '56';

    const ethKey = pickKey(process.env.NEXT_PUBLIC_ETHERSCAN_KEYS || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY);
    const bscKey = pickKey(process.env.NEXT_PUBLIC_BSCSCAN_API_KEY);
    const isBSC = chainid === '56';

    // Build universal query string (without apikey — will add per attempt)
    const base = new URLSearchParams();
    params.forEach((v, k) => { if (k !== 'apikey') base.set(k, v); });

    // Attempt order: BSCScan (if BSC + key available) → Etherscan V2
    type Attempt = { url: string; key: string; label: string };
    const attempts: Attempt[] = [];

    if (isBSC && bscKey) {
        const q = new URLSearchParams(base); q.set('apikey', bscKey);
        attempts.push({ url: `${BSCSCAN_BASE}?${q}`, key: bscKey, label: 'BSCScan' });
    }
    {
        const q = new URLSearchParams(base);
        if (ethKey) q.set('apikey', ethKey);
        attempts.push({ url: `${V2_BASE}?${q}`, key: ethKey, label: 'Etherscan-V2' });
    }
    if (isBSC && !bscKey) {
        // Try BSCScan without key (5 req/s free tier)
        const q = new URLSearchParams(base);
        q.delete('chainid'); // BSCScan doesn't use chainid param
        attempts.push({ url: `${BSCSCAN_BASE}?${q}`, key: '', label: 'BSCScan-nokey' });
    }

    for (const attempt of attempts) {
        try {
            const res = await fetch(attempt.url, { signal: AbortSignal.timeout(10_000) });
            const data = await res.json();

            if (data.status === '1' && Array.isArray(data.result)) {
                console.info(`[etherscan-proxy] ✅ ${attempt.label} returned ${data.result.length} results`);
                return NextResponse.json(data);
            }

            console.warn(`[etherscan-proxy] ${attempt.label} NOTOK:`, {
                message: data.message,
                result: typeof data.result === 'string' ? data.result.slice(0, 150) : '(array/empty)',
                keyPresent: !!attempt.key,
                keyPrefix: attempt.key ? attempt.key.slice(0, 6) + '...' : 'NONE',
            });
        } catch (e: any) {
            console.error(`[etherscan-proxy] ${attempt.label} fetch error:`, e?.message);
        }
    }

    return NextResponse.json({ status: '0', message: 'NOTOK', result: [] });
}
