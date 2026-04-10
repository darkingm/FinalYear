'use client';

/**
 * Shared ProductCard component — dùng cho cả trang chủ và trang /products
 * Hỗ trợ 3 variants: 'grid' | 'list' | 'featured'
 */

import { useState, memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShoppingCart, Star, User, Zap, Heart, Eye } from 'lucide-react';
import { useCartStore } from '@/store/cart-store';
import { getProductGallery } from '@/lib/utils/product-images';
import { toast } from 'sonner';
import { useTokenPrice, usdToToken, formatTokenAmount, TESTNET_CHAIN_IDS } from '@/lib/hooks/useTokenPrice';
import { useChainId } from 'wagmi';
import { CoinImage } from '@/components/ui/CoinImage';
import { formatUSD } from '@/lib/utils/format-price';

/* ─── Safe Chain Id Hook ─────────────────────────────────────── */
// useChainId is called unconditionally at the top. If WagmiProvider is unavailable,
// wagmi returns its default (amoy 80002 = testnet) which is safe.
function useCurrentChainId() {
  return useChainId(); // defaults to 80002 (testnet) if no wallet connected
}



const FALLBACK = '/placeholder-product.svg';

export interface AcceptedToken {
  token_id: number;
  symbol: string;
  name?: string;
  price_in_token: string | number;
  is_primary?: boolean;
  chain_id?: number;
  chain_name?: string;
}

export interface ProductCardData {
  product_id: number;
  name: string;
  description?: string;
  base_price_usd: number;
  price_in_token?: number | null;
  token_symbol?: string | null;
  stock?: number;
  primary_image?: string | null;
  images?: string[] | null;
  metadata?: Record<string, any>;
  category?: string;
  seller_name?: string;
  seller_avatar?: string | null;
  seller_user_avatar?: string | null;
  rating_avg?: number;
  seller_rating?: number;
  is_nft_minted?: boolean;
  accepted_tokens?: AcceptedToken[] | null;
}

interface ProductCardProps {
  product: ProductCardData;
  index?: number;
  variant?: 'grid' | 'list' | 'featured';
  showAddToCart?: boolean;
}

const STABLECOINS = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD']);

/**
 * TokenPill — renders a single token price pill with coin logo.
 */
function TokenPill({ symbol, amount }: { symbol: string; amount: number }) {
  const formatted = formatTokenAmount(amount, symbol);
  return (
    <span className="inline-flex items-center gap-1 bg-[#8247e5]/8 border border-[#8247e5]/20 rounded-lg px-2 py-0.5">
      <span className="font-black text-[#8247e5] text-sm leading-none">{formatted}</span>
      <CoinImage symbol={symbol} size={14} className="flex-shrink-0" />
    </span>
  );
}

/**
 * PriceBadge — shows prices consistent with product detail page.
 * Priority: accepted_tokens (DB) → metadata.pricing → legacy price_in_token → MATIC fallback
 */
function PriceBadge({ product }: { product: ProductCardData }) {
  const { prices } = useTokenPrice();
  const chainId = useChainId();
  const isTestnet = TESTNET_CHAIN_IDS.has(chainId);

  // Case 1: accepted_tokens from DB (SAME source as product detail page — highest priority)
  const tokens = product.accepted_tokens;
  if (tokens && tokens.length > 0) {
    const nonStable = tokens.filter(t => !STABLECOINS.has(t.symbol.toUpperCase()));
    const stable = tokens.filter(t => STABLECOINS.has(t.symbol.toUpperCase()));

    // Show non-stablecoin tokens as token amount, stablecoins as USD
    const display = nonStable.length > 0 ? nonStable : stable;
    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap gap-1">
          {display.map(t => (
            <TokenPill
              key={t.token_id}
              symbol={t.symbol}
              amount={STABLECOINS.has(t.symbol.toUpperCase())
                ? Number(product.base_price_usd)
                : Number(t.price_in_token)}
            />
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground font-medium">≈ {formatUSD(product.base_price_usd)}</span>
        {isTestnet && <span className="text-[10px] text-muted-foreground">(testnet)</span>}
      </div>
    );
  }

  // Case 2: metadata.pricing (seller-set custom pricing)
  const pricing = product.metadata?.pricing || {};
  const tokenKeys = Object.keys(pricing);
  if (tokenKeys.length > 0) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap gap-1">
          {tokenKeys.map(sym => (
            <TokenPill key={sym} symbol={sym} amount={Number(pricing[sym])} />
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground font-medium">≈ {formatUSD(product.base_price_usd)}</span>
        {isTestnet && <span className="text-[10px] text-muted-foreground">(testnet)</span>}
      </div>
    );
  }

  // Case 3: legacy single token (non-stablecoin)
  const hasLegacyToken = !!(product.price_in_token && product.token_symbol
    && !STABLECOINS.has((product.token_symbol || '').toUpperCase()));
  if (hasLegacyToken) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap gap-1">
          <TokenPill symbol={product.token_symbol!} amount={Number(product.price_in_token)} />
          {isTestnet && <span className="text-[10px] text-muted-foreground self-center">(testnet)</span>}
        </div>
        <span className="text-[11px] text-muted-foreground font-medium">≈ {formatUSD(product.base_price_usd)}</span>
      </div>
    );
  }

  // Case 4: no token data — fallback to MATIC computed from USD
  const maticAmount = usdToToken(Number(product.base_price_usd), 'MATIC', prices);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        <TokenPill symbol="MATIC" amount={maticAmount} />
        {isTestnet && <span className="text-[10px] text-muted-foreground self-center">(testnet)</span>}
      </div>
      <span className="text-[11px] text-muted-foreground font-medium">≈ {formatUSD(product.base_price_usd)}</span>
    </div>
  );
}

