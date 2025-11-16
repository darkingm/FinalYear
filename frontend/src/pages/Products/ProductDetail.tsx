import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { 
  FiShoppingCart, 
  FiHeart, 
  FiStar, 
  FiArrowLeft,
  FiShare2,
  FiCheck,
  FiTruck,
  FiShield,
  FiPlus,
  FiMinus
} from 'react-icons/fi';
import axios from '../../api/axios';
import { addToCart } from '../../store/slices/cartSlice';
import { RootState } from '../../store';
import toast from 'react-hot-toast';

interface Product {
  _id: string;
  id: string;
  title: string;
  description: string;
  images: string[];
  priceInCoins: number;
  priceInUSD: number;
  coinSymbol: string;
  coinLogo: string;
  sellerName: string;
  sellerId: string;
  rating: number;
  reviews: number;
  condition: string;
  quantity: number;
  category: string;
  tags: string[];
  createdAt: string;
  views: number;
  likes: number;
}

const ProductDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/v1/products/${id}`);
      const productData = response.data.data;
      
      // Transform backend data
      const transformedProduct: Product = {
        _id: productData._id || productData.id,
        id: productData._id || productData.id,
        title: productData.title,
        description: productData.description || '',
        images: productData.images || [productData.image] || ['https://via.placeholder.com/800'],
        priceInCoins: productData.priceInCoins || 0,
        priceInUSD: productData.priceInUSD || 0,
        coinSymbol: productData.coinSymbol || 'BTC',
        coinLogo: productData.coinLogo || 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
        sellerName: productData.sellerName || 'Verified Seller',
        sellerId: productData.sellerId || '',
        rating: productData.rating || 4.5,
        reviews: productData.reviews || 0,
        condition: productData.condition || 'NEW',
        quantity: productData.quantity || productData.stock || 0,
        category: productData.category || '',
        tags: productData.tags || [],
        createdAt: productData.createdAt || new Date().toISOString(),
        views: productData.views || 0,
        likes: productData.likes || 0,
      };
      
      setProduct(transformedProduct);
    } catch (err: any) {
      console.error('Error fetching product:', err);
      if (err.code === 'ECONNABORTED' || err.message?.includes('aborted')) {
        setError('Request was cancelled. Please try again.');
      } else if (err.response?.status === 404) {
        setError('Product not found');
      } else {
        setError('Failed to load product. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;
    
    if (!isAuthenticated) {
      toast.error('Please login to add items to cart');
      navigate('/auth');
      return;
    }

    if (product.quantity < quantity) {
      toast.error(`Only ${product.quantity} items available`);
      return;
    }

    setAddingToCart(true);
    try {
      dispatch(addToCart({
        id: product.id,
        name: product.title,
        price: product.priceInUSD,
        quantity: quantity,
        image: product.images[0] || 'https://via.placeholder.com/400',
      }));
      
      toast.success(`${product.title} added to cart!`);
    } catch (err) {
      toast.error('Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to add favorites');
      navigate('/auth');
      return;
    }

    try {
      // TODO: Implement favorite API
      setIsFavorite(!isFavorite);
      toast.success(isFavorite ? 'Removed from favorites' : 'Added to favorites');
    } catch (err) {
      toast.error('Failed to update favorites');
    }
  };

  const handleShare = async () => {
    if (navigator.share && product) {
      try {
        await navigator.share({
          title: product.title,
          text: product.description,
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  const conditionColors: Record<string, string> = {
    NEW: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    LIKE_NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:bg-blue-300',
    GOOD: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    USED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-16">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto"
          >
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {error || 'Product Not Found'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              {error || 'The product you are looking for does not exist.'}
            </p>
            <Link
              to="/products"
              className="btn btn-primary inline-flex items-center space-x-2"
            >
              <FiArrowLeft className="w-5 h-5" />
              <span>Back to Products</span>
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          <FiArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </motion.button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Product Images */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            {/* Main Image */}
            <div className="relative bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg aspect-square">
              <img
                src={product.images[selectedImage] || 'https://via.placeholder.com/800'}
                alt={product.title}
                className="w-full h-full object-cover"
              />
              {/* Favorite Button */}
              <button
                onClick={handleToggleFavorite}
                className={`absolute top-4 right-4 p-3 rounded-full shadow-lg transition-colors ${
                  isFavorite
                    ? 'bg-red-500 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-gray-700'
                }`}
              >
                <FiHeart className={`w-6 h-6 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Thumbnail Images */}
            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {product.images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImage === index
                        ? 'border-primary-600 ring-2 ring-primary-200'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary-400'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${product.title} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Product Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Title & Condition */}
            <div>
              <div className="flex items-start justify-between mb-2">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                  {product.title}
                </h1>
                <button
                  onClick={handleShare}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                >
                  <FiShare2 className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex items-center space-x-4 mb-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${conditionColors[product.condition] || conditionColors.NEW}`}>
                  {product.condition}
                </span>
                <div className="flex items-center space-x-1">
                  <FiStar className="w-5 h-5 text-yellow-400 fill-current" />
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {product.rating}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    ({product.reviews} reviews)
                  </span>
                </div>
              </div>
            </div>

            {/* Price */}
            <div className="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 p-6 rounded-lg">
              <div className="flex items-center space-x-3 mb-2">
                <img
                  src={product.coinLogo}
                  alt={product.coinSymbol}
                  className="w-8 h-8"
                />
                <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                  {product.priceInCoins} {product.coinSymbol}
                </div>
              </div>
              <div className="text-lg text-gray-600 dark:text-gray-400">
                ≈ ${product.priceInUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Stock & Seller */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Stock:</span>
                <span className={`font-semibold ${product.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {product.quantity > 0 ? `${product.quantity} available` : 'Out of Stock'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Seller:</span>
                <Link
                  to={`/seller/${product.sellerId}`}
                  className="font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {product.sellerName}
                </Link>
              </div>
            </div>

            {/* Quantity Selector */}
            {product.quantity > 0 && (
              <div className="flex items-center space-x-4">
                <span className="text-gray-700 dark:text-gray-300 font-medium">Quantity:</span>
                <div className="flex items-center space-x-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiMinus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center font-semibold">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.quantity, quantity + 1))}
                    disabled={quantity >= product.quantity}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiPlus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 pt-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddToCart}
                disabled={product.quantity === 0 || addingToCart}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white py-4 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiShoppingCart className="w-5 h-5" />
                <span>{addingToCart ? 'Adding...' : product.quantity > 0 ? 'Add to Cart' : 'Out of Stock'}</span>
              </motion.button>
              
              {product.quantity > 0 && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    handleAddToCart();
                    setTimeout(() => navigate('/checkout'), 500);
                  }}
                  className="w-full bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600 text-white py-4 rounded-lg font-semibold transition-colors"
                >
                  Buy Now
                </motion.button>
              )}
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2 text-sm">
                <FiTruck className="w-5 h-5 text-primary-600" />
                <span className="text-gray-600 dark:text-gray-400">Free Shipping</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <FiShield className="w-5 h-5 text-primary-600" />
                <span className="text-gray-600 dark:text-gray-400">Secure Payment</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <FiCheck className="w-5 h-5 text-primary-600" />
                <span className="text-gray-600 dark:text-gray-400">Verified Seller</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Description & Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-12 bg-white dark:bg-gray-800 rounded-lg shadow-md p-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Product Description
          </h2>
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
              {product.description || 'No description available.'}
            </p>
          </div>

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {product.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ProductDetailPage;

