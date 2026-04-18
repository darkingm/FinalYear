'use client';

import { memo, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eye, Heart, ShoppingCart, Star, User, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/store/cart-store';
import { CoinImage } from '@/components/ui/CoinImage';
import { ProductTokenPricing } from '@/components/product/ProductTokenPricing';
import { getPrimaryProductImage, normalizeProductImages } from '@/lib/products/images';
import type { ProductAcceptedTokenView, ProductGalleryImage } from '@/lib/products/types';

const FALLBACK = '/placeholder-product.svg';

export interface ProductCardData {
  product_id: number;
  name: string;
  description?: string;
  base_price_usd: number | string;
  price_in_token?: number | null;
  token_symbol?: string | null;
  stock?: number;
  primary_image?: string | null;
  images?: ProductGalleryImage[] | string[] | null;
  metadata?: Record<string, any>;
  category?: string;
  seller_name?: string;
  seller_avatar?: string | null;
  seller_user_avatar?: string | null;
  rating_avg?: number | string;
  seller_rating?: number | string;
  is_nft_minted?: boolean;
  accepted_tokens?: ProductAcceptedTokenView[] | null;
}

interface ProductCardProps {
  product: ProductCardData;
  index?: number;
  variant?: 'grid' | 'list' | 'featured';
  showAddToCart?: boolean;
}

function StockBadge({ stock }: { stock?: number }) {
  if (stock === undefined) return null;
  if (stock === 0) {
    return (
      <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-400">
        Hết hàng
      </span>
    );
  }
  if (stock <= 5) {
    return (
      <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-xs font-bold text-orange-400">
        Còn {stock}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{stock} còn lại</span>;
}

function TokenBadgeBar({ acceptedTokens }: { acceptedTokens: ProductAcceptedTokenView[] }) {
  if (acceptedTokens.length === 0) return null;

  const visible = acceptedTokens.slice(0, 3);
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1 shadow-sm backdrop-blur">
      <div className="flex -space-x-2">
        {visible.map((token) => (
          <div key={`${token.token_id}-${token.symbol}`} className="rounded-full ring-2 ring-background">
            <CoinImage symbol={token.logo_symbol || token.symbol} size={18} className="rounded-full" />
          </div>
        ))}
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-foreground">
        {acceptedTokens.length} token{acceptedTokens.length > 1 ? 's' : ''}
      </span>
    </div>
  );
}

export const ProductCard = memo(function ProductCard({
  product,
  index = 0,
  variant = 'grid',
  showAddToCart = true,
}: ProductCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  const normalizedImages = useMemo(
    () => normalizeProductImages(product.images as ProductGalleryImage[] | string[] | null | undefined, product.primary_image ?? null),
    [product.images, product.primary_image],
  );
  const acceptedTokens = product.accepted_tokens ?? [];
  const imgSrc = imgFailed
    ? FALLBACK
    : getPrimaryProductImage(product.images as ProductGalleryImage[] | string[] | null | undefined, product.primary_image ?? null);

  const sellerAvatar = product.seller_user_avatar ?? product.seller_avatar ?? null;
  const rating = Number(product.rating_avg ?? product.seller_rating ?? 0);
  const basePriceUsd = Number(product.base_price_usd || 0);
  const primaryToken = acceptedTokens.find((token) => token.is_primary) ?? acceptedTokens[0] ?? null;

  const handleAddToCart = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    addItem({
      product_id: product.product_id,
      name: product.name,
      base_price_usd: basePriceUsd,
      price_in_token: primaryToken ? Number(primaryToken.price_in_token) : undefined,
      token_symbol: primaryToken?.symbol,
      selected_token_id: primaryToken?.token_id ?? null,
      image_url: imgSrc,
      metadata: { images: normalizedImages.map((image) => image.url) },
      accepted_tokens: acceptedTokens,
    });
    toast.success('Đã thêm vào giỏ hàng');
  };

  const handleWishlist = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setWishlisted((value) => !value);
    toast.success(wishlisted ? 'Đã xóa khỏi yêu thích' : 'Đã thêm vào yêu thích');
  };

  if (variant === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: index * 0.03 }}
      >
        <Link href={`/products/${product.product_id}`}>
          <div className="group flex cursor-pointer gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-lg">
            <div className="relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
              <Image
                src={imgSrc}
                alt={product.name}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                unoptimized
                onError={() => setImgFailed(true)}
              />
              {product.stock === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <span className="text-xs font-bold text-red-400">Hết hàng</span>
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-between">
              <div>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h3 className="line-clamp-1 text-base font-bold text-foreground transition-colors group-hover:text-primary">
                    {product.name}
                  </h3>
                  <TokenBadgeBar acceptedTokens={acceptedTokens} />
                </div>
                {product.description && (
                  <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {sellerAvatar ? (
                    <img src={sellerAvatar} className="h-4 w-4 rounded-full object-cover" alt="" />
                  ) : (
                    <User className="h-3.5 w-3.5" />
                  )}
                  <span>{product.seller_name}</span>
                  {rating > 0 && (
                    <span className="flex items-center gap-0.5 text-yellow-500">
                      <Star className="h-3 w-3 fill-current" />
                      {rating.toFixed(1)}
                    </span>
                  )}
                  {product.category && (
                    <span className="rounded-md bg-muted px-2 py-0.5 capitalize">{product.category}</span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <ProductTokenPricing acceptedTokens={acceptedTokens} basePriceUsd={basePriceUsd} variant="card" />
                  <div className="mt-2">
                    <StockBadge stock={product.stock} />
                  </div>
                </div>

                {showAddToCart && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddToCart}
                      className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:border-primary/30 hover:bg-muted"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Thêm vào giỏ
                    </button>
                    <button
                      onClick={(event) => {
                        event.preventDefault();
                        window.location.href = `/products/${product.product_id}`;
                      }}
                      className="rounded-xl bg-[#f0b90b] px-3 py-1.5 text-xs font-bold text-black shadow shadow-yellow-500/20 transition-all hover:bg-[#e6a800]"
                    >
                      Mua ngay
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  const isFeatured = variant === 'featured';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      className="h-full"
    >
      <Link href={`/products/${product.product_id}`} className="block h-full">
        <div
          className={[
            'group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-black/10',
            isFeatured ? 'ring-1 ring-[#f0b90b]/0 hover:ring-[#f0b90b]/20' : '',
          ].join(' ')}
        >
          <div className={`relative overflow-hidden bg-muted ${isFeatured ? 'h-52' : 'h-44'}`}>
            <Image
              src={imgSrc}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              unoptimized
              onError={() => setImgFailed(true)}
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            {product.stock === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
                <span className="rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-400">
                  Hết hàng
                </span>
              </div>
            )}

            <div className="absolute left-3 top-3 flex flex-col gap-1.5">
              {product.category && (
                <span className="rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold capitalize text-white backdrop-blur-sm">
                  {product.category}
                </span>
              )}
            </div>

            <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
              {(product.is_nft_minted || product.metadata?.is_nft_minted) && (
                <span className="rounded-full border border-purple-400/30 bg-purple-600/90 px-2.5 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                  ✦ NFT
                </span>
              )}
              <TokenBadgeBar acceptedTokens={acceptedTokens} />
            </div>

            <div className="absolute bottom-0 left-0 right-0 flex translate-y-full gap-2 p-3 transition-transform duration-300 group-hover:translate-y-0">
              {showAddToCart && (
                <button
                  onClick={handleAddToCart}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/90 py-2 text-xs font-bold text-black shadow-lg backdrop-blur-sm transition-colors hover:bg-white"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Thêm giỏ
                </button>
              )}
              <button
                onClick={handleWishlist}
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-xl shadow-lg backdrop-blur-sm transition-colors',
                  wishlisted ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-700 hover:bg-white',
                ].join(' ')}
                title="Yêu thích"
              >
                <Heart className={`h-4 w-4 ${wishlisted ? 'fill-current' : ''}`} />
              </button>
              <Link
                href={`/products/${product.product_id}`}
                onClick={(event) => event.stopPropagation()}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-gray-700 shadow-lg backdrop-blur-sm transition-colors hover:bg-white"
                title="Xem chi tiết"
              >
                <Eye className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="flex flex-grow flex-col p-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              {sellerAvatar ? (
                <img src={sellerAvatar} className="h-4 w-4 flex-shrink-0 rounded-full object-cover" alt="" />
              ) : (
                <User className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              <span className="truncate">{product.seller_name || 'Người bán'}</span>
              {rating > 0 && (
                <span className="ml-auto flex flex-shrink-0 items-center gap-0.5 text-yellow-500">
                  <Star className="h-3 w-3 fill-current" />
                  <span className="text-muted-foreground">{rating.toFixed(1)}</span>
                </span>
              )}
            </div>

            <h3 className="mb-1 line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
              {product.name}
            </h3>

            {product.description && (
              <p className="mb-2 hidden line-clamp-2 text-xs text-muted-foreground sm:block">{product.description}</p>
            )}

            <div className="mt-auto border-t border-border/50 pt-3">
              <ProductTokenPricing acceptedTokens={acceptedTokens} basePriceUsd={basePriceUsd} variant="card" />
              <div className="mt-3 flex items-center justify-between gap-2">
                <StockBadge stock={product.stock} />
              </div>

              {showAddToCart && (
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    window.location.href = `/products/${product.product_id}`;
                  }}
                  className="group/btn mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#f0b90b] py-2 text-xs font-bold text-black shadow shadow-yellow-500/20 transition-all hover:bg-[#e6a800]"
                >
                  <Zap className="h-3.5 w-3.5 group-hover/btn:animate-pulse" />
                  Mua ngay
                </button>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
});
