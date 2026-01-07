import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiTrendingUp, FiTrendingDown, FiDollarSign } from 'react-icons/fi';
import P2PTrading from './components/P2PTrading';
import Wallet from './components/Wallet';
import Swap from './components/Swap';

const TradingPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'p2p' | 'wallet' | 'swap'>('swap');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-16">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-8">
            {t('trading.title', 'Giao Dịch')}
          </h1>

          {/* Tabs */}
          <div className="flex space-x-4 mb-8 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('swap')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'swap'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-primary-600'
              }`}
            >
              {t('trading.swap', 'Swap Coin')}
            </button>
            <button
              onClick={() => setActiveTab('p2p')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'p2p'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-primary-600'
              }`}
            >
              {t('trading.p2p', 'Mua/Bán Coin P2P')}
            </button>
            <button
              onClick={() => setActiveTab('wallet')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'wallet'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-primary-600'
              }`}
            >
              {t('trading.wallet', 'Ví Của Tôi')}
            </button>
          </div>

          {/* Content */}
          {activeTab === 'swap' && <Swap />}
          {activeTab === 'p2p' && <P2PTrading />}
          {activeTab === 'wallet' && <Wallet />}
        </motion.div>
      </div>
    </div>
  );
};

export default TradingPage;