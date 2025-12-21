import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';
import { FiArrowUp, FiArrowDown, FiDollarSign, FiRefreshCw } from 'react-icons/fi';

const P2PTrading = () => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [loading, setLoading] = useState(false);
  const [trades, setTrades] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    coinType: 'BTC',
    coinAmount: '',
    fiatAmount: '',
    exchangeRate: '',
    bankName: '',
    bankAccountNumber: '',
    bankAccountName: '',
  });

  useEffect(() => {
    if (isAuthenticated) {
      fetchTrades();
    }
  }, [isAuthenticated]);

  const fetchTrades = async () => {
    try {
      // ✅ SỬA: Thay /api/v1/payments/p2p bằng /api/p2p
      const response = await axios.get('/api/p2p');
      if (response.data.success) {
        setTrades(response.data.data.trades || response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching trades:', error);
      // Không hiển thị toast nếu user chưa đăng nhập
      if (isAuthenticated) {
        toast.error('Failed to fetch trades');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error('Please login to create a trade');
      return;
    }

    setLoading(true);
    try {
      // ✅ SỬA: Thay /api/v1/payments/p2p bằng /api/p2p
      const response = await axios.post('/api/p2p', {
        tradeType,
        coinAmount: parseFloat(formData.coinAmount),
        coinType: formData.coinType,
        fiatAmount: parseFloat(formData.fiatAmount),
        fiatCurrency: 'USD',
        exchangeRate: parseFloat(formData.exchangeRate),
        bankName: formData.bankName,
        bankAccountNumber: formData.bankAccountNumber,
        bankAccountName: formData.bankAccountName,
      });

      if (response.data.success) {
        toast.success('Trade created successfully!');
        setFormData({
          coinType: 'BTC',
          coinAmount: '',
          fiatAmount: '',
          exchangeRate: '',
          bankName: '',
          bankAccountNumber: '',
          bankAccountName: '',
        });
        fetchTrades();
      }
    } catch (error: any) {
      console.error('Error creating trade:', error);
      console.error('Error response:', error.response?.data);
      toast.error(error.response?.data?.error || 'Failed to create trade');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Trade Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
      >
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {tradeType === 'BUY' ? 'Mua Coin' : 'Bán Coin'}
        </h2>

        {/* Trade Type Toggle */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setTradeType('BUY')}
            className={`p-4 rounded-lg border-2 transition-all ${
              tradeType === 'BUY'
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            <FiArrowDown className="w-6 h-6 mx-auto mb-2 text-green-600" />
            <span className="font-bold">Mua Coin</span>
          </button>
          <button
            onClick={() => setTradeType('SELL')}
            className={`p-4 rounded-lg border-2 transition-all ${
              tradeType === 'SELL'
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            <FiArrowUp className="w-6 h-6 mx-auto mb-2 text-red-600" />
            <span className="font-bold">Bán Coin</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Loại Coin
            </label>
            <select
              value={formData.coinType}
              onChange={(e) => setFormData({ ...formData, coinType: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="BTC">Bitcoin (BTC)</option>
              <option value="ETH">Ethereum (ETH)</option>
              <option value="USDT">Tether (USDT)</option>
              <option value="BNB">BNB</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Số Lượng Coin
            </label>
            <input
              type="number"
              step="0.00000001"
              value={formData.coinAmount}
              onChange={(e) => setFormData({ ...formData, coinAmount: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tỷ Giá (USD)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.exchangeRate}
              onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tên Ngân Hàng
            </label>
            <input
              type="text"
              value={formData.bankName}
              onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Số Tài Khoản
            </label>
            <input
              type="text"
              value={formData.bankAccountNumber}
              onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tên Chủ Tài Khoản
            </label>
            <input
              type="text"
              value={formData.bankAccountName}
              onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn btn-primary"
          >
            {loading ? 'Đang xử lý...' : tradeType === 'BUY' ? 'Tạo Lệnh Mua' : 'Tạo Lệnh Bán'}
          </button>
        </form>
      </motion.div>

      {/* My Trades */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Lệnh Giao Dịch Của Tôi
          </h2>
          <button
            onClick={fetchTrades}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <FiRefreshCw className="w-5 h-5" />
          </button>
        </div>

        {trades.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            Chưa có lệnh giao dịch nào
          </p>
        ) : (
          <div className="space-y-4">
            {trades.map((trade) => (
              <div
                key={trade.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          trade.tradeType === 'BUY'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}
                      >
                        {trade.tradeType === 'BUY' ? 'MUA' : 'BÁN'}
                      </span>
                      <span className="font-bold">{trade.coinType}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Số lượng: {trade.coinAmount} {trade.coinType}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Giá: ${trade.fiatAmount} USD
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        trade.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-800'
                          : trade.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {trade.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default P2PTrading;