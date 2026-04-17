'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Zap, Star, Clock, Package, Shield,
  ChevronRight, ChevronLeft, Heart, Share2, ExternalLink,
  Store, Calendar, TrendingUp, MessageCircle,
  CreditCard, Check, AlertCircle, Copy,
  Gem, ArrowLeft,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductReviewSection } from '@/components/product/ProductReviewSection';
import { NFTOwnershipCard } from '@/components/web3/NFTOwnershipCard';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { LivePriceEstimate } from '@/components/ui/live-price';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useClientTranslation } from '@/lib/hooks/useClientTranslation';
import { formatUSD, formatCrypto } from '@/lib/utils/format-price';
import { CoinImage } from '@/components/ui/CoinImage';

const PLACEHOLDER = '/images/placeholder-product.png';

// ── Thumbnail component — hooks must be in a real component, not in .map() ──
function ThumbnailBtn({ url, active, onClick }: { url: string; active: boolean; onClick: () => void }) {
  const [src, setSrc] = useState(url || PLACEHOLDER);
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all shadow-sm
        ${active ? 'border-primary ring-2 ring-primary/20' : 'border-border opacity-70 hover:opacity-100'}`}
    >
      <img src={src} alt="" className="w-full h-full object-cover" onError={() => setSrc(PLACEHOLDER)} />
    </button>
  );
}

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
  const { isAuthenticated } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImg, setCurrentImg] = useState(0);
  const [selectedToken, setSelectedToken] = useState<AcceptedToken | null>(null);
  const [qty, setQty] = useState(1);
  const [liked, setLiked] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [coinPrices, setCoinPrices] = useState<Record<string, number>>({});
  const { t } = useClientTranslation();
  const addItem = useCartStore((state) => state.addItem);

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
    toast.success(t('productDetail.productLinkCopied'));
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const handleShareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`, '_blank', 'width=600,height=400');
  };

  const handleShareTwitter = () => {
    const text = product ? `Xem sản phẩm: ${product.name}` : 'Xem sản phẩm này!';
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(getShareUrl())}`, '_blank', 'width=600,height=400');
  };

  const handleShareWhatsApp = () => {
    const text = product ? `${product.name} - ${getShareUrl()}` : getShareUrl();
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleBuyNow = async () => {
    if (!product) return;
    if (!isAuthenticated) {
      toast.error(t('productDetail.loginRequired'));
      router.push(`/login?redirect=/products/${id}`);
      return;
    }
    try {
      const { data } = await apiClient.post('/api/orders', {
        product_id: product.product_id,
        quantity: qty,
        payment_method: selectedToken ? 'crypto' : 'paypal',
      });
      if (data?.order?.order_id) {
        router.push(`/checkout/${data.order.order_id}`);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi tạo đơn hàng. Vui lòng thử lại!';
      toast.error(msg);
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
    toast.success(t('productDetail.addedToCart'));
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
        <h2 className="text-xl font-semibold">{t('productDetail.productNotFound')}</h2>
        <Link href="/products" className="text-primary hover:underline">{t('productDetail.browseProducts')}</Link>
      </main>
      <Footer />
    </div>
  );

  const images = product.images?.length > 0
    ? product.images
    : product.primary_image ? [{ url: product.primary_image, is_primary: true, sort_order: 0 }] : [];
  const STABLE_TOKENS = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD']);
  const isStableToken = selectedToken && STABLE_TOKENS.has(selectedToken.symbol.toUpperCase());
  // Always show token price as primary — consistent with homepage PriceBadge
  const getDisplayPrice = () => {
    // Case 1: Non-stablecoin token selected — show token amount
    if (selectedToken && !isStableToken) {
      return `${formatCrypto(parseFloat(selectedToken.price_in_token), selectedToken.symbol)} ${selectedToken.symbol}`;
    }
    // Case 2: Stablecoin selected — show USD equiv with stablecoin label
    if (selectedToken && isStableToken) {
      return `${formatCrypto(parseFloat(product.base_price_usd), selectedToken.symbol)} ${selectedToken.symbol}`;
    }
    // Case 3: No token selected but accepted_tokens exist — use first non-stable
    const tokens = product.accepted_tokens || [];
    const nonStable = tokens.find(t => !STABLE_TOKENS.has(t.symbol.toUpperCase()));
    if (nonStable) {
      return `${formatCrypto(parseFloat(nonStable.price_in_token), nonStable.symbol)} ${nonStable.symbol}`;
    }
    // Case 4: No token info at all — fallback to USD
    return formatUSD(parseFloat(product.base_price_usd));
  };
  const displayPrice = getDisplayPrice();
  const displayPayWith = isStableToken ? `${t('productDetail.payWith')} ${selectedToken!.symbol}` : null;
  const usdEquivalent = selectedToken && !isStableToken && coinPrices[selectedToken.symbol]
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
                  {/* Share dropdown — Radix DropdownMenu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="w-9 h-9 rounded-full bg-background/80 text-foreground border border-border backdrop-blur flex items-center justify-center hover:bg-background transition-all shadow-sm" aria-label="Chia sẻ">
                        <Share2 className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuLabel>
                        <p className="font-bold text-foreground text-sm">Chia sẻ sản phẩm</p>
                        <p className="text-[10px] text-muted-foreground truncate font-normal">{product.name}</p>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleCopyLink} className="gap-2">
                        {linkCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        <span className={linkCopied ? 'text-emerald-500 font-semibold' : ''}>{linkCopied ? 'Đã sao chép!' : 'Sao chép liên kết'}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleShareFacebook} className="gap-2">
                        <svg className="w-4 h-4 flex-shrink-0" fill="#1877F2" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                        Chia sẻ Facebook
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleShareTwitter} className="gap-2">
                        <svg className="w-4 h-4 flex-shrink-0 text-sky-500" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                        Chia sẻ X (Twitter)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleShareWhatsApp} className="gap-2">
                        <svg className="w-4 h-4 flex-shrink-0" fill="#25D366" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                        Chia sẻ WhatsApp
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <button
                    onClick={() => setLiked(v => !v)}
                    className="w-9 h-9 rounded-full bg-background/80 text-foreground border border-border backdrop-blur flex items-center justify-center hover:bg-background transition-all shadow-sm"
                    aria-label={liked ? 'Bỏ yêu thích' : 'Yêu thích'}
                  >
                    <Heart className={`w-4 h-4 transition-colors ${liked ? 'fill-red-500 text-red-500' : ''}`} />
                  </button>
                </div>
              </div>
              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {images.map((img, idx) => (
                    <ThumbnailBtn
                      key={idx}
                      url={img.url}
                      active={currentImg === idx}
                      onClick={() => setCurrentImg(idx)}
                    />
                  ))}
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
                  ? <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 flex items-center gap-1"><Check className="w-3 h-3" />{t('productDetail.inStock')} ({product.stock})</span>
                  : <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">{t('productDetail.outOfStock')}</span>
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
                {/* Primary Price: Token amount big + coin icon */}
                <div className="space-y-2">
                  {selectedToken ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-4xl font-black bg-gradient-to-r from-[#f0b90b] to-amber-400 bg-clip-text text-transparent leading-none">
                        {formatCrypto(parseFloat(selectedToken.price_in_token), selectedToken.symbol)}
                      </span>
                      <div className="flex items-center gap-1.5 bg-muted/60 border border-border rounded-xl px-3 py-1.5">
                        <CoinImage symbol={selectedToken.symbol} size={20} />
                        <span className="font-bold text-base text-foreground">{selectedToken.symbol}</span>
                        {selectedToken.chain_id === 31337 && (
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded-full">testnet</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-4xl font-black text-foreground">
                      {formatUSD(parseFloat(product.base_price_usd))}
                    </span>
                  )}

                  {/* USD equivalent badge */}
                  {selectedToken && (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 bg-emerald-500/8 border border-emerald-500/20 rounded-full px-3 py-1 text-sm">
                        <span className="text-muted-foreground">≈</span>
                        <span className="font-semibold text-emerald-400">{formatUSD(parseFloat(product.base_price_usd))}</span>
                        <span className="text-muted-foreground text-xs">USDT</span>
                      </span>
                      <span className="text-xs text-muted-foreground">ước tính theo giá hiện tại</span>
                    </div>
                  )}
                </div>

                {/* Token Selector */}
                {product.accepted_tokens?.length > 0 && (
                  <div className="pt-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Thanh toán bằng:</p>
                    <div className="flex flex-wrap gap-2">
                      {product.accepted_tokens.map(token => (
                        <button
                          key={token.token_id}
                          onClick={() => setSelectedToken(token)}
                          className={`px-3 py-2 rounded-xl text-sm font-bold border transition-all flex items-center gap-1.5
                            ${selectedToken?.token_id === token.token_id
                              ? 'bg-[#f0b90b]/10 border-[#f0b90b] text-[#f0b90b] shadow-sm'
                              : 'bg-background border-border text-muted-foreground hover:border-[#f0b90b]/50 hover:text-foreground'}`}
                        >
                          <CoinImage symbol={token.symbol} size={16} />
                          <span>{token.symbol}</span>
                        </button>
                      ))}
                      <button
                        onClick={() => setSelectedToken(null)}
                        className={`px-3 py-2 rounded-xl text-sm font-bold border transition-all flex items-center gap-1.5
                          ${!selectedToken
                            ? 'bg-blue-500/10 border-blue-500 text-blue-500 shadow-sm'
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
                <span className="text-sm font-medium text-foreground">{t('productDetail.quantity')}</span>
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
                  {t('productDetail.buyNow')}
                </button>
                <button
                  onClick={handleAddToCart}
                  className="flex-1 py-4 rounded-xl font-bold text-base bg-card border border-border hover:bg-muted hover:border-primary/50 text-foreground transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {t('productDetail.addToCart')}
                </button>
              </div>

              {/* Trust badges */}
              <div className="grid grid-cols-3 gap-3 pt-6 border-t border-border">
                {[
                  { icon: Shield, label: t('productDetail.escrowProtection') },
                  { icon: Package, label: t('productDetail.fastShipping') },
                  { icon: MessageCircle, label: t('productDetail.support247') },
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
                  {t('productDetail.sellerProfile')}
                </h3>

                <div className="flex items-center gap-4">
                  <Avatar className="w-14 h-14 rounded-xl border border-primary/20">
                    <AvatarImage src={product.seller_user_avatar || product.seller_avatar || undefined} />
                    <AvatarFallback className="rounded-xl text-xl font-black bg-primary/10 text-primary">
                      {product.seller_name?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
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
                      <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> {t('productDetail.sales')}</div>
                      <span className="font-semibold text-foreground">{product.seller_total_sales} {t('productDetail.total')}</span>
                    </div>
                  )}
                  {product.seller_joined_at && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {t('productDetail.memberSince')}</div>
                      <span className="font-medium text-foreground">{new Date(product.seller_joined_at).getFullYear()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-muted-foreground">
                    <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> {t('productDetail.listedOn')}</div>
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
                      {t('productDetail.visitFullStore')}
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
                  {t('productDetail.productDescription')}
                </h3>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-base">{product.description}</p>
                </div>
              </div>

              {/* Share row - no raw URL exposed */}
              <div className="p-5 rounded-2xl bg-card border border-border flex items-center justify-between gap-4 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground mb-1">{t('productDetail.shareProduct')}</p>
                  <p className="text-xs text-muted-foreground">{t('productDetail.copyLinkDesc')}</p>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="flex-shrink-0 px-5 py-3 rounded-xl bg-muted border border-border font-medium text-foreground hover:bg-primary hover:text-white hover:border-primary transition-all flex items-center gap-2 shadow-sm"
                >
                  {linkCopied ? <><Check className="w-4 h-4" />{t('productDetail.linkCopied')}</> : <><Share2 className="w-4 h-4" />{t('productDetail.copyLink')}</>}
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
