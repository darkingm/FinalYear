'use client';

/**
 * CoinImage — Single source of truth for ALL cryptocurrency logos.
 *
 * FREE API fallback chain (5 tiers, no API key required):
 *
 *   1. CoinGecko CDN      — coin-images.coingecko.com
 *                           Official logos used by CoinGecko. 13M+ tokens.
 *                           Format: /coins/images/{id}/small/{name}.png
 *
 *   2. spothq icons       — cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons
 *                           400+ popular coins, color PNGs, well-known pack.
 *
 *   3. ErikThiart icons   — cdn.jsdelivr.net/gh/ErikThiart/cryptocurrency-icons
 *                           Derived from CoinMarketCap. 3000+ coins, flat list.
 *                           File names are lowercase full coin names.
 *
 *   4. CoinCap CDN        — assets.coincap.io/assets/icons/{id}@2x.png
 *                           CoinCap's own coin assets, always online.
 *
 *   5. cryptologos.cc     — Official SVG-derived PNGs for top 100 coins.
 *
 *   6. Text initials      — Brand-colored circle. Never fails.
 *
 * Usage:
 *   <CoinImage symbol="BTC" size={24} className="rounded-full" />
 *   <CoinImage symbol="ETH" size={32} />
 */

import { useState, useMemo } from 'react';

function normalizeCoinSymbol(symbol: string): string {
    const upper = (symbol || '').toUpperCase().replace(/_LOCAL$/, '').trim();
    if (!upper) return '';
    if (upper === 'USDT') return upper;
    if (upper.endsWith('USDT') && upper.length > 4) {
        return upper.slice(0, -4);
    }
    return upper;
}

// ── Brand colors ─────────────────────────────────────────────────────────────
const COIN_COLORS: Record<string, string> = {
    BTC: '#f7931a', ETH: '#627eea', BNB: '#f0b90b', SOL: '#9945ff',
    XRP: '#00aae4', ADA: '#0033ad', DOGE: '#c3a634', AVAX: '#e84142',
    MATIC: '#8247e5', POL: '#8247e5', DOT: '#e6007a', LINK: '#2a5ada',
    ATOM: '#6f7390', LTC: '#bfbbbb', TRX: '#ef0027', TON: '#0098ea',
    NEAR: '#00c08b', APT: '#00c2a8', ARB: '#28a0f0', OP: '#ff0420',
    SUI: '#4ca3ff', USDT: '#26a17b', USDC: '#2775ca', DAI: '#f5ac37',
    UNI: '#ff007a', AAVE: '#b6509e', SHIB: '#e71b1b', INJ: '#00b4d0',
    FIL: '#0090ff', GRT: '#6747ed', SAND: '#04adef', MANA: '#f47e22',
    AXS: '#0055d5', CAKE: '#d1884f', CRO: '#002d74', STX: '#5546ff',
    HBAR: '#00a9b3', FLOW: '#00ef8b', RUNE: '#33ff99', IMX: '#0acbf4',
    BLUR: '#ff6600', PEPE: '#3c9c42', BONK: '#f8a92b', WLD: '#000000',
    DYDX: '#6966ff', LDO: '#00a3ff', FXS: '#000000', GMX: '#072b4c',
    USDT_LOCAL: '#26a17b',
};

