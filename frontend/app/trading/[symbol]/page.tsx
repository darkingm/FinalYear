'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { getCoinDetail, CoinDetailData } from '@/lib/api/binance-detail';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, Clock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

// Lazy load chart
const CoinChart = dynamic(
  () => import('@/components/charts/CoinChart').then((mod) => mod.CoinChart),
  { 
    loading: () => <div className="w-full h-full bg-gray-200 dark:bg-gray-800 animate-pulse rounded-lg" />,
    ssr: false 
  }
);

export default function TradingPage() {
  const params = useParams();
  const symbol = (params.symbol as string).toUpperCase();
  const [coinData, setCoinData] = useState<CoinDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCoinData();
    
    // WebSocket for real-time order book
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@depth20@1000ms`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (coinData) {
        setCoinData({
          ...coinData,
          orderBook: {
            lastUpdateId: data.lastUpdateId,
            bids: data.bids,
            asks: data.asks,
          },
        });
      }
    };

    const interval = setInterval(fetchCoinData, 2000); // Update ticker every 2s
    
    return () => {
      ws.close();
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!coinData) {
    return <div className="min-h-screen flex items-center justify-center">Failed to load data</div>;
  }

  const ticker = coinData.ticker24hr;
  const coinName = symbol.replace('USDT', '');
  const isPositive = parseFloat(ticker.priceChangePercent) >= 0;
  const currentPrice = parseFloat(ticker.lastPrice);
  const priceChange = parseFloat(ticker.priceChange);
  const priceChangePercent = parseFloat(ticker.priceChangePercent);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="mb-6">
          <Link href="/">
            <Button variant="outline" size="lg">← Back to Home</Button>
          </Link>
        </div>

        {/* Coin Header - Enhanced */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-xl p-8 mb-6 text-white"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-lg flex items-center justify-center text-3xl font-bold">
                  {coinName.charAt(0)}
                </div>
                <div>
                  <h1 className="text-4xl font-bold">{coinName}</h1>
                  <p className="text-white/80 text-lg">{symbol}</p>
                </div>
              </div>
              
              <div className="flex items-baseline gap-4">
                <span className="text-5xl font-bold">
                  ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                </span>
                <span
                  className={`flex items-center gap-2 text-2xl font-semibold px-4 py-2 rounded-lg ${
                    isPositive ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}
                >
                  {isPositive ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                  {isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%
                  <span className="text-lg">
                    ({isPositive ? '+' : ''}${priceChange.toFixed(2)})
                  </span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
                <p className="text-white/70 text-sm mb-1">24h High</p>
                <p className="text-2xl font-bold">${parseFloat(ticker.highPrice).toLocaleString()}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
                <p className="text-white/70 text-sm mb-1">24h Low</p>
                <p className="text-2xl font-bold">${parseFloat(ticker.lowPrice).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
          >
            <div className="flex items-center gap-2 text-blue-500 mb-2">
              <BarChart3 className="w-5 h-5" />
              <p className="text-sm text-gray-500">24h Volume</p>
            </div>
            <p className="text-2xl font-bold">{parseFloat(ticker.volume).toLocaleString()} {coinName}</p>
            <p className="text-sm text-gray-500 mt-1">
              ≈ ${parseFloat(ticker.quoteVolume).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
          >
            <div className="flex items-center gap-2 text-purple-500 mb-2">
              <Activity className="w-5 h-5" />
              <p className="text-sm text-gray-500">Price Change</p>
            </div>
            <p className={`text-2xl font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? '+' : ''}${Math.abs(priceChange).toFixed(2)}
            </p>
            <p className="text-sm text-gray-500 mt-1">Last 24 hours</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
          >
            <div className="flex items-center gap-2 text-green-500 mb-2">
              <DollarSign className="w-5 h-5" />
              <p className="text-sm text-gray-500">Weighted Avg</p>
            </div>
            <p className="text-2xl font-bold">${parseFloat(ticker.weightedAvgPrice).toFixed(2)}</p>
            <p className="text-sm text-gray-500 mt-1">24h average</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
          >
            <div className="flex items-center gap-2 text-orange-500 mb-2">
              <Clock className="w-5 h-5" />
              <p className="text-sm text-gray-500">Trades</p>
            </div>
            <p className="text-2xl font-bold">{ticker.count.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-1">Last 24 hours</p>
          </motion.div>
        </div>

        {/* TradingView Chart - Full Width */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
          <h2 className="text-xl font-bold mb-4">Price Chart</h2>
          <div className="h-[70vh]">
            <CoinChart symbol={symbol} height="100%" />
          </div>
        </div>

        {/* Order Book (left) & Recent Trades (right, vertical) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-6 items-start">
          {/* Order Book - Left */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold mb-4">Order Book</h3>
            {/* Asks (Sell Orders) */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">ASKS (Sell)</p>
              <div className="space-y-1">
                {coinData.orderBook.asks.slice(0, 10).reverse().map(([price, qty], i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-red-500 font-mono">${parseFloat(price).toFixed(2)}</span>
                    <span className="text-gray-500 font-mono">{parseFloat(qty).toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Current Price */}
            <div className="py-3 border-y border-gray-200 dark:border-gray-700 mb-4">
              <p className="text-center text-xl font-bold">${currentPrice.toFixed(2)}</p>
              <p className="text-center text-xs text-gray-500">Current Price</p>
            </div>
            {/* Bids (Buy Orders) */}
            <div>
              <p className="text-xs text-gray-500 mb-2">BIDS (Buy)</p>
              <div className="space-y-1">
                {coinData.orderBook.bids.slice(0, 10).map(([price, qty], i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-green-500 font-mono">${parseFloat(price).toFixed(2)}</span>
                    <span className="text-gray-500 font-mono">{parseFloat(qty).toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Recent Trades - Right column, vertical */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 lg:sticky lg:top-24">
            <h3 className="text-lg font-bold mb-4">Recent Trades</h3>
            <div className="space-y-2 max-h-[28rem] overflow-y-auto">
              {coinData.recentTrades.map((trade) => (
                <div key={trade.id} className="flex justify-between items-center text-sm py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <span className={`font-mono ${trade.isBuyerMaker ? 'text-red-500' : 'text-green-500'}`}>
                    ${parseFloat(trade.price).toFixed(2)}
                  </span>
                  <span className="text-gray-500 font-mono">{parseFloat(trade.qty).toFixed(4)}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(trade.time).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
