import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiShoppingCart, FiHeart, FiStar } from 'react-icons/fi';
import { Link } from 'react-router-dom';

// Mock data - sẽ thay bằng API sau
const mockProducts = Array.from({ length: 22 }, (_, i) => ({
  id: `product-${i + 1}`,
  title: `Premium Product ${i + 1}`,
  description: 'High quality tokenized real-world asset',
  image: `https://picsum.photos/400/400?random=${i + 1}`,
  priceInCoins: (Math.random() * 10 + 1).toFixed(2),
  priceInUSD: (Math.random() * 1000 + 100).toFixed(2),
  seller: `Seller ${Math.floor(Math.random() * 100)}`,
  rating: (Math.random() * 2 + 3).toFixed(1),
  reviews: Math.floor(Math.random() * 500),
  condition: ['NEW', 'LIKE_NEW', 'GOOD'][Math.floor(Math.random() * 3)],
}));

const ProductGrid = () => {
  const { t } = useTranslation();

  const conditionColors: Record<string, string> = {
    NEW: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    LIKE_NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    GOOD: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  };

  return (
    <div>
      {/* Section Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2"
          >
            {t('home.recommended_products')}
          </motion.h2>
          <p className="text-gray-600 dark:text-gray-400">
            Discover amazing tokenized real-world assets
          </p>
        </div>

        <Link
          to="/products"
          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
        >
          {t('home.view_all')} →
        </Link>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {mockProducts.map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -8 }}
            className="group bg-white dark:bg-gray-700 rounded-xl shadow-lg hover:shadow-2xl transition-all overflow-hidden border border-gray-200 dark:border-gray-600"
          >
            {/* Product Image */}
            <Link to={`/products/${product.id}`} className="block relative overflow-hidden">
              <div className="aspect-square relative">
                <img
                  src={product.image}
                  alt={product.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                {/* Condition Badge */}
                <div className="absolute top-3 left-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${conditionColors[product.condition]}`}>
                    {product.condition.replace('_', ' ')}
                  </span>
                </div>
                {/* Like Button */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="absolute top-3 right-3 w-10 h-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 transition-colors shadow-lg"
                >
                  <FiHeart className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </motion.button>
              </div>
            </Link>

            {/* Product Info */}
            <div className="p-4">
              {/* Title */}
              <Link to={`/products/${product.id}`}>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                  {product.title}
                </h3>
              </Link>

              {/* Seller */}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                by {product.seller}
              </p>

              {/* Rating */}
              <div className="flex items-center space-x-1 mb-3">
                <FiStar className="w-4 h-4 text-yellow-400 fill-current" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {product.rating}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({product.reviews})
                </span>
              </div>

              {/* Price */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {product.priceInCoins} ₿
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    ${product.priceInUSD}
                  </div>
                </div>
              </div>

              {/* Add to Cart Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors shadow-md hover:shadow-lg"
              >
                <FiShoppingCart className="w-5 h-5" />
                <span>Add to Cart</span>
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Load More */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="text-center mt-12"
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-8 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
        >
          Load More Products
        </motion.button>
      </motion.div>
    </div>
  );
};

export default ProductGrid;