// ── CoinGecko image IDs: { SYMBOL: { id: number, name: string } } ─────────────
// Get from: https://api.coingecko.com/api/v3/coins/list
// URL: https://coin-images.coingecko.com/coins/images/{id}/small/{name}.png
const COINGECKO: Record<string, { id: number; name: string }> = {
    BTC: { id: 1, name: 'bitcoin.png' },
    ETH: { id: 279, name: 'ethereum.png' },
    BNB: { id: 825, name: 'bnb-icon2_2x.png' },
    SOL: { id: 4128, name: 'solana.png' },
    XRP: { id: 44, name: 'xrp-symbol-white-128.png' },
    ADA: { id: 975, name: 'cardano.png' },
    DOGE: { id: 5, name: 'dogecoin-icon.png' },
    AVAX: { id: 2031, name: 'avalanche-avax-logo.png' },
    MATIC: { id: 3890, name: 'polygon.png' },
    POL: { id: 3890, name: 'polygon.png' },
    DOT: { id: 12171, name: 'polkadot.png' },
    LINK: { id: 877, name: 'chainlink-new-logo.png' },
    ATOM: { id: 3794, name: 'cosmos_hub.png' },
    LTC: { id: 2, name: 'litecoin.png' },
    TRX: { id: 1094308, name: 'tron-logo.png' },
    TON: { id: 17980, name: 'ton_logo_circle_5x5_apng.png' },
    NEAR: { id: 10365, name: 'near.png' },
    APT: { id: 26455, name: 'aptos.png' },
    ARB: { id: 11841, name: 'arbitrum.png' },
    OP: { id: 11840, name: 'optimism.jpeg' },
    SUI: { id: 26375, name: 'sui_asset.jpeg' },
    USDT: { id: 325, name: 'tether.png' },
    USDC: { id: 6319, name: 'usdc.png' },
    DAI: { id: 8290, name: 'dai.png' },
    UNI: { id: 12504, name: 'uniswap-uni-logo.png' },
    AAVE: { id: 7278, name: 'aave-v3.png' },
    SHIB: { id: 11939, name: 'shib.png' },
    INJ: { id: 7226, name: 'injective-protocol-logo.jpeg' },
    FIL: { id: 12817, name: 'filecoin.png' },
    GRT: { id: 13573, name: 'graph-token.png' },
    CAKE: { id: 7186, name: 'pancakeswap-cake-logo.png' },
    SAND: { id: 12129, name: 'sandbox.png' },
    MANA: { id: 1966, name: 'decentraland-mana.png' },
    AXS: { id: 13029, name: 'axie-infinity-logo.png' },
    CRO: { id: 14806, name: 'cronos.png' },
    STX: { id: 4847, name: 'stacks.png' },
    HBAR: { id: 4642, name: 'hbar.png' },
    FLOW: { id: 4558, name: 'flow.png' },
    RUNE: { id: 4157, name: 'thor.png' },
    IMX: { id: 17720, name: 'immutable.png' },
    PEPE: { id: 29850, name: 'pepe-token.png' },
    BONK: { id: 28600, name: 'bonk-token.jpeg' },
    BLUR: { id: 28451, name: 'blur.png' },
    LDO: { id: 18761, name: 'ldo.png' },
    ENJ: { id: 1414, name: 'enjin-coin-logo.png' },
    CHZ: { id: 3978, name: 'chiliz-logo.png' },
    BAT: { id: 1068, name: 'bat.png' },
    CRV: { id: 6538, name: 'curve.png' },
    MKR: { id: 1128, name: 'maker.png' },
    COMP: { id: 5692, name: 'comp.png' },
    SUSHI: { id: 12271, name: 'sushiswap.png' },
    LRC: { id: 16798, name: 'loopring.jpeg' },
    ZRX: { id: 1896, name: '0x.jpeg' },
    OCEAN: { id: 3911, name: 'ocean-protocol.png' },
    FET: { id: 5681, name: 'fetch-ai-logo.jpeg' },
    RNDR: { id: 5690, name: 'render-token.png' },
    ALGO: { id: 4030, name: 'algorand.png' },
    VET: { id: 3077, name: 'vechain.svg' },
    XTZ: { id: 2011, name: 'tezos.png' },
    XLM: { id: 100, name: 'stellar_pro.png' },
    FTM: { id: 3513, name: 'fantom.png' },
    EOS: { id: 738, name: 'eos-eos.png' },
    BCH: { id: 788, name: 'bitcoin-cash.png' },
    GALA: { id: 12493, name: 'gala.png' },
    ICP: { id: 8916, name: 'internet-computer.png' },
    KAVA: { id: 4846, name: 'kava.png' },
    CELO: { id: 5567, name: 'celo-celo-logo.png' },
    OKB: { id: 3897, name: 'okb.png' },
    EGLD: { id: 8179, name: 'elrond-egld.png' },
    SNX: { id: 2316, name: 'havven.png' },
};

// ── spothq icon names (usually just lowercase symbol) ─────────────────────────
const SPOTHQ_OVERRIDES: Record<string, string> = {
    POL: 'matic',   // spothq uses "matic" for Polygon
    BNB: 'bnb',
};

