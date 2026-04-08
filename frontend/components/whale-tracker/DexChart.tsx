'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import type { SupportedChain } from '@/store/whale-tracker-store';

interface Props {
    chainId: string;        // dexscreener chainId e.g. "bsc", "ethereum"
    pairAddress: string;
    tokenSymbol?: string;
}

const DEXSCREENER_CHAIN: Record<SupportedChain, string> = {
    BSC: 'bsc', ETH: 'ethereum', POLYGON: 'polygon',
};

export function DexChart({ chainId, pairAddress, tokenSymbol }: Props) {
    const [isMounted, setIsMounted] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => { setIsMounted(true); }, []);

    const embedUrl = useMemo(() => {
        if (!pairAddress) return '';
        return `https://dexscreener.com/${chainId}/${pairAddress}?embed=1&theme=dark&trades=0&info=0`;
    }, [chainId, pairAddress]);

    if (!isMounted || !embedUrl) {
        return (
            <div className="w-full h-full bg-[#0b0b12] flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-white/20">
                    <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                    <span className="text-xs">Loading chart...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative bg-[#0b0b12]">
            <iframe
                ref={iframeRef}
                src={embedUrl}
                className="w-full h-full border-0"
                allow="clipboard-write"
                loading="lazy"
                title={`${tokenSymbol || 'Token'} Chart`}
            />
        </div>
    );
}
