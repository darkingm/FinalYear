'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Heart,
  MessageCircle,
  Package,
  Share2,
  Shield,
  ShoppingCart,
  Star,
  Store,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductReviewSection } from '@/components/product/ProductReviewSection';
import { ProductGalleryViewer } from '@/components/product/ProductGalleryViewer';
import { ProductTokenPricing } from '@/components/product/ProductTokenPricing';
import { ProductQuickActions } from '@/components/product/ProductQuickActions';
import { NFTOwnershipCard } from '@/components/web3/NFTOwnershipCard';
import { useCartStore } from '@/store/cart-store';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { normalizeProductImages } from '@/lib/products/images';
import type { ProductAcceptedTokenView, ProductGalleryImage } from '@/lib/products/types';
import { CoinImage } from '@/components/ui/CoinImage';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buildLoginRedirectUrl } from '@/lib/auth/login-redirect';
import { publicRequestConfig } from '@/lib/api/request-auth';

interface Product {
  product_id: number;
  name: string;
  description: string;
  base_price_usd: string;
  category: string;
  status: string;
  rating_avg: string;
  review_count: number;
  stock: number;
  listed_at: string;
  primary_image: string | null;
  images: ProductGalleryImage[] | string[];
  accepted_tokens: ProductAcceptedTokenView[];
  metadata?: {
    accepted_tokens?: {
      fiat?: string[];
    };
  };
  seller_name: string;
  seller_avatar: string | null;
  seller_slug: string | null;
  seller_rating: string;
  seller_description: string | null;
  seller_total_sales: number;
  seller_joined_at: string | null;
  seller_user_avatar: string | null;
  seller_username: string | null;
}

