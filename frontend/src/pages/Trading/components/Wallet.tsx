import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { RootState } from '../../../store';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';
import { FiDollarSign, FiRefreshCw, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import WithdrawalModal from '../../../components/WithdrawalModal';

const Wallet = () => {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState<any>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchBalances();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const fetchBalances = async () => {
    try {
      setLoading(true);
      const userId = user?.id || user?.userId;
      if (!userId) {
        setLoading(false);
        return;
      }
      
      const response = await axios.get(`/api/v1/users/${userId}/balances`);
      if (response.data.success) {
        setBalances(response.data.data.balances || []);
      }
    } catch (error: any) {
      console.error('Error fetching balances:', error);
      // Chỉ hiển thị toast nếu đã đăng nhập
      if (isAuthenticated) {
        toast.error('Failed to fetch wallet balances');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          Vui lòng đăng nhập để xem ví của bạn
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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('wallet.title') || 'My Wallet'}
          </h2>
          <button
            onClick={fetchBalances}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <FiRefreshCw className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : balances.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            {t('wallet.no_balance') || 'No balance available'}
          </p>
        ) : (
          <div className="space-y-4">
            {balances.map((balance) => (
              <div
                key={balance.coinId || balance.symbol}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-lg">{balance.symbol || 'N/A'}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {balance.name || 'Unknown'}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                      {balance.balance?.toFixed(8) || '0.00000000'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('wallet.balance') || 'USD Value'}</p>
                    <p className="text-xl font-semibold text-primary-600">
                      ${balance.usdValue?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedCoin({
                      coinId: balance.coinId || balance.symbol,
                      symbol: balance.symbol,
                      name: balance.name,
                      balance: parseFloat(balance.balance || '0'),
                    });
                    setWithdrawModalOpen(true);
                  }}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                >
                  <FiArrowUp className="w-4 h-4" />
                  <span>{t('wallet.withdraw') || 'Withdraw'}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Withdrawal Modal */}
      {selectedCoin && (
        <WithdrawalModal
          isOpen={withdrawModalOpen}
          onClose={() => {
            setWithdrawModalOpen(false);
            setSelectedCoin(null);
          }}
          coinId={selectedCoin.coinId}
          coinSymbol={selectedCoin.symbol}
          coinName={selectedCoin.name}
          balance={selectedCoin.balance}
          userId={user?.id || user?.userId || ''}
          onSuccess={() => {
            fetchBalances();
          }}
        />
      )}
    </div>
  );
};

export default Wallet;