'use client';

export const dynamic = 'force-dynamic';

import { useAuth } from '@/lib/hooks/useAuth';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShoppingBag, Shield, Zap, ArrowRight, TrendingUp,
  Package, ChevronRight, BarChart3, Wallet, RefreshCw, Activity, Search,
} from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useWallet } from '@/lib/hooks/useWallet';
import { formatCurrency, formatCrypto } from '@/lib/utils/format';
import { CoinImage } from '@/components/ui/CoinImage';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { useClientTranslation } from '@/lib/hooks/useClientTranslation';
import { ProductCard, type ProductCardData } from '@/components/product/ProductCard';
import { AIChatButton } from '@/components/ui/ai-chat-button';
import { usePriceStore } from '@/store';
import { productsApi } from '@/lib/api/products';
import { CoinPriceStrip } from '@/components/home/CoinPriceStrip';
import {
  Laptop, Shirt, Home as HomeIcon, Dumbbell, BookOpen, Gamepad2, Car, Diamond, Sparkles,
} from 'lucide-react';
import { Store, ShieldCheck, Truck, BadgeCheck } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';



/* ─── Build realistic daily chart from low/high/price ── */
function hashSymbol(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface ChartData {
  path: string; fillPath: string;
  peakX: number; peakY: number; peakVal: number;
  valleyX: number; valleyY: number; valleyVal: number;
}

function buildDailyChart(low: number, high: number, price: number, symbol: string): ChartData {
  const empty: ChartData = { path: '', fillPath: '', peakX: 0, peakY: 0, peakVal: 0, valleyX: 0, valleyY: 0, valleyVal: 0 };
  if (low <= 0 || high <= 0 || price <= 0) return empty;
  const N = 28; // 28 data points ≈ 7 days (4 per day)
  const range = high - low || 1;
  const w = 100, h = 36, pad = 4;
  // Seed based on SYMBOL (stable) not price
  const seed = hashSymbol(symbol) % 997;
  const points: number[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const openPrice = low + range * 0.35;
    const base = openPrice + (price - openPrice) * t;
    // Multi-frequency noise — realistic market pattern
    const noise = Math.sin(seed * 0.13 + i * 1.7) * range * 0.18
      + Math.sin(seed * 0.31 + i * 2.9) * range * 0.10
      + Math.cos(seed * 0.07 + i * 0.6) * range * 0.14
      + Math.sin(seed * 0.53 + i * 4.3) * range * 0.05;
    let v = base + noise;
    v = Math.max(low, Math.min(high, v));
    if (i === 0) v = openPrice;
    if (i === N - 1) v = price;
    points.push(v);
  }
  // Find peak and valley (skip first/last)
  let peakIdx = 1, valleyIdx = 1;
  for (let i = 2; i < N - 1; i++) {
    if (points[i] > points[peakIdx]) peakIdx = i;
    if (points[i] < points[valleyIdx]) valleyIdx = i;
  }
  const toY = (v: number) => h - pad - ((v - low) / range) * (h - pad * 2);
  const step = w / (N - 1);
  const pathD = points.map((p, i) => {
    const x = (i * step).toFixed(1);
    const y = toY(p).toFixed(1);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');
  const fillD = `${pathD} L${w},${h} L0,${h} Z`;
  return {
    path: pathD, fillPath: fillD,
    peakX: peakIdx * step, peakY: toY(points[peakIdx]), peakVal: points[peakIdx],
    valleyX: valleyIdx * step, valleyY: toY(points[valleyIdx]), valleyVal: points[valleyIdx],
  };
}

/* ─── Hero Coin Card ─────────────────────────────── */
function CoinHeroCard({ coinInfo, prices: cardPrices, index }: {
  coinInfo: { symbol: string; name: string; short: string; color: string };
  prices: Record<string, any>;
  index: number;
}) {
  const priceData = cardPrices[coinInfo.symbol];
  const price = priceData?.price ?? 0;
  const change = priceData?.change24h ?? 0;
  const isPos = change >= 0;
  const displaySymbol = coinInfo.symbol.replace('USDT', '');
  const vol24h = priceData?.volume24h ?? 0;
  const high = priceData?.high24h ?? 0;
  const low = priceData?.low24h ?? 0;

  // Flash on price change
  const prevPriceRef = useRef(0);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    if (price > 0 && prevPriceRef.current > 0 && price !== prevPriceRef.current) {
      setFlash(price > prevPriceRef.current ? 'up' : 'down');
      const t = setTimeout(() => setFlash(null), 800);
      return () => clearTimeout(t);
    }
    prevPriceRef.current = price;
  }, [price]);

  // Generate realistic chart shape — seed from symbol (stable), scale from price data
  const chart = useMemo(() => buildDailyChart(low, high, price, coinInfo.symbol), [low, high, price, coinInfo.symbol]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 100, damping: 18, delay: 0.3 + index * 0.12 }}
      whileHover={{ y: -4, transition: { duration: 0.25 } }}
    >
      <Link href={`/trading/${coinInfo.symbol}`}>
        <div className="group relative bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-5 hover:border-border transition-all duration-300 cursor-pointer overflow-hidden">
          {/* Glow */}
          <div
            className="absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl pointer-events-none"
            style={{ background: `radial-gradient(circle at 50% 50%, ${coinInfo.color}18, transparent 70%)` }}
          />
          <div
            className="absolute top-0 left-6 right-6 h-[1.5px] rounded-full opacity-0 group-hover:opacity-80 transition-opacity"
            style={{ background: `linear-gradient(90deg, transparent, ${coinInfo.color}, transparent)` }}
          />

          {/* Header */}
          <div className="relative flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <motion.div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${coinInfo.color}22, ${coinInfo.color}08)`,
                  border: `1.5px solid ${coinInfo.color}30`,
                }}
                whileHover={{ scale: 1.1, rotate: 3 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <CoinImage symbol={displaySymbol} size={26} />
              </motion.div>
              <div>
                <p className="text-sm font-bold text-foreground leading-tight">{displaySymbol}</p>
                <p className="text-[11px] text-muted-foreground">{coinInfo.name}</p>
              </div>
            </div>
            <motion.span
              className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg ${isPos
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-500/15 text-red-600 dark:text-red-400'
              }`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6 + index * 0.1 }}
            >
              <TrendingUp className={`w-3 h-3 ${!isPos ? 'rotate-180' : ''}`} />
              {Math.abs(change).toFixed(2)}%
            </motion.span>
          </div>

          {/* Price — stable display with flash effect */}
          <div className="relative mb-2">
            {price > 0 ? (
              <p className={`text-2xl font-bold font-mono tracking-tight transition-colors duration-500 ${
                flash === 'up' ? 'text-emerald-400' : flash === 'down' ? 'text-red-400' : 'text-foreground'
              }`}>
                ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            ) : (
              <div className="h-8 w-36 bg-muted/50 rounded-lg animate-pulse" />
            )}
          </div>

          {/* Daily Chart — coin-colored with peak/valley labels */}
          <div className="mb-3 h-12">
            {chart.path ? (
              <svg viewBox="0 0 100 36" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`sg-${displaySymbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={coinInfo.color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={coinInfo.color} stopOpacity="0.03" />
                  </linearGradient>
                </defs>
                <path d={chart.fillPath} fill={`url(#sg-${displaySymbol})`} />
                <path d={chart.path} fill="none" stroke={coinInfo.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                {/* Peak dot + label */}
                <circle cx={chart.peakX} cy={chart.peakY} r="1.5" fill={coinInfo.color} />
                <text x={Math.min(chart.peakX, 85)} y={Math.max(chart.peakY - 2, 5)} fontSize="3.2" fill={coinInfo.color} fontFamily="monospace" opacity="0.8">
                  {chart.peakVal >= 1000 ? `${(chart.peakVal/1000).toFixed(1)}K` : chart.peakVal.toFixed(1)}
                </text>
                {/* Valley dot + label */}
                <circle cx={chart.valleyX} cy={chart.valleyY} r="1.5" fill="#ef4444" />
                <text x={Math.min(chart.valleyX, 85)} y={Math.min(chart.valleyY + 5, 35)} fontSize="3.2" fill="#ef4444" fontFamily="monospace" opacity="0.8">
                  {chart.valleyVal >= 1000 ? `${(chart.valleyVal/1000).toFixed(1)}K` : chart.valleyVal.toFixed(1)}
                </text>
              </svg>
            ) : (
              <div className="w-full h-full bg-muted/30 rounded animate-pulse" />
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-xs border-t border-border/50 pt-2.5">
            <div>
              <p className="text-muted-foreground text-[10px]">Vol 24h</p>
              <p className="font-mono font-semibold text-foreground text-[11px]">
                ${vol24h.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-[10px]">24h Range</p>
              <p className="font-mono font-semibold text-foreground text-[11px]">
                ${low.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })} – ${high.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}
              </p>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ─── Types ──────────────────────────────────────── */
type Product = ProductCardData & {
  pricing_mode?: string;
  price_token?: string;  // legacy field alias
};


/* ─── Constants ──────────────────────────────────── */
const PRODUCT_IMAGES = [
  '/products/gallery/headphones-1.png', '/products/gallery/smartwatch-1.png',
  '/products/gallery/laptop-1.png', '/products/gallery/camera-1.png',
  '/products/gallery/sneakers-1.png', '/products/gallery/speaker-1.png',
];

const TOP_COINS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', short: 'BTC', color: '#f7931a' },
  { symbol: 'ETHUSDT', name: 'Ethereum', short: 'ETH', color: '#627eea' },
  { symbol: 'BNBUSDT', name: 'BNB', short: 'BNB', color: '#f0b90b' },
  { symbol: 'SOLUSDT', name: 'Solana', short: 'SOL', color: '#9945ff' },
  { symbol: 'XRPUSDT', name: 'XRP', short: 'XRP', color: '#00aae4' },
  { symbol: 'ADAUSDT', name: 'Cardano', short: 'ADA', color: '#0033ad' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', short: 'DOGE', color: '#c3a634' },
  { symbol: 'AVAXUSDT', name: 'Avalanche', short: 'AVAX', color: '#e84142' },
  { symbol: 'MATICUSDT', name: 'Polygon', short: 'MATIC', color: '#8247e5' },
  { symbol: 'DOTUSDT', name: 'Polkadot', short: 'DOT', color: '#e6007a' },
  { symbol: 'LINKUSDT', name: 'Chainlink', short: 'LINK', color: '#2a5ada' },
  { symbol: 'ATOMUSDT', name: 'Cosmos', short: 'ATOM', color: '#6f7390' },
  { symbol: 'LTCUSDT', name: 'Litecoin', short: 'LTC', color: '#bfbbbb' },
  { symbol: 'TRXUSDT', name: 'TRON', short: 'TRX', color: '#ef0027' },
  { symbol: 'TONUSDT', name: 'TON', short: 'TON', color: '#0098ea' },
  { symbol: 'NEARUSDT', name: 'NEAR', short: 'NEAR', color: '#00c08b' },
  { symbol: 'APTUSDT', name: 'Aptos', short: 'APT', color: '#00c2a8' },
  { symbol: 'OPUSDT', name: 'Optimism', short: 'OP', color: '#ff0420' },
  { symbol: 'ARBUSDT', name: 'Arbitrum', short: 'ARB', color: '#28a0f0' },
  { symbol: 'SUIUSDT', name: 'Sui', short: 'SUI', color: '#4ca3ff' },
];

const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    eyebrow: 'Marketplace',
    title: 'Duyệt & Mua',
    desc: 'Tìm sản phẩm và đặt hàng bằng crypto hoặc tiền tệ thông thường.',
    icon: Store,
    iconTone: 'text-sky-300',
    iconSurface: 'border-sky-400/20 bg-sky-500/[0.10] shadow-sky-500/10',
    divider: 'from-sky-400/65 via-sky-400/20 to-transparent',
  },
  {
    step: '02',
    eyebrow: 'Escrow',
    title: 'Escrow khóa',
    desc: 'Thanh toán được khóa trong hợp đồng thông minh Escrow an toàn.',
    icon: ShieldCheck,
    iconTone: 'text-violet-300',
    iconSurface: 'border-violet-400/20 bg-violet-500/[0.10] shadow-violet-500/10',
    divider: 'from-violet-400/65 via-violet-400/20 to-transparent',
  },
  {
    step: '03',
    eyebrow: 'Delivery',
    title: 'Nhận hàng',
    desc: 'Người bán giao hàng. Xác nhận khi nhận được.',
    icon: Truck,
    iconTone: 'text-emerald-300',
    iconSurface: 'border-emerald-400/20 bg-emerald-500/[0.10] shadow-emerald-500/10',
    divider: 'from-emerald-400/65 via-emerald-400/20 to-transparent',
  },
  {
    step: '04',
    eyebrow: 'Settlement',
    title: 'Hoàn tất',
    desc: 'Admin giải ngân cho người bán hoặc hoàn tiền khi có tranh chấp.',
    icon: BadgeCheck,
    iconTone: 'text-amber-200',
    iconSurface: 'border-amber-400/20 bg-amber-500/[0.12] shadow-amber-500/10',
    divider: 'from-amber-300/70 via-amber-300/20 to-transparent',
  },
] as const;


/* ─── Main Page ──────────────────────────────────────── */
function WalletBalanceSection() {
  const { isConnected, tokenBalances, totalUSDT, isLoading, refetch } = useWallet();
  const { t } = useClientTranslation();

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-[#f0b90b]" />
          <h2 className="text-foreground font-bold">{t('home.myWallet')}</h2>
        </div>
        <button onClick={refetch} disabled={isLoading} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!isConnected ? (
        <div className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[#f0b90b]/10 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-[#f0b90b]" />
          </div>
          <p className="text-muted-foreground text-sm mb-4">{t('home.noCoins')}</p>
        </div>
      ) : (
        <div className="p-5">
          {/* Total balance */}
          <div className="mb-5">
            <p className="text-xs text-muted-foreground mb-1">Tổng số dư (USD)</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{formatCurrency(totalUSDT)}</span>
              <span className="text-sm text-[#f0b90b] font-medium">USDT</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs text-emerald-600 dark:text-emerald-400">+2.43% hôm nay</span>
            </div>
          </div>

          {/* Coins owned */}
          {tokenBalances.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Coin đang sở hữu ({tokenBalances.length})</p>
              {tokenBalances.slice(0, 5).map((token, i) => (
                <motion.div
                  key={token.symbol}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted border border-border/50 hover:border-border transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-muted p-1 flex-shrink-0 flex items-center justify-center">
                      <CoinImage symbol={token.symbol} size={28} className="rounded-full" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{token.symbol}</p>
                      <p className="text-xs text-muted-foreground">{formatCrypto(token.balance, 4)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{formatCurrency(token.usdValue)}</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">+1.2%</p>
                  </div>
                </motion.div>
              ))}
              <Link href="/wallet">
                <div className="flex items-center justify-center gap-1 py-2 text-xs text-[#f0b90b] hover:text-[#e6a800] transition-colors cursor-pointer">
                  Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm">Chưa có coin nào trong ví</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Market Table Row with live flash ───────────── */
function MarketRow({ symbol, coinInfo, idx }: { symbol: string; coinInfo: typeof TOP_COINS[0] | undefined; idx: number }) {
  const priceData = usePriceStore(s => s.prices[symbol]);
  const prevRef = useRef<number>(0);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const displaySymbol = symbol.replace('USDT', '');

  useEffect(() => {
    if (!priceData) return;
    const curr = priceData.price;
    if (prevRef.current !== 0 && curr !== prevRef.current) {
      setFlash(curr > prevRef.current ? 'up' : 'down');
      const t = setTimeout(() => setFlash(null), 700);
      return () => clearTimeout(t);
    }
    prevRef.current = curr;
  }, [priceData?.price]);

  if (!priceData) {
    return (
      <tr className="border-b border-border/50">
        {[1, 2, 3, 4, 5, 6].map(j => (
          <td key={j} className="px-5 py-3.5"><div className="h-4 bg-muted rounded animate-pulse" /></td>
        ))}
      </tr>
    );
  }

  const isPos = priceData.change24h >= 0;
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: idx * 0.03 }}
      className="border-b border-border/50 hover:bg-muted/50 transition-colors group cursor-pointer"
    >
      <td className="px-5 py-3.5">
        <Link href={`/trading/${symbol}`} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${coinInfo?.color}25`, border: `1px solid ${coinInfo?.color}40` }}>
            <CoinImage symbol={displaySymbol} size={20} />
          </div>
          <div>
            <p className="font-bold text-foreground text-sm group-hover:text-[#f0b90b] transition-colors">{displaySymbol}</p>
            <p className="text-xs text-muted-foreground">{coinInfo?.name || displaySymbol}</p>
          </div>
        </Link>
      </td>
      <td className="px-5 py-3.5 text-right">
        <Link href={`/trading/${symbol}`}>
          <span className={`font-mono font-semibold text-sm transition-colors duration-500 ${flash === 'up' ? 'text-emerald-400' : flash === 'down' ? 'text-red-400' : 'text-foreground'
            }`}>
            ${priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
          </span>
        </Link>
      </td>
      <td className="px-5 py-3.5 text-right">
        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-bold ${isPos ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'
          }`}>
          {isPos ? '▲' : '▼'} {Math.abs(priceData.change24h).toFixed(2)}%
        </span>
      </td>
      <td className="px-5 py-3.5 text-right text-xs text-muted-foreground hidden sm:table-cell font-mono">
        {priceData.volume24h.toLocaleString('en-US', { maximumFractionDigits: 0, notation: 'compact' })} {displaySymbol}
      </td>
      <td className="px-5 py-3.5 text-right hidden md:table-cell">
        <div className="text-xs">
          <p className="text-emerald-600 dark:text-emerald-400 font-mono">${priceData.high24h.toLocaleString()}</p>
          <p className="text-red-600 dark:text-red-400 font-mono">${priceData.low24h.toLocaleString()}</p>
        </div>
      </td>
      <td className="px-5 py-3.5 text-center">
        <Link href={`/trading/${symbol}`}>
          <Button size="sm" variant="ghost" className="h-7 px-3 text-xs text-[#f0b90b] hover:bg-[#f0b90b]/10 opacity-0 group-hover:opacity-100 transition-opacity">
            <BarChart3 className="w-3.5 h-3.5 mr-1" /> Xem
          </Button>
        </Link>
      </td>
    </motion.tr>
  );
}

/* ─── Market Table ───────────────────────────────── */
function MarketTable({ symbols, search }: { symbols: string[]; search: string }) {
  const { t } = useClientTranslation();
  const { isConnected } = usePriceStore();

  const filtered = symbols.filter(sym =>
    sym.toLowerCase().includes(search.toLowerCase()) ||
    sym.replace('USDT', '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#f0b90b]" />
          <h2 className="text-foreground font-bold">{t('home.market')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {isConnected ? 'Live' : 'Offline'}
          </span>
          <Link href="/trading/BTCUSDT">
            <Button variant="ghost" size="sm" className="text-[#f0b90b] hover:text-[#e6a800] hover:bg-[#f0b90b]/8 text-xs h-7 gap-1">
              Xem tất cả <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-xs text-muted-foreground uppercase">
              <th className="px-5 py-3 text-left font-medium">Coin</th>
              <th className="px-5 py-3 text-right font-medium">Giá</th>
              <th className="px-5 py-3 text-right font-medium">24h %</th>
              <th className="px-5 py-3 text-right font-medium hidden sm:table-cell">KL 24h</th>
              <th className="px-5 py-3 text-right font-medium hidden md:table-cell">Cao/Thấp</th>
              <th className="px-5 py-3 text-center font-medium">Biểu đồ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((sym, idx) => {
              const coinInfo = TOP_COINS.find(c => c.symbol === sym);
              return <MarketRow key={sym} symbol={sym} coinInfo={coinInfo} idx={idx} />;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


/* ─── Category definitions ───────────────────────── */
const HOME_CATEGORIES = [
  { id: 'all', label: 'Tất cả', icon: Sparkles, color: '#f0b90b', slug: undefined },
  { id: 'electronics', label: 'Electronics', icon: Laptop, color: '#3b82f6', slug: 'electronics' },
  { id: 'fashion', label: 'Fashion', icon: Shirt, color: '#ec4899', slug: 'fashion' },
  { id: 'home', label: 'Home', icon: HomeIcon, color: '#10b981', slug: 'home' },
  { id: 'sports', label: 'Sports', icon: Dumbbell, color: '#f97316', slug: 'sports' },
  { id: 'books', label: 'Books', icon: BookOpen, color: '#8b5cf6', slug: 'books' },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2, color: '#ef4444', slug: 'toys' },
  { id: 'automotive', label: 'Automotive', icon: Car, color: '#6b7280', slug: 'automotive' },
  { id: 'jewelry', label: 'Jewelry', icon: Diamond, color: '#f59e0b', slug: 'jewelry' },
];

const TARGET_COUNT = 12;

type ProductWithSource = ProductCardData & { _borrowedFrom?: string };

/** Fill `primary` up to `count` by taking extras from `allPool` (different category). */
function fillToCount(
  primary: ProductCardData[],
  primaryCategoryId: string,
  allPool: ProductCardData[],
  count = TARGET_COUNT,
): { products: ProductWithSource[]; borrowedCategories: Set<string> } {
  const needed = count - primary.length;
  const borrowedCategories = new Set<string>();
  if (needed <= 0) {
    return { products: primary.slice(0, count) as ProductWithSource[], borrowedCategories };
  }
  // Pool = everything NOT already in primary, deduplicated by product_id
  const usedIds = new Set(primary.map(p => p.product_id));
  const extras: ProductWithSource[] = allPool
    .filter(p => !usedIds.has(p.product_id))
    .slice(0, needed)
    .map(p => {
      const cat = p.category || 'other';
      if (cat !== primaryCategoryId) borrowedCategories.add(cat);
      return { ...p, _borrowedFrom: cat };
    });
  return {
    products: [...(primary as ProductWithSource[]), ...extras],
    borrowedCategories,
  };
}

/* ─── Coin tab filter constants ──────────────────── */
const COIN_TABS = [
  { symbol: 'BTC', name: 'Bitcoin', color: '#f7931a' },
  { symbol: 'ETH', name: 'Ethereum', color: '#627eea' },
  { symbol: 'BNB', name: 'BNB', color: '#f0b90b' },
  { symbol: 'SOL', name: 'Solana', color: '#9945ff' },
  { symbol: 'USDT', name: 'Tether', color: '#26a17b' },
  { symbol: 'USDC', name: 'USD Coin', color: '#2775ca' },
  { symbol: 'MATIC', name: 'Polygon', color: '#8247e5' },
  { symbol: 'DOGE', name: 'Dogecoin', color: '#c3a634' },
];

export default function HomePage() {
  const { t } = useClientTranslation();
  const { isAuthenticated, isLoading } = useAuth();
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [prodLoading, setProdLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [coinSearch, setCoinSearch] = useState('');
  const [activeCoinFilter, setActiveCoinFilter] = useState<string | null>(null);

  // Use shared live price store (1.5s polling, same as PriceTicker)
  const { prices, connect } = usePriceStore();
  const TOP_SYMBOLS = TOP_COINS.map(c => c.symbol);

  useEffect(() => {
    connect(TOP_SYMBOLS);
    // Don't disconnect so CoinPriceStrip can keep polling
  }, [connect]);

  // Show welcome toast after Google/social login redirect
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (searchParams?.get('welcome') === '1') {
      toast.success('🎉 Chào mừng bạn trở lại!', {
        description: 'Bạn đã đăng nhập thành công vào KienAI Marketplace.',
        duration: 5000,
      });
      // Clean up URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('welcome');
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [searchParams]);




  // ── Featured products state (12-product guarantee) ────────────────────
  const [featuredCategory, setFeaturedCategory] = useState('all');
  const [categoryProductCache, setCategoryProductCache] = useState<Record<string, ProductCardData[]>>({});
  const [featuredLoading, setFeaturedLoading] = useState(false);

  // Load all/homepage products (pool for filling)
  useEffect(() => {
    productsApi.homepage()
      .then(res => {
        const list = res.data?.data ?? res.data?.products ?? [];
        setProducts(Array.isArray(list) ? list : []);
      })
      .catch(() => setProducts([]))
      .finally(() => setProdLoading(false));
  }, []);

  // Fetch products for selected featured category (fetch more for coin filtering)
  useEffect(() => {
    if (categoryProductCache[featuredCategory]) return;
    setFeaturedLoading(true);
    const cat = HOME_CATEGORIES.find(c => c.id === featuredCategory);
    const params = cat?.slug
      ? { limit: 60, category: cat.slug }
      : { limit: 60 };
    productsApi.list(params)
      .then(res => {
        const list = res.data?.data ?? res.data?.products ?? [];
        setCategoryProductCache(prev => ({ ...prev, [featuredCategory]: Array.isArray(list) ? list : [] }));
      })
      .catch(() => setCategoryProductCache(prev => ({ ...prev, [featuredCategory]: [] })))
      .finally(() => setFeaturedLoading(false));
  }, [featuredCategory]);


  // Filter/sort helpers powered by store prices
  const allPriceData = TOP_COINS.map(c => ({
    ...c,
    data: prices[c.symbol],
  }));
  const filteredCoins = allPriceData.filter(c =>
    c.symbol.toLowerCase().includes(coinSearch.toLowerCase()) ||
    c.name.toLowerCase().includes(coinSearch.toLowerCase())
  );
  const gainers = filteredCoins.filter(c => (c.data?.change24h ?? 0) >= 0);
  const losers = filteredCoins.filter(c => (c.data?.change24h ?? 0) < 0);
  const displayedCoins = activeCategory === 'gainers' ? gainers
    : activeCategory === 'losers' ? losers
      : filteredCoins;

  const displayedSymbols = displayedCoins.map(c => c.symbol);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-[#f0b90b] border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AIChatButton />

      <main>
        {/* ── Hero Section ── */}
        <section className="relative overflow-hidden bg-background py-16 md:py-24 border-b border-border">
          {/* ── Premium Background Decorations ── */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Animated gradient orbs */}
            <div className="absolute -top-24 -left-24 w-[500px] h-[500px] bg-gradient-to-br from-[#f0b90b]/8 via-amber-500/5 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
            <div className="absolute top-1/2 -right-32 w-[400px] h-[400px] bg-gradient-to-bl from-blue-500/6 via-indigo-500/4 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
            <div className="absolute -bottom-20 left-1/3 w-[350px] h-[350px] bg-gradient-to-tr from-purple-500/5 via-pink-500/3 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '7s', animationDelay: '4s' }} />

            {/* Dot grid pattern */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }} />

            {/* Geometric lines */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f0b90b" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#627eea" stopOpacity="0.3" />
                </linearGradient>
              </defs>
              <line x1="10%" y1="20%" x2="40%" y2="80%" stroke="url(#line-grad)" strokeWidth="1" />
              <line x1="60%" y1="10%" x2="90%" y2="70%" stroke="url(#line-grad)" strokeWidth="1" />
              <line x1="30%" y1="5%" x2="70%" y2="95%" stroke="url(#line-grad)" strokeWidth="0.5" />
              <circle cx="15%" cy="25%" r="2" fill="#f0b90b" opacity="0.3" />
              <circle cx="85%" cy="65%" r="2" fill="#627eea" opacity="0.3" />
              <circle cx="50%" cy="50%" r="1.5" fill="#f0b90b" opacity="0.2" />
            </svg>

            {/* Floating small squares */}
            <motion.div
              animate={{ y: [0, -20, 0], rotate: [0, 45, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              className="absolute top-[15%] left-[8%] w-3 h-3 border border-[#f0b90b]/20 rounded-sm"
            />
            <motion.div
              animate={{ y: [0, 15, 0], rotate: [0, -30, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear', delay: 2 }}
              className="absolute top-[60%] right-[12%] w-4 h-4 border border-blue-500/20 rounded-sm"
            />
            <motion.div
              animate={{ y: [0, -10, 0], x: [0, 10, 0] }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear', delay: 1 }}
              className="absolute bottom-[20%] left-[45%] w-2.5 h-2.5 bg-[#f0b90b]/10 rounded-full"
            />

            {/* Gradient border line at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#f0b90b]/30 to-transparent" />
          </div>

          <div className="container mx-auto px-4 max-w-7xl relative z-10">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#f0b90b]/10 border border-[#f0b90b]/20 text-sm text-[#f0b90b] mb-6">
                  <Zap className="w-4 h-4" />
                  <span>Powered by Smart Contracts</span>
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight mb-6">
                  Mua sắm &{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f0b90b] via-[#e6a800] to-[#f0b90b]">
                    Thanh toán Crypto
                  </span>
                </h1>
                <p className="text-lg text-muted-foreground mb-8 max-w-lg leading-relaxed">
                  Sàn thương mại điện tử Web3 bảo mật với hợp đồng Escrow thông minh. Giao dịch minh bạch, an toàn.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/products">
                    <Button size="lg" className="bg-[#f0b90b] hover:bg-[#e6a800] text-black font-bold px-8 shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/40 transition-shadow">
                      <ShoppingBag className="w-5 h-5 mr-2" />
                      Mua sắm ngay
                    </Button>
                  </Link>
                  <Link href="/trading/BTCUSDT">
                    <Button size="lg" variant="outline" className="border-border bg-card text-foreground hover:bg-accent font-semibold px-8">
                      <BarChart3 className="w-5 h-5 mr-2" />
                      Xem thị trường
                    </Button>
                  </Link>
                </div>

                {/* Mini stats - enhanced with icons */}
                <div className="flex gap-4 mt-10">
                  {[
                    { label: 'Người dùng', value: '10K+', icon: '👥' },
                    { label: 'Sản phẩm', value: '5K+', icon: '📦' },
                    { label: 'Giao dịch', value: '$2M+', icon: '💰' },
                    { label: 'Chains', value: '5+', icon: '⛓️' },
                  ].map((s, i) => (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + i * 0.1 }}
                      className="text-center px-4 py-2.5 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm"
                    >
                      <p className="text-lg font-bold text-foreground">{s.icon} {s.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Hero right: premium crypto cards */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="hidden md:grid grid-cols-2 gap-4"
              >
                {TOP_COINS.slice(0, 4).map((coinInfo, i) => (
                  <CoinHeroCard key={coinInfo.symbol} coinInfo={coinInfo} prices={prices} index={i} />
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Sản phẩm nổi bật — 12 sản phẩm cố định, lọc theo danh mục + coin ── */}
        <section className="relative py-12 bg-background overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -bottom-20 -left-20 w-[350px] h-[350px] bg-gradient-to-tr from-[#f0b90b]/4 to-transparent rounded-full blur-3xl" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#f0b90b]/15 to-transparent" />
          </div>

          <div className="container mx-auto px-4 max-w-7xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Sản phẩm nổi bật</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Khám phá {TARGET_COUNT} sản phẩm — chọn danh mục và coin thanh toán.
                </p>
              </div>
              <Link href="/products">
                <Button variant="ghost" size="sm" className="text-[#f0b90b] hover:text-[#e6a800] hover:bg-[#f0b90b]/8 gap-1 text-sm">
                  Xem tất cả <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>

            {/* ── Row 1: Category tabs ── */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-3">
              {(() => {
                const primaryProducts = categoryProductCache[featuredCategory] ?? [];
                const coinFiltered = activeCoinFilter
                  ? primaryProducts.filter(p =>
                    p.accepted_tokens?.some((t: any) => t.symbol?.toUpperCase() === activeCoinFilter) ||
                    (p.metadata?.pricing && activeCoinFilter in p.metadata.pricing) ||
                    p.token_symbol?.toUpperCase() === activeCoinFilter
                  )
                  : primaryProducts;
                const { borrowedCategories } = fillToCount(coinFiltered, featuredCategory, products);
                return HOME_CATEGORIES.map((cat, i) => {
                  const isActive = featuredCategory === cat.id;
                  const isBorrowed = borrowedCategories.has(cat.slug ?? cat.id);
                  const CatIcon = cat.icon;
                  return (
                    <motion.button
                      key={cat.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => { setFeaturedCategory(cat.id); setActiveCoinFilter(null); }}
                      title={isBorrowed ? `Đang mượn sản phẩm từ danh mục này` : cat.label}
                      className={[
                        'flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-semibold transition-all duration-200',
                        isActive
                          ? 'text-black shadow-md'
                          : isBorrowed
                            ? 'bg-card border-amber-500/50 text-foreground ring-1 ring-amber-500/40'
                            : 'bg-card border-border text-foreground hover:border-primary/40 hover:bg-muted',
                      ].join(' ')}
                      style={isActive ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
                    >
                      <CatIcon
                        className="w-3.5 h-3.5 flex-shrink-0"
                        style={{ color: isActive ? 'black' : isBorrowed ? '#f59e0b' : cat.color }}
                      />
                      <span>{cat.label}</span>
                      {isBorrowed && !isActive && (
                        <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 rounded px-1">↗</span>
                      )}
                    </motion.button>
                  );
                });
              })()}
            </div>

            {/* ── Row 2: Coin filter ── */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-hide mb-6">
              <span className="text-xs text-muted-foreground flex-shrink-0 mr-1">Coin:</span>
              {/* All coins button */}
              <button
                onClick={() => setActiveCoinFilter(null)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 ${activeCoinFilter === null
                  ? 'bg-foreground text-background border-foreground shadow-sm'
                  : 'bg-card border-border text-muted-foreground hover:border-primary/40 hover:bg-muted'
                  }`}
              >
                Tất cả
              </button>
              {COIN_TABS.map((tab) => {
                const priceData = prices[tab.symbol + 'USDT'];
                const change = priceData?.change24h ?? 0;
                const isActive = activeCoinFilter === tab.symbol;
                return (
                  <button
                    key={tab.symbol}
                    onClick={() => setActiveCoinFilter(isActive ? null : tab.symbol)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 ${isActive
                      ? 'text-black shadow-sm'
                      : 'bg-card border-border text-foreground hover:border-primary/40 hover:bg-muted'
                      }`}
                    style={isActive ? { backgroundColor: tab.color, borderColor: tab.color } : {}}
                  >
                    <CoinImage symbol={tab.symbol} size={14} className="rounded-full" />
                    <span>{tab.symbol}</span>
                    {priceData && (
                      <span className={`hidden sm:inline ${isActive ? 'text-black/70' : change >= 0 ? 'text-emerald-500' : 'text-red-500'
                        }`}>
                        {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Product Grid — always 12 slots ── */}
            {(() => {
              const primaryProducts = categoryProductCache[featuredCategory] ?? [];
              // Apply coin filter first
              const coinFiltered = activeCoinFilter
                ? primaryProducts.filter(p =>
                  p.accepted_tokens?.some((t: any) => t.symbol?.toUpperCase() === activeCoinFilter) ||
                  (p.metadata?.pricing && activeCoinFilter in p.metadata.pricing) ||
                  p.token_symbol?.toUpperCase() === activeCoinFilter
                )
                : primaryProducts;

              const isLoading = featuredLoading || (primaryProducts.length === 0 && prodLoading);
              const { products: displayList, borrowedCategories } = fillToCount(
                coinFiltered, featuredCategory, products
              );

              if (isLoading) {
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: TARGET_COUNT }).map((_, i) => (
                      <div key={i} className="bg-card rounded-2xl overflow-hidden border border-border animate-pulse">
                        <div className="h-44 bg-muted" />
                        <div className="p-4 space-y-2">
                          <div className="h-3 bg-muted rounded w-3/4" />
                          <div className="h-4 bg-muted rounded w-1/2" />
                          <div className="h-8 bg-muted rounded mt-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }

              if (displayList.length === 0) {
                return (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-center py-20 bg-card rounded-2xl border border-border">
                    {activeCoinFilter
                      ? <CoinImage symbol={activeCoinFilter} size={48} className="opacity-30 mx-auto mb-3" />
                      : <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />}
                    <p className="text-muted-foreground text-sm">
                      {activeCoinFilter
                        ? `Chưa có sản phẩm thanh toán bằng ${activeCoinFilter}`
                        : 'Chưa có sản phẩm nào'}
                    </p>
                    {activeCoinFilter && (
                      <button onClick={() => setActiveCoinFilter(null)}
                        className="mt-3 text-xs text-[#f0b90b] hover:underline">
                        Xóa bộ lọc coin →
                      </button>
                    )}
                    <Link href="/products" className="mt-2 block text-xs text-muted-foreground hover:underline">
                      Xem tất cả sản phẩm →
                    </Link>
                  </motion.div>
                );
              }

              return (
                <>
                  {/* Borrowed notice */}
                  {borrowedCategories.size > 0 && featuredCategory !== 'all' && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-amber-500 mb-4 flex items-center gap-1.5"
                    >
                      <span>✦</span>
                      Chưa đủ {TARGET_COUNT} sản phẩm — đang hiển thị thêm từ:{' '}
                      <span className="font-semibold capitalize">
                        {Array.from(borrowedCategories).join(', ')}
                      </span>
                    </motion.p>
                  )}
                  <motion.div
                    key={`${featuredCategory}-${activeCoinFilter}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
                  >
                    {displayList.map((product, i) => (
                      <div key={product.product_id} className="relative">
                        {product._borrowedFrom && (
                          <span className="absolute top-2.5 left-2.5 z-10 text-[9px] font-bold
                            bg-amber-500/90 text-black px-1.5 py-0.5 rounded-full shadow">
                            {product._borrowedFrom}
                          </span>
                        )}
                        <ProductCard product={product} index={i} variant="grid" showAddToCart />
                      </div>
                    ))}
                  </motion.div>
                </>
              );
            })()}
          </div>
        </section>

        {/* ── Market + Wallet Section ── */}
        <section className="relative py-10 bg-background border-b border-border transition-colors duration-300 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#f0b90b]/15 to-transparent" />
            <div className="absolute -top-32 right-0 w-[300px] h-[300px] bg-gradient-to-bl from-[#f0b90b]/3 to-transparent rounded-full blur-3xl" />
          </div>
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" placeholder={t('home.searchCoin')} value={coinSearch}
                  onChange={e => setCoinSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-all" />
              </div>
              <div className="flex items-center gap-1 p-1 bg-muted border border-border rounded-xl">
                {['all', 'gainers', 'losers'].map(tab => (
                  <button key={tab} onClick={() => setActiveCategory(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeCategory === tab ? 'bg-[#f0b90b] text-black' : 'text-muted-foreground hover:text-foreground'
                      }`}>
                    {tab === 'all' ? t('home.all') : tab === 'gainers' ? '▲ ' + t('home.gainers') : '▼ ' + t('home.losers')}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid lg:grid-cols-[1fr,320px] gap-6">
              <MarketTable symbols={displayedSymbols} search={coinSearch} />
              <WalletBalanceSection />
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="py-14 border-t border-border/50">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-foreground">{t('home.howItWorks')}</h2>
              <p className="text-muted-foreground mt-2 text-sm">{t('home.howItWorksDesc')}</p>
            </div>
            <div className="grid md:grid-cols-4 gap-5">
              {HOW_IT_WORKS_STEPS.map((item, i) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="group relative overflow-hidden rounded-[28px] border border-border/80 bg-card/95 px-6 py-7 text-left shadow-[0_18px_40px_rgba(0,0,0,0.16)] transition-all duration-300 hover:-translate-y-1 hover:border-white/15 hover:shadow-[0_24px_55px_rgba(0,0,0,0.22)]"
                >
                  <div className={`absolute left-6 right-6 top-0 h-px bg-gradient-to-r ${item.divider}`} />
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-[#f0b90b]/25 bg-[#f0b90b]/10 px-3 text-[11px] font-black tracking-[0.2em] text-[#f0b90b]">
                      {item.step}
                    </span>
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border shadow-lg transition-transform duration-300 group-hover:scale-[1.04] ${item.iconSurface}`}>
                      <item.icon className={`h-6 w-6 ${item.iconTone}`} strokeWidth={1.9} />
                    </div>
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
                    {item.eyebrow}
                  </p>
                  <h3 className="mt-3 text-xl font-bold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.desc}</p>
                  <div className={`mt-6 h-px w-full bg-gradient-to-r ${item.divider}`} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        {!isAuthenticated && (
          <section className="py-16">
            <div className="container mx-auto px-4 max-w-5xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="relative bg-gradient-to-br from-[#1a1d26] to-[#131722] border border-[#f0b90b]/20 rounded-3xl p-10 text-center overflow-hidden"
              >
                <div className="absolute inset-0">
                  <div className="absolute top-0 left-1/3 w-64 h-64 bg-[#f0b90b]/5 rounded-full blur-3xl" />
                  <div className="absolute bottom-0 right-1/4 w-52 h-52 bg-blue-600/5 rounded-full blur-3xl" />
                </div>
                <div className="relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#f0b90b] to-[#e6a800] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-yellow-500/20">
                    <Zap className="w-8 h-8 text-black fill-black" />
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t('home.readyToStart')}</h2>
                  <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
                    {t('home.readyToStartDesc')}
                  </p>
                  <div className="flex justify-center gap-4">
                    <Link href="/register">
                      <Button size="lg" className="bg-[#f0b90b] hover:bg-[#e6a800] text-black font-bold px-10 shadow-lg shadow-yellow-500/20">
                        {t('auth.createAccount')}
                      </Button>
                    </Link>
                    <Link href="/products">
                      <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/5 font-semibold px-10">
                        {t('home.explore')}
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