function formatUsd(value: number) {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, reauthRequired } = useAuth();
  const addItem = useCartStore((state) => state.addItem);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState<ProductAcceptedTokenView | null>(null);
  const [qty, setQty] = useState(1);
  const [liked, setLiked] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    const requestedTokenId = Number(searchParams.get('token'));

    apiClient.get(`/api/products/${id}`, publicRequestConfig)
      .then((response) => {
        const data = response.data;
        if (data.success && data.data) {
          setProduct(data.data);
          const resolvedToken = data.data.accepted_tokens?.find((token: ProductAcceptedTokenView) => token.token_id === requestedTokenId)
            || data.data.accepted_tokens?.find((token: ProductAcceptedTokenView) => token.is_primary)
            || data.data.accepted_tokens?.[0]
            || null;
          setSelectedToken(resolvedToken);
        }
      })
      .catch(() => toast.error('Không tìm thấy sản phẩm'))
      .finally(() => setLoading(false));
  }, [id, searchParams]);

  const basePriceUsd = Number(product?.base_price_usd || 0);
  const images = useMemo(
    () => normalizeProductImages(product?.images, product?.primary_image ?? null),
    [product?.images, product?.primary_image],
  );
  const acceptsPaypal = product?.metadata?.accepted_tokens?.fiat?.includes('paypal') ?? true;

  const getShareUrl = () => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/products/${id}`;
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(getShareUrl());
    setLinkCopied(true);
    toast.success('Đã sao chép link sản phẩm');
    window.setTimeout(() => setLinkCopied(false), 2500);
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

  const handleAddToCart = () => {
    if (!product) return;

    const token = selectedToken || product.accepted_tokens?.[0] || null;
    addItem({
      product_id: product.product_id,
      name: product.name,
      base_price_usd: basePriceUsd,
      price_in_token: token ? Number(token.price_in_token) : undefined,
      token_symbol: token?.symbol,
      selected_token_id: token?.token_id ?? null,
      image_url: product.primary_image || images[0]?.url,
      metadata: { images: images.map((image) => image.url) },
      accepted_tokens: product.accepted_tokens,
    });
    toast.success('Đã thêm vào giỏ hàng');
  };

  const handleBuyNow = async () => {
    if (!product) return;
    if (!isAuthenticated) {
      const query = searchParams?.toString();
      const callbackUrl = `/products/${id}${query ? `?${query}` : ''}`;
      toast.error(reauthRequired ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : 'Vui lòng đăng nhập để mua hàng');
      router.push(buildLoginRedirectUrl(callbackUrl, reauthRequired ? 'reauth_required' : undefined));
      return;
    }

    try {
      const response = await apiClient.post('/api/orders', {
        product_id: product.product_id,
        quantity: qty,
        payment_method: selectedToken ? 'crypto' : 'paypal',
      });

      if (response.data?.order?.order_id) {
        router.push(`/checkout/${response.data.order.order_id}`);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Có lỗi xảy ra khi tạo đơn hàng. Vui lòng thử lại.';
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex flex-1 flex-col items-center justify-center gap-4 text-foreground">
          <AlertCircle className="h-16 w-16 text-red-500" />
          <h2 className="text-xl font-semibold">Product not found</h2>
          <Link href="/products" className="text-primary hover:underline">
            Browse all products →
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="border-b border-border bg-card/30 px-4 py-3 text-sm text-muted-foreground">
          <div className="mx-auto flex max-w-7xl items-center gap-2">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/products" className="hover:text-foreground transition-colors">Products</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="max-w-[200px] truncate text-foreground">{product.name}</span>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-12 grid grid-cols-1 gap-10 lg:grid-cols-2">
            <div className="space-y-3">
              <ProductGalleryViewer images={images} productName={product.name} />
            </div>

            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                {product.category && (
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {product.category}
                  </span>
                )}
                {product.stock > 0 ? (
                  <span className="flex items-center gap-1 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400">
                    <Check className="h-3 w-3" />
                    Còn hàng ({product.stock})
                  </span>
                ) : (
                  <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400">
                    Hết hàng
                  </span>
                )}
              </div>

              <h1 className="text-3xl font-extrabold leading-snug lg:text-4xl">{product.name}</h1>

              {Number(product.rating_avg) > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${star <= Math.round(Number(product.rating_avg)) ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/30'}`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {Number(product.rating_avg).toFixed(1)} ({product.review_count} reviews)
                  </span>
                </div>
              )}

              <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
                {product.accepted_tokens?.length > 0 && (
                  <div className="pt-2">
                    <ProductTokenPricing
                      acceptedTokens={product.accepted_tokens}
                      basePriceUsd={basePriceUsd}
                      selectedTokenId={selectedToken?.token_id ?? null}
                      onSelect={setSelectedToken}
                      variant="detail"
                      stock={product.stock}
                    />
                  </div>
                )}

                {acceptsPaypal && (
                  <button
                    type="button"
                    onClick={() => setSelectedToken(null)}
                    className={[
                      'flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition',
                      !selectedToken ? 'border-primary/50 bg-primary/5 shadow-sm' : 'border-border bg-card/70 hover:border-primary/40 hover:bg-primary/5',
                    ].join(' ')}
                  >
                    <div>
                      <div className="text-sm font-black text-foreground">PayPal / Fiat</div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {formatUsd(basePriceUsd)}
                      </div>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                      {selectedToken ? 'Optional' : 'Selected'}
                    </span>
                  </button>
                )}

                <ProductQuickActions
                  onAddToCart={handleAddToCart}
                  onBuyNow={handleBuyNow}
                  disabled={product.stock === 0}
                  size="detail"
                />
              </div>

              <div className="flex items-center gap-6 py-2">
                <span className="text-sm font-medium text-foreground">Quantity</span>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-1 shadow-sm">
                  <button
                    onClick={() => setQty((value) => Math.max(1, value - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-bold text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                  >
                    −
                  </button>
                  <span className="w-12 text-center font-bold">{qty}</span>
                  <button
                    onClick={() => setQty((value) => Math.min(product.stock || 99, value + 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-bold text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 border-t border-border pt-6">
                {[
                  { icon: Shield, label: 'Escrow bảo vệ' },
                  { icon: Package, label: 'Giao hàng nhanh' },
                  { icon: MessageCircle, label: 'Hỗ trợ 24/7' },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-border/50 bg-muted/50 p-4 text-center text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <Icon className="h-5 w-5 text-primary" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <Store className="h-5 w-5 text-primary" />
                  Seller Profile
                </h3>

                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 rounded-xl border border-primary/20">
                    <AvatarImage src={product.seller_user_avatar || product.seller_avatar || undefined} />
                    <AvatarFallback className="rounded-xl bg-primary/10 text-xl font-black text-primary">
                      {product.seller_name?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="cursor-pointer text-lg font-bold text-foreground transition-colors hover:text-primary">
                      {product.seller_name}
                    </p>
                    {product.seller_username && (
                      <p className="mb-1 text-sm text-muted-foreground">@{product.seller_username}</p>
                    )}
                    {Number(product.seller_rating) > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                        <span className="text-sm font-semibold text-foreground">{Number(product.seller_rating).toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 border-y border-border py-4 text-sm">
                  {product.seller_total_sales > 0 && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Sales
                      </div>
                      <span className="font-semibold text-foreground">{product.seller_total_sales} total</span>
                    </div>
                  )}
                  {product.seller_joined_at && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Member since
                      </div>
                      <span className="font-medium text-foreground">{new Date(product.seller_joined_at).getFullYear()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Listed on
                    </div>
                    <span className="font-medium text-foreground">{new Date(product.listed_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {product.seller_description && (
                  <p className="border-l-2 border-primary/30 pl-3 text-sm italic leading-relaxed text-muted-foreground">
                    "{product.seller_description}"
                  </p>
                )}

                {product.seller_slug && (
                  <Link href={`/seller/${product.seller_slug}`} className="flex w-full flex-1 justify-center">
                    <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted py-3 font-semibold text-foreground transition-all hover:bg-primary hover:text-white">
                      <ExternalLink className="h-4 w-4" />
                      Visit Full Store
                    </button>
                  </Link>
                )}
              </div>
            </div>

            <div className="space-y-8 lg:col-span-2">
              <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
                <h3 className="mb-6 flex items-center gap-2 text-xl font-bold text-foreground">
                  <Package className="h-5 w-5 text-primary" />
                  Product Description
                </h3>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p className="whitespace-pre-line text-base leading-relaxed text-muted-foreground">{product.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="min-w-0 flex-1">
                  <p className="mb-1 font-semibold text-foreground">Chia sẻ sản phẩm này</p>
                  <p className="text-xs text-muted-foreground">Sao chép liên kết hoặc chia sẻ qua mạng xã hội</p>
                </div>

                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted text-foreground shadow-sm transition-all hover:border-primary hover:bg-primary hover:text-white">
                        <Share2 className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuLabel>
                        <p className="text-sm font-bold text-foreground">Chia sẻ sản phẩm</p>
                        <p className="truncate text-[10px] font-normal text-muted-foreground">{product.name}</p>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleShareFacebook}>Chia sẻ Facebook</DropdownMenuItem>
                      <DropdownMenuItem onClick={handleShareTwitter}>Chia sẻ X (Twitter)</DropdownMenuItem>
                      <DropdownMenuItem onClick={handleShareWhatsApp}>Chia sẻ WhatsApp</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <button
                    onClick={() => setLiked((value) => !value)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted text-foreground shadow-sm transition-all hover:border-primary hover:bg-primary hover:text-white"
                    aria-label={liked ? 'Bỏ yêu thích' : 'Yêu thích'}
                  >
                    <Heart className={`h-4 w-4 ${liked ? 'fill-current text-red-500' : ''}`} />
                  </button>

                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-2 rounded-xl border border-border bg-muted px-5 py-3 font-medium text-foreground shadow-sm transition-all hover:border-primary hover:bg-primary hover:text-white"
                  >
                    {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {linkCopied ? 'Đã copy!' : 'Copy link'}
                  </button>
                </div>
              </div>

              <NFTOwnershipCard productId={product.product_id} productName={product.name} variant="compact" />

              <ProductReviewSection productId={product.product_id} />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
