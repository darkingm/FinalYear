import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiTrendingUp, FiTrendingDown, FiRefreshCw } from 'react-icons/fi';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';

interface Coin {
  coinId: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  priceChangePercentage24h: number;
  marketCap: number;
  marketCapRank: number;
  totalVolume: number;
}

const TopCoins = () => {
  const { t } = useTranslation();
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCoins = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      const response = await axios.get('/api/v1/coins/top10');
      setCoins(response.data.data.coins);
      if (showToast) {
        toast.success('Prices updated!');
      }
    } catch (error) {
      console.error('Error fetching coins:', error);
      toast.error('Failed to fetch coin prices');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCoins();
    // Auto refresh every 60 seconds
    const interval = setInterval(() => fetchCoins(), 60000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: price < 1 ? 6 : 2,
    }).format(price);
  };

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`;
    return `$${marketCap.toFixed(0)}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div>
      {/* Section Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2"
          >
            {t('home.top_coins')}
          </motion.h2>
          <p className="text-gray-600 dark:text-gray-400">
            Live prices updated every minute
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => fetchCoins(true)}
          disabled={refreshing}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </motion.button>
      </div>

      {/* Coins Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {coins.map((coin, index) => (
          <motion.div
            key={coin.coinId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -4, scale: 1.02 }}
            className="bg-white dark:bg-gray-700 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all cursor-pointer border border-gray-200 dark:border-gray-600"
          >
            {/* Rank Badge */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center space-x-3">
                <img 
                  src={coin.image} 
                  alt={coin.name}
                  className="w-10 h-10"
                />
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    {coin.symbol.toUpperCase()}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {coin.name}
                  </p>
                </div>
              </div>
              <span className="bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-bold px-2 py-1 rounded">
                #{coin.marketCapRank}
              </span>
            </div>

            {/* Price */}
            <div className="mb-2">
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {formatPrice(coin.currentPrice)}
              </div>
            </div>

            {/* Price Change */}
            <div className={`flex items-center space-x-1 text-sm font-medium ${
              coin.priceChangePercentage24h >= 0 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {coin.priceChangePercentage24h >= 0 ? (
                <FiTrendingUp className="w-4 h-4" />
              ) : (
                <FiTrendingDown className="w-4 h-4" />
              )}
              <span>
                {coin.priceChangePercentage24h >= 0 ? '+' : ''}
                {coin.priceChangePercentage24h.toFixed(2)}%
              </span>
            </div>

            {/* Market Cap */}
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Market Cap
              </div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {formatMarketCap(coin.marketCap)}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* View All Link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center mt-8"
      >
        <a
          href="/coins"
          className="inline-flex items-center space-x-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
        >
          <span>{t('home.view_all')}</span>
          <FiTrendingUp className="w-4 h-4" />
        </a>
      </motion.div>
    </div>
  );
};

export default TopCoins;

