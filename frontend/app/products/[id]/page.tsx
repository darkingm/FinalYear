'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingCart, Heart, Share2, Truck, Shield, RefreshCw, MapPin, Trash, Edit } from 'lucide-react';
import Link from 'next/link';

// Import new components
import { ImageGallery } from '@/components/product/ImageGallery';
import { RelatedProducts } from '@/components/product/RelatedProducts';
import { ProductReviews } from '@/components/product/ProductReviews';
import { Badge } from '@/components/ui/Badge';

interface Product {
  product_id: number;
  name: string;
  description: string;
  base_price_usd: number;
  pricing_mode?: string;
  price_token?: string | number;
  token_symbol?: string;
  token_decimals?: number;
  metadata: {
    images?: string[];
    category?: string;
    accepted_tokens?: { crypto?: string[]; fiat?: string[] };
    attributes?: any;
    location?: string;
  };
  stock: number;
  stock_available?: number;
  seller_name: string;
  seller_id: number;
  owner_user_id: number;
  rating_avg?: number;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchProduct();
    }
  }, [params.id]);

  const fetchProduct = async () => {
    try {
      const response = await apiClient.get(`/api/products/${params.id}`);
      setProduct(response.data.data);
    } catch (error) {
      toast.error('Product not found');
      router.push('/products');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyNow = async () => {
    if (!session) {
      toast.error('Please login first');
      router.push('/login');
      return;
    }

    setBuyLoading(true);
    try {
      const response = await apiClient.post('/api/orders', {
        product_id: product?.product_id,
        quantity,
      });

      toast.success('Order created! Redirecting to checkout...');
      router.push(`/checkout/${response.data.order.order_id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create order');
    } finally {
      setBuyLoading(false);
    }
  };

  const isOwner = session?.user?.id === String(product?.owner_user_id);

  const handleDeleteProduct = async () => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await apiClient.delete(`/api/products/${product?.product_id}`);
      toast.success('Product deleted successfully');
      router.push('/products');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete product');
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: product?.name,
        text: product?.description,
        url: window.location.href,
      });
    } catch {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
            <div className="space-y-4">
              <div className="h-8 w-3/4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-12 w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Product not found</h2>
            <Link href="/products">
              <Button>Back to Products</Button>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6"
        >
          <Button variant="ghost" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </motion.div>

        {/* Product Details */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Gallery */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <ImageGallery
              images={product.metadata?.images || []}
              productName={product.name}
              category={product.metadata?.category}
            />
          </motion.div>

          {/* Product Info */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-6"
          >
            {/* Category & Stock Badge */}
            <div className="flex items-center gap-2 flex-wrap">
              {product.metadata?.category && (
                <Badge variant="outline">{product.metadata.category}</Badge>
              )}
              {product.stock > 0 ? (
                <Badge variant="success" dot>In Stock</Badge>
              ) : (
                <Badge variant="error">Out of Stock</Badge>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl lg:text-4xl font-bold">{product.name}</h1>

            {/* Price */}
            <div className="flex flex-col gap-1">
              {product.pricing_mode === 'crypto' && product.price_token ? (
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold">
                    {Number(product.price_token).toString()}
                  </span>
                  <span className="text-lg font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded">
                    {product.token_symbol}
                  </span>
                </div>
              ) : product.pricing_mode === 'both' && product.price_token ? (
                <>
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-bold text-primary">
                      ${Number(product.base_price_usd).toFixed(2)}
                    </span>
                    <span className="text-muted-foreground font-medium">USD</span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-muted-foreground">or</span>
                    <span className="text-2xl font-bold">{Number(product.price_token).toString()}</span>
                    <span className="text-blue-500 font-bold">{product.token_symbol}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold text-primary">
                    ${Number(product.base_price_usd).toFixed(2)}
                  </span>
                  <span className="text-muted-foreground font-medium">USD</span>
                </div>
              )}
            </div>

            {/* Description */}
            <p className="text-muted-foreground leading-relaxed">
              {product.description}
            </p>

            {/* Accepted Payment Methods */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <h3 className="font-semibold mb-3">Accepted Payments</h3>
              <div className="flex gap-2 flex-wrap">
                {product.metadata?.accepted_tokens?.crypto?.map((token) => (
                  <div key={token} className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <img
                      src={`https://cryptologos.cc/logos/${token.toLowerCase()}-logo.svg`}
                      alt={token}
                      className="w-5 h-5"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <span className="font-medium text-sm">{token}</span>
                  </div>
                ))}
                {product.metadata?.accepted_tokens?.fiat?.includes('paypal') && (
                  <div className="px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg font-medium text-sm">
                    PayPal
                  </div>
                )}
              </div>
            </div>

            {/* Quantity Selector */}
            <div>
              <label className="block text-sm font-medium mb-2">Quantity</label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  -
                </Button>
                <span className="text-2xl font-semibold w-16 text-center">{quantity}</span>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  disabled={quantity >= product.stock}
                >
                  +
                </Button>
                <span className="text-sm text-muted-foreground ml-2">
                  {product.stock} available
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleBuyNow}
                size="lg"
                className="flex-1 text-lg py-6"
                disabled={product.stock === 0 || buyLoading}
              >
                {buyLoading ? (
                  <span className="animate-spin mr-2">⟳</span>
                ) : (
                  <ShoppingCart className="w-5 h-5 mr-2" />
                )}
                {product.stock === 0 ? 'Out of Stock' : 'Buy Now'}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setIsWishlisted(!isWishlisted)}
                className={isWishlisted ? 'text-red-500 border-red-500' : ''}
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
              </Button>
              <Button variant="outline" size="lg" onClick={handleShare}>
                <Share2 className="w-5 h-5" />
              </Button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-xs font-medium">Escrow Protection</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Truck className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-xs font-medium">Fast Shipping</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <RefreshCw className="w-6 h-6 text-purple-600" />
                </div>
                <p className="text-xs font-medium">Easy Returns</p>
              </div>
            </div>

            {/* Seller Info */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Sold by</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f0b90b] to-[#e6a800] text-black font-bold flex items-center justify-center text-lg shadow-sm">
                    {product.seller_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{product.seller_name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {(product.metadata as any)?.location || 'Global Seller'}
                    </p>
                  </div>
                </div>
              </div>

              {isOwner && (
                <div className="pt-4 border-t border-border flex flex-col gap-3">
                  <p className="text-xs font-semibold text-[#f0b90b] uppercase tracking-wider flex items-center gap-2">
                    <Shield className="w-3 h-3" /> Your Owned Product
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="gap-2 border-primary/20 hover:bg-primary/10 transition-colors" onClick={() => router.push('/seller/dashboard')}>
                      <Edit className="w-4 h-4" /> Manage
                    </Button>
                    <Button variant="outline" className="gap-2 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={handleDeleteProduct}>
                      <Trash className="w-4 h-4" /> Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Related Products */}
        <RelatedProducts
          currentProductId={product.product_id}
          category={product.metadata?.category}
        />

        {/* Product Reviews */}
        <ProductReviews productId={product.product_id} />
      </main>

      <Footer />
    </div>
  );
}
