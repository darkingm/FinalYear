import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store';
import { clearCart } from '../store/slices/cartSlice';
import axios from '../api/axios';
import toast from 'react-hot-toast';
import {
  FiMapPin,
  FiCreditCard,
  FiLock,
  FiCheckCircle,
  FiArrowRight,
  FiArrowLeft,
  FiUser,
  FiPhone,
  FiMail,
  FiGlobe,
  FiPackage,
} from 'react-icons/fi';

// Coin data - prices in USD
const COINS = [
  { symbol: 'BTC', name: 'Bitcoin', logo: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png', priceUSD: 43000 },
  { symbol: 'ETH', name: 'Ethereum', logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png', priceUSD: 2300 },
  { symbol: 'USDT', name: 'Tether', logo: 'https://assets.coingecko.com/coins/images/325/small/Tether.png', priceUSD: 1 },
  { symbol: 'BNB', name: 'Binance Coin', logo: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png', priceUSD: 320 },
  { symbol: 'XRP', name: 'Ripple', logo: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png', priceUSD: 0.52 },
];

type CheckoutStep = 'address' | 'payment' | 'review' | 'confirmation';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { items, totalPrice } = useSelector((state: RootState) => state.cart);
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  
  const [step, setStep] = useState<CheckoutStep>('address');
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  
  const [shippingAddress, setShippingAddress] = useState({
    fullName: user?.fullName || '',
    phone: '',
    email: user?.email || '',
    address: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
  });

  const [selectedCoin, setSelectedCoin] = useState('USDT');
  const [paymentMethod, setPaymentMethod] = useState<'COIN' | 'CREDIT_CARD'>('COIN');
  const [cardDetails, setCardDetails] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardName: '',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    if (items.length === 0 && step !== 'confirmation') {
      navigate('/cart');
      return;
    }
  }, [isAuthenticated, items, navigate, step]);

  const selectedCoinData = COINS.find(c => c.symbol === selectedCoin) || COINS[2];
  const totalInCoins = (totalPrice / selectedCoinData.priceUSD).toFixed(6);
  const shippingFee = 0; // Free shipping for now
  const tax = totalPrice * 0.1; // 10% tax
  const finalTotal = totalPrice + shippingFee + tax;

  const validateAddress = () => {
    if (!shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.email || 
        !shippingAddress.address || !shippingAddress.city || !shippingAddress.country) {
      toast.error('Please fill in all required shipping information');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingAddress.email)) {
      toast.error('Please enter a valid email address');
      return false;
    }
    return true;
  };

  const validatePayment = () => {
    if (paymentMethod === 'COIN') {
      return true; // Coin payment is always valid
    }
    // Validate credit card
    if (!cardDetails.cardNumber || !cardDetails.expiryDate || !cardDetails.cvv || !cardDetails.cardName) {
      toast.error('Please fill in all card details');
      return false;
    }
    if (cardDetails.cardNumber.replace(/\s/g, '').length !== 16) {
      toast.error('Please enter a valid card number');
      return false;
    }
    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validateAddress() || !validatePayment()) {
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        items: items.map(item => ({
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
        })),
        shippingAddress: {
          fullName: shippingAddress.fullName,
          phone: shippingAddress.phone,
          email: shippingAddress.email,
          address: shippingAddress.address,
          city: shippingAddress.city,
          state: shippingAddress.state,
          country: shippingAddress.country,
          postalCode: shippingAddress.postalCode,
        },
        paymentMethod: {
          type: paymentMethod,
          coinSymbol: paymentMethod === 'COIN' ? selectedCoin : undefined,
          coinAmount: paymentMethod === 'COIN' ? totalInCoins : undefined,
          usdAmount: finalTotal,
        },
        totalAmountUSD: finalTotal,
        totalAmountCoin: paymentMethod === 'COIN' ? parseFloat(totalInCoins) : undefined,
        subtotal: totalPrice,
        shipping: shippingFee,
        tax: tax,
      };

      const response = await axios.post('/api/v1/orders', orderData);
      const order = response.data.data;

      setOrderId(order.id);
      dispatch(clearCart());
      toast.success('Order placed successfully!');
      setStep('confirmation');
    } catch (error: any) {
      console.error('Error placing order:', error);
      toast.error(error.response?.data?.error || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { key: 'address' as CheckoutStep, label: 'Shipping', icon: FiMapPin },
    { key: 'payment' as CheckoutStep, label: 'Payment', icon: FiCreditCard },
    { key: 'review' as CheckoutStep, label: 'Review', icon: FiCheckCircle },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  if (step === 'confirmation' && orderId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <FiCheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
            </motion.div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Order Confirmed!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Thank you for your purchase. Your order has been placed successfully.
            </p>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">Order Number</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{orderId}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate(`/orders/${orderId}`)}
                className="btn btn-primary"
              >
                View Order Details
              </button>
              <button
                onClick={() => navigate('/products')}
                className="btn btn-outline"
              >
                Continue Shopping
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || items.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-16">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            {steps.map((s, index) => (
              <div key={s.key} className="flex items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${
                    currentStepIndex >= index
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {currentStepIndex > index ? (
                    <FiCheckCircle className="w-6 h-6" />
                  ) : (
                    <s.icon className="w-6 h-6" />
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-24 h-1 mx-2 transition-colors ${
                      currentStepIndex > index
                        ? 'bg-primary-600'
                        : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center space-x-32 mt-2">
            {steps.map((s) => (
              <span key={s.key} className="text-sm text-gray-600 dark:text-gray-400">
                {s.label}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <AnimatePresence mode="wait">
              {/* Step 1: Shipping Address */}
              {step === 'address' && (
                <motion.div
                  key="address"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
                >
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                    <FiMapPin className="w-6 h-6 mr-2" />
                    Shipping Address
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Full Name *
                      </label>
                      <div className="relative">
                        <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="text"
                          value={shippingAddress.fullName}
                          onChange={(e) => setShippingAddress({ ...shippingAddress, fullName: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Email *
                      </label>
                      <div className="relative">
                        <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="email"
                          value={shippingAddress.email}
                          onChange={(e) => setShippingAddress({ ...shippingAddress, email: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Phone Number *
                      </label>
                      <div className="relative">
                        <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="tel"
                          value={shippingAddress.phone}
                          onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Address *
                      </label>
                      <div className="relative">
                        <FiMapPin className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                        <textarea
                          value={shippingAddress.address}
                          onChange={(e) => setShippingAddress({ ...shippingAddress, address: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                          rows={3}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          City *
                        </label>
                        <input
                          type="text"
                          value={shippingAddress.city}
                          onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          State/Province
                        </label>
                        <input
                          type="text"
                          value={shippingAddress.state}
                          onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Country *
                        </label>
                        <div className="relative">
                          <FiGlobe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                          <input
                            type="text"
                            value={shippingAddress.country}
                            onChange={(e) => setShippingAddress({ ...shippingAddress, country: e.target.value })}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Postal Code
                        </label>
                        <input
                          type="text"
                          value={shippingAddress.postalCode}
                          onChange={(e) => setShippingAddress({ ...shippingAddress, postalCode: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (validateAddress()) setStep('payment');
                      }}
                      className="w-full btn btn-primary flex items-center justify-center"
                    >
                      Continue to Payment <FiArrowRight className="w-5 h-5 ml-2" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Payment Method */}
              {step === 'payment' && (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
                >
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                    <FiCreditCard className="w-6 h-6 mr-2" />
                    Payment Method
                  </h2>
                  <div className="space-y-4">
                    {/* Payment Method Selection */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <button
                        onClick={() => setPaymentMethod('COIN')}
                        className={`p-4 border-2 rounded-lg transition-all ${
                          paymentMethod === 'COIN'
                            ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <FiPackage className="w-5 h-5" />
                          <span className="font-bold">Cryptocurrency</span>
                        </div>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('CREDIT_CARD')}
                        className={`p-4 border-2 rounded-lg transition-all ${
                          paymentMethod === 'CREDIT_CARD'
                            ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <FiCreditCard className="w-5 h-5" />
                          <span className="font-bold">Credit Card</span>
                        </div>
                      </button>
                    </div>

                    {/* Coin Payment */}
                    {paymentMethod === 'COIN' && (
                      <div className="space-y-4">
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                          Select a cryptocurrency to pay with:
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          {COINS.map((coin) => (
                            <button
                              key={coin.symbol}
                              onClick={() => setSelectedCoin(coin.symbol)}
                              className={`p-4 border-2 rounded-lg transition-all ${
                                selectedCoin === coin.symbol
                                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                  : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <img src={coin.logo} alt={coin.symbol} className="w-8 h-8" />
                                <div className="text-left">
                                  <div className="font-bold text-gray-900 dark:text-white">{coin.symbol}</div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400">{coin.name}</div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Credit Card Payment */}
                    {paymentMethod === 'CREDIT_CARD' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Card Number *
                          </label>
                          <input
                            type="text"
                            value={cardDetails.cardNumber}
                            onChange={(e) => setCardDetails({ ...cardDetails, cardNumber: e.target.value.replace(/\D/g, '').slice(0, 16) })}
                            placeholder="1234 5678 9012 3456"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                            maxLength={16}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Cardholder Name *
                          </label>
                          <input
                            type="text"
                            value={cardDetails.cardName}
                            onChange={(e) => setCardDetails({ ...cardDetails, cardName: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Expiry Date *
                            </label>
                            <input
                              type="text"
                              value={cardDetails.expiryDate}
                              onChange={(e) => setCardDetails({ ...cardDetails, expiryDate: e.target.value.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(\d{0,2})/, '$1/$2') })}
                              placeholder="MM/YY"
                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                              maxLength={5}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              CVV *
                            </label>
                            <input
                              type="text"
                              value={cardDetails.cvv}
                              onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                              placeholder="123"
                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                              maxLength={3}
                            />
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                          <FiLock className="w-4 h-4" />
                          <span>Your payment is secure and encrypted</span>
                        </div>
                      </div>
                    )}

                    <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600 dark:text-gray-400">Total (USD):</span>
                        <span className="text-xl font-bold text-gray-900 dark:text-white">${finalTotal.toFixed(2)}</span>
                      </div>
                      {paymentMethod === 'COIN' && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 dark:text-gray-400">Total ({selectedCoin}):</span>
                          <span className="text-xl font-bold text-primary-600">{totalInCoins} {selectedCoin}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-4">
                      <button
                        onClick={() => setStep('address')}
                        className="flex-1 btn btn-outline flex items-center justify-center"
                      >
                        <FiArrowLeft className="w-5 h-5 mr-2" />
                        Back
                      </button>
                      <button
                        onClick={() => {
                          if (validatePayment()) setStep('review');
                        }}
                        className="flex-1 btn btn-primary flex items-center justify-center"
                      >
                        Review Order <FiArrowRight className="w-5 h-5 ml-2" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Review Order */}
              {step === 'review' && (
                <motion.div
                  key="review"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
                >
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                    <FiCheckCircle className="w-6 h-6 mr-2 text-green-500" />
                    Review Your Order
                  </h2>
                  <div className="space-y-6">
                    {/* Order Items */}
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Items</h3>
                      <div className="space-y-3">
                        {items.map((item) => (
                          <div key={item.id} className="flex items-center space-x-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded" />
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Qty: {item.quantity} × ${item.price.toFixed(2)}</p>
                            </div>
                            <p className="font-bold text-gray-900 dark:text-white">
                              ${(item.price * item.quantity).toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Shipping Address */}
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Shipping To</h3>
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-gray-900 dark:text-white font-medium">{shippingAddress.fullName}</p>
                        <p className="text-gray-600 dark:text-gray-400">{shippingAddress.phone}</p>
                        <p className="text-gray-600 dark:text-gray-400">{shippingAddress.email}</p>
                        <p className="text-gray-600 dark:text-gray-400">
                          {shippingAddress.address}, {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400">{shippingAddress.country}</p>
                      </div>
                    </div>

                    {/* Payment Summary */}
                    <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                        <span className="font-semibold">${totalPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600 dark:text-gray-400">Shipping:</span>
                        <span className="font-semibold">${shippingFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600 dark:text-gray-400">Tax:</span>
                        <span className="font-semibold">${tax.toFixed(2)}</span>
                      </div>
                      <hr className="my-3 border-gray-300 dark:border-gray-600" />
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">Total:</span>
                        <div className="text-right">
                          {paymentMethod === 'COIN' && (
                            <div className="text-lg font-bold text-primary-600">{totalInCoins} {selectedCoin}</div>
                          )}
                          <div className="text-sm text-gray-600 dark:text-gray-400">${finalTotal.toFixed(2)} USD</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <FiLock className="w-4 h-4" />
                      <span>Your payment is secure and encrypted</span>
                    </div>

                    <div className="flex space-x-4">
                      <button
                        onClick={() => setStep('payment')}
                        className="flex-1 btn btn-outline flex items-center justify-center"
                      >
                        <FiArrowLeft className="w-5 h-5 mr-2" />
                        Back
                      </button>
                      <button
                        onClick={handlePlaceOrder}
                        disabled={loading}
                        className="flex-1 btn btn-primary"
                      >
                        {loading ? 'Processing...' : 'Place Order'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 sticky top-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Order Summary</h3>
              <div className="space-y-3 mb-4">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center space-x-3">
                    <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">x{item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <hr className="my-4 border-gray-300 dark:border-gray-600" />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                  <span className="font-semibold">${totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Shipping</span>
                  <span className="font-semibold">${shippingFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Tax</span>
                  <span className="font-semibold">${tax.toFixed(2)}</span>
                </div>
                <hr className="my-2 border-gray-300 dark:border-gray-600" />
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-gray-900 dark:text-white">Total</span>
                  <span className="text-primary-600">${finalTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;

