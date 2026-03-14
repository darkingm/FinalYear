'use client';

export const dynamic = 'force-dynamic';

import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import nextDynamic from 'next/dynamic';
import { getCoinDetail, CoinDetailData } from '@/lib/api/binance-detail';
import {
  TrendingUp, TrendingDown, Activity, BarChart3, Clock, ArrowLeft,
  Search, Star, RefreshCw, ChevronDown, Share2, BookOpen, ArrowUpDown,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { getCoinLogo } from '@/lib/utils/coin-logos';
import { getProductGallery } from '@/lib/utils/product-images';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { productService } from '@/services';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { ShoppingCart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Lazy load chart
const CoinChart = nextDynamic(
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
            className="w-full pl-8 pr-3 py-1.5 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-[#f0b90b]/40"
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
                      <p className={`text-xs font-bold truncate ${isCurrent ? 'text-[#f0b90b]' : 'text-foreground'}`}>{coin.short}</p>
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
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
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
        <p className="text-base font-bold font-mono text-foreground text-center">
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
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
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

/* ─── Spot Trading Panel ─────────────────────────── */
function SpotTradingPanel({ coinName, currentPrice }: { coinName: string; currentPrice: number }) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop-limit'>('market');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [sliderPercent, setSliderPercent] = useState(0);

  // Demo wallet balance
  const usdtBalance = 1250.00;
  const coinBalance = 0.0142;

  const total = orderType === 'market'
    ? (parseFloat(amount || '0') * currentPrice)
    : (parseFloat(amount || '0') * parseFloat(price || '0'));

  const handleSlider = (pct: number) => {
    setSliderPercent(pct);
    if (side === 'buy') {
      const maxSpend = usdtBalance * (pct / 100);
      const p = orderType === 'market' ? currentPrice : parseFloat(price || '0');
      if (p > 0) setAmount((maxSpend / p).toFixed(6));
    } else {
      setAmount((coinBalance * (pct / 100)).toFixed(6));
    }
  };

  const handleSubmit = () => {
    toast.success(`${side === 'buy' ? 'Mua' : 'Bán'} ${amount} ${coinName} ${orderType === 'market' ? 'theo giá thị trường' : `tại giá $${price}`}`);
    setAmount('');
    setSliderPercent(0);
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#f0b90b]" />
          Spot Trading
        </h3>
      </div>

      {/* Tab headers: Spot / Cross Margin / Isolated */}
      <div className="flex text-xs border-b border-border">
        {['Spot', 'Cross Margin', 'Isolated'].map((tab, i) => (
          <button
            key={tab}
            className={`flex-1 py-2 text-center transition-colors ${i === 0
              ? 'text-foreground font-bold border-b-2 border-[#f0b90b]'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Order type tabs */}
      <div className="flex px-3 pt-3 gap-2 text-xs">
        {(['limit', 'market', 'stop-limit'] as const).map(type => (
          <button
            key={type}
            onClick={() => setOrderType(type)}
            className={`px-2.5 py-1 rounded-md transition-all font-medium ${orderType === type
              ? 'bg-[#f0b90b]/15 text-[#f0b90b]'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            {type === 'limit' ? 'Giới hạn' : type === 'market' ? 'Thị trường' : 'Stop Limit'}
          </button>
        ))}
      </div>

      <div className="p-3">
        {/* Buy / Sell toggle */}
        <div className="flex gap-1 mb-3 bg-secondary rounded-lg p-1">
          <button
            onClick={() => setSide('buy')}
            className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${side === 'buy'
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            Mua {coinName}
          </button>
          <button
            onClick={() => setSide('sell')}
            className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${side === 'sell'
              ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            Bán {coinName}
          </button>
        </div>

        {/* Avail balance */}
        <div className="flex items-center justify-between mb-3 text-xs">
          <span className="text-muted-foreground">Số dư khả dụng</span>
          <span className="text-foreground font-mono font-semibold">
            {side === 'buy' ? `${usdtBalance.toFixed(2)} USDT` : `${coinBalance.toFixed(6)} ${coinName}`}
          </span>
        </div>

        {/* Price input (not for Market orders) */}
        {orderType !== 'market' && (
          <div className="mb-2">
            <label className="text-[10px] text-muted-foreground mb-1 block">Giá (USDT)</label>
            <div className="relative">
              <input
                type="number"
                placeholder={currentPrice.toFixed(2)}
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm font-mono text-foreground placeholder-muted-foreground focus:outline-none focus:border-[#f0b90b]/50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">USDT</span>
            </div>
          </div>
        )}

        {orderType === 'market' && (
          <div className="mb-2 px-3 py-2 bg-secondary/50 border border-border rounded-lg">
            <p className="text-xs text-muted-foreground">Giá thị trường</p>
            <p className="text-sm font-bold font-mono text-foreground">${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
        )}

        {/* Amount input */}
        <div className="mb-2">
          <label className="text-[10px] text-muted-foreground mb-1 block">Số lượng ({coinName})</label>
          <div className="relative">
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm font-mono text-foreground placeholder-muted-foreground focus:outline-none focus:border-[#f0b90b]/50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{coinName}</span>
          </div>
        </div>

        {/* Percentage slider */}
        <div className="flex gap-1 mb-3">
          {[25, 50, 75, 100].map(pct => (
            <button
              key={pct}
              onClick={() => handleSlider(pct)}
              className={`flex-1 py-1 text-[10px] font-medium rounded transition-all ${sliderPercent === pct
                ? (side === 'buy' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30')
                : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'
                }`}
            >
              {pct}%
            </button>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between mb-3 px-3 py-2 bg-secondary/50 border border-border rounded-lg">
          <span className="text-xs text-muted-foreground">Tổng</span>
          <span className="text-sm font-mono font-bold text-foreground">
            ≈ ${isNaN(total) ? '0.00' : total.toFixed(2)} USDT
          </span>
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!amount || parseFloat(amount) <= 0}
          className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${side === 'buy'
            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
            : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
            }`}
        >
          {side === 'buy' ? `Mua ${coinName}` : `Bán ${coinName}`}
        </button>

        {/* Fee info */}
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>Phí giao dịch: 0.1%</span>
          <span>Taker / Maker</span>
        </div>

        {/* Swap Coin Section */}
        <SwapCoinWidget coinName={coinName} currentPrice={currentPrice} />
      </div>
    </div>
  );
}

/* ─── Swap Coin Widget ───────────────────────────── */
function SwapCoinWidget({ coinName, currentPrice }: { coinName: string; currentPrice: number }) {
  const [swapFrom, setSwapFrom] = useState('USDT');
  const [swapTo, setSwapTo] = useState(coinName);
  const [swapAmount, setSwapAmount] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);

  const estimatedReceive = swapFrom === 'USDT'
    ? (parseFloat(swapAmount || '0') / currentPrice)
    : (parseFloat(swapAmount || '0') * currentPrice);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    setSwapFrom(swapTo);
    setSwapTo(swapFrom);
    setSwapAmount('');
  };

  const handleSwap = () => {
    if (!swapAmount || parseFloat(swapAmount) <= 0) return;
    toast.success(`Đã swap ${swapAmount} ${swapFrom} → ${estimatedReceive.toFixed(6)} ${swapTo}`);
    setSwapAmount('');
  };

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5 text-[#f0b90b]" />
          Swap nhanh
        </h4>
        <span className="text-[9px] text-muted-foreground">Rate: 1 {coinName} = ${currentPrice.toLocaleString()}</span>
      </div>

      {/* From */}
      <div className="mb-1">
        <label className="text-[9px] text-muted-foreground">Từ</label>
        <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-1.5">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Image src={getCoinLogo(swapFrom)} alt={swapFrom} width={16} height={16} className="object-contain" />
            <span className="text-xs font-bold text-foreground">{swapFrom}</span>
          </div>
          <input
            type="number"
            placeholder="0.00"
            value={swapAmount}
            onChange={e => setSwapAmount(e.target.value)}
            className="flex-1 text-right bg-transparent text-sm font-mono text-foreground placeholder-muted-foreground focus:outline-none"
          />
        </div>
      </div>

      {/* Flip button */}
      <div className="flex justify-center -my-1.5 relative z-10">
        <button
          onClick={handleFlip}
          className="w-7 h-7 rounded-full bg-[#f0b90b] text-black flex items-center justify-center shadow-md hover:shadow-lg hover:scale-110 transition-all"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* To */}
      <div className="mb-2">
        <label className="text-[9px] text-muted-foreground">Đến</label>
        <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-1.5">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Image src={getCoinLogo(swapTo)} alt={swapTo} width={16} height={16} className="object-contain" />
            <span className="text-xs font-bold text-foreground">{swapTo}</span>
          </div>
          <span className="flex-1 text-right text-sm font-mono text-muted-foreground">
            ≈ {isNaN(estimatedReceive) ? '0.00' : estimatedReceive.toFixed(6)}
          </span>
        </div>
      </div>

      <button
        onClick={handleSwap}
        disabled={!swapAmount || parseFloat(swapAmount) <= 0}
        className="w-full py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-[#f0b90b] to-[#e6a800] text-black shadow-md hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Swap {swapFrom} → {swapTo}
      </button>
    </div>
  );
}

/* ─── Full Spot Panel (Bottom, Binance-like) ─────── */
function FullSpotPanel({ coinName, currentPrice }: { coinName: string; currentPrice: number }) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop-limit'>('limit');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [sliderPct, setSliderPct] = useState(0);

  const usdtBal = 1250.00;
  const coinBal = 0.0142;
  const effectivePrice = orderType === 'market' ? currentPrice : parseFloat(price || '0');
  const total = parseFloat(amount || '0') * effectivePrice;
  const fee = total * 0.001;

  const handleSlider = (pct: number) => {
    setSliderPct(pct);
    if (side === 'buy' && effectivePrice > 0) {
      setAmount(((usdtBal * pct / 100) / effectivePrice).toFixed(6));
    } else {
      setAmount((coinBal * pct / 100).toFixed(6));
    }
  };

  return (
    <div className="p-4">
      {/* Order type tabs */}
      <div className="flex gap-2 mb-4">
        {(['limit', 'market', 'stop-limit'] as const).map(type => (
          <button
            key={type}
            onClick={() => setOrderType(type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${orderType === type
              ? 'bg-[#f0b90b]/15 text-[#f0b90b] font-bold'
              : 'text-muted-foreground hover:text-foreground bg-muted/50'
              }`}
          >
            {type === 'limit' ? 'Limit' : type === 'market' ? 'Market' : 'Stop Limit'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Buy side */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-emerald-500">Mua {coinName}</span>
            <span className="text-[10px] text-muted-foreground">Khả dụng: {usdtBal.toFixed(2)} USDT</span>
          </div>

          {orderType !== 'market' && (
            <div className="mb-2">
              <label className="text-[10px] text-muted-foreground mb-1 block">Giá (USDT)</label>
              <div className="relative">
                <input type="number" placeholder={currentPrice.toFixed(2)} value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm font-mono text-foreground placeholder-muted-foreground focus:outline-none focus:border-[#f0b90b]/50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">USDT</span>
              </div>
            </div>
          )}

          {orderType === 'market' && (
            <div className="mb-2 px-3 py-2 bg-secondary/50 border border-border rounded-lg">
              <p className="text-[10px] text-muted-foreground">Giá thị trường</p>
              <p className="text-sm font-bold font-mono text-foreground">${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          )}

          <div className="mb-2">
            <label className="text-[10px] text-muted-foreground mb-1 block">Số lượng ({coinName})</label>
            <div className="relative">
              <input type="number" placeholder="0.00" value={side === 'buy' ? amount : ''}
                onChange={e => { setSide('buy'); setAmount(e.target.value); }}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm font-mono text-foreground placeholder-muted-foreground focus:outline-none focus:border-emerald-500/50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{coinName}</span>
            </div>
          </div>

          <div className="flex gap-1 mb-3">
            {[25, 50, 75, 100].map(pct => (
              <button key={pct} onClick={() => { setSide('buy'); handleSlider(pct); }}
                className={`flex-1 py-1 text-[10px] font-medium rounded transition-all ${sliderPct === pct && side === 'buy'
                  ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                  : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'}`}
              >{pct}%</button>
            ))}
          </div>

          <div className="flex justify-between text-[10px] text-muted-foreground mb-2">
            <span>Tổng ≈</span>
            <span className="font-mono">{isNaN(total) || side !== 'buy' ? '0.00' : total.toFixed(2)} USDT</span>
          </div>

          <button
            className="w-full py-2.5 rounded-lg text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40"
            disabled={!amount || parseFloat(amount) <= 0 || side !== 'buy'}
            onClick={() => { toast.success(`Đặt lệnh mua ${amount} ${coinName} thành công!`); setAmount(''); setSliderPct(0); }}
          >
            Mua {coinName}
          </button>
        </div>

        {/* Sell side */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-red-500">Bán {coinName}</span>
            <span className="text-[10px] text-muted-foreground">Khả dụng: {coinBal.toFixed(6)} {coinName}</span>
          </div>

          {orderType !== 'market' && (
            <div className="mb-2">
              <label className="text-[10px] text-muted-foreground mb-1 block">Giá (USDT)</label>
              <div className="relative">
                <input type="number" placeholder={currentPrice.toFixed(2)} value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm font-mono text-foreground placeholder-muted-foreground focus:outline-none focus:border-[#f0b90b]/50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">USDT</span>
              </div>
            </div>
          )}

          {orderType === 'market' && (
            <div className="mb-2 px-3 py-2 bg-secondary/50 border border-border rounded-lg">
              <p className="text-[10px] text-muted-foreground">Giá thị trường</p>
              <p className="text-sm font-bold font-mono text-foreground">${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          )}

          <div className="mb-2">
            <label className="text-[10px] text-muted-foreground mb-1 block">Số lượng ({coinName})</label>
            <div className="relative">
              <input type="number" placeholder="0.00" value={side === 'sell' ? amount : ''}
                onChange={e => { setSide('sell'); setAmount(e.target.value); }}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm font-mono text-foreground placeholder-muted-foreground focus:outline-none focus:border-red-500/50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{coinName}</span>
            </div>
          </div>

          <div className="flex gap-1 mb-3">
            {[25, 50, 75, 100].map(pct => (
              <button key={pct} onClick={() => { setSide('sell'); handleSlider(pct); }}
                className={`flex-1 py-1 text-[10px] font-medium rounded transition-all ${sliderPct === pct && side === 'sell'
                  ? 'bg-red-500/20 text-red-500 border border-red-500/30'
                  : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'}`}
              >{pct}%</button>
            ))}
          </div>

          <div className="flex justify-between text-[10px] text-muted-foreground mb-2">
            <span>Nhận ≈</span>
            <span className="font-mono">{isNaN(total) || side !== 'sell' ? '0.00' : total.toFixed(2)} USDT</span>
          </div>

          <button
            className="w-full py-2.5 rounded-lg text-sm font-bold bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all disabled:opacity-40"
            disabled={!amount || parseFloat(amount) <= 0 || side !== 'sell'}
            onClick={() => { toast.success(`Đặt lệnh bán ${amount} ${coinName} thành công!`); setAmount(''); setSliderPct(0); }}
          >
            Bán {coinName}
          </button>
        </div>
      </div>

      {/* Fee info */}
      <div className="mt-3 pt-3 border-t border-border flex justify-between text-[10px] text-muted-foreground">
        <span>Phí Maker / Taker: 0.1%</span>
        <span>Phí ước tính: ~${isNaN(fee) ? '0.00' : fee.toFixed(4)} USDT</span>
      </div>
    </div>
  );
}

/* ─── Full Swap Panel (Bottom, Binance Convert style) ─── */
function FullSwapPanel({ coinName, currentPrice }: { coinName: string; currentPrice: number }) {
  const SWAP_COINS = ['USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'SOL', 'MATIC', coinName].filter((v, i, a) => a.indexOf(v) === i);

  const [fromCoin, setFromCoin] = useState('USDT');
  const [toCoin, setToCoin] = useState(coinName);
  const [fromAmount, setFromAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);

  // Simple rate calculation
  const getRate = (from: string, to: string) => {
    if (from === 'USDT' && to === coinName) return 1 / currentPrice;
    if (from === coinName && to === 'USDT') return currentPrice;
    if (from === 'USDT' && to === 'USDT') return 1;
    return 1 / currentPrice; // simplified
  };

  const rate = getRate(fromCoin, toCoin);
  const toAmount = parseFloat(fromAmount || '0') * rate;
  const minReceived = toAmount * (1 - slippage / 100);

  const handleFlip = () => {
    const tmp = fromCoin;
    setFromCoin(toCoin);
    setToCoin(tmp);
    setFromAmount('');
  };

  return (
    <div className="p-4">
      {/* From */}
      <div className="mb-1">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-muted-foreground">Từ</label>
          <span className="text-[10px] text-muted-foreground">Số dư: 1,250.00</span>
        </div>
        <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-4 py-3">
          <select
            value={fromCoin}
            onChange={e => setFromCoin(e.target.value)}
            className="bg-transparent text-sm font-bold text-foreground focus:outline-none cursor-pointer appearance-none pr-4"
            style={{ backgroundImage: 'none' }}
          >
            {SWAP_COINS.map(c => <option key={c} value={c} className="bg-card text-foreground">{c}</option>)}
          </select>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Image src={getCoinLogo(fromCoin)} alt={fromCoin} width={24} height={24} className="object-contain" />
          </div>
          <input
            type="number"
            placeholder="0.00"
            value={fromAmount}
            onChange={e => setFromAmount(e.target.value)}
            className="flex-1 text-right bg-transparent text-lg font-mono font-bold text-foreground placeholder-muted-foreground focus:outline-none"
          />
        </div>
      </div>

      {/* Flip */}
      <div className="flex justify-center -my-2 relative z-10">
        <button
          onClick={handleFlip}
          className="w-9 h-9 rounded-full bg-[#f0b90b] text-black flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 transition-all"
        >
          <ArrowUpDown className="w-4 h-4" />
        </button>
      </div>

      {/* To */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-muted-foreground">Đến (ước tính)</label>
        </div>
        <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-4 py-3">
          <select
            value={toCoin}
            onChange={e => setToCoin(e.target.value)}
            className="bg-transparent text-sm font-bold text-foreground focus:outline-none cursor-pointer appearance-none pr-4"
            style={{ backgroundImage: 'none' }}
          >
            {SWAP_COINS.filter(c => c !== fromCoin).map(c => <option key={c} value={c} className="bg-card text-foreground">{c}</option>)}
          </select>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Image src={getCoinLogo(toCoin)} alt={toCoin} width={24} height={24} className="object-contain" />
          </div>
          <span className="flex-1 text-right text-lg font-mono font-bold text-muted-foreground">
            ≈ {isNaN(toAmount) ? '0.00' : toAmount.toFixed(6)}
          </span>
        </div>
      </div>

      {/* Swap details */}
      <div className="bg-muted/50 rounded-xl p-3 mb-4 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tỷ giá</span>
          <span className="font-mono text-foreground">1 {fromCoin} = {rate.toFixed(6)} {toCoin}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Slippage</span>
          <div className="flex gap-1">
            {[0.1, 0.5, 1.0].map(s => (
              <button key={s} onClick={() => setSlippage(s)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${slippage === s
                  ? 'bg-[#f0b90b]/15 text-[#f0b90b]'
                  : 'bg-secondary text-muted-foreground'}`}
              >{s}%</button>
            ))}
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Nhận tối thiểu</span>
          <span className="font-mono text-foreground">{isNaN(minReceived) ? '0' : minReceived.toFixed(6)} {toCoin}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Phí</span>
          <span className="font-mono text-emerald-500">Miễn phí</span>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={() => {
          if (!fromAmount || parseFloat(fromAmount) <= 0) return;
          toast.success(`Đã swap ${fromAmount} ${fromCoin} → ${toAmount.toFixed(6)} ${toCoin}`);
          setFromAmount('');
        }}
        disabled={!fromAmount || parseFloat(fromAmount) <= 0}
        className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-[#f0b90b] to-[#e6a800] text-black shadow-lg hover:shadow-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Swap {fromCoin} → {toCoin}
      </button>
    </div>
  );
}

/* ─── Suggested Products for Coin ────────────────── */
function RecommendedProducts({ symbol }: { symbol: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const addItem = useCartStore(s => s.addItem);
  const { t } = useTranslation();

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
          const galleryImages = getProductGallery(p.name, p.metadata?.category, p.metadata?.images);
          const img = failed.has(p.product_id) ? '/placeholder-product.svg' : (galleryImages[0] || '/placeholder-product.svg');
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
                    <span className="font-bold text-foreground">{coinName}</span>
                    <span className="text-gray-500">/</span>
                    <span className="text-gray-400 text-sm">USDT</span>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* Price */}
            <div>
              <p className="text-2xl font-bold font-mono text-foreground">
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
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                  <p className={`text-lg font-bold font-mono ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
                </motion.div>
              ))}
            </div>

            {/* ── Full-width Spot + Swap Section (below chart, all screens) ── */}
            <div className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Spot Trading Section (Binance-like) */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-[#f0b90b]" />
                      Spot Trading
                    </h3>
                    <div className="flex gap-1 text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-[#f0b90b]/15 text-[#f0b90b] font-bold">Spot</span>
                      <span className="px-2 py-0.5 rounded text-muted-foreground">Margin</span>
                    </div>
                  </div>

                  <FullSpotPanel coinName={coinName} currentPrice={currentPrice} />
                </div>

                {/* Swap Section (Binance-like) */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-[#f0b90b]" />
                      Swap & Convert
                    </h3>
                    <span className="text-[10px] text-muted-foreground">Phí 0% | Tốc độ ngay lập tức</span>
                  </div>

                  <FullSwapPanel coinName={coinName} currentPrice={currentPrice} />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Spot Trading + Order Book + Recent Trades */}
          <div className="hidden lg:flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            <SpotTradingPanel coinName={coinName} currentPrice={currentPrice} />
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
