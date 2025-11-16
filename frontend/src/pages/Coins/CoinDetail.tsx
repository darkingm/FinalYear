import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  FiTrendingUp, 
  FiTrendingDown, 
  FiArrowLeft,
  FiStar,
  FiBarChart2,
  FiActivity
} from 'react-icons/fi';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import CandlestickChart from '../../components/CandlestickChart';
import BuySellModal from '../../components/BuySellModal';
import PriceAlertModal from '../../components/PriceAlertModal';
import CoinTransferModal from '../../components/CoinTransferModal';

interface CoinDetail {
  coinId: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  priceChangePercentage24h: number;
  priceChangePercentage7d: number;
  priceChangePercentage30d: number;
  marketCap: number;
  marketCapRank: number;
  totalVolume: number;
  high24h: number;
  low24h: number;
  circulatingSupply: number;
  totalSupply: number;
  maxSupply: number;
  ath: number;
  athDate: string;
  atl: number;
  atlDate: string;
}

type TimeRange = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M' | '1y';

const CoinDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [coin, setCoin] = useState<CoinDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('1d');
  const [chartData, setChartData] = useState<any[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  const timeRanges: { value: TimeRange; label: string }[] = [
    { value: '1m', label: '1 Minute' },
    { value: '5m', label: '5 Minutes' },
    { value: '15m', label: '15 Minutes' },
    { value: '30m', label: '30 Minutes' },
    { value: '1h', label: '1 Hour' },
    { value: '4h', label: '4 Hours' },
    { value: '1d', label: '1 Day' },
    { value: '1w', label: '1 Week' },
    { value: '1M', label: '1 Month' },
    { value: '1y', label: '1 Year' },
  ];

  useEffect(() => {
    if (id) {
      fetchCoinDetail();
      fetchChartData();
    }
  }, [id, timeRange]);

  const fetchCoinDetail = async () => {
    try {
      const response = await axios.get(`/api/v1/coins/${id}`);
      setCoin(response.data.data);
    } catch (error) {
      console.error('Error fetching coin detail:', error);
      toast.error('Failed to fetch coin details');
    } finally {
      setLoading(false);
    }
  };

  const fetchChartData = async () => {
    try {
      const response = await axios.get(`/api/v1/coins/${id}/chart`, {
        params: { timeRange }
      });
      setChartData(response.data.data);
    } catch (error) {
      console.error('Error fetching chart data:', error);
      // Generate mock data for demonstration
      generateMockChartData();
    }
  };

  const generateMockChartData = () => {
    const now = Math.floor(Date.now() / 1000);
    const mockData = [];
    let basePrice = coin?.currentPrice || 50000;
    
    const intervals: Record<TimeRange, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
      '1w': 604800,
      '1M': 2592000,
      '1y': 31536000,
    };

    const dataPoints: Record<TimeRange, number> = {
      '1m': 60,
      '5m': 60,
      '15m': 96,
      '30m': 96,
      '1h': 168,
      '4h': 168,
      '1d': 90,
      '1w': 52,
      '1M': 12,
      '1y': 12,
    };

    const interval = intervals[timeRange];
    const points = dataPoints[timeRange];

    for (let i = points; i >= 0; i--) {
      const time = now - (i * interval);
      const volatility = basePrice * 0.02;
      const open = basePrice + (Math.random() - 0.5) * volatility;
      const close = open + (Math.random() - 0.5) * volatility;
      const high = Math.max(open, close) + Math.random() * volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * 0.5;

      mockData.push({
        time: time,
        open: open,
        high: high,
        low: low,
        close: close,
      });

      basePrice = close;
    }

    setChartData(mockData);
  };

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    toast.success(isFavorite ? 'Removed from favorites' : 'Added to favorites');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: price < 1 ? 6 : 2,
    }).format(price);
  };

  const formatNumber = (num: number) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!coin) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Coin not found
        </h2>
        <button
          onClick={() => navigate('/coins')}
          className="btn btn-primary"
        >
          Back to Coins
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/coins')}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-4"
          >
            <FiArrowLeft />
            <span>Back to Coins</span>
          </button>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img src={coin.image} alt={coin.name} className="w-16 h-16" />
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {coin.name}
                  </h1>
                  <span className="text-xl text-gray-500 dark:text-gray-400">
                    {coin.symbol.toUpperCase()}
                  </span>
                  <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-full text-sm font-medium">
                    Rank #{coin.marketCapRank}
                  </span>
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleFavorite}
              className={`p-3 rounded-full ${
                isFavorite
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              <FiStar className={isFavorite ? 'fill-current' : ''} />
            </motion.button>
          </div>
        </div>

        {/* Price Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mb-6 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Current Price
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatPrice(coin.currentPrice)}
              </div>
              <div className={`flex items-center space-x-1 mt-2 ${
                coin.priceChangePercentage24h >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {coin.priceChangePercentage24h >= 0 ? (
                  <FiTrendingUp className="w-5 h-5" />
                ) : (
                  <FiTrendingDown className="w-5 h-5" />
                )}
                <span className="font-semibold">
                  {coin.priceChangePercentage24h >= 0 ? '+' : ''}
                  {coin.priceChangePercentage24h.toFixed(2)}%
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  (24h)
                </span>
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Market Cap
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {formatNumber(coin.marketCap)}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                24h Volume
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {formatNumber(coin.totalVolume)}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                24h Range
              </div>
              <div className="text-sm text-gray-900 dark:text-white">
                <div>{formatPrice(coin.low24h)}</div>
                <div className="my-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full"
                    style={{
                      width: `${((coin.currentPrice - coin.low24h) / (coin.high24h - coin.low24h)) * 100}%`
                    }}
                  />
                </div>
                <div>{formatPrice(coin.high24h)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mb-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <FiBarChart2 />
              <span>Price Chart</span>
            </h2>

            {/* Time Range Selector */}
            <div className="flex flex-wrap gap-2">
              {timeRanges.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setTimeRange(range.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    timeRange === range.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Candlestick Chart */}
          <div className="h-[500px]">
            <CandlestickChart data={chartData} />
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Market Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
              <FiActivity />
              <span>Market Statistics</span>
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">7d Change</span>
                <span className={`font-semibold ${
                  coin.priceChangePercentage7d >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {coin.priceChangePercentage7d >= 0 ? '+' : ''}
                  {coin.priceChangePercentage7d?.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">30d Change</span>
                <span className={`font-semibold ${
                  coin.priceChangePercentage30d >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {coin.priceChangePercentage30d >= 0 ? '+' : ''}
                  {coin.priceChangePercentage30d?.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">All-Time High</span>
                <div className="text-right">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {formatPrice(coin.ath)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(coin.athDate).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">All-Time Low</span>
                <div className="text-right">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {formatPrice(coin.atl)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(coin.atlDate).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Supply Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Supply Information
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Circulating Supply</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {coin.circulatingSupply?.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Supply</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {coin.totalSupply?.toLocaleString() || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Max Supply</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {coin.maxSupply?.toLocaleString() || '∞'}
                </span>
              </div>
              {coin.maxSupply && (
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600 dark:text-gray-400 text-sm">Progress</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {((coin.circulatingSupply / coin.maxSupply) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full"
                      style={{
                        width: `${(coin.circulatingSupply / coin.maxSupply) * 100}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Trading Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button 
                onClick={() => setBuyModalOpen(true)}
                className="w-full btn btn-primary"
              >
                Buy {coin.symbol.toUpperCase()}
              </button>
              <button 
                onClick={() => setSellModalOpen(true)}
                className="w-full btn btn-secondary"
              >
                Sell {coin.symbol.toUpperCase()}
              </button>
              <button 
                onClick={() => setTransferModalOpen(true)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium transition-colors"
              >
                Transfer {coin.symbol.toUpperCase()}
              </button>
              <button 
                onClick={toggleFavorite}
                className="w-full btn btn-outline"
              >
                {isFavorite ? 'Remove from' : 'Add to'} Watchlist
              </button>
              <button 
                onClick={() => setAlertModalOpen(true)}
                className="w-full btn btn-outline"
              >
                Set Price Alert
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {coin && (
        <>
          <BuySellModal
            isOpen={buyModalOpen}
            onClose={() => setBuyModalOpen(false)}
            type="buy"
            coin={{
              symbol: coin.symbol,
              name: coin.name,
              currentPrice: coin.currentPrice,
              image: coin.image,
            }}
          />
          <BuySellModal
            isOpen={sellModalOpen}
            onClose={() => setSellModalOpen(false)}
            type="sell"
            coin={{
              symbol: coin.symbol,
              name: coin.name,
              currentPrice: coin.currentPrice,
              image: coin.image,
            }}
          />
          <PriceAlertModal
            isOpen={alertModalOpen}
            onClose={() => setAlertModalOpen(false)}
            coin={{
              symbol: coin.symbol,
              name: coin.name,
              currentPrice: coin.currentPrice,
              image: coin.image,
            }}
          />
          <CoinTransferModal
            isOpen={transferModalOpen}
            onClose={() => setTransferModalOpen(false)}
            coinSymbol={coin.symbol}
          />
        </>
      )}
    </div>
  );
};

export default CoinDetail;

