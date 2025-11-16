import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiBell, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

interface PriceAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  coin: {
    symbol: string;
    name: string;
    currentPrice: number;
    image: string;
  };
}

const PriceAlertModal = ({ isOpen, onClose, coin }: PriceAlertModalProps) => {
  const { t } = useTranslation();
  const [alertType, setAlertType] = useState<'above' | 'below'>('above');
  const [targetPrice, setTargetPrice] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!targetPrice || parseFloat(targetPrice) <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    setLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success(
        `Price alert set! You'll be notified when ${coin.symbol.toUpperCase()} goes ${alertType} $${targetPrice}`
      );
      onClose();
      setTargetPrice('');
    } catch (error) {
      toast.error('Failed to set price alert');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full relative"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>

          <div className="p-8">
            {/* Header */}
            <div className="flex items-center space-x-4 mb-6">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-full">
                <FiBell className="w-6 h-6 text-yellow-600 dark:text-yellow-300" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Set Price Alert
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {coin.name} ({coin.symbol.toUpperCase()})
                </p>
              </div>
            </div>

            {/* Current Price */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-6">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Current Price
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                ${coin.currentPrice.toLocaleString()}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Alert Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Alert me when price goes
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAlertType('above')}
                    className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-lg border-2 transition-all ${
                      alertType === 'above'
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <FiTrendingUp className="w-5 h-5" />
                    <span className="font-medium">Above</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAlertType('below')}
                    className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-lg border-2 transition-all ${
                      alertType === 'below'
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <FiTrendingDown className="w-5 h-5" />
                    <span className="font-medium">Below</span>
                  </button>
                </div>
              </div>

              {/* Target Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Target Price (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg">
                    $
                  </span>
                  <input
                    type="number"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
                {targetPrice && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {alertType === 'above' ? 'Alert when price rises to' : 'Alert when price drops to'} ${targetPrice}
                    {' '}({((parseFloat(targetPrice) - coin.currentPrice) / coin.currentPrice * 100).toFixed(2)}%)
                  </p>
                )}
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quick Presets
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 20].map((percent) => {
                    const presetPrice = alertType === 'above'
                      ? coin.currentPrice * (1 + percent / 100)
                      : coin.currentPrice * (1 - percent / 100);
                    return (
                      <button
                        key={percent}
                        type="button"
                        onClick={() => setTargetPrice(presetPrice.toFixed(2))}
                        className="py-2 px-3 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                      >
                        {alertType === 'above' ? '+' : '-'}{percent}%
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading || !targetPrice}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Setting Alert...' : 'Set Price Alert'}
              </motion.button>
            </form>

            {/* Info */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <FiBell className="inline w-4 h-4 mr-1" />
                You'll receive a notification via email and push notification when the price reaches your target.
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PriceAlertModal;

