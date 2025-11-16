import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { FiShoppingCart, FiHeart, FiStar } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import axios from '../../../api/axios';
import { addToCart } from '../../../store/slices/cartSlice';
import toast from 'react-hot-toast';
import { handleAddToCart } from '../../../utils/cartUtils';

interface Product {
  id: string;
  title: string;
  description: string;
  image: string;
  priceInCoins: number;
  priceInUSD: number;
  coinSymbol: string;
  coinLogo: string;
  seller: string;
  rating: number;
  reviews: number;
  condition: string;
  stock: number;
}

const ProductGrid = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/v1/products/featured');
      const backendProducts = response.data.data.products || [];
      
      // ✅ Transform backend data - đảm bảo ID là string unique
      const transformedProducts = backendProducts.map((p: any) => ({
        id: String(p._id || p.id), // ✅ Convert ObjectId sang string
        title: p.title,
        description: p.description || '', // ✅ Thêm description
        image: p.images?.[0] || 'https://via.placeholder.com/400',
        priceInCoins: p.priceInCoins || 0,
        priceInUSD: p.priceInUSD || 0,
        coinSymbol: p.coinSymbol || 'BTC',
        coinLogo: p.coinLogo || 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
        seller: p.sellerName || 'Verified Seller',
        rating: p.rating || 4.5,
        reviews: p.reviews || 0,
        condition: p.condition || 'NEW',
        stock: p.quantity || 0,
      }));
      
      // ✅ Debug: Log để kiểm tra IDs
      console.log('Products loaded:', transformedProducts.map(p => ({ 
        id: p.id, 
        idType: typeof p.id,
        title: p.title 
      })));
      
      setProducts(transformedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products. Please check if product service is running.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const onAddToCart = (product: Product) => {
    handleAddToCart(product, dispatch);
  };

  const conditionColors: Record<string, string> = {
    NEW: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    LIKE_NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    GOOD: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

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

      {/* Empty State */}
      {products.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {t('home.no_products') || 'No products available. Please start the product service.'}
          </p>
        </div>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product, index) => (
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

              {/* Price with Coin Logo */}
              <div className="mb-4">
                <div className="flex items-center space-x-2 mb-2">
                  <img 
                    src={product.coinLogo} 
                    alt={product.coinSymbol}
                    className="w-6 h-6"
                  />
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {product.priceInCoins} {product.coinSymbol}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    ≈ ${product.priceInUSD.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {product.stock} in stock
                  </div>
                </div>
              </div>

              {/* Add to Cart Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onAddToCart(product)}
                disabled={product.stock === 0}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiShoppingCart className="w-5 h-5" />
                <span>{product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}</span>
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

