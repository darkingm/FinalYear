import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiX, FiSend, FiAlertCircle } from 'react-icons/fi';
import axios from '../api/axios';
import toast from 'react-hot-toast';

interface CoinTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  coinSymbol?: string;
}

const CoinTransferModal = ({ isOpen, onClose, coinSymbol = 'BTC' }: CoinTransferModalProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fromNetwork: 'ethereum',
    toNetwork: 'binance-smart-chain',
    amount: '',
    recipientAddress: '',
  });

  const networks = [
    { value: 'ethereum', label: 'Ethereum (ERC-20)', fee: '0.005 ETH' },
    { value: 'binance-smart-chain', label: 'Binance Smart Chain (BEP-20)', fee: '0.0005 BNB' },
    { value: 'polygon', label: 'Polygon (MATIC)', fee: '0.01 MATIC' },
    { value: 'arbitrum', label: 'Arbitrum', fee: '0.001 ETH' },
    { value: 'optimism', label: 'Optimism', fee: '0.001 ETH' },
    { value: 'avalanche', label: 'Avalanche C-Chain', fee: '0.01 AVAX' },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.amount || !formData.recipientAddress) {
      toast.error('Please fill in all fields');
      return;
    }

    if (formData.fromNetwork === formData.toNetwork) {
      toast.error('Please select different networks');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/api/v1/blockchain/transfer', {
        coinSymbol,
        fromNetwork: formData.fromNetwork,
        toNetwork: formData.toNetwork,
        amount: parseFloat(formData.amount),
        recipientAddress: formData.recipientAddress,
      });

      toast.success('Transfer initiated successfully!');
      toast.info(`Transaction ID: ${response.data.data.txHash}`);
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Transfer failed. This feature requires blockchain service setup.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('blockchain.transfer_coin') || 'Transfer Coin'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <FiX className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleTransfer} className="p-6 space-y-6">
            {/* Warning Banner */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <FiAlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-semibold mb-1">
                    {t('blockchain.warning') || 'Important Notice'}
                  </p>
                  <p>
                    {t('blockchain.warning_text') || 'Cross-chain transfers are irreversible. Double-check all details before confirming.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Coin Display */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {t('blockchain.transferring') || 'Transferring'}
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {coinSymbol}
              </div>
            </div>

            {/* From Network */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('blockchain.from_network') || 'From Network'} *
              </label>
              <select
                name="fromNetwork"
                value={formData.fromNetwork}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                required
              >
                {networks.map((network) => (
                  <option key={network.value} value={network.value}>
                    {network.label} (Fee: {network.fee})
                  </option>
                ))}
              </select>
            </div>

            {/* To Network */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('blockchain.to_network') || 'To Network'} *
              </label>
              <select
                name="toNetwork"
                value={formData.toNetwork}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                required
              >
                {networks.map((network) => (
                  <option key={network.value} value={network.value}>
                    {network.label} (Fee: {network.fee})
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('blockchain.amount') || 'Amount'} *
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                step="0.000001"
                placeholder="0.00"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>

            {/* Recipient Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('blockchain.recipient_address') || 'Recipient Address'} *
              </label>
              <input
                type="text"
                name="recipientAddress"
                value={formData.recipientAddress}
                onChange={handleInputChange}
                placeholder="0x..."
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                required
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {t('blockchain.address_warning') || 'Make sure this address is compatible with the destination network'}
              </p>
            </div>

            {/* Estimated Fee */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('blockchain.estimated_fee') || 'Estimated Fee'}
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {networks.find(n => n.value === formData.fromNetwork)?.fee}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('blockchain.estimated_time') || 'Estimated Time'}
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  10-30 {t('blockchain.minutes') || 'minutes'}
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <FiSend className="w-5 h-5" />
                <span>{loading ? (t('blockchain.transferring') || 'Transferring...') : (t('blockchain.transfer') || 'Transfer')}</span>
              </button>
            </div>

            {/* Demo Notice */}
            <div className="text-center text-xs text-gray-500 dark:text-gray-400">
              {t('blockchain.demo_notice') || 'This is a demo feature. Requires blockchain service configuration.'}
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CoinTransferModal;