function StockBadge({ stock }: { stock?: number }) {
  if (stock === undefined) return null;
  if (stock === 0) return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
      Hết hàng
    </span>
  );
  if (stock <= 5) return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
      Còn {stock}
    </span>
  );
  return (
    <span className="text-xs text-muted-foreground">{stock} còn lại</span>
  );
}

export const ProductCard = memo(function ProductCard({
  product, index = 0, variant = 'grid', showAddToCart = true,
}: ProductCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const addItem = useCartStore(s => s.addItem);

  const gallery = getProductGallery(product.name, product.metadata?.category, product.images ?? []);
  const imgSrc = imgFailed
    ? FALLBACK
    : (product.primary_image ?? gallery[0] ?? FALLBACK);

  const sellerAvatar = product.seller_user_avatar ?? product.seller_avatar ?? null;
  const rating = product.rating_avg ?? product.seller_rating ?? 0;

  const pricing = product.metadata?.pricing || {};
  const tokenKeys = Object.keys(pricing);
  const hasToken = tokenKeys.length > 0 || !!(product.price_in_token && product.token_symbol);

  const displayTokenSymbol = tokenKeys.length > 0 ? tokenKeys[0] : product.token_symbol;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    addItem({
      product_id: product.product_id,
      name: product.name,
      base_price_usd: Number(product.base_price_usd),
      metadata: product.metadata,
    });
    toast.success('Đã thêm vào giỏ hàng!');
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setWishlisted(v => !v);
    toast.success(wishlisted ? 'Đã xóa khỏi yêu thích' : 'Đã thêm vào yêu thích ❤️');
  };

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (variant === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: index * 0.03 }}
      >
        <Link href={`/products/${product.product_id}`}>
          <div className="bg-card rounded-2xl border border-border hover:border-primary/40 hover:shadow-lg transition-all p-4 flex gap-4 cursor-pointer group">
            {/* Image */}
            <div className="relative w-28 h-28 rounded-xl overflow-hidden bg-muted flex-shrink-0">
              <Image
                src={imgSrc} alt={product.name} fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                unoptimized onError={() => setImgFailed(true)}
              />
              {product.stock === 0 && (
                <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                  <span className="text-xs font-bold text-red-400">Hết hàng</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-bold text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                    {product.name}
                  </h3>
                  {displayTokenSymbol && (
                    <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b] border border-[#f0b90b]/20">
                      {displayTokenSymbol} {tokenKeys.length > 1 ? '+' : ''}
                    </span>
                  )}
                </div>
                {product.description && (
                  <p className="text-muted-foreground text-sm line-clamp-2 mb-2">{product.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {sellerAvatar
                    ? <img src={sellerAvatar} className="w-4 h-4 rounded-full object-cover" alt="" />
                    : <User className="w-3.5 h-3.5" />}
                  <span>{product.seller_name}</span>
                  {rating > 0 && (
                    <span className="flex items-center gap-0.5 text-yellow-500">
                      <Star className="w-3 h-3 fill-current" />
                      {Number(rating).toFixed(1)}
                    </span>
                  )}
                  {product.category && (
                    <span className="px-2 py-0.5 bg-muted rounded-md capitalize">{product.category}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mt-3">
                <div>
                  <PriceBadge product={product} />
                  <StockBadge stock={product.stock} />
                </div>
                {showAddToCart && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddToCart}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-xl text-xs font-semibold text-foreground hover:bg-muted hover:border-primary/30 transition-all"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" /> Thêm vào giỏ
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); window.location.href = `/products/${product.product_id}`; }}
                      className="px-3 py-1.5 bg-[#f0b90b] hover:bg-[#e6a800] text-black text-xs font-bold rounded-xl shadow shadow-yellow-500/20 transition-all"
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

  // ── FEATURED / GRID VIEW ───────────────────────────────────────────────────
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
        <div className={`
          bg-card h-full flex flex-col rounded-2xl border border-border overflow-hidden group cursor-pointer
          hover:shadow-xl hover:shadow-black/10 hover:border-primary/30 transition-all duration-300
          ${isFeatured ? 'ring-1 ring-[#f0b90b]/0 hover:ring-[#f0b90b]/20' : ''}
        `}>
          {/* Image zone */}
          <div className={`relative ${isFeatured ? 'h-52' : 'h-44'} bg-muted overflow-hidden flex-shrink-0`}>
            <Image
              src={imgSrc} alt={product.name} fill
              className="object-cover group-hover:scale-105 transition-transform duration-700"
              unoptimized onError={() => setImgFailed(true)}
            />

            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Out of stock overlay */}
            {product.stock === 0 && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center">
                <span className="text-sm font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-full">
                  Hết hàng
                </span>
              </div>
            )}

            {/* Top badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              {product.category && (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white capitalize">
                  {product.category}
                </span>
              )}
            </div>
            <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
              {/* NFT Certified badge */}
              {(product.is_nft_minted || product.metadata?.is_nft_minted) && (
                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-purple-600/90 text-white shadow-lg backdrop-blur-sm border border-purple-400/30">
                  ✦ NFT
                </span>
              )}
              {hasToken && displayTokenSymbol && (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#f0b90b] text-black shadow-lg">
                  {displayTokenSymbol} {tokenKeys.length > 1 ? `+${tokenKeys.length - 1}` : ''}
                </span>
              )}
            </div>

            {/* Quick actions bar — visible on hover */}
            <div className="absolute bottom-0 left-0 right-0 flex gap-2 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
              {showAddToCart && (
                <button
                  onClick={handleAddToCart}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white/90 hover:bg-white text-black text-xs font-bold rounded-xl backdrop-blur-sm transition-colors shadow-lg"
                >
                  <ShoppingCart className="w-3.5 h-3.5" /> Thêm giỏ
                </button>
              )}
              <button
                onClick={handleWishlist}
                className={`w-9 h-9 flex items-center justify-center rounded-xl backdrop-blur-sm transition-colors shadow-lg ${wishlisted
                  ? 'bg-red-500 text-white'
                  : 'bg-white/90 hover:bg-white text-gray-700'
                  }`}
                title="Yêu thích"
              >
                <Heart className={`w-4 h-4 ${wishlisted ? 'fill-current' : ''}`} />
              </button>
              <Link
                href={`/products/${product.product_id}`}
                onClick={e => e.stopPropagation()}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/90 hover:bg-white text-gray-700 backdrop-blur-sm transition-colors shadow-lg"
                title="Xem chi tiết"
              >
                <Eye className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Info */}
          <div className="p-4 flex flex-col flex-grow">
            {/* Seller */}
            <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
              {sellerAvatar
                ? <img src={sellerAvatar} className="w-4 h-4 rounded-full object-cover flex-shrink-0" alt="" />
                : <User className="w-3.5 h-3.5 flex-shrink-0" />}
              <span className="truncate">{product.seller_name || 'Người bán'}</span>
              {rating > 0 && (
                <span className="flex items-center gap-0.5 text-yellow-500 ml-auto flex-shrink-0">
                  <Star className="w-3 h-3 fill-current" />
                  <span className="text-muted-foreground">{Number(rating).toFixed(1)}</span>
                </span>
              )}
            </div>

            {/* Name */}
            <h3 className="font-semibold text-sm text-foreground mb-1 line-clamp-2 leading-snug group-hover:text-primary transition-colors">
              {product.name}
            </h3>

            {/* Description (only in featured/larger cards) */}
            {product.description && (
              <p className="text-muted-foreground text-xs mb-2 line-clamp-2 hidden sm:block">
                {product.description}
              </p>
            )}

            {/* Price + Stock */}
            <div className="mt-auto pt-3 border-t border-border/50">
              <div className="flex items-end justify-between gap-2">
                <PriceBadge product={product} />
                <StockBadge stock={product.stock} />
              </div>

              {/* Buy now button always visible */}
              {showAddToCart && (
                <button
                  onClick={(e) => { e.preventDefault(); window.location.href = `/products/${product.product_id}`; }}
                  className="mt-3 w-full py-2 bg-[#f0b90b] hover:bg-[#e6a800] text-black text-xs font-bold rounded-xl shadow shadow-yellow-500/20 transition-all flex items-center justify-center gap-1.5 group/btn"
                >
                  <Zap className="w-3.5 h-3.5 group-hover/btn:animate-pulse" />
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
