import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiX, FiCopy, FiCheck, FiAlertCircle, FiExternalLink } from 'react-icons/fi';
import toast from 'react-hot-toast';
import axios from '../api/axios';

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  coinId: string;
  coinSymbol: string;
  coinName: string;
  balance: number;
  userId: string;
  onSuccess?: () => void;
}

interface WalletOption {
  id: string;
  name: string;
  icon: string;
  type: 'metamask' | 'walletconnect' | 'coinbase' | 'trust' | 'cold';
}

const WALLET_OPTIONS: WalletOption[] = [
  { id: 'metamask', name: 'MetaMask', icon: '🦊', type: 'metamask' },
  { id: 'walletconnect', name: 'WalletConnect', icon: '🔗', type: 'walletconnect' },
  { id: 'coinbase', name: 'Coinbase Wallet', icon: '📱', type: 'coinbase' },
  { id: 'trust', name: 'Trust Wallet', icon: '🛡️', type: 'trust' },
  { id: 'cold', name: 'Cold Wallet (Manual)', icon: '❄️', type: 'cold' },
];

const NETWORKS = [
  { id: 'ethereum', name: 'Ethereum (ERC-20)', symbol: 'ETH' },
  { id: 'bsc', name: 'BNB Smart Chain (BEP-20)', symbol: 'BNB' },
  { id: 'polygon', name: 'Polygon (MATIC)', symbol: 'MATIC' },
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
];

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      selectedAddress?: string;
    };
  }
}

