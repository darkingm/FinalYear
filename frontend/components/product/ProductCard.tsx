'use client';

import { memo, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Star, User, ShoppingCart, Zap, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/store/cart-store';
import { ProductTokenPricing } from '@/components/product/ProductTokenPricing';
import { getPrimaryProductImage, normalizeProductImages } from '@/lib/products/images';
import type { ProductAcceptedTokenView, ProductGalleryImage } from '@/lib/products/types';
import { useDualText } from '@/lib/hooks/useDualText';

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
  seller_slug?: string | null;
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

export const ProductCard = memo(function ProductCard({
  product,
  index = 0,
  variant = 'grid',
  showAddToCart = true,
}: ProductCardProps) {
  const tr = useDualText();
  const [imgFailed, setImgFailed] = useState(false);
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
  const sellerLabel = product.seller_name || tr('Người bán', 'Seller');
  const sellerHref = product.seller_slug ? `/seller/${product.seller_slug}` : null;
  const rating = Number(product.rating_avg ?? product.seller_rating ?? 0);
  const basePriceUsd = Number(product.base_price_usd || 0);
  const primaryToken = acceptedTokens.find((token) => token.is_primary) ?? acceptedTokens[0] ?? null;
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(primaryToken?.token_id ?? null);
  const selectedToken = acceptedTokens.find((token) => token.token_id === selectedTokenId) ?? primaryToken;
  const productHref = selectedToken
    ? `/products/${product.product_id}?token=${selectedToken.token_id}`
    : `/products/${product.product_id}`;

  const handleAddToCart = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    addItem({
      product_id: product.product_id,
      name: product.name,
      base_price_usd: basePriceUsd,
      price_in_token: selectedToken ? Number(selectedToken.price_in_token) : undefined,
      token_symbol: selectedToken?.symbol,
      selected_token_id: selectedToken?.token_id ?? null,
      image_url: imgSrc,
      metadata: { images: normalizedImages.map((image) => image.url) },
      accepted_tokens: acceptedTokens,
    });
    toast.success(tr('Đã thêm vào giỏ hàng', 'Added to cart'));
  };

  const handleBuyNow = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    window.location.href = productHref;
  };

  const handleSelectToken = (token: ProductAcceptedTokenView) => {
    setSelectedTokenId(token.token_id);
  };

  /* ── List variant ───────────────────────────────────── */
  if (variant === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: index * 0.03 }}
      >
        <div className="group flex gap-4 rounded-2xl border border-border bg-card p-3 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
          <Link href={productHref} className="relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50">
            {product.category ? (
              <div className="absolute left-2 top-2 z-10">
                <span className="rounded-full border border-white/10 bg-black/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-md">
                  {product.category}
                </span>
              </div>
            ) : null}
            <Image
              src={imgSrc}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              unoptimized
              onError={() => setImgFailed(true)}
            />
            {product.stock === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">{tr('Hết hàng', 'Out of stock')}</span>
              </div>
            ) : null}
          </Link>

          <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
            {/* Seller + Rating */}
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {sellerHref ? (
                <Link href={sellerHref} className="flex min-w-0 items-center gap-1.5 transition-colors hover:text-primary" aria-label={tr(`Xem cửa hàng ${sellerLabel}`, `View shop ${sellerLabel}`)}>
                  {sellerAvatar ? (
                    <img src={sellerAvatar} className="h-4 w-4 flex-shrink-0 rounded-full object-cover ring-1 ring-white/10" alt="" />
                  ) : (
                    <User className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/60" />
                  )}
                  <span className="truncate">{sellerLabel}</span>
                </Link>
              ) : (
                <>
                  {sellerAvatar ? (
                    <img src={sellerAvatar} className="h-4 w-4 flex-shrink-0 rounded-full object-cover ring-1 ring-white/10" alt="" />
                  ) : (
                    <User className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/60" />
                  )}
                  <span className="truncate">{sellerLabel}</span>
                </>
              )}
              {rating > 0 ? (
                <span className="ml-auto flex flex-shrink-0 items-center gap-0.5">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="text-muted-foreground">{rating.toFixed(1)}</span>
                </span>
              ) : null}
            </div>

            <Link href={productHref} className="mb-1.5 block">
              <h3 className="line-clamp-2 text-[13px] font-bold leading-tight tracking-tight text-foreground transition-colors group-hover:text-foreground">
                {product.name}
              </h3>
            </Link>

            <div className="mt-auto border-t border-border pt-2">
              <ProductTokenPricing
                acceptedTokens={acceptedTokens}
                basePriceUsd={basePriceUsd}
                selectedTokenId={selectedToken?.token_id ?? null}
                onSelect={handleSelectToken}
                variant="card"
                stock={product.stock}
              />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ── Grid / Featured variant ────────────────────────── */
  const isFeatured = variant === 'featured';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -4 }}
      className="h-full"
    >
      <div
        className={[
          'group relative flex h-full flex-col overflow-hidden rounded-2xl border transition-all duration-300',
          /* Default state */
          'border-border bg-card backdrop-blur-sm',
          /* Hover state */
          'hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/10',
          isFeatured ? 'ring-1 ring-primary/0 hover:ring-primary/20' : '',
        ].join(' ')}
      >
        {/* ── Image ─────────────────────────────────── */}
        <Link href={productHref} className={`relative block overflow-hidden ${isFeatured ? 'h-56' : 'h-48'}`}>
          {/* Gradient background for loading state */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800/60 via-slate-900/40 to-slate-800/60" />

          <Image
            src={imgSrc}
            alt={product.name}
            fill
            className="object-cover transition-all duration-700 group-hover:scale-110"
            unoptimized
            onError={() => setImgFailed(true)}
          />

          {/* Hover overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Top-left badge area */}
          <div className="absolute left-3 top-3 flex flex-col gap-1.5">
            {product.category ? (
              <span className="rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-md">
                {product.category}
              </span>
            ) : null}
            {product.is_nft_minted ? (
              <span className="rounded-full border border-violet-400/20 bg-violet-500/20 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-violet-300 backdrop-blur-md">
                NFT
              </span>
            ) : null}
          </div>

          {/* Out of stock overlay */}
          {product.stock === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
              <span className="rounded-full border border-red-500/20 bg-red-500/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-400">
                {tr('Hết hàng', 'Out of stock')}
              </span>
            </div>
          ) : null}

          {/* Quick add overlay on hover */}
          {showAddToCart && product.stock !== 0 ? (
            <div className="absolute bottom-3 right-3 opacity-0 transition-all duration-300 group-hover:opacity-100">
              <button
                onClick={handleAddToCart}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-black/50 text-white/80 backdrop-blur-md transition-all hover:bg-white/20 hover:text-white"
                aria-label={tr('Thêm nhanh vào giỏ', 'Quick add to cart')}
              >
                <ShoppingCart className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </Link>

        {/* ── Content ───────────────────────────────── */}
        <div className="flex flex-grow flex-col p-4">
          {/* Seller row */}
          <div className="mb-2 flex items-center gap-1.5 text-[11px]">
            {sellerHref ? (
              <Link href={sellerHref} className="flex min-w-0 items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary" aria-label={tr(`Xem cửa hàng ${sellerLabel}`, `View shop ${sellerLabel}`)}>
                {sellerAvatar ? (
                  <img src={sellerAvatar} className="h-4 w-4 flex-shrink-0 rounded-full object-cover ring-1 ring-white/10" alt="" />
                ) : (
                  <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="h-2.5 w-2.5 text-muted-foreground" />
                  </div>
                )}
                <span className="truncate">{sellerLabel}</span>
              </Link>
            ) : (
              <>
                {sellerAvatar ? (
                  <img src={sellerAvatar} className="h-4 w-4 flex-shrink-0 rounded-full object-cover ring-1 ring-white/10" alt="" />
                ) : (
                  <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="h-2.5 w-2.5 text-muted-foreground" />
                  </div>
                )}
                <span className="truncate text-muted-foreground">{sellerLabel}</span>
              </>
            )}
            {rating > 0 ? (
              <span className="ml-auto flex flex-shrink-0 items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="text-[11px] text-muted-foreground">{rating.toFixed(1)}</span>
              </span>
            ) : null}
          </div>

          {/* Product name */}
          <Link href={productHref} className="mb-1.5 block">
            <h3 className="line-clamp-2 text-[13px] font-bold leading-tight tracking-tight text-foreground transition-colors group-hover:text-foreground">
              {product.name}
            </h3>
          </Link>

          {product.description ? (
            <p className="mb-2 line-clamp-1 text-[11px] leading-relaxed text-muted-foreground">{product.description}</p>
          ) : null}

          {/* Price + Actions — pushed to bottom */}
          <div className="mt-auto space-y-3 border-t border-border pt-3">
            <ProductTokenPricing
              acceptedTokens={acceptedTokens}
              basePriceUsd={basePriceUsd}
              selectedTokenId={selectedToken?.token_id ?? null}
              onSelect={handleSelectToken}
              variant="card"
              stock={product.stock}
            />

            {showAddToCart ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={product.stock === 0}
                  aria-label={tr('Thêm vào giỏ hàng', 'Add to cart')}
                  className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={product.stock === 0}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#f0b90b] to-[#e6a800] text-[12px] font-extrabold text-black shadow-lg shadow-yellow-500/15 transition-all hover:shadow-yellow-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Zap className="h-3.5 w-3.5" />
                  {tr('Mua ngay', 'Buy now')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
});
