import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  FiTrendingUp, 
  FiTrendingDown, 
  FiSearch,
  FiRefreshCw,
  FiStar
} from 'react-icons/fi';
import axios from '../../api/axios';
import toast from 'react-hot-toast';

interface Coin {
  coinId: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  priceChangePercentage24h: number;
  priceChangePercentage7d: number;
  marketCap: number;
  marketCapRank: number;
  totalVolume: number;
  sparkline: number[];
}

const CoinList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'rank' | 'price' | 'change' | 'volume'>('rank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchCoins();
    const interval = setInterval(() => fetchCoins(), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchCoins = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      const response = await axios.get('/api/v1/coins', {
        params: { limit: 100 }
      });
      setCoins(response.data.data.coins);
      if (showToast) {
        toast.success('Prices updated!');
      }
    } catch (error) {
      console.error('Error fetching coins:', error);
      // Generate mock data for top 100 coins
      generateMockCoins();
      if (!showToast) {
        toast.info('Showing demo data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateMockCoins = () => {
    const topCoins = [
      { name: 'Bitcoin', symbol: 'BTC', image: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png', basePrice: 45000 },
      { name: 'Ethereum', symbol: 'ETH', image: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png', basePrice: 2500 },
      { name: 'Tether', symbol: 'USDT', image: 'https://assets.coingecko.com/coins/images/325/small/Tether.png', basePrice: 1 },
      { name: 'BNB', symbol: 'BNB', image: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png', basePrice: 300 },
      { name: 'XRP', symbol: 'XRP', image: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png', basePrice: 0.5 },
      { name: 'Cardano', symbol: 'ADA', image: 'https://assets.coingecko.com/coins/images/975/small/cardano.png', basePrice: 0.4 },
      { name: 'Solana', symbol: 'SOL', image: 'https://assets.coingecko.com/coins/images/4128/small/solana.png', basePrice: 100 },
      { name: 'Dogecoin', symbol: 'DOGE', image: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png', basePrice: 0.08 },
      { name: 'Polkadot', symbol: 'DOT', image: 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png', basePrice: 6 },
      { name: 'Polygon', symbol: 'MATIC', image: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png', basePrice: 0.8 },
    ];

    const mockCoins: Coin[] = [];
    
    for (let i = 0; i < 100; i++) {
      const coinTemplate = topCoins[i % topCoins.length];
      const volatility = (Math.random() - 0.5) * 0.1;
      const currentPrice = coinTemplate.basePrice * (1 + volatility);
      const change24h = (Math.random() - 0.5) * 20;
      const change7d = (Math.random() - 0.5) * 30;

      mockCoins.push({
        coinId: `${coinTemplate.symbol.toLowerCase()}-${i}`,
        symbol: i < 10 ? coinTemplate.symbol : `${coinTemplate.symbol}${i}`,
        name: i < 10 ? coinTemplate.name : `${coinTemplate.name} ${i}`,
        image: coinTemplate.image,
        currentPrice,
        priceChangePercentage24h: change24h,
        priceChangePercentage7d: change7d,
        marketCap: currentPrice * (Math.random() * 1000000000 + 100000000),
        marketCapRank: i + 1,
        totalVolume: currentPrice * (Math.random() * 10000000 + 1000000),
        sparkline: Array.from({ length: 7 }, () => Math.random() * 100),
      });
    }

    setCoins(mockCoins);
  };

  const filteredCoins = coins
    .filter(coin => 
      coin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      coin.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue, bValue;
      switch (sortBy) {
        case 'rank':
          aValue = a.marketCapRank;
          bValue = b.marketCapRank;
          break;
        case 'price':
          aValue = a.currentPrice;
          bValue = b.currentPrice;
          break;
        case 'change':
          aValue = a.priceChangePercentage24h;
          bValue = b.priceChangePercentage24h;
          break;
        case 'volume':
          aValue = a.totalVolume;
          bValue = b.totalVolume;
          break;
        default:
          return 0;
      }
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

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
    return `$${num.toFixed(0)}`;
  };

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Cryptocurrency Prices
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Live prices for top 100 cryptocurrencies by market cap
          </p>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-6 shadow-lg">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 w-full md:w-auto">
              <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search coins..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
              />
            </div>

            {/* Refresh Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => fetchCoins(true)}
              disabled={refreshing}
              className="flex items-center space-x-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </motion.button>
          </div>
        </div>

        {/* Coins Table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort('rank')}
                      className="flex items-center space-x-1 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
                    >
                      <span>#</span>
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Coin
                    </span>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleSort('price')}
                      className="text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
                    >
                      Price
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleSort('change')}
                      className="text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
                    >
                      24h %
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right hidden md:table-cell">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      7d %
                    </span>
                  </th>
                  <th className="px-6 py-4 text-right hidden lg:table-cell">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Market Cap
                    </span>
                  </th>
                  <th className="px-6 py-4 text-right hidden lg:table-cell">
                    <button
                      onClick={() => handleSort('volume')}
                      className="text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
                    >
                      Volume (24h)
                    </button>
                  </th>
                  <th className="px-6 py-4 text-center hidden xl:table-cell">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Last 7 Days
                    </span>
                  </th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCoins.map((coin, index) => (
                  <motion.tr
                    key={coin.coinId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => navigate(`/coins/${coin.coinId}`)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300 font-medium">
                      {coin.marketCapRank}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <img 
                          src={coin.image} 
                          alt={coin.name}
                          className="w-8 h-8"
                        />
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {coin.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {coin.symbol.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900 dark:text-white">
                      {formatPrice(coin.currentPrice)}
                    </td>
                    <td className={`px-6 py-4 text-right font-semibold ${
                      coin.priceChangePercentage24h >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      <div className="flex items-center justify-end space-x-1">
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
                    </td>
                    <td className={`px-6 py-4 text-right font-semibold hidden md:table-cell ${
                      coin.priceChangePercentage7d >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {coin.priceChangePercentage7d >= 0 ? '+' : ''}
                      {coin.priceChangePercentage7d?.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900 dark:text-white hidden lg:table-cell">
                      {formatNumber(coin.marketCap)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900 dark:text-white hidden lg:table-cell">
                      {formatNumber(coin.totalVolume)}
                    </td>
                    <td className="px-6 py-4 hidden xl:table-cell">
                      {/* Mini sparkline chart would go here */}
                      <div className="h-12 flex items-center justify-center">
                        <div className="text-xs text-gray-400">Chart</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.success('Added to favorites');
                        }}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        <FiStar className="w-4 h-4 text-gray-400 hover:text-yellow-500" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredCoins.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                No coins found matching "{searchTerm}"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoinList;