// ── ErikThiart repo uses lowercase full coin name ─────────────────────────────
// File: /{coin-name-lowercase}.png  e.g. /bitcoin.png, /ethereum.png
const ERIKTHIART_NAME: Record<string, string> = {
    BTC: 'bitcoin', ETH: 'ethereum', BNB: 'bnb',
    SOL: 'solana', XRP: 'xrp', ADA: 'cardano',
    DOGE: 'dogecoin', AVAX: 'avalanche', MATIC: 'polygon',
    POL: 'polygon', DOT: 'polkadot', LINK: 'chainlink',
    ATOM: 'cosmos', LTC: 'litecoin', TRX: 'tron',
    TON: 'toncoin', NEAR: 'near-protocol', APT: 'aptos',
    ARB: 'arbitrum', OP: 'optimism', SUI: 'sui',
    USDT: 'tether', USDC: 'usd-coin', DAI: 'dai',
    UNI: 'uniswap', AAVE: 'aave', SHIB: 'shiba-inu',
    INJ: 'injective', FIL: 'filecoin', GRT: 'graph',
    CAKE: 'pancakeswap', SAND: 'the-sandbox', MANA: 'decentraland',
    AXS: 'axie-infinity', CRO: 'cronos', STX: 'stacks',
    HBAR: 'hedera', FLOW: 'flow', RUNE: 'thorchain',
    IMX: 'immutable-x', PEPE: 'pepe', BONK: 'bonk',
    BLUR: 'blur', ENJ: 'enjin-coin', CHZ: 'chiliz',
    BAT: 'basic-attention-token', CRV: 'curve', MKR: 'maker',
    COMP: 'compound', SUSHI: 'sushiswap', LRC: 'loopring',
    ZRX: '0x', FET: 'fetch-ai', RNDR: 'render-token',
    ALGO: 'algorand', VET: 'vechain', XTZ: 'tezos',
    XLM: 'stellarlumens', FTM: 'fantom', EOS: 'eos',
    BCH: 'bitcoin-cash', GALA: 'gala', ICP: 'internet-computer',
    KAVA: 'kava', CELO: 'celo', EGLD: 'elrond',
    SNX: 'synthetix', LDO: 'lido-dao', OCEAN: 'ocean-protocol',
};

// ── CoinCap asset IDs ──────────────────────────────────────────────────────────
const COINCAP_ID: Record<string, string> = {
    BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binance-coin',
    SOL: 'solana', XRP: 'xrp', ADA: 'cardano',
    DOGE: 'dogecoin', AVAX: 'avalanche', MATIC: 'polygon',
    POL: 'polygon', DOT: 'polkadot', LINK: 'chainlink',
    ATOM: 'cosmos', LTC: 'litecoin', TRX: 'tron',
    TON: 'toncoin', NEAR: 'near-protocol', APT: 'aptos',
    ARB: 'arbitrum', OP: 'optimism', SUI: 'sui',
    USDT: 'tether', USDC: 'usd-coin', DAI: 'multi-collateral-dai',
    UNI: 'uniswap', AAVE: 'aave', SHIB: 'shiba-inu',
    INJ: 'injective-protocol', FIL: 'filecoin', GRT: 'the-graph',
    CAKE: 'pancakeswap', SAND: 'the-sandbox', MANA: 'decentraland',
    AXS: 'axie-infinity', CRO: 'cronos', STX: 'stacks',
    HBAR: 'hedera-hashgraph', FLOW: 'flow', RUNE: 'thorchain',
    IMX: 'immutable-x', PEPE: 'pepe', BONK: 'bonk',
    BLUR: 'blur', ENJ: 'enjin-coin', CHZ: 'chiliz',
    BAT: 'basic-attention-token', CRV: 'curve-dao-token', MKR: 'maker',
    COMP: 'compound', SUSHI: 'sushiswap', LRC: 'loopring',
    ZRX: '0x', FET: 'fetch-ai', RNDR: 'render-token',
    ALGO: 'algorand', VET: 'vechain', XTZ: 'tezos',
    XLM: 'stellar', FTM: 'fantom', EOS: 'eos',
    BCH: 'bitcoin-cash', GALA: 'gala', ICP: 'internet-computer',
    KAVA: 'kava', CELO: 'celo', EGLD: 'elrond-egld',
};

