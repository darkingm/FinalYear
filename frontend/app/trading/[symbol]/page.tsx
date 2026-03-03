'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { getCoinDetail, CoinDetailData } from '@/lib/api/binance-detail';
import {
  TrendingUp, TrendingDown, Activity, BarChart3, Clock, ArrowLeft,
  Search, Star, RefreshCw, ChevronDown, Share2, BookOpen,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { getCoinLogo } from '@/lib/utils/coin-logos';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { productService } from '@/services';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { ShoppingCart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Lazy load chart
const CoinChart = dynamic(
  () => import('@/components/charts/CoinChart').then((mod) => mod.CoinChart),
  {
    loading: () => <div className="w-full h-full bg-card animate-pulse rounded-lg flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#f0b90b] border-t-transparent rounded-full animate-spin" />
    </div>,
    ssr: false,
  }
);

/* ─── Sidebar Coin List ───────────────────────────── */
const SIDEBAR_COINS = [
  { symbol: 'BTCUSDT', short: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETHUSDT', short: 'ETH', name: 'Ethereum' },
  { symbol: 'BNBUSDT', short: 'BNB', name: 'BNB' },
  { symbol: 'SOLUSDT', short: 'SOL', name: 'Solana' },
  { symbol: 'XRPUSDT', short: 'XRP', name: 'XRP' },
  { symbol: 'ADAUSDT', short: 'ADA', name: 'Cardano' },
  { symbol: 'DOGEUSDT', short: 'DOGE', name: 'Dogecoin' },
  { symbol: 'AVAXUSDT', short: 'AVAX', name: 'Avalanche' },
  { symbol: 'DOTUSDT', short: 'DOT', name: 'Polkadot' },
  { symbol: 'MATICUSDT', short: 'MATIC', name: 'Polygon' },
  { symbol: 'LTCUSDT', short: 'LTC', name: 'Litecoin' },
  { symbol: 'LINKUSDT', short: 'LINK', name: 'Chainlink' },
];

interface SidebarTickerData {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
}

function CoinSidebar({ currentSymbol }: { currentSymbol: string }) {
  const [tickers, setTickers] = useState<SidebarTickerData[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        const data = await res.json();
        const filtered = SIDEBAR_COINS.map(c =>
          data.find((d: any) => d.symbol === c.symbol) || { symbol: c.symbol, lastPrice: '0', priceChangePercent: '0' }
        );
        setTickers(filtered);
      } catch { }
    };
    fetch_();
    const iv = setInterval(fetch_, 5000);
    return () => clearInterval(iv);
  }, []);

  const filtered = SIDEBAR_COINS.filter(c =>
    c.short.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            placeholder="Tìm coin..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-border rounded-lg text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#f0b90b]/40"
          />
        </div>
      </div>
      <div className="flex text-xs text-gray-600 px-3 py-2 border-b border-border/50">
        <span className="flex-1">Đồng coin</span>
        <span className="w-20 text-right">Giá</span>
        <span className="w-14 text-right">24h</span>
      </div>
      <div className="overflow-y-auto flex-1">
        {filtered.map(coin => {
          const ticker = tickers.find(t => t.symbol === coin.symbol);
          const isPos = ticker ? parseFloat(ticker.priceChangePercent) >= 0 : true;
          const isCurrent = coin.symbol === currentSymbol;
          return (
            <Link key={coin.symbol} href={`/trading/${coin.symbol}`}>
              <div className={`flex items-center px-3 py-2.5 hover:bg-white/5 transition-colors border-b border-border/30 cursor-pointer ${isCurrent ? 'bg-[#f0b90b]/8 border-l-2 border-l-[#f0b90b]' : ''}`}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Star className={`w-3 h-3 flex-shrink-0 ${isCurrent ? 'text-[#f0b90b] fill-[#f0b90b]' : 'text-gray-700'}`} />
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-5 h-5 flex-shrink-0">
                      <Image src={getCoinLogo(coin.short)} alt={coin.short} width={20} height={20} className="object-contain" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${isCurrent ? 'text-[#f0b90b]' : 'text-white'}`}>{coin.short}</p>
                      <p className="text-[10px] text-gray-600 truncate">{coin.name}</p>
                    </div>
                  </div>
                </div>
                <div className="w-20 text-right">
                  <p className="text-xs font-mono text-gray-300">
                    {ticker ? parseFloat(ticker.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                  </p>
                </div>
                <div className="w-14 text-right">
                  <span className={`text-xs font-medium ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                    {ticker ? `${isPos ? '+' : ''}${parseFloat(ticker.priceChangePercent).toFixed(2)}%` : '—'}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Order Book ─────────────────────────────────── */
function OrderBook({ orderBook, currentPrice }: { orderBook: CoinDetailData['orderBook']; currentPrice: number }) {
  const maxAskQty = Math.max(...orderBook.asks.slice(0, 12).map(([, q]) => parseFloat(q)));
  const maxBidQty = Math.max(...orderBook.bids.slice(0, 12).map(([, q]) => parseFloat(q)));

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#f0b90b]" />
          Sổ lệnh
        </h3>
        <div className="flex items-center gap-1">
          {['0.01', '0.1', '1'].map(v => (
            <button key={v} className="px-2 py-0.5 text-[10px] text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors">{v}</button>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="flex text-[10px] text-gray-600 px-3 py-1.5 border-b border-border/50">
        <span className="flex-1">Giá (USDT)</span>
        <span className="w-20 text-right">Số lượng</span>
        <span className="w-20 text-right">Tổng</span>
      </div>

      {/* Asks */}
      <div className="relative">
        {orderBook.asks.slice(0, 12).reverse().map(([price, qty], i) => {
          const pct = (parseFloat(qty) / maxAskQty) * 100;
          return (
            <div key={i} className="relative flex px-3 py-0.5 hover:bg-red-500/5 transition-colors cursor-pointer">
              <div className="absolute right-0 top-0 h-full bg-red-500/8" style={{ width: `${pct}%` }} />
              <span className="flex-1 text-xs font-mono text-red-400">${parseFloat(price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span className="w-20 text-right text-xs font-mono text-gray-400">{parseFloat(qty).toFixed(4)}</span>
              <span className="w-20 text-right text-xs font-mono text-gray-600">
                {(parseFloat(price) * parseFloat(qty)).toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mid price */}
      <div className="py-2 px-3 border-y border-border bg-background">
        <p className="text-base font-bold font-mono text-white text-center">
          ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
        <p className="text-[10px] text-gray-600 text-center">Giá hiện tại</p>
      </div>

      {/* Bids */}
      <div className="relative">
        {orderBook.bids.slice(0, 12).map(([price, qty], i) => {
          const pct = (parseFloat(qty) / maxBidQty) * 100;
          return (
            <div key={i} className="relative flex px-3 py-0.5 hover:bg-emerald-500/5 transition-colors cursor-pointer">
              <div className="absolute right-0 top-0 h-full bg-emerald-500/8" style={{ width: `${pct}%` }} />
              <span className="flex-1 text-xs font-mono text-emerald-400">${parseFloat(price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span className="w-20 text-right text-xs font-mono text-gray-400">{parseFloat(qty).toFixed(4)}</span>
              <span className="w-20 text-right text-xs font-mono text-gray-600">
                {(parseFloat(price) * parseFloat(qty)).toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Recent Trades ──────────────────────────────── */
function RecentTrades({ trades }: { trades: CoinDetailData['recentTrades'] }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#f0b90b]" />
          Giao dịch gần đây
        </h3>
      </div>
      <div className="flex text-[10px] text-gray-600 px-3 py-1.5 border-b border-border/50">
        <span className="flex-1">Giá (USDT)</span>
        <span className="w-16 text-right">Số lượng</span>
        <span className="w-20 text-right">Thời gian</span>
      </div>
      <div className="overflow-y-auto max-h-80">
        {trades.map(trade => (
          <div key={trade.id} className="flex items-center px-3 py-1 hover:bg-white/3 transition-colors border-b border-border/30">
            <span className={`flex-1 text-xs font-mono ${trade.isBuyerMaker ? 'text-red-400' : 'text-emerald-400'}`}>
              ${parseFloat(trade.price).toFixed(2)}
            </span>
            <span className="w-16 text-right text-xs font-mono text-gray-500">{parseFloat(trade.qty).toFixed(4)}</span>
            <span className="w-20 text-right text-[10px] text-gray-600">
              {new Date(trade.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Suggested Products for Coin ────────────────── */
function RecommendedProducts({ symbol }: { symbol: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const addItem = useCartStore(s => s.addItem);
  const { t } = useTranslation('common');

  useEffect(() => {
    productService.list({ limit: 4 }).then(res => {
      setProducts(Array.isArray(res.products) ? res.products : []);
    }).catch(() => { });
  }, []);

  if (products.length === 0) return null;

  return (
    <div className="mt-8 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#f0b90b]/10 flex items-center justify-center">
          <ShoppingCart className="w-4 h-4 text-[#f0b90b]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Sản phẩm gợi ý</h2>
          <p className="text-xs text-muted-foreground">Mua ngay bằng {symbol.replace('USDT', '')} hoặc USDT</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {products.map((p, idx) => {
          const img = failed.has(p.product_id) ? '/placeholder-product.svg' : (p.metadata?.images?.[0] || '/placeholder-product.svg');
          return (
            <motion.div
              key={p.product_id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
            >
              <Link href={`/products/${p.product_id}`} className="block h-full">
                <div className="bg-card h-full flex flex-col border border-border rounded-xl overflow-hidden group hover:border-primary/30 transition-all">
                  <div className="relative h-40 bg-secondary/20 flex-shrink-0">
                    <Image
                      src={img}
                      alt={p.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                      unoptimized
                      onError={() => setFailed(pr => new Set(pr).add(p.product_id))}
                    />
                  </div>
                  <div className="p-3 flex flex-col flex-grow">
                    <h3 className="font-semibold text-sm text-foreground mb-1 line-clamp-1">{p.name}</h3>
                    <div className="mt-auto">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-primary">${Number(p.base_price_usd).toFixed(2)}</span>
                      </div>
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          addItem({ product_id: p.product_id, name: p.name, base_price_usd: Number(p.base_price_usd), metadata: p.metadata });
                          toast.success('Đã thêm');
                        }}
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs border-border hover:bg-primary/10 hover:text-primary gap-1"
                      >
                        <ShoppingCart className="w-3 h-3" />
                        Thêm vào giỏ
                      </Button>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────── */
export default function TradingPage() {
  const params = useParams();
  const symbol = (params.symbol as string).toUpperCase();
  const [coinData, setCoinData] = useState<CoinDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chart' | 'orderbook' | 'trades'>('chart');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetchCoinData();
    const interval = setInterval(fetchCoinData, 3000);

    // WebSocket
    wsRef.current = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@depth20@1000ms`);
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setCoinData(prev => prev ? ({
        ...prev,
        orderBook: {
          lastUpdateId: data.lastUpdateId,
          bids: data.bids,
          asks: data.asks,
        },
      }) : null);
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
      clearInterval(interval);
    };
  }, [symbol]);

  const fetchCoinData = async () => {
    try {
      const data = await getCoinDetail(symbol);
      setCoinData(data);
    } catch (error) {
      console.error('Error fetching coin data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-[#f0b90b] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 text-sm">Đang tải dữ liệu thị trường...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!coinData) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center text-gray-400">Không thể tải dữ liệu</div>
      </div>
    );
  }

  const ticker = coinData.ticker24hr;
  const coinName = symbol.replace('USDT', '');
  const isPositive = parseFloat(ticker.priceChangePercent) >= 0;
  const currentPrice = parseFloat(ticker.lastPrice);
  const priceChange = parseFloat(ticker.priceChange);
  const priceChangePercent = parseFloat(ticker.priceChangePercent);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Top info bar */}
      <div className="bg-card border-b border-border px-4 py-3">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-wrap items-center gap-4 md:gap-8">
            {/* Back + Coin name */}
            <div className="flex items-center gap-3">
              <Link href="/">
                <button className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/10 p-1">
                  <Image src={getCoinLogo(coinName)} alt={coinName} width={32} height={32} className="object-contain" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white">{coinName}</span>
                    <span className="text-gray-500">/</span>
                    <span className="text-gray-400 text-sm">USDT</span>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* Price */}
            <div>
              <p className="text-2xl font-bold font-mono text-white">
                {currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className={`text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPositive ? '+' : ''}{priceChange.toFixed(2)} ({isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%)
              </p>
            </div>

            {/* Stats */}
            <div className="hidden md:flex items-center gap-6 divide-x divide-white/8">
              {[
                { label: 'Cao 24h', value: `$${parseFloat(ticker.highPrice).toLocaleString()}`, color: 'text-emerald-400' },
                { label: 'Thấp 24h', value: `$${parseFloat(ticker.lowPrice).toLocaleString()}`, color: 'text-red-400' },
                { label: 'KL 24h', value: `${parseFloat(ticker.volume).toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 2 })} ${coinName}`, color: 'text-gray-300' },
                { label: 'KL USDT', value: `${parseFloat(ticker.quoteVolume).toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 2 })} USDT`, color: 'text-gray-300' },
                { label: 'Số giao dịch', value: ticker.count.toLocaleString(), color: 'text-gray-300' },
              ].map(s => (
                <div key={s.label} className="pl-6 first:pl-0">
                  <p className="text-[10px] text-gray-600 mb-0.5">{s.label}</p>
                  <p className={`text-sm font-mono font-semibold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="ml-auto flex items-center gap-2">
              <button onClick={fetchCoinData} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                <Share2 className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:yellow-400 transition-colors">
                <Star className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 max-w-[1600px] mx-auto w-full px-3 py-4">
        <div className="grid grid-cols-[200px,1fr,280px] gap-4 h-full" style={{ minHeight: 'calc(100vh - 220px)' }}>

          {/* Left: Coin sidebar */}
          <div className="hidden xl:flex flex-col">
            <CoinSidebar currentSymbol={symbol} />
          </div>

          {/* Center: Chart + order book */}
          <div className="flex flex-col gap-4 min-w-0">
            {/* Mobile stats */}
            <div className="md:hidden grid grid-cols-2 gap-2">
              {[
                { label: 'Cao 24h', value: `$${parseFloat(ticker.highPrice).toLocaleString()}`, color: 'text-emerald-400' },
                { label: 'Thấp 24h', value: `$${parseFloat(ticker.lowPrice).toLocaleString()}`, color: 'text-red-400' },
                { label: 'KL 24h', value: `${parseFloat(ticker.volume).toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 })} ${coinName}`, color: 'text-gray-300' },
                { label: 'Số GD', value: ticker.count.toLocaleString(undefined, { notation: 'compact' }), color: 'text-gray-300' },
              ].map(s => (
                <div key={s.label} className="bg-card border border-border rounded-xl p-3">
                  <p className="text-[10px] text-gray-600 mb-0.5">{s.label}</p>
                  <p className={`text-sm font-mono font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Chart container */}
            <div className="bg-card border border-border rounded-xl overflow-hidden flex-1">
              <div className="border-b border-border px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {['chart', 'orderbook', 'trades'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === tab ? 'bg-[#f0b90b]/15 text-[#f0b90b]' : 'text-gray-500 hover:text-white'}`}
                    >
                      {tab === 'chart' ? 'Biểu đồ' : tab === 'orderbook' ? 'Sổ lệnh' : 'Giao dịch'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block" />
                  Live
                </div>
              </div>

              {activeTab === 'chart' && (
                <div style={{ height: '65vh', minHeight: '400px' }}>
                  <CoinChart symbol={symbol} height="100%" />
                </div>
              )}
              {activeTab === 'orderbook' && (
                <div className="p-4">
                  <OrderBook orderBook={coinData.orderBook} currentPrice={currentPrice} />
                </div>
              )}
              {activeTab === 'trades' && (
                <div className="p-4">
                  <RecentTrades trades={coinData.recentTrades} />
                </div>
              )}
            </div>

            {/* Below chart: Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  icon: BarChart3, label: 'KL 24h (coin)', value: `${parseFloat(ticker.volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                  sub: `${coinName}`, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20',
                },
                {
                  icon: Activity, label: 'KL 24h (USDT)', value: `$${parseFloat(ticker.quoteVolume).toLocaleString(undefined, { maximumFractionDigits: 0, notation: 'compact' })}`,
                  sub: 'Tổng giá trị', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20',
                },
                {
                  icon: isPositive ? TrendingUp : TrendingDown,
                  label: 'Thay đổi 24h', value: `${isPositive ? '+' : ''}$${Math.abs(priceChange).toFixed(2)}`,
                  sub: `${isPositive ? '+' : ''}${priceChangePercent.toFixed(2)}%`, color: isPositive ? 'text-emerald-400' : 'text-red-400',
                  bg: isPositive ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20',
                },
                {
                  icon: Clock, label: 'Số lệnh 24h', value: ticker.count.toLocaleString(),
                  sub: 'Giao dịch', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20',
                },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`border rounded-xl p-4 ${stat.bg}`}
                >
                  <div className={`flex items-center gap-1.5 mb-2 ${stat.color}`}>
                    <stat.icon className="w-4 h-4" />
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                  <p className={`text-lg font-bold font-mono ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{stat.sub}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right: Order Book + Recent Trades */}
          <div className="hidden lg:flex flex-col gap-4">
            <OrderBook orderBook={coinData.orderBook} currentPrice={currentPrice} />
            <RecentTrades trades={coinData.recentTrades} />
          </div>
        </div>

        {/* Recommended Products */}
        <RecommendedProducts symbol={symbol} />
      </div>

      <Footer />
    </div>
  );
}
