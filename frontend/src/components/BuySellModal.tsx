import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiDollarSign, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

interface BuySellModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'buy' | 'sell';
  coin: {
    symbol: string;
    name: string;
    currentPrice: number;
    image: string;
  };
}

const BuySellModal = ({ isOpen, onClose, type, coin }: BuySellModalProps) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);

  const calculateTotal = () => {
    if (quantity) {
      return (parseFloat(quantity) * coin.currentPrice).toFixed(2);
    }
    if (amount) {
      return amount;
    }
    return '0.00';
  };

  const calculateQuantity = () => {
    if (amount) {
      return (parseFloat(amount) / coin.currentPrice).toFixed(8);
    }
    if (quantity) {
      return quantity;
    }
    return '0.00000000';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success(
        `${type === 'buy' ? 'Bought' : 'Sold'} ${calculateQuantity()} ${coin.symbol.toUpperCase()} successfully!`
      );
      onClose();
      setAmount('');
      setQuantity('');
    } catch (error) {
      toast.error(`Failed to ${type} ${coin.symbol.toUpperCase()}`);
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
              <div className={`p-3 rounded-full ${
                type === 'buy' ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
              }`}>
                {type === 'buy' ? (
                  <FiTrendingUp className={`w-6 h-6 ${
                    type === 'buy' ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'
                  }`} />
                ) : (
                  <FiTrendingDown className="w-6 h-6 text-red-600 dark:text-red-300" />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {type === 'buy' ? 'Buy' : 'Sell'} {coin.symbol.toUpperCase()}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {coin.name}
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
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Amount in USD */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Amount (USD)
                </label>
                <div className="relative">
                  <FiDollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setQuantity('');
                    }}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="text-center text-gray-500 dark:text-gray-400">or</div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantity ({coin.symbol.toUpperCase()})
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    setAmount('');
                  }}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0.00000000"
                  step="0.00000001"
                  min="0"
                />
              </div>

              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">You will {type}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {calculateQuantity()} {coin.symbol.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Total</span>
                  <span className="font-bold text-lg text-gray-900 dark:text-white">
                    ${calculateTotal()}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading || (!amount && !quantity)}
                className={`w-full py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  type === 'buy'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {loading ? 'Processing...' : `${type === 'buy' ? 'Buy' : 'Sell'} ${coin.symbol.toUpperCase()}`}
              </motion.button>
            </form>

            {/* Disclaimer */}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
              This is a demo transaction. No real money will be exchanged.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BuySellModal;

