import { motion } from 'framer-motion';
import { FiShield, FiZap, FiDollarSign, FiTrendingUp, FiLock, FiGlobe } from 'react-icons/fi';

const features = [
  {
    icon: FiShield,
    title: 'Secure Trading',
    description: 'Bank-grade security with blockchain verification for every transaction',
    color: 'from-blue-500 to-blue-600',
  },
  {
    icon: FiZap,
    title: 'Instant Transactions',
    description: 'Lightning-fast transactions powered by Layer 2 blockchain technology',
    color: 'from-yellow-500 to-orange-600',
  },
  {
    icon: FiDollarSign,
    title: 'Low Fees',
    description: 'Competitive fees with transparent pricing and no hidden charges',
    color: 'from-green-500 to-emerald-600',
  },
  {
    icon: FiTrendingUp,
    title: 'Real-Time Prices',
    description: 'Live cryptocurrency market data updated every minute',
    color: 'from-purple-500 to-pink-600',
  },
  {
    icon: FiLock,
    title: 'P2P Trading',
    description: 'Secure peer-to-peer coin trading with escrow protection',
    color: 'from-red-500 to-rose-600',
  },
  {
    icon: FiGlobe,
    title: 'Global Access',
    description: 'Trade from anywhere in the world, 24/7 availability',
    color: 'from-indigo-500 to-blue-600',
  },
];

const Features = () => {
  return (
    <div>
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Why Choose TokenAsset?
        </h2>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Experience the future of asset trading with our cutting-edge platform
        </p>
      </motion.div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {features.map((feature, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -8 }}
            className="group relative bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all border border-gray-200 dark:border-gray-700"
          >
            {/* Icon with Gradient Background */}
            <div className="relative mb-6">
              <div className={`w-16 h-16 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-6 transition-transform shadow-lg`}>
                <feature.icon className="w-8 h-8 text-white" />
              </div>
              {/* Glow Effect */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity`} />
            </div>

            {/* Content */}
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              {feature.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {feature.description}
            </p>

            {/* Decorative Element */}
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${feature.color} transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left rounded-b-2xl`} />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Features;

