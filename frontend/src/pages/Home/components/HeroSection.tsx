import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowRight, FiShield, FiTrendingUp, FiZap } from 'react-icons/fi';

interface HeroSectionProps {
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
}

const HeroSection = ({ onLoginClick, onRegisterClick }: HeroSectionProps) => {
  const { t } = useTranslation();

  const floatingAnimation = {
    y: [0, -20, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut"
    }
  };

  return (
    <div className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-600 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={floatingAnimation}
          className="absolute top-20 left-10 w-72 h-72 bg-primary-400/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            y: [0, 30, 0],
            transition: { duration: 4, repeat: Infinity, ease: "easeInOut" }
          }}
          className="absolute bottom-20 right-10 w-96 h-96 bg-secondary-400/20 rounded-full blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 py-20 md:py-32 relative z-10">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="text-white"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-lg rounded-full px-4 py-2 mb-6"
            >
              <FiZap className="w-4 h-4 text-yellow-300" />
              <span className="text-sm font-medium">New: Blockchain Powered</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-6xl font-bold mb-6 leading-tight"
            >
              {t('home.hero_title')}
              <span className="block text-yellow-300">With Cryptocurrency</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-xl text-gray-100 mb-8"
            >
              {t('home.hero_subtitle')}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap gap-4"
            >
              {onLoginClick ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onLoginClick}
                  className="bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold flex items-center space-x-2 shadow-xl hover:shadow-2xl transition-shadow"
                >
                  <span>{t('nav.login')}</span>
                  <FiArrowRight />
                </motion.button>
              ) : (
                <Link to="/products">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold flex items-center space-x-2 shadow-xl hover:shadow-2xl transition-shadow"
                  >
                    <span>{t('home.get_started')}</span>
                    <FiArrowRight />
                  </motion.button>
                </Link>
              )}
              {onRegisterClick ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onRegisterClick}
                  className="bg-white/10 backdrop-blur-lg text-white px-8 py-4 rounded-lg font-semibold border-2 border-white/30 hover:bg-white/20 transition-colors"
                >
                  {t('nav.register')}
                </motion.button>
              ) : (
                <Link to="/about">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-white/10 backdrop-blur-lg text-white px-8 py-4 rounded-lg font-semibold border-2 border-white/30 hover:bg-white/20 transition-colors"
                  >
                    {t('home.learn_more')}
                  </motion.button>
                </Link>
              )}
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="grid grid-cols-3 gap-6 mt-12"
            >
              {[
                { label: 'Active Users', value: '50K+' },
                { label: 'Products Listed', value: '10K+' },
                { label: 'Total Trading', value: '$2M+' }
              ].map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl font-bold text-yellow-300">{stat.value}</div>
                  <div className="text-sm text-gray-200">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right Content - 3D Cards */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative hidden md:block"
          >
            <div className="relative w-full h-[500px]">
              {/* Floating Cards */}
              <motion.div
                animate={{
                  y: [0, -20, 0],
                  rotate: [0, 5, 0]
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute top-0 right-0 w-64 h-80 bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl"
              >
                <FiShield className="w-12 h-12 text-yellow-300 mb-4" />
                <h3 className="text-white font-bold text-xl mb-2">Secure Trading</h3>
                <p className="text-gray-200 text-sm">Bank-grade security with blockchain verification</p>
              </motion.div>

              <motion.div
                animate={{
                  y: [0, 20, 0],
                  rotate: [0, -5, 0]
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5
                }}
                className="absolute bottom-0 left-0 w-64 h-80 bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl"
              >
                <FiTrendingUp className="w-12 h-12 text-green-300 mb-4" />
                <h3 className="text-white font-bold text-xl mb-2">Real-Time Prices</h3>
                <p className="text-gray-200 text-sm">Live cryptocurrency market data updated every minute</p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Wave Divider */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <path
            d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            className="fill-white dark:fill-gray-800"
          />
        </svg>
      </div>
    </div>
  );
};

export default HeroSection;