// ── cryptologos.cc slugs ───────────────────────────────────────────────────────
const CRYPTOLOGOS: Record<string, string> = {
    BTC: 'bitcoin-btc', ETH: 'ethereum-eth', BNB: 'binance-coin-bnb',
    SOL: 'solana-sol', XRP: 'xrp-xrp', ADA: 'cardano-ada',
    DOGE: 'dogecoin-doge', AVAX: 'avalanche-avax', MATIC: 'polygon-matic',
    POL: 'polygon-matic', DOT: 'polkadot-new-dot', LINK: 'chainlink-link',
    ATOM: 'cosmos-atom', LTC: 'litecoin-ltc', TRX: 'tron-trx',
    TON: 'toncoin-ton', NEAR: 'near-protocol-near', APT: 'aptos-apt',
    ARB: 'arbitrum-arb', OP: 'optimism-ethereum-op', SUI: 'sui-sui',
    USDT: 'tether-usdt', USDC: 'usd-coin-usdc', DAI: 'multi-collateral-dai-dai',
    UNI: 'uniswap-uni', AAVE: 'aave-aave', SHIB: 'shiba-inu-shib',
    INJ: 'injective-inj', FIL: 'filecoin-fil', GRT: 'the-graph-grt',
    CAKE: 'pancakeswap-cake', SAND: 'the-sandbox-sand', MANA: 'decentraland-mana',
    AXS: 'axie-infinity-axs', CRO: 'cronos-cro', STX: 'stacks-stx',
    HBAR: 'hedera-hbar', FLOW: 'flow-flow', RUNE: 'thorchain-rune',
    ENJ: 'enjincoin-enj', CHZ: 'chiliz-chz', BAT: 'basic-attention-token-bat',
    CRV: 'curve-dao-token-crv', MKR: 'maker-mkr', COMP: 'compound-comp',
    SUSHI: 'sushiswap-sushi', LRC: 'loopring-lrc', ZRX: '0x-zrx',
    FET: 'fetch-ai-fet', RNDR: 'render-token-rndr', IMX: 'immutable-x-imx',
    ALGO: 'algorand-algo', VET: 'vechain-vet', XTZ: 'tezos-xtz',
    XLM: 'stellar-xlm', FTM: 'fantom-ftm', EOS: 'eos-eos',
    BCH: 'bitcoin-cash-bch', PEPE: 'pepe-pepe', KAVA: 'kava-kava',
    CELO: 'celo-celo', BONK: 'bonk-bonk', GALA: 'gala-gala',
    HBAR2: 'hedera-hashgraph-hbar',
};

// ── Build the fallback URL list for a given symbol ────────────────────────────
function buildFallbacks(symbol: string): string[] {
    if (!symbol) return [];
    const up = normalizeCoinSymbol(symbol);
    if (!up) return [];

    const list: string[] = [];

    // 1. CoinGecko CDN (official logos, 13M+ coins, no key needed for image CDN)
    const cg = COINGECKO[up];
    if (cg) {
        list.push(`https://coin-images.coingecko.com/coins/images/${cg.id}/small/${cg.name}`);
        list.push(`https://coin-images.coingecko.com/coins/images/${cg.id}/large/${cg.name}`);
    }

    // 2. spothq cryptocurrency-icons (400+ popular coins, color-themed)
    const spothqSym = (SPOTHQ_OVERRIDES[up] || up).toLowerCase();
    list.push(`https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${spothqSym}.png`);

    // 3. ErikThiart cryptocurrency-icons (CoinMarketCap-derived, 3000+ coins)
    const erikName = ERIKTHIART_NAME[up] || up.toLowerCase();
    list.push(`https://cdn.jsdelivr.net/gh/ErikThiart/cryptocurrency-icons@master/${erikName}.png`);

    // 4. CoinCap CDN assets
    const capId = COINCAP_ID[up] || up.toLowerCase();
    list.push(`https://assets.coincap.io/assets/icons/${capId}@2x.png`);

    // 5. cryptologos.cc (top 100 coins, official PNGs)
    if (CRYPTOLOGOS[up]) {
        list.push(`https://cryptologos.cc/logos/${CRYPTOLOGOS[up]}-logo.png`);
    }

    return list;
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface CoinImageProps {
    symbol: string;
    size?: number;
    className?: string;
    alt?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function CoinImage({ symbol, size = 24, className = '', alt }: CoinImageProps) {
    const upper = useMemo(
        () => normalizeCoinSymbol(symbol),
        [symbol]
    );
    const fallbacks = useMemo(() => buildFallbacks(upper), [upper]);

    const [srcIndex, setSrcIndex] = useState(0);
    const [failed, setFailed] = useState(false);

    // No symbol, or all fallbacks exhausted → brand-colored text initials
    if (!upper || failed || fallbacks.length === 0) {
        const color = COIN_COLORS[upper] || '#6b7280';
        const initials = upper.length <= 4 ? upper : upper.slice(0, 3);
        const fontSize = Math.max(7, Math.round(size * 0.36));
        return (
            <span
                className={`inline-flex items-center justify-center rounded-full font-bold select-none flex-shrink-0 ${className}`}
                style={{
                    width: size,
                    height: size,
                    backgroundColor: `${color}22`,
                    border: `1.5px solid ${color}55`,
                    color,
                    fontSize,
                    lineHeight: 1,
                }}
                aria-label={alt || upper || '?'}
                title={alt || upper}
            >
                {initials || '?'}
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
