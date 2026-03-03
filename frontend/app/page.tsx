'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShoppingBag, Shield, Zap, ArrowRight, Star, TrendingUp,
  Users, Package, Timer, Flame, Tag, ChevronRight, Eye,
  BarChart3, Wallet, RefreshCw, Activity, Search, ShoppingCart,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { productService } from '@/services';
import { useWallet } from '@/lib/hooks/useWallet';
import { formatCurrency, formatCrypto } from '@/lib/utils/format';
import { getCoinLogo } from '@/lib/utils/coin-logos';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

/* ─── Types ──────────────────────────────────────── */
interface Product {
  product_id: number;
  name: string;
  description: string;
  base_price_usd: number;
  metadata?: { images?: string[]; category?: string };
  stock?: number;
}

interface TickerData {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
  highPrice: string;
  lowPrice: string;
  quoteVolume: string;
}

/* ─── Constants ──────────────────────────────────── */
const PRODUCT_IMAGES = [
  '/products/headphones.png', '/products/smartwatch.png',
  '/products/laptop.png', '/products/camera.png',
  '/products/sneakers.png', '/products/backpack.png',
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
];

const CATEGORIES = [
  { name: 'Điện tử', icon: '💻', color: 'from-blue-600 to-blue-700', href: '/products?category=electronics', count: '1.2K+' },
  { name: 'Thời trang', icon: '👕', color: 'from-pink-500 to-rose-600', href: '/products?category=fashion', count: '800+' },
  { name: 'Nhà cửa', icon: '🏠', color: 'from-amber-500 to-orange-600', href: '/products?category=home', count: '650+' },
  { name: 'Thể thao', icon: '⚽', color: 'from-green-500 to-emerald-600', href: '/products?category=sports', count: '500+' },
  { name: 'Sách', icon: '📚', color: 'from-purple-500 to-violet-600', href: '/products?category=books', count: '900+' },
  { name: 'Đồ chơi', icon: '🧸', color: 'from-red-500 to-pink-600', href: '/products?category=toys', count: '300+' },
  { name: 'Làm đẹp', icon: '💄', color: 'from-fuchsia-500 to-pink-600', href: '/products?category=beauty', count: '400+' },
  { name: 'Thực phẩm', icon: '🛒', color: 'from-lime-500 to-green-600', href: '/products?category=food', count: '200+' },
];

