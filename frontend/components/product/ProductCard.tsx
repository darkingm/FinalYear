'use client';

import { memo, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Star, User } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/store/cart-store';
import { ProductQuickActions } from '@/components/product/ProductQuickActions';
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

export const ProductCard = memo(function ProductCard({
  product,
  index = 0,
  variant = 'grid',
  showAddToCart = true,
}: ProductCardProps) {
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
    toast.success('Đã thêm vào giỏ hàng');
  };

  const handleBuyNow = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    window.location.href = productHref;
  };

  const handleSelectToken = (token: ProductAcceptedTokenView) => {
    setSelectedTokenId(token.token_id);
  };

  const infoBlock = (
    <>
      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        {sellerAvatar ? (
          <img src={sellerAvatar} className="h-4 w-4 flex-shrink-0 rounded-full object-cover" alt="" />
        ) : (
          <User className="h-3.5 w-3.5 flex-shrink-0" />
        )}
        <span className="truncate">{product.seller_name || 'Người bán'}</span>
        {rating > 0 ? (
          <span className="ml-auto flex flex-shrink-0 items-center gap-0.5 text-yellow-500">
            <Star className="h-3 w-3 fill-current" />
            <span className="text-muted-foreground">{rating.toFixed(1)}</span>
          </span>
        ) : null}
      </div>

      <Link href={productHref} className="mb-1 block">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors hover:text-primary">
          {product.name}
        </h3>
      </Link>

      {product.description ? (
        <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
      ) : null}

      <div className="mt-auto border-t border-border/50 pt-3">
        <ProductTokenPricing
          acceptedTokens={acceptedTokens}
          basePriceUsd={basePriceUsd}
          selectedTokenId={selectedToken?.token_id ?? null}
          onSelect={handleSelectToken}
          variant="card"
          stock={product.stock}
        />

        {showAddToCart ? (
          <div className="mt-3">
            <ProductQuickActions
              onAddToCart={handleAddToCart}
              onBuyNow={handleBuyNow}
              disabled={product.stock === 0}
              size="card"
            />
          </div>
        ) : null}
      </div>
    </>
  );

  if (variant === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: index * 0.03 }}
      >
        <div className="group flex gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-lg">
          <Link href={productHref} className="relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
            {product.category ? (
              <div className="absolute left-3 top-3 z-10">
                <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold capitalize text-white backdrop-blur-sm">
                  {product.category}
                </span>
              </div>
            ) : null}
            <Image
              src={imgSrc}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              unoptimized
              onError={() => setImgFailed(true)}
            />
            {product.stock === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                <span className="text-xs font-bold text-red-400">Hết hàng</span>
              </div>
            ) : null}
          </Link>

          <div className="flex min-w-0 flex-1 flex-col justify-between">
            {infoBlock}
          </div>
        </div>
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
      <div
        className={[
          'group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-black/10',
          isFeatured ? 'ring-1 ring-[#f0b90b]/0 hover:ring-[#f0b90b]/20' : '',
        ].join(' ')}
      >
        <Link href={productHref} className={`relative block overflow-hidden bg-muted ${isFeatured ? 'h-52' : 'h-44'}`}>
          <Image
            src={imgSrc}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            unoptimized
            onError={() => setImgFailed(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {product.stock === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <span className="rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-400">
                Hết hàng
              </span>
            </div>
          ) : null}

          {product.category ? (
            <div className="absolute left-3 top-3 flex flex-col gap-1.5">
              <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold capitalize text-white backdrop-blur-sm">
                {product.category}
              </span>
            </div>
          ) : null}
        </Link>

        <div className="flex flex-grow flex-col p-4">
          {infoBlock}
        </div>
      </div>
    </motion.div>
  );
});
