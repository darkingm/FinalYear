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
import { ArrowLeft, ShoppingCart, Heart, Share2, Truck, Shield, RefreshCw, MapPin, Trash, Edit, Star, Calendar, Coins } from 'lucide-react';
import Link from 'next/link';
import { ImageGallery } from '@/components/product/ImageGallery';
import { RelatedProducts } from '@/components/product/RelatedProducts';
import { ProductReviews } from '@/components/product/ProductReviews';
import { Badge } from '@/components/ui/Badge';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '@/store/cart-store';

interface Product {
  product_id: number;
  name: string;
  description: string;
  base_price_usd: number;
  price_in_token: number | null;
  token_id: number | null;
  token_symbol: string | null;
  token_decimals: number | null;
  category: string;
  metadata: Record<string, any>;
  stock: number;
  seller_name: string;
  seller_id: number;
  seller_avatar: string | null;
  seller_user_avatar: string | null;
  seller_slug: string | null;
  seller_rating: number;
  seller_description: string | null;
  seller_wallet: string | null;
  rating_avg: number;
  review_count: number;
  listed_at: string;
  primary_image: string | null;
  images: string[] | null;
  owner_user_id?: number;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);
  const addItem = useCartStore(s => s.addItem);

  useEffect(() => { if (params.id) fetchProduct(); }, [params.id]);

  const fetchProduct = async () => {
    try {
      const response = await apiClient.get(`/api/products/${params.id}`);
      setProduct(response.data.data);
    } catch {
      toast.error('Product not found');
      router.push('/products');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyNow = async () => {
    if (!session) { toast.error(t('auth.login')); router.push('/login'); return; }
    setBuyLoading(true);
    try {
      const response = await apiClient.post('/api/orders', { product_id: product?.product_id, quantity });
      toast.success(t('checkout.checkout'));
      const orderId = response.data.data?.order_id ?? response.data.order?.order_id;
      router.push(`/checkout/${orderId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('common.error'));
    } finally {
      setBuyLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    addItem({ product_id: product.product_id, name: product.name, base_price_usd: Number(product.base_price_usd), metadata: product.metadata });
    toast.success(t('product.addedToCart'));
  };

  const handleDeleteProduct = async () => {
    if (!confirm('Are you sure?')) return;
    try {
      await apiClient.delete(`/api/products/${product?.product_id}`);
      toast.success(t('product.deleteSuccess'));
      router.push('/products');
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('common.error'));
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({ title: product?.name, text: product?.description, url: window.location.href });
    } catch {
      navigator.clipboard.writeText(window.location.href);
      toast.success(t('common.copied'));
    }
  };

  const galleryImages = product
    ? (product.images?.length
      ? product.images
      : product.primary_image
        ? [product.primary_image]
        : (product.metadata?.images ?? []))
    : [];

  const priceDisplay = product
    ? (product.price_in_token && product.token_symbol
      ? `${Number(product.price_in_token).toFixed(product.token_symbol === 'ETH' || product.token_symbol === 'WBTC' ? 6 : 2)} ${product.token_symbol}`
      : `$${Number(product.base_price_usd).toFixed(2)}`)
    : '';

  const isOwner = session?.user?.id === String(product?.owner_user_id);
  const listingDate = product?.listed_at ? new Date(product.listed_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : null;
  const sellerAvatar = product?.seller_user_avatar ?? product?.seller_avatar;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="aspect-square bg-muted rounded-2xl animate-pulse" />
            <div className="space-y-4">
              <div className="h-8 w-3/4 bg-muted rounded animate-pulse" />
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
              <div className="h-12 w-32 bg-muted rounded animate-pulse" />
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
            <h2 className="text-2xl font-bold mb-4">{t('common.noResults')}</h2>
            <Link href="/products"><Button>{t('common.back')}</Button></Link>
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
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-6">
          <Button variant="ghost" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="w-4 h-4" />{t('common.back')}
          </Button>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <ImageGallery images={galleryImages} productName={product.name} category={product.category ?? product.metadata?.category} />
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
              {(product.category || product.metadata?.category) && <Badge variant="outline">{product.category || product.metadata?.category}</Badge>}
              {product.stock > 0 ? <Badge variant="success" dot>{t('product.inStock')}</Badge> : <Badge variant="error">{t('product.outOfStock')}</Badge>}
              {product.token_symbol && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 font-semibold border border-yellow-200 dark:border-yellow-700">
                  <Coins className="w-3 h-3" />{product.token_symbol}
                </span>
              )}
            </div>

            <h1 className="text-3xl lg:text-4xl font-bold">{product.name}</h1>

            {product.rating_avg > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex">{[1, 2, 3, 4, 5].map(s => <Star key={s} className={`w-4 h-4 ${s <= Math.round(product.rating_avg) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />)}</div>
                <span className="text-sm text-muted-foreground">({product.review_count ?? 0})</span>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <span className="text-4xl font-bold text-primary">{priceDisplay}</span>
              {product.price_in_token && product.token_symbol && <span className="text-sm text-muted-foreground">approx. ${Number(product.base_price_usd).toFixed(2)} USD</span>}
            </div>

            <p className="text-muted-foreground leading-relaxed">{product.description}</p>

            {listingDate && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />{t('product.listedOn')}: {listingDate}
              </p>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">{t('product.quantity')}</label>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="lg" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>-</Button>
                <span className="text-2xl font-semibold w-16 text-center">{quantity}</span>
                <Button variant="outline" size="lg" onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} disabled={quantity >= product.stock}>+</Button>
                <span className="text-sm text-muted-foreground ml-2">{product.stock} {t('product.inStock')}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleBuyNow} size="lg" className="flex-1 bg-[#f0b90b] hover:bg-[#e6a800] text-black font-bold text-lg py-6" disabled={product.stock === 0 || buyLoading}>
                {buyLoading ? <span className="animate-spin mr-2">loading</span> : <ShoppingCart className="w-5 h-5 mr-2" />}
                {product.stock === 0 ? t('product.outOfStock') : t('product.buyNow')}
              </Button>
              <Button variant="outline" size="lg" onClick={handleAddToCart} disabled={product.stock === 0}><ShoppingCart className="w-5 h-5" /></Button>
              <Button variant="outline" size="lg" onClick={() => setIsWishlisted(!isWishlisted)} className={isWishlisted ? 'text-red-500 border-red-500' : ''}><Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} /></Button>
              <Button variant="outline" size="lg" onClick={handleShare}><Share2 className="w-5 h-5" /></Button>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-6 border-t">
              <div className="text-center"><div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-2"><Shield className="w-6 h-6 text-blue-600" /></div><p className="text-xs font-medium">Escrow</p></div>
              <div className="text-center"><div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-2"><Truck className="w-6 h-6 text-green-600" /></div><p className="text-xs font-medium">Shipping</p></div>
              <div className="text-center"><div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-2"><RefreshCw className="w-6 h-6 text-purple-600" /></div><p className="text-xs font-medium">Returns</p></div>
            </div>

            <div className="p-4 bg-muted/40 rounded-xl space-y-3">
              <p className="text-sm text-muted-foreground font-medium">{t('product.seller')}</p>
              <div className="flex items-center gap-3">
                {sellerAvatar ? (
                  <img src={sellerAvatar} className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/20" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f0b90b] to-[#e6a800] text-black font-bold flex items-center justify-center text-lg">{product.seller_name?.charAt(0).toUpperCase()}</div>
                )}
                <div className="flex-1">
                  <p className="font-semibold">{product.seller_name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {product.seller_rating > 0 && <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400 fill-current" />{Number(product.seller_rating).toFixed(1)}</span>}
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{(product.metadata as any)?.location || 'Global'}</span>
                  </div>
                </div>
                {product.seller_slug && <Link href={`/sellers/${product.seller_slug}`} className="text-xs text-primary hover:underline ml-auto">View Store</Link>}
              </div>
              {isOwner && (
                <div className="pt-3 border-t border-border grid grid-cols-2 gap-3">
                  <Button variant="outline" className="gap-2" onClick={() => router.push('/seller/dashboard')}><Edit className="w-4 h-4" />{t('common.edit')}</Button>
                  <Button variant="outline" className="gap-2 border-destructive/20 text-destructive hover:bg-destructive/10" onClick={handleDeleteProduct}><Trash className="w-4 h-4" />{t('common.delete')}</Button>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        <RelatedProducts currentProductId={product.product_id} category={product.category ?? product.metadata?.category} />
        <ProductReviews productId={product.product_id} />
      </main>
      <Footer />
    </div>
  );
}