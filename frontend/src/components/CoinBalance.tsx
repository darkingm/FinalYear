import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { RootState } from '../store';
import axios from '../api/axios';
import toast from 'react-hot-toast';
import { FiDollarSign, FiRefreshCw, FiEye, FiEyeOff, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import WithdrawalModal from './WithdrawalModal';

interface CoinBalance {
  coinId: string;
  coinSymbol: string;
  coinName: string;
  balance: number;
  usdValue?: number;
  priceUSD?: number;
  image?: string;
}

const CoinBalance = () => {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const [balances, setBalances] = useState<CoinBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(true);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState<CoinBalance | null>(null);
  const [totalUSDValue, setTotalUSDValue] = useState(0);

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
        const balancesData = response.data.data.balances || [];
        
        // Fetch current prices for each coin
        const balancesWithPrices = await Promise.all(
          balancesData.map(async (balance: any) => {
            try {
              // Try to get coin price from coin-market service
              const coinResponse = await axios.get(`/api/v1/coins/${balance.coinId || balance.coinSymbol.toLowerCase()}`);
              const coinData = coinResponse.data.data;
              const priceUSD = coinData?.currentPrice || balance.priceUSD || 0;
              const usdValue = (balance.balance || 0) * priceUSD;
              
              return {
                ...balance,
                coinId: balance.coinId || balance.coinSymbol?.toLowerCase(),
                coinSymbol: balance.coinSymbol || balance.symbol,
                coinName: balance.coinName || balance.name || balance.coinSymbol,
                balance: parseFloat(balance.balance?.toString() || '0'),
                priceUSD,
                usdValue,
                image: coinData?.image || balance.image,
              };
            } catch (error) {
              // If coin not found, use default values
              return {
                ...balance,
                coinId: balance.coinId || balance.coinSymbol?.toLowerCase(),
                coinSymbol: balance.coinSymbol || balance.symbol,
                coinName: balance.coinName || balance.name || balance.coinSymbol,
                balance: parseFloat(balance.balance?.toString() || '0'),
                priceUSD: balance.priceUSD || 0,
                usdValue: (balance.balance || 0) * (balance.priceUSD || 0),
                image: balance.image,
              };
            }
          })
        );

        setBalances(balancesWithPrices);
        const total = balancesWithPrices.reduce((sum, b) => sum + (b.usdValue || 0), 0);
        setTotalUSDValue(total);
      }
    } catch (error: any) {
      console.error('Error fetching balances:', error);
      if (isAuthenticated) {
        toast.error('Failed to fetch wallet balances');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = (coin: CoinBalance) => {
    setSelectedCoin(coin);
    setWithdrawModalOpen(true);
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          {t('wallet.login_required', 'Please login to view your coin balances')}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Total Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-6 text-white shadow-lg"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-primary-200 text-sm mb-1">
              {t('wallet.total_balance', 'Total Balance')}
            </p>
            <div className="flex items-center space-x-2">
              <FiDollarSign className="w-6 h-6" />
              <h2 className="text-3xl font-bold">
                {showBalance ? `$${totalUSDValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '****'}
              </h2>
            </div>
          </div>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="p-2 hover:bg-primary-700 rounded-lg transition-colors"
          >
            {showBalance ? <FiEyeOff className="w-6 h-6" /> : <FiEye className="w-6 h-6" />}
          </button>
        </div>
        <button
          onClick={fetchBalances}
          className="flex items-center space-x-2 text-primary-200 hover:text-white transition-colors"
        >
          <FiRefreshCw className="w-4 h-4" />
          <span className="text-sm">{t('wallet.refresh', 'Refresh')}</span>
        </button>
      </motion.div>

      {/* Coin Balances List */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          {t('wallet.coin_balances', 'Coin Balances')}
        </h3>
        
        {balances.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <p className="text-gray-500 dark:text-gray-400">
              {t('wallet.no_balances', 'No coin balances found')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {balances.map((balance) => (
              <motion.div
                key={balance.coinId || balance.coinSymbol}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {balance.image && (
                      <img
                        src={balance.image}
                        alt={balance.coinSymbol}
                        className="w-10 h-10 rounded-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">
                        {balance.coinSymbol}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {balance.coinName}
                      </p>
                    </div>
                  </div>
                  {balance.priceUSD && balance.priceUSD > 0 && (
                    <div className="text-right">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        ${balance.priceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t('wallet.balance', 'Balance')}:
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {showBalance 
                        ? `${balance.balance.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 })} ${balance.coinSymbol}`
                        : '****'
                      }
                    </span>
                  </div>
                  {balance.usdValue && balance.usdValue > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {t('wallet.usd_value', 'USD Value')}:
                      </span>
                      <span className="font-semibold text-primary-600 dark:text-primary-400">
                        {showBalance 
                          ? `$${balance.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '****'
                        }
                      </span>
                    </div>
                  )}
                </div>

                {balance.balance > 0 && (
                  <button
                    onClick={() => handleWithdraw(balance)}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                  >
                    <FiArrowUp className="w-4 h-4" />
                    <span>{t('wallet.withdraw', 'Withdraw')}</span>
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Withdrawal Modal */}
      {selectedCoin && (
        <WithdrawalModal
          isOpen={withdrawModalOpen}
          onClose={() => {
            setWithdrawModalOpen(false);
            setSelectedCoin(null);
          }}
          coinId={selectedCoin.coinId}
          coinSymbol={selectedCoin.coinSymbol}
          coinName={selectedCoin.coinName}
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

export default CoinBalance;

