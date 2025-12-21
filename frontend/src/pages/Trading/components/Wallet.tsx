import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';
import { FiDollarSign, FiRefreshCw, FiArrowUp, FiArrowDown } from 'react-icons/fi';

const Wallet = () => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
            Số Dư Ví
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
            Chưa có số dư nào
          </p>
        ) : (
          <div className="space-y-4">
            {balances.map((balance) => (
              <div
                key={balance.coinId || balance.symbol}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg flex justify-between items-center"
              >
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
                  <p className="text-sm text-gray-600 dark:text-gray-400">Giá trị USD</p>
                  <p className="text-xl font-semibold text-primary-600">
                    ${balance.usdValue?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Wallet;