const WithdrawalModal = ({
  isOpen,
  onClose,
  coinId,
  coinSymbol,
  coinName,
  balance,
  userId,
  onSuccess,
}: WithdrawalModalProps) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<'wallet' | 'details' | 'confirm'>('wallet');
  const [selectedWallet, setSelectedWallet] = useState<WalletOption | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string>('');
  const [manualAddress, setManualAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState(NETWORKS[0].id);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [withdrawalFee, setWithdrawalFee] = useState(0.001);
  const [minWithdraw, setMinWithdraw] = useState(0.01);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setStep('wallet');
      setSelectedWallet(null);
      setConnectedAddress('');
      setManualAddress('');
      setAmount('');
      setSelectedNetwork(NETWORKS[0].id);
    }
  }, [isOpen]);

  const connectMetaMask = async () => {
    if (!window.ethereum) {
      toast.error('MetaMask not installed. Please install MetaMask extension.');
      return;
    }

    try {
      setConnecting(true);
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      
      if (accounts && accounts.length > 0) {
        setConnectedAddress(accounts[0]);
        toast.success('MetaMask connected successfully');
      }
    } catch (error: any) {
      console.error('Error connecting MetaMask:', error);
      toast.error(error.message || 'Failed to connect MetaMask');
    } finally {
      setConnecting(false);
    }
  };

  const connectWallet = async (wallet: WalletOption) => {
    setSelectedWallet(wallet);
    
    if (wallet.type === 'metamask') {
      await connectMetaMask();
    } else if (wallet.type === 'cold') {
      // Cold wallet - manual address entry
      setStep('details');
    } else if (wallet.type === 'walletconnect') {
      // WalletConnect integration
      try {
        setConnecting(true);
        // Check if WalletConnect is available
        if (typeof window !== 'undefined' && (window as any).WalletConnect) {
          // WalletConnect SDK integration would go here
          toast.info('WalletConnect integration - Please enter your wallet address manually');
          setStep('details');
        } else {
          toast.info('WalletConnect not available. Please enter your wallet address manually.');
          setStep('details');
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to connect WalletConnect');
      } finally {
        setConnecting(false);
      }
    } else if (wallet.type === 'coinbase' || wallet.type === 'trust') {
      // For Coinbase Wallet and Trust Wallet, user can enter address manually
      // or we can try to detect if they're using the browser extension
      try {
        setConnecting(true);
        if (wallet.type === 'coinbase' && (window as any).ethereum?.isCoinbaseWallet) {
          const accounts = await (window as any).ethereum.request({
            method: 'eth_requestAccounts',
          });
          if (accounts && accounts.length > 0) {
            setConnectedAddress(accounts[0]);
            setManualAddress(accounts[0]);
            toast.success(`${wallet.name} connected successfully`);
            setStep('details');
          }
        } else {
          // Manual address entry for other wallets
          toast.info(`Please enter your ${wallet.name} address manually`);
          setStep('details');
        }
      } catch (error: any) {
        console.error(`Error connecting ${wallet.name}:`, error);
        toast.info(`Please enter your ${wallet.name} address manually`);
        setStep('details');
      } finally {
        setConnecting(false);
      }
    } else {
      toast.info(`${wallet.name} integration - Please enter your wallet address manually`);
      setStep('details');
    }
  };

  const handleContinue = () => {
    if (selectedWallet?.type === 'metamask' && connectedAddress) {
      setManualAddress(connectedAddress);
      setStep('details');
    } else if (selectedWallet?.type === 'cold' && manualAddress) {
      setStep('details');
    } else if (selectedWallet && step === 'wallet') {
      // Other wallet types
      setStep('details');
    } else if (step === 'details') {
      // Validate before proceeding
      if (!manualAddress || !amount) {
        toast.error(t('wallet.enter_address') || 'Please enter wallet address and amount');
        return;
      }
      if (parseFloat(amount) <= 0) {
        toast.error(t('wallet.invalid_amount') || 'Invalid amount');
        return;
      }
      if (parseFloat(amount) < minWithdraw) {
        toast.error(`${t('wallet.min_withdraw') || 'Minimum withdrawal'}: ${minWithdraw} ${coinSymbol}`);
        return;
      }
      if (parseFloat(amount) + withdrawalFee > balance) {
        toast.error(t('wallet.insufficient_balance') || 'Insufficient balance');
        return;
      }
      setStep('confirm');
    }
  };

  const handleWithdraw = async () => {
    try {
      setLoading(true);
      const walletAddress = selectedWallet?.type === 'metamask' ? connectedAddress : manualAddress;
      
      const response = await axios.post(`/api/v1/users/${userId}/withdraw`, {
        coinId,
        coinSymbol,
        amount: parseFloat(amount),
        walletAddress,
        network: selectedNetwork,
        walletType: selectedWallet?.type || 'manual',
      });

      if (response.data.success) {
        toast.success(t('wallet.withdrawal_success') || 'Withdrawal initiated successfully');
        onSuccess?.();
        onClose();
      } else {
        throw new Error(response.data.error || 'Withdrawal failed');
      }
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      toast.error(error.response?.data?.error || error.message || t('wallet.withdrawal_failed') || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    if (connectedAddress) {
      navigator.clipboard.writeText(connectedAddress);
      setAddressCopied(true);
      toast.success('Address copied to clipboard');
      setTimeout(() => setAddressCopied(false), 2000);
    }
  };

  const totalReceive = parseFloat(amount) - withdrawalFee;
  const isValid = manualAddress && amount && parseFloat(amount) >= minWithdraw && parseFloat(amount) + withdrawalFee <= balance;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('wallet.withdraw_to_wallet') || 'Withdraw to Wallet'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Balance Info */}
            <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('wallet.available_balance') || 'Available Balance'}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {balance.toFixed(8)} {coinSymbol}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{coinName}</p>
                </div>
              </div>
            </div>

            {/* Step 1: Select Wallet */}
            {step === 'wallet' && (
              <div className="space-y-4">
                <p className="text-gray-700 dark:text-gray-300">
                  {t('wallet.connect_wallet') || 'Connect your wallet or enter a cold wallet address'}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {WALLET_OPTIONS.map((wallet) => (
                    <button
                      key={wallet.id}
                      onClick={() => connectWallet(wallet)}
                      className={`p-4 border-2 rounded-lg transition-all ${
                        selectedWallet?.id === wallet.id
                          ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-primary-400'
                      }`}
                    >
                      <div className="text-3xl mb-2">{wallet.icon}</div>
                      <div className="font-semibold text-gray-900 dark:text-white">{wallet.name}</div>
                    </button>
                  ))}
                </div>

                {/* MetaMask Connection Status */}
                {selectedWallet?.type === 'metamask' && (
                  <div className="mt-4">
                    {connectedAddress ? (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-green-800 dark:text-green-200">
                              Connected
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-mono">
                              {connectedAddress.slice(0, 10)}...{connectedAddress.slice(-8)}
                            </p>
                          </div>
                          <button
                            onClick={copyAddress}
                            className="p-2 hover:bg-green-100 dark:hover:bg-green-900/40 rounded"
                          >
                            {addressCopied ? (
                              <FiCheck className="w-5 h-5 text-green-600" />
                            ) : (
                              <FiCopy className="w-5 h-5 text-green-600" />
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={connectMetaMask}
                        disabled={connecting}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {connecting
                          ? t('wallet.connecting') || 'Connecting...'
                          : t('wallet.connect_metamask') || 'Connect MetaMask'}
                      </button>
                    )}
                  </div>
                )}

                {/* Cold Wallet Address Input */}
                {selectedWallet?.type === 'cold' && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('wallet.wallet_address') || 'Wallet Address'}
                    </label>
                    <input
                      type="text"
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      placeholder={t('wallet.enter_address') || 'Enter wallet address'}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>
                )}

                {selectedWallet && (
                  <button
                    onClick={handleContinue}
                    disabled={
                      (selectedWallet.type === 'metamask' && !connectedAddress) ||
                      (selectedWallet.type === 'cold' && !manualAddress)
                    }
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                )}
              </div>
            )}

            {/* Step 2: Withdrawal Details */}
            {step === 'details' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('wallet.wallet_address') || 'Wallet Address'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={selectedWallet?.type === 'metamask' ? connectedAddress : manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      disabled={selectedWallet?.type === 'metamask'}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    />
                    {selectedWallet?.type === 'metamask' && (
                      <button
                        onClick={copyAddress}
                        className="absolute right-2 top-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                      >
                        {addressCopied ? (
                          <FiCheck className="w-5 h-5 text-green-600" />
                        ) : (
                          <FiCopy className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('wallet.network') || 'Network'}
                  </label>
                  <select
                    value={selectedNetwork}
                    onChange={(e) => setSelectedNetwork(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {NETWORKS.map((network) => (
                      <option key={network.id} value={network.id}>
                        {network.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('wallet.amount') || 'Amount'} ({coinSymbol})
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    min={minWithdraw}
                    max={balance - withdrawalFee}
                    step="0.00000001"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>
                      {t('wallet.min_withdraw') || 'Min'}: {minWithdraw} {coinSymbol}
                    </span>
                    <button
                      onClick={() => setAmount((balance - withdrawalFee).toString())}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      Max
                    </button>
                  </div>
                </div>

                {/* Fee Info */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t('wallet.withdrawal_fee') || 'Withdrawal Fee'}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {withdrawalFee} {coinSymbol}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t('wallet.total_receive') || 'You will receive'}
                    </span>
                    <span className="font-bold text-primary-600">
                      {totalReceive >= 0 ? totalReceive.toFixed(8) : '0.00000000'} {coinSymbol}
                    </span>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={() => setStep('wallet')}
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleContinue}
                    disabled={!isValid}
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Confirm */}
            {step === 'confirm' && (
              <div className="space-y-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <FiAlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800 dark:text-yellow-200">
                        Important Notice
                      </p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        Withdrawals are irreversible. Double-check all details before confirming.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">To Address:</span>
                    <span className="font-mono text-sm text-gray-900 dark:text-white">
                      {manualAddress.slice(0, 10)}...{manualAddress.slice(-8)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Network:</span>
                    <span className="text-gray-900 dark:text-white">
                      {NETWORKS.find((n) => n.id === selectedNetwork)?.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                    <span className="text-gray-900 dark:text-white">
                      {parseFloat(amount).toFixed(8)} {coinSymbol}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Fee:</span>
                    <span className="text-gray-900 dark:text-white">
                      {withdrawalFee} {coinSymbol}
                    </span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                    <span className="font-medium text-gray-900 dark:text-white">You will receive:</span>
                    <span className="font-bold text-primary-600">
                      {totalReceive.toFixed(8)} {coinSymbol}
                    </span>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={() => setStep('details')}
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleWithdraw}
                    disabled={loading}
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading
                      ? t('wallet.processing') || 'Processing...'
                      : t('wallet.confirm_withdraw') || 'Confirm Withdrawal'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default WithdrawalModal;