/* ─── Flash Sale Timer ───────────────────────────── */
function useFlashSaleTimer() {
  const [timeLeft, setTimeLeft] = useState({ h: 5, m: 47, s: 23 });
  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft(prev => {
        let { h, m, s } = prev;
        s--;
        if (s < 0) { s = 59; m--; }
        if (m < 0) { m = 59; h--; }
        if (h < 0) { h = 23; m = 59; s = 59; }
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);
  return timeLeft;
}

/* ─── Wallet Balance Section ─────────────────────── */
function WalletBalanceSection() {
  const { isConnected, tokenBalances, totalUSDT, isLoading, refetch } = useWallet();
  const { t } = useTranslation();

  return (
    <div className="bg-gradient-to-br from-[#1a1d26] to-[#0f1117] border border-border rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-[#f0b90b]" />
          <h2 className="text-white font-bold">{t('home.myWallet')}</h2>
        </div>
        <button onClick={refetch} disabled={isLoading} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
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
            <p className="text-xs text-gray-500 mb-1">Tổng số dư (USD)</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{formatCurrency(totalUSDT)}</span>
              <span className="text-sm text-[#f0b90b] font-medium">USDT</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-400">+2.43% hôm nay</span>
            </div>
          </div>

          {/* Coins owned */}
          {tokenBalances.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Coin đang sở hữu ({tokenBalances.length})</p>
              {tokenBalances.slice(0, 5).map((token, i) => (
                <motion.div
                  key={token.symbol}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/3 hover:bg-white/6 border border-border/50 hover:border-border transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-white/10 p-1 flex-shrink-0">
                      <Image
                        src={getCoinLogo(token.symbol)}
                        alt={token.symbol}
                        width={32} height={32}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{token.symbol}</p>
                      <p className="text-xs text-gray-500">{formatCrypto(token.balance, 4)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">{formatCurrency(token.usdValue)}</p>
                    <p className="text-xs text-emerald-400">+1.2%</p>
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
              <p className="text-gray-500 text-sm">Chưa có coin nào trong ví</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Market Table ───────────────────────────────── */
function MarketTable({ tickers, loading }: { tickers: TickerData[]; loading: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#f0b90b]" />
          <h2 className="text-white font-bold">{t('home.market')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block" />
            Live
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
            <tr className="border-b border-border/50 text-xs text-gray-600 uppercase">
              <th className="px-5 py-3 text-left font-medium">Coin</th>
              <th className="px-5 py-3 text-right font-medium">Giá</th>
              <th className="px-5 py-3 text-right font-medium">24h %</th>
              <th className="px-5 py-3 text-right font-medium hidden sm:table-cell">KL 24h</th>
              <th className="px-5 py-3 text-right font-medium hidden md:table-cell">Cao/Thấp</th>
              <th className="px-5 py-3 text-center font-medium">Biểu đồ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {[1, 2, 3, 4, 5, 6].map(j => (
                    <td key={j} className="px-5 py-3.5">
                      <div className="h-4 bg-white/5 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              tickers.map((ticker, idx) => {
                const isPos = parseFloat(ticker.priceChangePercent) >= 0;
                const coinInfo = TOP_COINS.find(c => c.symbol === ticker.symbol);
                const displaySymbol = ticker.symbol.replace('USDT', '');
                return (
                  <motion.tr
                    key={ticker.symbol}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.04 }}
                    className="border-b border-border/50 hover:bg-white/3 transition-colors group cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <Link href={`/trading/${ticker.symbol}`} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${coinInfo?.color}25`, border: `1px solid ${coinInfo?.color}40` }}>
                          <Image
                            src={getCoinLogo(displaySymbol)}
                            alt={displaySymbol}
                            width={24} height={24}
                            className="w-5 h-5 object-contain"
                          />
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm group-hover:text-[#f0b90b] transition-colors">{displaySymbol}</p>
                          <p className="text-xs text-gray-600">{coinInfo?.name || displaySymbol}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/trading/${ticker.symbol}`}>
                        <span className="font-mono font-semibold text-white text-sm">
                          ${parseFloat(ticker.lastPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-bold ${isPos ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                        {isPos ? '▲' : '▼'} {Math.abs(parseFloat(ticker.priceChangePercent)).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-gray-500 hidden sm:table-cell font-mono">
                      {parseFloat(ticker.quoteVolume).toLocaleString(undefined, { maximumFractionDigits: 0, notation: 'compact' })} USDT
                    </td>
                    <td className="px-5 py-3.5 text-right hidden md:table-cell">
                      <div className="text-xs">
                        <p className="text-emerald-400 font-mono">${parseFloat(ticker.highPrice).toLocaleString()}</p>
                        <p className="text-red-400 font-mono">${parseFloat(ticker.lowPrice).toLocaleString()}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <Link href={`/trading/${ticker.symbol}`}>
                        <Button size="sm" variant="ghost" className="h-7 px-3 text-xs text-[#f0b90b] hover:bg-[#f0b90b]/10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <BarChart3 className="w-3.5 h-3.5 mr-1" /> Xem
                        </Button>
                      </Link>
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Flash Sale Card ────────────────────────────── */
function FlashSaleCard({ product, index, getProductImage, failedImgs, setFailedImgs }: any) {
  const discount = Math.floor(Math.random() * 40) + 10;
  const originalPrice = product.base_price_usd * (1 + discount / 100);
  const stockLeft = Math.floor(Math.random() * 80) + 10;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06 }}
    >
      <Link href={`/products/${product.product_id}`}>
        <div className="bg-card border border-border rounded-2xl overflow-hidden group hover:border-[#f0b90b]/40 hover:shadow-lg hover:shadow-[#f0b90b]/8 transition-all duration-300">
          <div className="relative h-48 bg-gradient-to-br from-[#0f1117] to-[#1a1d26] overflow-hidden">
            <Image
              src={getProductImage(product, index)}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              unoptimized
              onError={() => setFailedImgs((prev: Set<number>) => new Set(prev).add(product.product_id))}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f1117]/60 to-transparent" />
            <span className="absolute top-3 left-3 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg shadow-lg">
              -{discount}%
            </span>
            {product.metadata?.category && (
              <span className="absolute top-3 right-3 px-2 py-1 bg-card/80 backdrop-blur-sm text-gray-300 text-xs rounded-lg border border-border">
                {product.metadata.category}
              </span>
            )}
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-sm text-white mb-1 line-clamp-1 group-hover:text-[#f0b90b] transition-colors">
              {product.name}
            </h3>
            <p className="text-gray-600 text-xs mb-3 line-clamp-2">{product.description}</p>

            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-lg font-bold text-[#f0b90b]">
                  ${Number(product.base_price_usd).toFixed(2)}
                </span>
                <span className="text-xs text-gray-600 line-through ml-2">
                  ${originalPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-yellow-400">
                <Star className="w-3 h-3 fill-current" />
                <span className="text-xs text-gray-400">4.8</span>
              </div>
            </div>

            {/* Stock bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Đã bán {100 - stockLeft}%</span>
                <span className="text-red-400 font-medium">Còn {stockLeft} sản phẩm</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full"
                  style={{ width: `${100 - stockLeft}%` }}
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  useCartStore.getState().addItem({
                    product_id: product.product_id,
                    name: product.name,
                    base_price_usd: Number(product.base_price_usd),
                    metadata: product.metadata,
                  });
                  toast.success('Đã thêm vào giỏ hàng');
                }}
                variant="outline"
                className="flex-1 bg-background/5 border-border hover:bg-white/10 text-white transition-all h-8 text-xs font-medium px-2"
              >
                <ShoppingCart className="w-3 h-3 mr-1" /> Cart
              </Button>
              <Button
                onClick={(e) => { e.preventDefault(); window.location.href = `/products/${product.product_id}`; }}
                className="flex-1 bg-[#f0b90b] hover:bg-[#e6a800] text-black font-semibold h-8 text-xs px-2 shadow shadow-yellow-500/20"
              >
                Mua ngay
              </Button>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ─── Product Card ───────────────────────────────── */
function ProductCard({ product, index, getProductImage, failedImgs, setFailedImgs }: any) {
  const addItem = useCartStore((state) => state.addItem);
  const { t } = useTranslation();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({
      product_id: product.product_id,
      name: product.name,
      base_price_usd: Number(product.base_price_usd),
      metadata: product.metadata,
    });
    toast.success('Đã thêm vào giỏ hàng');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      className="h-full"
    >
      <Link href={`/products/${product.product_id}`} className="block h-full">
        <div className="bg-card h-full flex flex-col border border-border rounded-2xl overflow-hidden group hover:border-white/20 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
          <div className="relative h-44 bg-gradient-to-br from-[#0f1117] to-[#1a1d26] overflow-hidden flex-shrink-0">
            <Image
              src={getProductImage(product, index)}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              unoptimized
              onError={() => setFailedImgs((prev: Set<number>) => new Set(prev).add(product.product_id))}
            />
            {product.metadata?.category && (
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-xs text-gray-300 border border-border">
                {product.metadata.category}
              </span>
            )}
            <button className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400">
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-4 flex flex-col flex-grow">
            <h3 className="font-semibold text-sm text-foreground mb-1 line-clamp-1 group-hover:text-primary transition-colors">
              {product.name}
            </h3>
            <p className="text-muted-foreground text-xs mb-3 line-clamp-2 min-h-[32px]">{product.description}</p>
            <div className="mt-auto">
              <div className="flex justify-between items-center mb-3">
                <span className="text-base font-bold text-foreground">
                  ${Number(product.base_price_usd).toFixed(2)}
                </span>
                <div className="flex items-center gap-1 text-yellow-500">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span className="text-xs text-muted-foreground">4.8</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={(e) => { e.preventDefault(); handleAddToCart(e); }}
                  variant="outline"
                  className="flex-1 bg-background border-border hover:bg-primary/10 hover:border-primary/50 text-foreground transition-all h-8 text-xs font-medium px-2"
                >
                  <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
                  Cart
                </Button>
                <Button
                  onClick={(e) => { e.preventDefault(); window.location.href = `/products/${product.product_id}`; }}
                  className="flex-1 bg-[#f0b90b] hover:bg-[#e6a800] text-black font-semibold h-8 text-xs px-2 shadow shadow-yellow-500/20"
                >
                  Mua ngay
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ─── Main Page ──────────────────────────────────── */
export default function HomePage() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [prodLoading, setProdLoading] = useState(true);
  const [failedImgs, setFailedImgs] = useState<Set<number>>(new Set());
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [tickerLoading, setTickerLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [coinSearch, setCoinSearch] = useState('');
  const flashTimer = useFlashSaleTimer();

  const getProductImage = useCallback((product: Product, index: number) => {
    if (failedImgs.has(product.product_id)) return PRODUCT_IMAGES[index % PRODUCT_IMAGES.length];
    const metaImg = product.metadata?.images?.[0];
    if (metaImg && metaImg !== '/placeholder-product.svg') return metaImg;
    return PRODUCT_IMAGES[index % PRODUCT_IMAGES.length];
  }, [failedImgs]);

  useEffect(() => {
    (async () => {
      try {
        const { products: list } = await productService.list({ limit: 16 });
        setProducts(Array.isArray(list) ? list : []);
      } catch { setProducts([]); }
      finally { setProdLoading(false); }
    })();
  }, []);

  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        const data: TickerData[] = await res.json();
        const filtered = TOP_COINS.map(c => data.find(d => d.symbol === c.symbol) || {
          symbol: c.symbol, lastPrice: '0', priceChangePercent: '0', volume: '0', highPrice: '0', lowPrice: '0', quoteVolume: '0',
        });
        setTickers(filtered as TickerData[]);
      } catch { }
      finally { setTickerLoading(false); }
    };
    fetchTickers();
    const iv = setInterval(fetchTickers, 10000);
    return () => clearInterval(iv);
  }, []);

  const filteredTickers = tickers.filter(t =>
    t.symbol.toLowerCase().includes(coinSearch.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-[#f0b90b] border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Đang tải...</p>
        </div>
      </div>
    );
  }

  const flashProducts = products.length > 0 ? products.slice(0, 6) : [];
  const featuredProducts = products.length > 6 ? products.slice(6, 14) : products;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main>
        {/* ── Hero Section ── */}
        <section className="relative overflow-hidden bg-background py-16 md:py-24 border-b border-border">
          {/* Background effects */}
          <div className="absolute inset-0">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#f0b90b]/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl" />
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
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
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f0b90b] to-[#e6a800]">
                    Thanh toán Crypto
                  </span>
                </h1>
                <p className="text-lg text-muted-foreground mb-8 max-w-lg leading-relaxed">
                  Sàn thương mại điện tử Web3 bảo mật với hợp đồng Escrow thông minh. Giao dịch minh bạch, an toàn.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/products">
                    <Button size="lg" className="bg-[#f0b90b] hover:bg-[#e6a800] text-black font-bold px-8 shadow-lg shadow-yellow-500/20">
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

                {/* Mini stats */}
                <div className="flex gap-6 mt-10">
                  {[
                    { label: 'Người dùng', value: '10K+' },
                    { label: 'Sản phẩm', value: '5K+' },
                    { label: 'Giao dịch', value: '$2M+' },
                  ].map(s => (
                    <div key={s.label}>
                      <p className="text-xl font-bold text-foreground">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Hero right: crypto mini cards */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="hidden md:grid grid-cols-2 gap-3"
              >
                {tickers.slice(0, 4).map((ticker, i) => {
                  const isPos = parseFloat(ticker.priceChangePercent) >= 0;
                  const coinInfo = TOP_COINS.find(c => c.symbol === ticker.symbol);
                  const displaySymbol = ticker.symbol.replace('USDT', '');
                  return (
                    <motion.div
                      key={ticker.symbol}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.1 }}
                      className={`h-full ${i % 2 === 1 ? 'mt-6' : ''}`}
                    >
                      <Link href={`/trading/${ticker.symbol}`}>
                        <div className="h-full bg-card backdrop-blur-sm border rounded-2xl p-4 hover:border-[#f0b90b]/50 transition-all cursor-pointer shadow-sm"
                          style={{ borderColor: `var(--border, ${coinInfo?.color}30)` }}>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: `${coinInfo?.color}25` }}>
                              <Image src={getCoinLogo(displaySymbol)} alt={displaySymbol} width={24} height={24} className="object-contain" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">{displaySymbol}</p>
                              <p className="text-xs text-muted-foreground">{coinInfo?.name}</p>
                            </div>
                          </div>
                          <p className="text-lg font-bold text-foreground font-mono">
                            ${parseFloat(ticker.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </p>
                          <span className={`text-sm font-medium ${isPos ? 'text-emerald-500' : 'text-red-500'} mt-1 block`}>
                            {isPos ? '+' : ''}{parseFloat(ticker.priceChangePercent).toFixed(2)}%
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Market + Wallet Section ── */}
        <section className="py-10 bg-background border-b border-border transition-colors duration-300">
          <div className="container mx-auto px-4 max-w-7xl">
            {/* Coin search */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t('home.searchCoin')}
                  value={coinSearch}
                  onChange={e => setCoinSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-all"
                />
              </div>
              <div className="flex items-center gap-1 p-1 bg-white/5 border border-border rounded-xl">
                {['all', 'gainers', 'losers'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveCategory(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeCategory === tab ? 'bg-[#f0b90b] text-black' : 'text-gray-400 hover:text-white'}`}
                  >
                    {tab === 'all' ? t('home.all') : tab === 'gainers' ? '▲ ' + t('home.gainers') : '▼ ' + t('home.losers')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-[1fr,320px] gap-6">
              <MarketTable
                tickers={activeCategory === 'gainers'
                  ? filteredTickers.filter(t => parseFloat(t.priceChangePercent) >= 0)
                  : activeCategory === 'losers'
                    ? filteredTickers.filter(t => parseFloat(t.priceChangePercent) < 0)
                    : filteredTickers}
                loading={tickerLoading}
              />
              <WalletBalanceSection />
            </div>
          </div>
        </section>

        {/* ── Categories ── */}
        <section className="py-12 bg-background">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Categories</h2>
                <p className="text-muted-foreground text-sm mt-1">Discover products across all categories and pay with Crypto.</p>
              </div>
              <Link href="/products">
                <Button variant="ghost" size="sm" className="text-[#f0b90b] hover:text-[#e6a800] hover:bg-[#f0b90b]/8 gap-1 text-sm">
                  Tất cả <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {CATEGORIES.map((cat, i) => (
                <motion.div key={cat.name} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}>
                  <Link href={cat.href}>
                    <div className="group bg-card border border-border rounded-xl p-3 text-center hover:border-[#f0b90b]/30 hover:shadow-lg hover:shadow-[#f0b90b]/5 transition-all cursor-pointer hover:-translate-y-1 duration-300">
                      <div className={`w-12 h-12 rounded-xl mx-auto mb-2 flex items-center justify-center bg-gradient-to-br ${cat.color} text-2xl shadow-lg`}>
                        {cat.icon}
                      </div>
                      <h3 className="text-xs font-semibold text-gray-300 group-hover:text-[#f0b90b] transition-colors line-clamp-1">{cat.name}</h3>
                      <p className="text-xs text-gray-600 mt-0.5">{cat.count}</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Flash Sale Section ── */}
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-xl shadow-lg shadow-red-500/30">
                  <Flame className="w-5 h-5 fill-white" />
                  <span className="font-bold text-lg">FLASH SALE</span>
                </div>
                <div className="flex items-center gap-1 bg-card border border-border px-3 py-2 rounded-xl">
                  <Timer className="w-4 h-4 text-[#f0b90b]" />
                  <span className="font-mono font-bold text-white text-lg">
                    {String(flashTimer.h).padStart(2, '0')}:{String(flashTimer.m).padStart(2, '0')}:{String(flashTimer.s).padStart(2, '0')}
                  </span>
                </div>
              </div>
              <Link href="/products">
                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/8 gap-1 text-sm">
                  Xem tất cả <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>

            {prodLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="bg-card rounded-2xl overflow-hidden border border-border animate-pulse">
                    <div className="h-48 bg-white/5" />
                    <div className="p-4 space-y-2">
                      <div className="h-3 bg-white/5 rounded w-3/4" />
                      <div className="h-4 bg-white/5 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {flashProducts.map((product, i) => (
                  <FlashSaleCard
                    key={product.product_id}
                    product={product}
                    index={i}
                    getProductImage={getProductImage}
                    failedImgs={failedImgs}
                    setFailedImgs={setFailedImgs}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Deal of Day Banner ── */}
        <section className="py-4">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: '🎉', title: 'Giảm đến 50%', sub: 'Sản phẩm nổi bật', color: 'from-blue-600/20 to-blue-800/20', border: 'border-blue-500/20', badge: 'HOT DEAL' },
                { icon: '🚀', title: 'Freeship toàn quốc', sub: 'Đơn từ $10 trở lên', color: 'from-emerald-600/20 to-emerald-800/20', border: 'border-emerald-500/20', badge: 'FREE SHIP' },
                { icon: '💎', title: 'Thanh toán Crypto', sub: 'BTC, ETH, BNB & more', color: 'from-yellow-600/20 to-amber-800/20', border: 'border-yellow-500/20', badge: 'WEB3' },
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                  <div className={`bg-gradient-to-r ${item.color} border ${item.border} rounded-2xl p-5 flex items-center gap-4 cursor-pointer hover:-translate-y-1 transition-all duration-300`}>
                    <span className="text-4xl">{item.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold px-2 py-0.5 bg-white/10 text-white rounded-full">{item.badge}</span>
                      </div>
                      <h3 className="font-bold text-white">{item.title}</h3>
                      <p className="text-xs text-gray-400">{item.sub}</p>
                    </div>
                    <Tag className="w-5 h-5 text-gray-500" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Featured Products ── */}
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Featured Products</h2>
                <p className="text-muted-foreground text-sm mt-1">Handpicked from our verified sellers</p>
              </div>
              <Link href="/products">
                <Button variant="ghost" size="sm" className="text-[#f0b90b] hover:text-[#e6a800] hover:bg-[#f0b90b]/8 gap-1">
                  View All <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>

            {prodLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                  <div key={i} className="bg-card rounded-2xl overflow-hidden border border-border animate-pulse">
                    <div className="h-44 bg-white/5" />
                    <div className="p-4 space-y-2">
                      <div className="h-3 bg-white/5 rounded w-3/4" />
                      <div className="h-3 bg-white/5 rounded w-1/2" />
                      <div className="h-4 bg-white/5 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : featuredProducts.length === 0 ? (
              <div className="text-center py-16 bg-card rounded-2xl border border-border">
                <ShoppingBag className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                <p className="text-gray-500">Chưa có sản phẩm nào</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {featuredProducts.map((product, i) => (
                  <ProductCard
                    key={product.product_id}
                    product={product}
                    index={i}
                    getProductImage={getProductImage}
                    failedImgs={failedImgs}
                    setFailedImgs={setFailedImgs}
                  />
                ))}
              </div>
            )}
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
              {[
                { step: '1', title: 'Duyệt & Mua', desc: 'Tìm sản phẩm và đặt hàng bằng crypto hoặc tiền tệ thông thường.', icon: ShoppingBag, color: 'from-blue-600 to-blue-700' },
                { step: '2', title: 'Escrow khóa', desc: 'Thanh toán được khóa trong hợp đồng thông minh Escrow an toàn.', icon: Shield, color: 'from-purple-600 to-purple-700' },
                { step: '3', title: 'Nhận hàng', desc: 'Người bán giao hàng. Xác nhận khi nhận được.', icon: Package, color: 'from-emerald-600 to-emerald-700' },
                { step: '4', title: 'Hoàn tất', desc: 'Admin giải ngân cho người bán hoặc hoàn tiền khi có tranh chấp.', icon: Zap, color: 'from-amber-500 to-orange-600' },
              ].map((item, i) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative text-center p-6 rounded-2xl bg-card border border-border hover:border-white/20 hover:shadow-lg transition-all group"
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-gradient-to-br from-[#f0b90b] to-[#e6a800] text-black text-xs font-bold flex items-center justify-center shadow-md">
                    {item.step}
                  </div>
                  <div className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-gradient-to-br ${item.color} shadow-lg group-hover:scale-110 transition-transform`}>
                    <item.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
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
