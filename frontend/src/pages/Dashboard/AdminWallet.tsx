import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import {
  FiDollarSign,
  FiRefreshCw,
  FiAlertCircle,
  FiCheckCircle,
  FiAlertTriangle,
  FiTrendingUp,
  FiTrendingDown,
} from 'react-icons/fi';

interface AdminWallet {
  coinSymbol: string;
  realBalance: number;
  lockedBalance: number;
  totalBalance: number;
  walletAddress?: string;
  lastUpdated: string;
}

interface PlatformStats {
  coinSymbol: string;
  totalUserSymbolic: number;
  totalUserLocked: number;
  adminRealBalance: number;
  coverage: number;
  deficit: number;
  status: 'healthy' | 'warning' | 'critical';
  userCount: number;
}

export default function AdminWallet() {
  const { t } = useTranslation();
  const [wallets, setWallets] = useState<AdminWallet[]>([]);
  const [platformStats, setPlatformStats] = useState<PlatformStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'wallets' | 'stats'>('wallets');

  useEffect(() => {
    fetchData();
    
    // Auto refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);

      if (activeTab === 'wallets') {
        // Fetch admin wallets
        const response = await axios.get('/api/v1/admin/wallets');
        if (response.data.success) {
          setWallets(response.data.data.wallets || []);
        }
      } else {
        // Fetch platform stats
        const response = await axios.get('/api/v1/admin/wallets/platform/stats');
        if (response.data.success) {
          setPlatformStats(response.data.data.stats || []);
        }
      }
    } catch (error: any) {
      console.error('Error fetching admin wallet data:', error);
      toast.error('Failed to fetch wallet data');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncBalance = async (coinSymbol: string) => {
    const realBalance = prompt(`Enter real ${coinSymbol} balance from blockchain:`);
    if (!realBalance) return;

    try {
      setSyncing(true);
      await axios.post('/api/v1/admin/wallets/sync', {
        coinSymbol,
        realBalance: parseFloat(realBalance),
        source: 'MANUAL_ADMIN_SYNC',
      });

      toast.success('Balance synced successfully');
      fetchData();
    } catch (error: any) {
      console.error('Error syncing balance:', error);
      toast.error('Failed to sync balance');
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
      case 'critical':
        return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <FiCheckCircle className="w-5 h-5" />;
      case 'warning':
        return <FiAlertTriangle className="w-5 h-5" />;
      case 'critical':
        return <FiAlertCircle className="w-5 h-5" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Admin Wallet Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage real cryptocurrency balances
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <FiRefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('wallets')}
            className={`pb-4 px-4 font-medium transition ${
              activeTab === 'wallets'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Admin Wallets (Real Balances)
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`pb-4 px-4 font-medium transition ${
              activeTab === 'stats'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Platform Statistics
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            {/* Wallets Tab */}
            {activeTab === 'wallets' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {wallets.map((wallet) => (
                  <motion.div
                    key={wallet.coinSymbol}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {wallet.coinSymbol}
                      </h3>
                      <FiDollarSign className="w-6 h-6 text-primary-600" />
                    </div>

                    <div className="space-y-3 mb-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Real Balance</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {wallet.realBalance.toLocaleString('en-US', { minimumFractionDigits: 8 })}
                        </p>
                      </div>

                      {wallet.lockedBalance > 0 && (
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Locked</p>
                          <p className="text-lg font-semibold text-yellow-600">
                            {wallet.lockedBalance.toLocaleString('en-US', { minimumFractionDigits: 8 })}
                          </p>
                        </div>
                      )}

                      {wallet.walletAddress && (
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Wallet Address</p>
                          <p className="text-xs text-gray-700 dark:text-gray-300 font-mono break-all">
                            {wallet.walletAddress}
                          </p>
                        </div>
                      )}

                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Last Updated</p>
                        <p className="text-xs text-gray-500">
                          {new Date(wallet.lastUpdated).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSyncBalance(wallet.coinSymbol)}
                      disabled={syncing}
                      className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                    >
                      <FiRefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                      <span>Sync from Blockchain</span>
                    </button>
                  </motion.div>
                ))}

                {wallets.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400">
                      No admin wallets found
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Platform Stats Tab */}
            {activeTab === 'stats' && (
              <div className="space-y-6">
                {platformStats.map((stat) => (
                  <motion.div
                    key={stat.coinSymbol}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                          {stat.coinSymbol}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1 ${getStatusColor(stat.status)}`}>
                          {getStatusIcon(stat.status)}
                          <span className="ml-1 capitalize">{stat.status}</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Coverage</p>
                        <p className={`text-xl font-bold ${
                          stat.coverage >= 100 ? 'text-green-600' : 
                          stat.coverage >= 80 ? 'text-yellow-600' : 
                          'text-red-600'
                        }`}>
                          {stat.coverage.toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">User Symbolic</p>
                        <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                          {stat.totalUserSymbolic.toLocaleString('en-US', { minimumFractionDigits: 4 })}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          {stat.userCount} users
                        </p>
                      </div>

                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-1">User Locked</p>
                        <p className="text-lg font-bold text-yellow-900 dark:text-yellow-100">
                          {stat.totalUserLocked.toLocaleString('en-US', { minimumFractionDigits: 4 })}
                        </p>
                      </div>

                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-sm text-green-600 dark:text-green-400 mb-1">Admin Real</p>
                        <p className="text-lg font-bold text-green-900 dark:text-green-100">
                          {stat.adminRealBalance.toLocaleString('en-US', { minimumFractionDigits: 4 })}
                        </p>
                      </div>

                      <div className={`p-4 rounded-lg ${
                        stat.deficit > 0 
                          ? 'bg-red-50 dark:bg-red-900/20' 
                          : 'bg-green-50 dark:bg-green-900/20'
                      }`}>
                        <p className={`text-sm mb-1 ${
                          stat.deficit > 0 
                            ? 'text-red-600 dark:text-red-400' 
                            : 'text-green-600 dark:text-green-400'
                        }`}>
                          {stat.deficit > 0 ? 'Deficit' : 'Surplus'}
                        </p>
                        <p className={`text-lg font-bold ${
                          stat.deficit > 0 
                            ? 'text-red-900 dark:text-red-100' 
                            : 'text-green-900 dark:text-green-100'
                        }`}>
                          {stat.deficit > 0 
                            ? `-${stat.deficit.toLocaleString('en-US', { minimumFractionDigits: 4 })}`
                            : `+${(stat.adminRealBalance - stat.totalUserSymbolic - stat.totalUserLocked).toLocaleString('en-US', { minimumFractionDigits: 4 })}`
                          }
                        </p>
                      </div>
                    </div>

                    {/* Warning Messages */}
                    {stat.status === 'critical' && (
                      <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg flex items-start space-x-3">
                        <FiAlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-900 dark:text-red-100">
                            Critical: Insufficient real balance
                          </p>
                          <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                            Admin wallet needs {stat.deficit.toFixed(8)} {stat.coinSymbol} more to cover user balances.
                            Please deposit immediately!
                          </p>
                        </div>
                      </div>
                    )}

                    {stat.status === 'warning' && (
                      <div className="mt-4 p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg flex items-start space-x-3">
                        <FiAlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                            Warning: Low coverage
                          </p>
                          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                            Consider depositing more {stat.coinSymbol} to maintain healthy reserves.
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}

                {platformStats.length === 0 && (
                  <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
                    <p className="text-gray-500 dark:text-gray-400">
                      No platform statistics available
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
