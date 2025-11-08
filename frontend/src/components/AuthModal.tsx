import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { FiMail, FiLock, FiUser, FiPhone, FiEye, FiEyeOff, FiX } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { FaFacebook } from 'react-icons/fa';
import { setCredentials } from '../store/slices/authSlice';
import axios from '../api/axios';
import toast from 'react-hot-toast';

type ViewMode = 'login' | 'register' | 'verify' | 'forgot';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: ViewMode;
}

const AuthModal = ({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phoneNumber: '',
  });
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [forgotEmail, setForgotEmail] = useState('');

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setViewMode(initialMode);
      setLoginData({ email: '', password: '' });
      setRegisterData({
        email: '',
        username: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        phoneNumber: '',
      });
      setOtp(['', '', '', '', '', '']);
      setForgotEmail('');
    }
  }, [isOpen, initialMode]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post('/api/v1/auth/login', loginData);
      const { user, accessToken, refreshToken } = response.data.data;

      dispatch(setCredentials({ user, accessToken, refreshToken }));
      toast.success(t('auth.login_title') + ' successful!');
      onClose();
      navigate('/');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (registerData.password !== registerData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await axios.post('/api/v1/auth/register', {
        email: registerData.email,
        username: registerData.username,
        password: registerData.password,
        fullName: registerData.fullName,
        phoneNumber: registerData.phoneNumber,
      });

      toast.success('Registration successful! Please verify your email.');
      setViewMode('verify');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = (provider: 'google' | 'facebook') => {
    window.location.href = `/api/v1/auth/${provider}`;
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join('');

    if (otpCode.length !== 6) {
      toast.error('Please enter complete OTP');
      return;
    }

    setLoading(true);

    try {
      await axios.post('/api/v1/auth/verify-otp', {
        email: registerData.email,
        otp: otpCode,
      });

      toast.success('Email verified successfully!');
      setViewMode('login');
      setOtp(['', '', '', '', '', '']);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post('/api/v1/auth/forgot-password', {
        email: forgotEmail,
      });

      toast.success('Password reset link sent to your email');
      setViewMode('login');
      setForgotEmail('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  // Animation variants
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
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
          className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto relative"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-10"
          >
            <FiX className="w-5 h-5" />
          </button>

          <div className="p-8 md:p-12">
            <AnimatePresence mode="wait" custom={viewMode === 'register' ? 1 : -1}>
              {/* Login View */}
              {viewMode === 'login' && (
                <motion.div
                  key="login"
                  custom={-1}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    {t('auth.login_title')}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-8">
                    Enter your credentials to continue
                  </p>

                  <form onSubmit={handleLogin} className="space-y-6">
                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('auth.email')}
                      </label>
                      <div className="relative">
                        <FiMail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="email"
                          value={loginData.email}
                          onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                          className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="your@email.com"
                          required
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('auth.password')}
                      </label>
                      <div className="relative">
                        <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={loginData.password}
                          onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                          className="w-full pl-12 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="••••••••"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {showPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                    </div>

                    {/* Forgot Password */}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setViewMode('forgot')}
                        className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                      >
                        {t('auth.forgot_password')}
                      </button>
                    </div>

                    {/* Submit */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={loading}
                      className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors"
                    >
                      {loading ? 'Logging in...' : t('nav.login')}
                    </motion.button>

                    {/* Divider */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                          {t('auth.or_continue_with')}
                        </span>
                      </div>
                    </div>

                    {/* OAuth Buttons */}
                    <div className="grid grid-cols-2 gap-4">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={() => handleOAuthLogin('google')}
                        className="flex items-center justify-center space-x-2 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <FcGoogle className="w-5 h-5" />
                        <span className="font-medium text-gray-700 dark:text-gray-300">Google</span>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={() => handleOAuthLogin('facebook')}
                        className="flex items-center justify-center space-x-2 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <FaFacebook className="w-5 h-5 text-blue-600" />
                        <span className="font-medium text-gray-700 dark:text-gray-300">Facebook</span>
                      </motion.button>
                    </div>

                    {/* Register Link */}
                    <p className="text-center text-gray-600 dark:text-gray-400">
                      {t('auth.no_account')}{' '}
                      <button
                        type="button"
                        onClick={() => setViewMode('register')}
                        className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-semibold"
                      >
                        {t('nav.register')}
                      </button>
                    </p>
                  </form>
                </motion.div>
              )}

              {/* Register View */}
              {viewMode === 'register' && (
                <motion.div
                  key="register"
                  custom={1}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    {t('auth.register_title')}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-8">
                    Create your account to get started
                  </p>

                  <form onSubmit={handleRegister} className="space-y-4">
                    {/* Full Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('auth.full_name')}
                      </label>
                      <div className="relative">
                        <FiUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={registerData.fullName}
                          onChange={(e) => setRegisterData({ ...registerData, fullName: e.target.value })}
                          className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          required
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('auth.email')}
                      </label>
                      <div className="relative">
                        <FiMail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="email"
                          value={registerData.email}
                          onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                          className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          required
                        />
                      </div>
                    </div>

                    {/* Username */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('auth.username')}
                      </label>
                      <div className="relative">
                        <FiUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={registerData.username}
                          onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                          className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          required
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('auth.phone_number')}
                      </label>
                      <div className="relative">
                        <FiPhone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="tel"
                          value={registerData.phoneNumber}
                          onChange={(e) => setRegisterData({ ...registerData, phoneNumber: e.target.value })}
                          className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('auth.password')}
                      </label>
                      <input
                        type="password"
                        value={registerData.password}
                        onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('auth.confirm_password')}
                      </label>
                      <input
                        type="password"
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                    </div>

                    {/* Submit */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={loading}
                      className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors"
                    >
                      {loading ? 'Creating account...' : t('nav.register')}
                    </motion.button>

                    {/* Login Link */}
                    <p className="text-center text-gray-600 dark:text-gray-400">
                      {t('auth.have_account')}{' '}
                      <button
                        type="button"
                        onClick={() => setViewMode('login')}
                        className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-semibold"
                      >
                        {t('nav.login')}
                      </button>
                    </p>
                  </form>
                </motion.div>
              )}

              {/* OTP Verification View */}
              {viewMode === 'verify' && (
                <motion.div
                  key="verify"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FiMail className="w-8 h-8 text-primary-600" />
                  </div>

                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    {t('auth.verify_email')}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-8">
                    Enter the 6-digit code sent to<br />
                    <strong>{registerData.email}</strong>
                  </p>

                  <form onSubmit={handleVerifyOtp} className="space-y-6">
                    {/* OTP Input */}
                    <div className="flex justify-center space-x-2">
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          id={`otp-${index}`}
                          type="text"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      ))}
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={loading}
                      className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors"
                    >
                      {loading ? 'Verifying...' : 'Verify Email'}
                    </motion.button>

                    <button
                      type="button"
                      onClick={() => setViewMode('register')}
                      className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
                    >
                      {t('auth.resend_code')}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* Forgot Password View */}
              {viewMode === 'forgot' && (
                <motion.div
                  key="forgot"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    {t('auth.forgot_password')}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-8">
                    Enter your email to receive a password reset link
                  </p>

                  <form onSubmit={handleForgotPassword} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('auth.email')}
                      </label>
                      <div className="relative">
                        <FiMail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="your@email.com"
                          required
                        />
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={loading}
                      className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors"
                    >
                      {loading ? 'Sending...' : 'Send Reset Link'}
                    </motion.button>

                    <button
                      type="button"
                      onClick={() => setViewMode('login')}
                      className="w-full text-primary-600 hover:text-primary-700 dark:text-primary-400 font-semibold"
                    >
                      Back to Login
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AuthModal;

