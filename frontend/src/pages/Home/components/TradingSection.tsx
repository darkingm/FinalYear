import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiDollarSign, FiCreditCard, FiTrendingUp } from 'react-icons/fi';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';
import { RootState } from '../../../store';

const TradingSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const [depositAmount, setDepositAmount] = useState<string>('100');
  const [selectedCoin, setSelectedCoin] = useState<string>('USDT');
  const [availableCoins, setAvailableCoins] = useState<Array<{symbol: string; name: string; logo: string; priceUSD: number}>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAvailableCoins();
  }, []);

  const fetchAvailableCoins = async () => {
    try {
      const response = await axios.get('/api/v1/coins/top10');
      if (response.data?.success && response.data.data?.coins) {
        const coins = response.data.data.coins
          .filter((coin: any) => ['USDT', 'BTC', 'ETH', 'BNB'].includes(coin.symbol))
          .map((coin: any) => ({
            symbol: coin.symbol,
            name: coin.name,
            logo: coin.image,
            priceUSD: coin.currentPrice,
          }));
        setAvailableCoins(coins);
        if (coins.length > 0) {
          setSelectedCoin(coins[0].symbol);
        }
      }
    } catch (error) {
      console.error('Error fetching coins:', error);
    }
  };

  const handleDeposit = async () => {
    if (!isAuthenticated) {
      toast.error('Vui lòng đăng nhập để nạp tiền');
      navigate('/auth/login');
      return;
    }

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Số tiền không hợp lệ');
      return;
    }

    if (amount < 10) {
      toast.error('Số tiền tối thiểu là $10');
      return;
    }

    try {
      setLoading(true);
      
      // Calculate coin amount based on selected coin price
      const coin = availableCoins.find(c => c.symbol === selectedCoin);
      const coinAmount = coin ? amount / coin.priceUSD : amount;

      // Create deposit order via VNPay
      const response = await axios.post('/api/v1/payments/vnpay/create', {
        amount: amount,
        coinSymbol: selectedCoin,
        coinAmount: coinAmount,
        description: `Nạp ${selectedCoin} qua VNPay`,
      });

      if (response.data?.success && response.data.data?.paymentUrl) {
        // Redirect to VNPay payment page
        window.location.href = response.data.data.paymentUrl;
      } else {
        toast.error('Không thể tạo giao dịch. Vui lòng thử lại.');
      }
    } catch (error: any) {
      console.error('Deposit error:', error);
      toast.error(error.response?.data?.error || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const selectedCoinData = availableCoins.find(c => c.symbol === selectedCoin);

  return (
    <section className="py-16 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              {t('home.trading.title', 'Nạp Tiền & Giao Dịch')}
            </h2>
            <p className="text-xl text-primary-100">
              {t('home.trading.subtitle', 'Nạp USDT và các đồng coin khác bằng VNPay hoặc thẻ ngân hàng')}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Deposit Form */}
              <div>
                <h3 className="text-2xl font-bold mb-6 flex items-center space-x-2">
                  <FiDollarSign className="w-6 h-6" />
                  <span>Nạp Tiền</span>
                </h3>

                {/* Coin Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2 text-primary-100">
                    Chọn đồng coin
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {availableCoins.map((coin) => (
                      <button
                        key={coin.symbol}
                        onClick={() => setSelectedCoin(coin.symbol)}
                        className={`p-4 rounded-lg border-2 transition-all flex items-center space-x-2 ${
                          selectedCoin === coin.symbol
                            ? 'border-white bg-white/20'
                            : 'border-white/30 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <img src={coin.logo} alt={coin.symbol} className="w-6 h-6 rounded-full" />
                        <div className="text-left">
                          <div className="font-semibold">{coin.symbol}</div>
                          <div className="text-xs text-primary-200">${coin.priceUSD.toFixed(2)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount Input */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2 text-primary-100">
                    Số tiền (USD)
                  </label>
                  <div className="relative">
                    <FiDollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="Nhập số tiền"
                      min="10"
                      step="0.01"
                      className="w-full pl-12 pr-4 py-3 rounded-lg bg-white/10 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-white/50"
                    />
                  </div>
                  {selectedCoinData && (
                    <p className="mt-2 text-sm text-primary-200">
                      ≈ {(parseFloat(depositAmount || '0') / selectedCoinData.priceUSD).toFixed(6)} {selectedCoin}
                    </p>
                  )}
                </div>

                {/* Payment Methods */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2 text-primary-100">
                    Phương thức thanh toán
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3 p-3 rounded-lg bg-white/10 border border-white/30">
                      <FiCreditCard className="w-5 h-5" />
                      <span>VNPay (Thẻ ngân hàng, Ví điện tử)</span>
                    </div>
                  </div>
                </div>

                {/* Deposit Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDeposit}
                  disabled={loading}
                  className="w-full bg-white text-primary-600 py-4 rounded-lg font-semibold flex items-center justify-center space-x-2 hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                      <span>Đang xử lý...</span>
                    </>
                  ) : (
                    <>
                      <span>Nạp Ngay</span>
                      <FiArrowRight className="w-5 h-5" />
                    </>
                  )}
                </motion.button>
              </div>

              {/* Features */}
              <div>
                <h3 className="text-2xl font-bold mb-6 flex items-center space-x-2">
                  <FiTrendingUp className="w-6 h-6" />
                  <span>Tính Năng</span>
                </h3>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="font-semibold mb-1">Nạp tiền nhanh chóng</div>
                    <div className="text-sm text-primary-200">
                      Hỗ trợ VNPay, thẻ ngân hàng, ví điện tử
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="font-semibold mb-1">Tỷ giá real-time</div>
                    <div className="text-sm text-primary-200">
                      Cập nhật giá từ Binance và Coinbase
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="font-semibold mb-1">Bảo mật cao</div>
                    <div className="text-sm text-primary-200">
                      Mã hóa SSL/TLS, bảo vệ thông tin
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="font-semibold mb-1">Hỗ trợ nhiều coin</div>
                    <div className="text-sm text-primary-200">
                      USDT, BTC, ETH, BNB và nhiều coin khác
                    </div>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/trading')}
                  className="w-full mt-6 bg-white/10 border-2 border-white text-white py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 hover:bg-white/20 transition-colors"
                >
                  <span>Xem Thêm Giao Dịch</span>
                  <FiArrowRight className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TradingSection;

