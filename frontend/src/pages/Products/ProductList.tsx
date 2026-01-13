import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { FiSearch, FiFilter, FiShoppingCart, FiImage, FiZap } from 'react-icons/fi';
import axios from '../../api/axios';
import { addToCartAsync } from '../../store/thunks/cartThunks';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  title: string;
  description: string;
  images: string[];
  priceInCoins: number;
  priceInUSD: number;
  coinSymbol: string;
  coinLogo: string;
  condition: string;
  quantity: number;
  category: string;
  location: string;
  seller: string;
  rating: number;
  reviews: number;
}

interface TopCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  priceChangePercentage24h: number;
}

const ProductListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [topCoins, setTopCoins] = useState<TopCoin[]>([]);
  const [loadingCoins, setLoadingCoins] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedCoin, setSelectedCoin] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [useElasticsearch, setUseElasticsearch] = useState(false);
  const [imageSearchOpen, setImageSearchOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'fashion', label: 'Fashion' },
    { value: 'home-garden', label: 'Home & Garden' },
    { value: 'sports-outdoors', label: 'Sports & Outdoors' },
    { value: 'jewelry-watches', label: 'Jewelry & Watches' },
    { value: 'collectibles-art', label: 'Collectibles & Art' },
    { value: 'real-estate', label: 'Real Estate' },
    { value: 'automotive', label: 'Automotive' },
  ];

  const coinFilters = [
    { value: 'all', label: 'All Coins' },
    { value: 'BTC', label: 'Bitcoin (BTC)' },
    { value: 'ETH', label: 'Ethereum (ETH)' },
    { value: 'USDT', label: 'Tether (USDT)' },
    { value: 'BNB', label: 'Binance (BNB)' },
    { value: 'XRP', label: 'Ripple (XRP)' },
  ];

  // Fetch top coins
  useEffect(() => {
    const fetchTopCoins = async () => {
      try {
        setLoadingCoins(true);
        const response = await axios.get('/api/v1/coins/top10');
        if (response.data?.success && response.data.data?.coins) {
          setTopCoins(response.data.data.coins);
        }
      } catch (error) {
        console.error('Error fetching top coins:', error);
      } finally {
        setLoadingCoins(false);
      }
    };
    fetchTopCoins();
  }, []);

  useEffect(() => {
    setPage(1);
    setProducts([]);
    fetchProducts(1, false);
  }, [searchQuery, selectedCategory, selectedCoin, sortBy]);

  useEffect(() => {
    const search = searchParams.get('search');
    if (search) {
      setSearchQuery(search);
    }
  }, [searchParams]);

  const handleCoinFilter = (coinSymbol: string) => {
    setSelectedCoin(coinSymbol);
    setPage(1);
    setProducts([]);
  };

  const fetchProducts = async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const params: any = {
        page: pageNum,
        limit: 20,
      };
      if (searchQuery) {
        params.search = searchQuery;
        if (useElasticsearch) {
          params.useElasticsearch = 'true';
        }
      }
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (selectedCoin !== 'all') params.coinSymbol = selectedCoin;
      if (sortBy) params.sort = sortBy;

      const response = await axios.get('/api/v1/products', { params });
      const newProducts = response.data.data.products || [];
      const pagination = response.data.data.pagination;

      if (append) {
        setProducts(prev => [...prev, ...newProducts]);
      } else {
        setProducts(newProducts);
      }

      setHasMore(pagination?.hasMore || false);
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    fetchProducts(page + 1, true);
  };

  const handleImageSearch = async (file: File) => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('image', file);
      
      // Convert to base64 for API
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = reader.result as string;
          const response = await axios.post('/api/v1/ai/products/image-search', {
            imageBase64: base64.split(',')[1],
          });
          
          if (response.data.success) {
            setProducts(response.data.data.products || []);
            toast.success(`Tìm thấy ${response.data.data.products?.length || 0} sản phẩm tương tự`);
            setImageSearchOpen(false);
          }
        } catch (error: any) {
          console.error('Image search error:', error);
          toast.error('Tính năng tìm kiếm bằng hình ảnh chưa được triển khai trên server. Vui lòng liên hệ admin.');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Image search error:', error);
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts(1, false);
  };

  const handleAddToCart = async (product: Product) => {
    // ✅ Đảm bảo ID là string
    const productId = String(product._id || product.id).trim();
    
    if (!productId || productId === 'undefined' || productId === 'null') {
      toast.error('Invalid product data');
      return;
    }

    try {
      const result = await dispatch(addToCartAsync({
        productId: productId,
        name: product.title,
        price: product.priceInUSD,
        quantity: 1,
        image: product.images?.[0] || product.image || 'https://via.placeholder.com/400',
        priceInCoins: product.priceInCoins,
      }) as any);
      
      if (addToCartAsync.rejected.match(result)) {
        toast.error(result.payload as string || 'Failed to add to cart');
      } else {
        toast.success(`${product.title} added to cart!`);
      }
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      toast.error(error.message || 'Failed to add to cart');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {t('products.all_products') || 'All Products'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('products.browse_desc') || 'Browse tokenized real-world assets'}
          </p>
        </motion.div>

        {/* Search & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md mb-8"
        >
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="relative flex items-center space-x-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('products.search_placeholder') || 'Search products...'}
                  className="w-full px-4 py-3 pl-12 pr-32 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                />
                <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setUseElasticsearch(!useElasticsearch)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      useElasticsearch
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                    }`}
                    title="Sử dụng Elasticsearch để tìm kiếm tốt hơn"
                  >
                    <FiZap className="w-3 h-3 inline mr-1" />
                    ES
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImageSearchOpen(true)}
                className="px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                title="Tìm kiếm bằng hình ảnh với AI"
              >
                <FiImage className="w-5 h-5" />
                <span className="hidden md:inline">Tìm bằng ảnh</span>
              </button>
            </div>
            {useElasticsearch && (
              <p className="mt-2 text-xs text-primary-600 dark:text-primary-400 flex items-center space-x-1">
                <FiZap className="w-3 h-3" />
                <span>Đang sử dụng Elasticsearch để tìm kiếm chính xác hơn</span>
              </p>
            )}
          </form>

          {/* Image Search Modal */}
          {imageSearchOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Tìm kiếm bằng hình ảnh
                </h3>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImageFile(file);
                      handleImageSearch(file);
                    }
                  }}
                  className="w-full mb-4"
                />
                {imageFile && (
                  <div className="mb-4">
                    <img
                      src={URL.createObjectURL(imageFile)}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                )}
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setImageSearchOpen(false);
                      setImageFile(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Top Coins Filter Buttons */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('products.filter_by_coin', 'Filter by Coin')}:
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleCoinFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedCoin === 'all'
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {t('products.all', 'All')}
              </button>
              {loadingCoins ? (
                <div className="flex items-center space-x-2 px-4 py-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                  <span className="text-sm text-gray-500">{t('common.loading', 'Loading...')}</span>
                </div>
              ) : (
                topCoins.map((coin) => (
                  <button
                    key={coin.id}
                    onClick={() => handleCoinFilter(coin.symbol.toUpperCase())}
                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center space-x-2 ${
                      selectedCoin === coin.symbol.toUpperCase()
                        ? 'bg-primary-600 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {coin.image && (
                      <img
                        src={coin.image}
                        alt={coin.symbol}
                        className="w-5 h-5 rounded-full"
                      />
                    )}
                    <span>{coin.symbol.toUpperCase()}</span>
                    {coin.priceChangePercentage24h && (
                      <span
                        className={`text-xs ${
                          coin.priceChangePercentage24h >= 0
                            ? 'text-green-500'
                            : 'text-red-500'
                        }`}
                      >
                        {coin.priceChangePercentage24h >= 0 ? '+' : ''}
                        {coin.priceChangePercentage24h.toFixed(2)}%
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <FiFilter className="inline w-4 h-4 mr-2" />
                {t('products.category') || 'Category'}
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Coin Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <FiFilter className="inline w-4 h-4 mr-2" />
                Payment Coin
              </label>
              <select
                value={selectedCoin}
                onChange={(e) => setSelectedCoin(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              >
                {coinFilters.map((coin) => (
                  <option key={coin.value} value={coin.value}>
                    {coin.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('products.sort_by') || 'Sort By'}
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="newest">{t('products.newest') || 'Newest'}</option>
                <option value="price_low">{t('products.price_low') || 'Price: Low to High'}</option>
                <option value="price_high">{t('products.price_high') || 'Price: High to Low'}</option>
                <option value="popular">{t('products.popular') || 'Most Popular'}</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Results Count & Loading State */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              <p className="text-gray-600 dark:text-gray-400">{t('common.loading', 'Loading...')}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 text-gray-600 dark:text-gray-400 font-medium">
              {products.length} {t('products.results') || 'results'}
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
              onClick={() => navigate(`/products/${product.id}`)}
            >
              {/* Product Image */}
              <div className="relative h-48 overflow-hidden bg-gray-100 dark:bg-gray-700">
                {product.images && product.images.length > 0 ? (
                  <img
                    src={product.images[0]}
                    alt={product.title}
                    className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=No+Image';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-400">
                    <span className="text-sm">No Image</span>
                  </div>
                )}
                <div className="absolute top-2 right-2 px-2 py-1 bg-white dark:bg-gray-800 rounded-full text-xs font-semibold shadow-sm">
                  {product.condition || 'New'}
                </div>
              </div>

              {/* Product Info */}
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                  {product.title}
                </h3>

                {/* Price */}
                <div className="mb-3">
                  <div className="flex items-center space-x-2 mb-1">
                    {product.coinLogo && (
                      <img
                        src={product.coinLogo}
                        alt={product.coinSymbol}
                        className="w-5 h-5 rounded-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="text-xl font-bold text-primary-600 dark:text-primary-400">
                      {product.priceInCoins?.toFixed(4) || '0'} {product.coinSymbol || 'N/A'}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    ≈ ${(product.priceInUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Seller & Location */}
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-3 space-y-1">
                  {product.seller && (
                    <div className="truncate" title={product.seller}>
                      <span className="font-medium">Seller:</span> {product.seller}
                    </div>
                  )}
                  {product.location && (
                    <div className="truncate" title={product.location}>
                      <span className="font-medium">📍</span> {product.location}
                    </div>
                  )}
                </div>

                {/* Add to Cart Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddToCart(product);
                  }}
                  disabled={product.quantity === 0}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiShoppingCart className="w-4 h-4" />
                  <span>{product.quantity > 0 ? t('products.add_to_cart') || 'Add to Cart' : t('products.out_of_stock') || 'Out of Stock'}</span>
                </motion.button>
              </div>
            </motion.div>
          ))}
            </div>
          </>
        )}

        {/* Load More Button */}
        {hasMore && !loading && (
          <div className="flex justify-center mb-8">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loadingMore ? (
                <span className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Loading...</span>
                </span>
              ) : (
                'Load More'
              )}
            </motion.button>
          </div>
        )}

        {/* No Results */}
        {products.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              {t('products.no_results') || 'No products found. Try adjusting your filters.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductListPage;

