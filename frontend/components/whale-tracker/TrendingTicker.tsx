'use client';

import { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { fetchTrendingPairs } from '@/lib/whale-api';
import type { TokenPair, SupportedChain } from '@/store/whale-tracker-store';

interface Props {
    onSelectPair?: (pair: TokenPair) => void;
}

function formatPrice(p: string) {
    const n = parseFloat(p);
    if (n >= 1) return `$${n.toFixed(2)}`;
    if (n >= 0.0001) return `$${n.toFixed(5)}`;
    return `$${n.toExponential(2)}`;
}

function TickerItem({ pair, onClick }: { pair: TokenPair; onClick?: () => void }) {
    const up = pair.priceChange24h >= 0;
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-1.5 px-3 py-1 hover:bg-white/5 rounded transition-colors whitespace-nowrap flex-shrink-0"
        >
            <span className="text-[11px] font-bold text-white/80">{pair.baseToken.symbol}</span>
            <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {up ? '+' : ''}{pair.priceChange24h.toFixed(1)}%
            </span>
        </button>
    );
}

export function TrendingTicker({ onSelectPair }: Props) {
    const [pairs, setPairs] = useState<TokenPair[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchTrendingPairs().then(setPairs);
        const interval = setInterval(() => fetchTrendingPairs().then(setPairs), 120_000);
        return () => clearInterval(interval);
    }, []);

    // Auto-scroll animation
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || pairs.length === 0) return;
        let animId: number;
        let pos = 0;
        const speed = 0.5;
        const tick = () => {
            pos += speed;
            if (pos >= el.scrollWidth / 2) pos = 0;
            el.scrollLeft = pos;
            animId = requestAnimationFrame(tick);
        };
        animId = requestAnimationFrame(tick);
        const pause = () => cancelAnimationFrame(animId);
        const resume = () => { animId = requestAnimationFrame(tick); };
        el.addEventListener('mouseenter', pause);
        el.addEventListener('mouseleave', resume);
        return () => { cancelAnimationFrame(animId); el.removeEventListener('mouseenter', pause); el.removeEventListener('mouseleave', resume); };
    }, [pairs]);

    if (pairs.length === 0) return null;

    // Duplicate list for seamless scroll
    const items = [...pairs, ...pairs];

    return (
        <div className="border-b border-white/[0.06] bg-black/30 overflow-hidden flex-shrink-0">
            <div ref={scrollRef} className="flex items-center overflow-hidden" style={{ scrollbarWidth: 'none' }}>
                {items.map((p, i) => (
                    <TickerItem key={`${p.pairAddress}-${i}`} pair={p} onClick={() => onSelectPair?.(p)} />
                ))}
            </div>
        </div>
    );
}
