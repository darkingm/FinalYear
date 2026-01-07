import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';
import { FiArrowRight, FiRefreshCw, FiTrendingUp, FiTrendingDown, FiInfo } from 'react-icons/fi';

interface Coin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  priceChangePercentage24h: number;
}

const Swap = () => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const [loading, setLoading] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [topCoins, setTopCoins] = useState<Coin[]>([]);
  const [quote, setQuote] = useState<any>(null);
  const [formData, setFormData] = useState({
    networkId: 'ethereum_mainnet',
    fromToken: 'native',
    toToken: 'native',
    fromAmount: '',
    slippage: 1,
  });

  // Fetch top coins for selection
  useEffect(() => {
    fetchTopCoins();
  }, []);

  // Fetch quote when amount or tokens change
  useEffect(() => {
    if (formData.fromAmount && parseFloat(formData.fromAmount) > 0) {
      const timeoutId = setTimeout(() => {
        fetchQuote();
      }, 500); // Debounce 500ms
      return () => clearTimeout(timeoutId);
    } else {
      setQuote(null);
    }
  }, [formData.fromAmount, formData.fromToken, formData.toToken, formData.networkId]);

  const fetchTopCoins = async () => {
    try {
      const response = await axios.get('/api/v1/coins/top10');
      if (response.data?.success && response.data.data?.coins) {
        setTopCoins(response.data.data.coins);
      }
    } catch (error) {
      console.error('Error fetching top coins:', error);
    }
  };

  const fetchQuote = async () => {
    if (!formData.fromAmount || parseFloat(formData.fromAmount) <= 0) {
      return;
    }

    try {
      setLoadingQuote(true);
      const response = await axios.get('/api/swaps/quote', {
        params: {
          networkId: formData.networkId,
          fromToken: formData.fromToken,
          toToken: formData.toToken,
          amount: formData.fromAmount,
        },
      });

      if (response.data.success) {
        setQuote(response.data.data);
      }
    } catch (error: any) {
      console.error('Error fetching quote:', error);
      setQuote(null);
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !user) {
      toast.error('Vui lòng đăng nhập để thực hiện swap');
      return;
    }

    if (!formData.fromAmount || parseFloat(formData.fromAmount) <= 0) {
      toast.error('Vui lòng nhập số lượng');
      return;
    }

    if (!quote) {
      toast.error('Đang lấy báo giá, vui lòng đợi...');
      return;
    }

    setLoading(true);
    try {
      // Get wallet address for network
      const walletResponse = await axios.get(`/api/wallets/user/${user.id}`);
      if (!walletResponse.data.success) {
        throw new Error('Không tìm thấy ví');
      }

      const wallet = walletResponse.data.data;
      const walletAddress = wallet.addresses?.find(
        (addr: any) => addr.networkId === formData.networkId
      )?.address;

      if (!walletAddress) {
        throw new Error('Chưa tạo ví cho network này');
      }

      const response = await axios.post('/api/swaps', {
        userId: user.id,
        networkId: formData.networkId,
        fromAddress: walletAddress,
        fromToken: formData.fromToken,
        toToken: formData.toToken,
        amount: formData.fromAmount,
        slippage: formData.slippage,
      });

      if (response.data.success) {
        toast.success('Swap đã được thực hiện thành công!');
        setFormData({
          ...formData,
          fromAmount: '',
        });
        setQuote(null);
      }
    } catch (error: any) {
      console.error('Swap error:', error);
      toast.error(error.response?.data?.error || 'Swap thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchTokens = () => {
    setFormData({
      ...formData,
      fromToken: formData.toToken,
      toToken: formData.fromToken,
    });
    setQuote(null);
  };

  const getTokenSymbol = (token: string) => {
    if (token === 'native') {
      const network = formData.networkId;
      if (network.includes('ethereum')) return 'ETH';
      if (network.includes('bsc')) return 'BNB';
      if (network.includes('polygon')) return 'MATIC';
      if (network.includes('avalanche')) return 'AVAX';
      return 'ETH';
    }
    return token.toUpperCase();
  };

  const getTokenImage = (token: string) => {
    if (token === 'native') {
      return 'https://cryptologos.cc/logos/ethereum-eth-logo.png';
    }
    const coin = topCoins.find((c) => c.symbol.toUpperCase() === token.toUpperCase());
    return coin?.image || 'https://via.placeholder.com/32';
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          Vui lòng đăng nhập để sử dụng tính năng swap
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Swap Coin</h2>
          <button
            onClick={fetchQuote}
            disabled={loadingQuote || !formData.fromAmount}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <FiRefreshCw className={`w-5 h-5 ${loadingQuote ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <form onSubmit={handleSwap} className="space-y-4">
          {/* Network Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Network
            </label>
            <select
              value={formData.networkId}
              onChange={(e) => {
                setFormData({ ...formData, networkId: e.target.value });
                setQuote(null);
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="ethereum_mainnet">Ethereum</option>
              <option value="bsc_mainnet">BNB Smart Chain</option>
              <option value="polygon_mainnet">Polygon</option>
              <option value="arbitrum_mainnet">Arbitrum</option>
              <option value="optimism_mainnet">Optimism</option>
              <option value="avalanche_mainnet">Avalanche</option>
            </select>
          </div>

          {/* From Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Từ
            </label>
            <div className="flex space-x-2">
              <div className="flex-1">
                <input
                  type="number"
                  step="0.00000001"
                  value={formData.fromAmount}
                  onChange={(e) => setFormData({ ...formData, fromAmount: e.target.value })}
                  placeholder="0.0"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-2xl"
                  required
                />
              </div>
              <select
                value={formData.fromToken}
                onChange={(e) => {
                  setFormData({ ...formData, fromToken: e.target.value });
                  setQuote(null);
                }}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="native">Native ({getTokenSymbol('native')})</option>
                {topCoins.slice(0, 5).map((coin) => (
                  <option key={coin.id} value={coin.symbol.toLowerCase()}>
                    {coin.symbol.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            {formData.fromToken !== 'native' && (
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {topCoins.find((c) => c.symbol.toUpperCase() === formData.fromToken.toUpperCase())
                  ?.currentPrice && (
                  <span>
                    ≈ $
                    {(
                      parseFloat(formData.fromAmount || '0') *
                      (topCoins.find(
                        (c) => c.symbol.toUpperCase() === formData.fromToken.toUpperCase()
                      )?.currentPrice || 0)
                    ).toFixed(2)}{' '}
                    USD
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Switch Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleSwitchTokens}
              className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <FiArrowRight className="w-5 h-5 rotate-90" />
            </button>
          </div>

          {/* To Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Đến
            </label>
            <div className="flex space-x-2">
              <div className="flex-1">
                <div className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-2xl min-h-[60px] flex items-center">
                  {loadingQuote ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                  ) : quote ? (
                    <span>{parseFloat(quote.toAmount || '0').toFixed(6)}</span>
                  ) : (
                    <span className="text-gray-400">0.0</span>
                  )}
                </div>
              </div>
              <select
                value={formData.toToken}
                onChange={(e) => {
                  setFormData({ ...formData, toToken: e.target.value });
                  setQuote(null);
                }}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="native">Native ({getTokenSymbol('native')})</option>
                {topCoins.slice(0, 5).map((coin) => (
                  <option key={coin.id} value={coin.symbol.toLowerCase()}>
                    {coin.symbol.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            {quote && (
              <div className="mt-2 space-y-1">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  ≈ $
                  {(
                    parseFloat(quote.toAmount || '0') *
                    (topCoins.find(
                      (c) => c.symbol.toUpperCase() === formData.toToken.toUpperCase()
                    )?.currentPrice || 1)
                  ).toFixed(2)}{' '}
                  USD
                </div>
                {quote.priceImpact && (
                  <div
                    className={`text-xs ${
                      quote.priceImpact > 5
                        ? 'text-red-500'
                        : quote.priceImpact > 1
                        ? 'text-yellow-500'
                        : 'text-green-500'
                    }`}
                  >
                    Price Impact: {quote.priceImpact.toFixed(2)}%
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Slippage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center space-x-2">
              <span>Slippage Tolerance</span>
              <FiInfo className="w-4 h-4 text-gray-400" />
            </label>
            <div className="flex space-x-2">
              {[0.5, 1, 3].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormData({ ...formData, slippage: value })}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    formData.slippage === value
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {value}%
                </button>
              ))}
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="50"
                value={formData.slippage}
                onChange={(e) =>
                  setFormData({ ...formData, slippage: parseFloat(e.target.value) || 1 })
                }
                placeholder="Custom"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {/* Quote Info */}
          {quote && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Exchange Rate</span>
                <span className="font-semibold">
                  1 {getTokenSymbol(formData.fromToken)} ={' '}
                  {(parseFloat(quote.toAmount) / parseFloat(formData.fromAmount)).toFixed(6)}{' '}
                  {getTokenSymbol(formData.toToken)}
                </span>
              </div>
              {quote.estimatedGas && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Estimated Gas</span>
                  <span className="font-semibold">{quote.estimatedGas}</span>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || loadingQuote || !quote || !formData.fromAmount}
            className="w-full btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Đang xử lý...</span>
              </span>
            ) : (
              'Swap'
            )}
          </button>
        </form>
      </motion.div>

      {/* Recent Swaps */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
      >
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Lịch sử Swap
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          Chưa có lịch sử swap
        </p>
      </motion.div>
    </div>
  );
};

export default Swap;

