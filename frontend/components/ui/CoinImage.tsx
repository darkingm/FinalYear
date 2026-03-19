'use client';

/**
 * CoinImage — universal coin logo with automatic fallback chain.
 * 1st: jsdelivr cryptocurrency-icons (stable, free CDN from GitHub)
 * 2nd: cryptologos.cc (major coins only)
 * Last: text initials with brand color
 *
 * Usage:
 *   <CoinImage symbol="BTC" size={24} className="rounded-full" />
 */

import { useState } from 'react';
import { getCoinLogoFallbacks } from '@/lib/utils/coin-logos';

// Brand colors for text-fallback initials
const COIN_COLORS: Record<string, string> = {
    BTC: '#f7931a', ETH: '#627eea', BNB: '#f0b90b', SOL: '#9945ff',
    XRP: '#00aae4', ADA: '#0033ad', DOGE: '#c3a634', AVAX: '#e84142',
    MATIC: '#8247e5', POL: '#8247e5', DOT: '#e6007a', LINK: '#2a5ada',
    ATOM: '#6f7390', LTC: '#bfbbbb', TRX: '#ef0027', TON: '#0098ea',
    NEAR: '#00c08b', APT: '#00c2a8', ARB: '#28a0f0', OP: '#ff0420',
    SUI: '#4ca3ff', USDT: '#26a17b', USDC: '#2775ca', DAI: '#f5ac37',
    UNI: '#ff007a', AAVE: '#b6509e', SHIB: '#e71b1b', INJ: '#00b4d0',
};

interface CoinImageProps {
    symbol: string;
    size?: number;
    className?: string;
    alt?: string;
}

export function CoinImage({ symbol, size = 24, className = '', alt }: CoinImageProps) {
    const upper = symbol.toUpperCase().replace(/USDT$/, '');
    const [srcIndex, setSrcIndex] = useState(0);
    const [failed, setFailed] = useState(false);

    const fallbacks = getCoinLogoFallbacks(upper);

    if (failed || fallbacks.length === 0) {
        // Text initials fallback
        const color = COIN_COLORS[upper] || '#888';
        const initials = upper.length <= 4 ? upper : upper.slice(0, 3);
        const fontSize = Math.max(8, Math.round(size * 0.38));
        return (
            <span
                className={`flex items-center justify-center rounded-full font-bold select-none flex-shrink-0 ${className}`}
                style={{
                    width: size,
                    height: size,
                    backgroundColor: `${color}25`,
                    border: `1.5px solid ${color}60`,
                    color,
                    fontSize,
                    lineHeight: 1,
                }}
                aria-label={alt || upper}
            >
                {initials}
            </span>
        );
    }

    return (
        <img
            src={fallbacks[srcIndex]}
            alt={alt || upper}
            width={size}
            height={size}
            className={`object-contain flex-shrink-0 ${className}`}
            style={{ width: size, height: size }}
            onError={() => {
                if (srcIndex + 1 < fallbacks.length) {
                    setSrcIndex(i => i + 1);
                } else {
                    setFailed(true);
                }
            }}
        />
    );
}
