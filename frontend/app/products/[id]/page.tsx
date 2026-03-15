'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Zap, Star, Clock, Package, Shield,
  ChevronRight, ChevronLeft, Heart, Share2, ExternalLink,
  Store, Calendar, TrendingUp, MessageCircle,
  CreditCard, Check, AlertCircle, Copy, Facebook,
  Twitter, X, Gem, ArrowLeft, Eye, Users,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductReviewSection } from '@/components/product/ProductReviewSection';
import { NFTOwnershipCard } from '@/components/web3/NFTOwnershipCard';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import { LivePriceEstimate } from '@/components/ui/live-price';

const PLACEHOLDER = '/images/placeholder-product.png';

interface AcceptedToken {
  token_id: number; symbol: string; name: string;
  price_in_token: string; is_primary: boolean;
  chain_id: number; chain_name: string; decimals: number;
}

interface Product {
  product_id: number; name: string; description: string;
  base_price_usd: string; category: string; status: string;
  rating_avg: string; review_count: number; stock: number;
  listed_at: string; primary_image: string;
  images: Array<{ url: string; is_primary: boolean; sort_order: number }>;
  accepted_tokens: AcceptedToken[];
  seller_name: string; seller_avatar: string; seller_slug: string;
  seller_rating: string; seller_description: string;
  seller_total_sales: number; seller_joined_at: string;
  seller_user_avatar: string; seller_username: string;
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImg, setCurrentImg] = useState(0);
  const [selectedToken, setSelectedToken] = useState<AcceptedToken | null>(null);
  const [qty, setQty] = useState(1);
  const [liked, setLiked] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [coinPrices, setCoinPrices] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'desc' | 'nft' | 'reviews'>('desc');
  const shareRef = useRef<HTMLDivElement>(null);
  const addItem = useCartStore((state) => state.addItem);

  // Close share dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShowShare(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    apiClient.get(`/api/products/${id}`)
      .then(res => {
        const d = res.data;
        if (d.success && d.data) {
          setProduct(d.data);
          if (d.data.accepted_tokens?.length > 0) {
            setSelectedToken(d.data.accepted_tokens.find((t: AcceptedToken) => t.is_primary) || d.data.accepted_tokens[0]);
          }
        }
      })
      .catch(() => toast.error('Không tìm thấy sản phẩm'))
      .finally(() => setLoading(false));
  }, [id]);

  // Fetch live prices from Binance for listed tokens
  useEffect(() => {
    if (!product?.accepted_tokens?.length) return;
    const symbols = [...new Set(product.accepted_tokens.map(t => t.symbol))];
    Promise.all(symbols.map(sym =>
      fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}USDT`)
        .then(r => r.json())
        .then(d => d.price ? { sym, price: parseFloat(d.price) } : null)
        .catch(() => null)
    )).then(results => {
      const prices: Record<string, number> = {};
      results.filter(Boolean).forEach(r => { if (r) prices[r.sym] = r.price; });
      setCoinPrices(prices);
    });
  }, [product]);


  const getShareUrl = () => {
    if (typeof window === 'undefined') return '';
    // Use clean URL - don't expose raw DB id in share UI
    return `${window.location.origin}/products/${id}`;
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(getShareUrl());
    setLinkCopied(true);
    toast.success('Đã sao chép link sản phẩm!');
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const handleShareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`, '_blank', 'width=600,height=400');
    setShowShare(false);
  };

  const handleShareTwitter = () => {
    const text = product ? `Xem sản phẩm: ${product.name}` : 'Xem sản phẩm này!';
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(getShareUrl())}`, '_blank', 'width=600,height=400');
    setShowShare(false);
  };

  const handleShareWhatsApp = () => {
    const text = product ? `${product.name} - ${getShareUrl()}` : getShareUrl();
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    setShowShare(false);
  };

  const handleBuyNow = async () => {
    if (!product) return;
    try {
      const { data } = await apiClient.post('/api/orders', {
        product_id: product.product_id,
        quantity: qty,
        payment_method: selectedToken ? 'crypto' : 'paypal'
      });
      if (data?.order?.order_id) {
        router.push(`/checkout/${data.order.order_id}`);
      }
    } catch (err) {
      toast.error('Có lỗi xảy ra khi tạo đơn hàng. Vui lòng thử lại!');
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    const primaryToken = selectedToken || product.accepted_tokens?.[0];
    addItem({
      product_id: product.product_id,
      name: product.name,
      base_price_usd: Number(product.base_price_usd),
      price_in_token: primaryToken ? Number(primaryToken.price_in_token) : undefined,
      token_symbol: primaryToken?.symbol,
      image_url: product.primary_image || product.images?.[0]?.url,
      seller_id: undefined, // populated via accepted_tokens seller context
      metadata: { images: product.images?.map(i => i.url) || [product.primary_image] },
    });
    toast.success('Đã thêm vào giỏ hàng 🛒');
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
      <Footer />
    </div>
  );

  if (!product) return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center text-foreground gap-4">
        <AlertCircle className="w-16 h-16 text-red-500" />
        <h2 className="text-xl font-semibold">Product not found</h2>
        <Link href="/products" className="text-primary hover:underline">Browse all products →</Link>
      </main>
      <Footer />
    </div>
  );

  const images = product.images?.length > 0
    ? product.images
    : product.primary_image ? [{ url: product.primary_image, is_primary: true, sort_order: 0 }] : [];
  const displayPrice = selectedToken
    ? `${parseFloat(selectedToken.price_in_token).toFixed(6)} ${selectedToken.symbol}`
    : `$${parseFloat(product.base_price_usd).toFixed(2)}`;
  const usdEquivalent = selectedToken && coinPrices[selectedToken.symbol]
    ? (parseFloat(selectedToken.price_in_token) * coinPrices[selectedToken.symbol]).toFixed(2)
    : null;

  // Image with fallback helper
  const ImgWithFallback = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
    const [imgSrc, setImgSrc] = useState(src || PLACEHOLDER);
    useEffect(() => { setImgSrc(src || PLACEHOLDER); }, [src]);
    return (
      <img
        src={imgSrc}
        alt={alt}
        className={className}
        onError={() => setImgSrc(PLACEHOLDER)}
      />
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      
      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="border-b border-border bg-card/30 px-4 py-3 text-sm text-muted-foreground">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/products" className="hover:text-foreground transition-colors">Products</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground truncate max-w-[200px]">{product.name}</span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
            {/* Image Gallery */}
            <div className="space-y-3">
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-card border border-border group shadow-sm">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentImg}
                    src={images[currentImg]?.url || '/placeholder.png'}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  />
                </AnimatePresence>
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setCurrentImg(p => Math.max(0, p - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background text-foreground shadow-sm"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setCurrentImg(p => Math.min(images.length - 1, p + 1))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background text-foreground shadow-sm"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
                {/* Share / Wishlist */}
                <div className="absolute top-3 right-3 flex gap-2">
                  {/* Share dropdown */}
                  <div ref={shareRef} className="relative">
                    <button
                      onClick={() => setShowShare(v => !v)}
                      className="w-9 h-9 rounded-full bg-background/80 text-foreground border border-border backdrop-blur flex items-center justify-center hover:bg-background transition-all shadow-sm"
                      title="Chia sẻ sản phẩm"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <AnimatePresence>
                      {showShare && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.92, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.92, y: -4 }}
                          className="absolute top-full right-0 mt-2 w-56 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50"
                        >
                          <div className="px-4 py-3 border-b border-border">
                            <p className="text-xs font-bold text-foreground">Chia sẻ sản phẩm</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{product.name}</p>
                          </div>
                          <div className="p-2 space-y-1">
                            <button
                              onClick={handleCopyLink}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm text-left"
                            >
                              {linkCopied
                                ? <Check className="w-4 h-4 text-emerald-500" />
                                : <Copy className="w-4 h-4 text-muted-foreground" />}
                              <span className={linkCopied ? 'text-emerald-500 font-semibold' : 'text-foreground'}>
                                {linkCopied ? 'Đã sao chép!' : 'Sao chép liên kết'}
                              </span>
                            </button>
                            <button
                              onClick={handleShareFacebook}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blue-500/10 transition-colors text-sm text-left"
                            >
                              <svg className="w-4 h-4" fill="#1877F2" viewBox="0 0 24 24">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                              </svg>
                              <span className="text-foreground">Chia sẻ Facebook</span>
                            </button>
                            <button
                              onClick={handleShareTwitter}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-sky-500/10 transition-colors text-sm text-left"
                            >
                              <svg className="w-4 h-4 text-sky-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                              </svg>
                              <span className="text-foreground">Chia sẻ X (Twitter)</span>
                            </button>
                            <button
                              onClick={handleShareWhatsApp}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-green-500/10 transition-colors text-sm text-left"
                            >
                              <svg className="w-4 h-4" fill="#25D366" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              <span className="text-foreground">Chia sẻ WhatsApp</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button
                    onClick={() => setLiked(v => !v)}
                    className="w-9 h-9 rounded-full bg-background/80 text-foreground border border-border backdrop-blur flex items-center justify-center hover:bg-background transition-all shadow-sm"
                  >
                    <Heart className={`w-4 h-4 transition-colors ${liked ? 'fill-red-500 text-red-500' : ''}`} />
                  </button>
                </div>
              </div>
              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {images.map((img, idx) => {
                    const [thumbSrc, setThumbSrc] = useState(img.url || PLACEHOLDER);
                    return (
                      <button
                        key={idx}
                        onClick={() => setCurrentImg(idx)}
                        className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all shadow-sm
                          ${currentImg === idx ? 'border-primary ring-2 ring-primary/20' : 'border-border opacity-70 hover:opacity-100'}`}
                      >
                        <img src={thumbSrc} alt="" className="w-full h-full object-cover"
                          onError={() => setThumbSrc(PLACEHOLDER)} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              {/* Category + Status */}
              <div className="flex items-center gap-3 flex-wrap">
                {product.category && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                    {product.category}
                  </span>
                )}
                {product.accepted_tokens?.length > 0 && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#8247e5]/10 text-[#8247e5] border border-[#8247e5]/20 flex items-center gap-1">
                    <Gem className="w-3 h-3" /> NFT Tokenized
                  </span>
                )}
                {product.stock > 0
                  ? <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 flex items-center gap-1"><Check className="w-3 h-3" />Còn hàng ({product.stock})</span>
                  : <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">Hết hàng</span>
                }
              </div>

              <h1 className="text-3xl lg:text-4xl font-extrabold leading-snug">{product.name}</h1>

              {/* Rating */}
              {parseFloat(product.rating_avg) > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={`w-4 h-4 ${s <= Math.round(parseFloat(product.rating_avg)) ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/30'}`} />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">{parseFloat(product.rating_avg).toFixed(1)} ({product.review_count} reviews)</span>
                </div>
              )}

              {/* Price Panel */}
              <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
                <div className="flex items-end gap-3">
                  <span className="text-4xl font-black bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
                    {displayPrice}
                  </span>
                  {selectedToken && (
                    <LivePriceEstimate 
                      tokenAmount={parseFloat(selectedToken.price_in_token)} 
                      tokenSymbol={selectedToken.symbol}
                      className="text-muted-foreground text-sm mb-1 font-medium"
                      showIcon={true}
                    />
                  )}
                </div>
                <p className="text-muted-foreground text-sm">Base price: <span className="font-semibold text-foreground">${parseFloat(product.base_price_usd).toFixed(2)} USD</span></p>

                {/* Token Selector */}
                {product.accepted_tokens?.length > 0 && (
                  <div className="pt-2">
                    <p className="text-sm font-medium text-foreground mb-3">Pay with:</p>
                    <div className="flex flex-wrap gap-2">
                      {product.accepted_tokens.map(token => (
                        <button
                          key={token.token_id}
                          onClick={() => setSelectedToken(token)}
                          className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all flex items-center gap-1.5
                            ${selectedToken?.token_id === token.token_id
                              ? 'bg-primary/10 border-primary text-primary shadow-sm shadow-primary/10'
                              : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}
                        >
                          <span className="font-bold">{token.symbol}</span>
                          <span className="text-xs opacity-70">({token.chain_name})</span>
                          {coinPrices[token.symbol] && (
                            <span className="ml-1 text-xs text-green-500 font-mono">${coinPrices[token.symbol].toFixed(2)}</span>
                          )}
                        </button>
                      ))}
                      <button
                        onClick={() => setSelectedToken(null)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all flex items-center gap-1.5
                          ${!selectedToken
                            ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'bg-background border-border text-muted-foreground hover:border-blue-500/50 hover:text-foreground'}`}
                      >
                        <CreditCard className="w-4 h-4" /> PayPal
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="flex items-center gap-6 py-2">
                <span className="text-sm font-medium text-foreground">Quantity</span>
                <div className="flex items-center gap-2 bg-card rounded-xl border border-border p-1 shadow-sm">
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-9 h-9 rounded-lg hover:bg-muted focus:ring-2 ring-primary/20 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all font-bold text-lg">−</button>
                  <span className="w-12 text-center font-bold">{qty}</span>
                  <button onClick={() => setQty(q => Math.min(product.stock || 99, q + 1))} className="w-9 h-9 rounded-lg hover:bg-muted focus:ring-2 ring-primary/20 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all font-bold text-lg">+</button>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleBuyNow}
                  disabled={product.stock === 0}
                  className="flex-[2] py-4 rounded-xl font-black text-base bg-[#f0b90b] hover:bg-[#e6a800] text-black disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-xl shadow-yellow-500/20 hover:-translate-y-0.5"
                >
                  <Zap className="w-5 h-5" />
                  Mua ngay
                </button>
                <button
                  onClick={handleAddToCart}
                  className="flex-1 py-4 rounded-xl font-bold text-base bg-card border border-border hover:bg-muted hover:border-primary/50 text-foreground transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <ShoppingCart className="w-5 h-5" />
                  Giỏ hàng
                </button>
              </div>

              {/* Trust badges */}
              <div className="grid grid-cols-3 gap-3 pt-6 border-t border-border">
                {[
                  { icon: Shield, label: 'Escrow bảo vệ' },
                  { icon: Package, label: 'Giao hàng nhanh' },
                  { icon: MessageCircle, label: 'Hỗ trợ 24/7' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-muted/50 border border-border/50 text-muted-foreground text-xs font-medium text-center hover:bg-muted transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
            <div className="lg:col-span-1">
              <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-5 sticky top-24">
                <h3 className="font-bold text-foreground flex items-center gap-2 text-lg">
                  <Store className="w-5 h-5 text-primary" />
                  Seller Profile
                </h3>
                
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    {product.seller_user_avatar || product.seller_avatar
                      ? <img src={product.seller_user_avatar || product.seller_avatar} alt="" className="w-full h-full object-cover" />
                      : <span className="text-xl font-black text-primary">{product.seller_name?.[0]?.toUpperCase()}</span>
                    }
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-lg cursor-pointer hover:text-primary transition-colors">{product.seller_name}</p>
                    {product.seller_username && <p className="text-sm text-muted-foreground mb-1">@{product.seller_username}</p>}
                    {parseFloat(product.seller_rating) > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                        <span className="text-sm font-semibold text-foreground">{parseFloat(product.seller_rating).toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 text-sm py-4 border-y border-border">
                  {product.seller_total_sales > 0 && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Sales</div>
                      <span className="font-semibold text-foreground">{product.seller_total_sales} total</span>
                    </div>
                  )}
                  {product.seller_joined_at && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Member since</div>
                      <span className="font-medium text-foreground">{new Date(product.seller_joined_at).getFullYear()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-muted-foreground">
                    <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> Listed on</div>
                    <span className="font-medium text-foreground">{new Date(product.listed_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {product.seller_description && (
                  <p className="text-sm text-muted-foreground leading-relaxed italic border-l-2 border-primary/30 pl-3">"{product.seller_description}"</p>
                )}

                {product.seller_slug && (
                  <Link
                    href={`/seller/${product.seller_slug}`}
                    className="flex justify-center flex-1 w-full"
                  >
                    <button className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-muted text-foreground font-semibold hover:bg-primary hover:text-white transition-all">
                      <ExternalLink className="w-4 h-4" />
                      Visit Full Store
                    </button>
                  </Link>
                )}
              </div>
            </div>

            {/* Description & Reviews */}
            <div className="lg:col-span-2 space-y-8">
              <div className="p-8 rounded-2xl bg-card border border-border shadow-sm">
                <h3 className="text-xl font-bold mb-6 text-foreground flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  Product Description
                </h3>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-base">{product.description}</p>
                </div>
              </div>

              {/* Share row - no raw URL exposed */}
              <div className="p-5 rounded-2xl bg-card border border-border flex items-center justify-between gap-4 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground mb-1">Chia sẻ sản phẩm này</p>
                  <p className="text-xs text-muted-foreground">Sao chép liên kết hoặc chia sẻ qua mạng xã hội</p>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="flex-shrink-0 px-5 py-3 rounded-xl bg-muted border border-border font-medium text-foreground hover:bg-primary hover:text-white hover:border-primary transition-all flex items-center gap-2 shadow-sm"
                >
                  {linkCopied ? <><Check className="w-4 h-4" />Đã copy!</> : <><Share2 className="w-4 h-4" />Copy link</>}
                </button>
              </div>

              {/* NFT Ownership */}
              <NFTOwnershipCard
                productId={product.product_id}
                productName={product.name}
                variant="compact"
              />

              {/* Reviews Section — full featured */}
              <ProductReviewSection productId={product.product_id} />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
