'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Zap, Star, Clock, Package, Shield,
  ChevronRight, ChevronLeft, Heart, Share2, ExternalLink,
  Store, Calendar, BadgeCheck, TrendingUp, MessageCircle,
  Coins, CreditCard, Info, Check, AlertCircle,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://103.20.96.79:3001';

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
  const [linkCopied, setLinkCopied] = useState(false);
  const [coinPrices, setCoinPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch(`${API}/api/products/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setProduct(d.data);
          if (d.data.accepted_tokens?.length > 0) {
            setSelectedToken(d.data.accepted_tokens.find((t: AcceptedToken) => t.is_primary) || d.data.accepted_tokens[0]);
          }
        }
      })
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

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleBuyNow = () => {
    if (!product) return;
    const params = new URLSearchParams({
      product_id: String(product.product_id),
      qty: String(qty),
      ...(selectedToken ? { token_id: String(selectedToken.token_id) } : {}),
    });
    router.push(`/checkout?${params.toString()}`);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-12 h-12 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );

  if (!product) return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center text-white gap-4">
      <AlertCircle className="w-16 h-16 text-red-400" />
      <h2 className="text-xl font-semibold">Product not found</h2>
      <Link href="/products" className="text-violet-400 hover:underline">Browse all products →</Link>
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

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Breadcrumb */}
      <div className="border-b border-white/5 px-4 py-3 text-sm text-white/40">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/products" className="hover:text-white/70 transition-colors">Products</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white/70 truncate max-w-[200px]">{product.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
          {/* Image Gallery */}
          <div className="space-y-3">
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-white/5 border border-white/10 group">
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
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setCurrentImg(p => Math.min(images.length - 1, p + 1))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
              {/* Share / Wishlist */}
              <div className="absolute top-3 right-3 flex gap-2">
                <button
                  onClick={handleShare}
                  className="w-9 h-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:bg-black/80 transition-all"
                  title="Copy link"
                >
                  {linkCopied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setLiked(v => !v)}
                  className="w-9 h-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:bg-black/80 transition-all"
                >
                  <Heart className={`w-4 h-4 transition-colors ${liked ? 'fill-red-500 text-red-500' : ''}`} />
                </button>
              </div>
            </div>
            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImg(idx)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all
                      ${currentImg === idx ? 'border-violet-500' : 'border-white/10 hover:border-white/30'}`}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Category + Status */}
            <div className="flex items-center gap-3 flex-wrap">
              {product.category && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-violet-500/15 text-violet-300 border border-violet-500/20">
                  {product.category}
                </span>
              )}
              {product.stock > 0
                ? <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-300 border border-green-500/20 flex items-center gap-1"><Check className="w-3 h-3" />In Stock ({product.stock})</span>
                : <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-300 border border-red-500/20">Out of Stock</span>
              }
            </div>

            <h1 className="text-2xl lg:text-3xl font-bold leading-snug">{product.name}</h1>

            {/* Rating */}
            {parseFloat(product.rating_avg) > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={`w-4 h-4 ${s <= Math.round(parseFloat(product.rating_avg)) ? 'fill-amber-400 text-amber-400' : 'text-white/20'}`} />
                  ))}
                </div>
                <span className="text-sm text-white/60">{parseFloat(product.rating_avg).toFixed(1)} ({product.review_count} reviews)</span>
              </div>
            )}

            {/* Price Panel */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <div className="flex items-end gap-3">
                <span className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                  {displayPrice}
                </span>
                {usdEquivalent && (
                  <span className="text-white/50 text-sm mb-1">≈ ${usdEquivalent} USD</span>
                )}
              </div>
              <p className="text-white/40 text-xs">Base price: ${parseFloat(product.base_price_usd).toFixed(2)} USD</p>

              {/* Token Selector */}
              {product.accepted_tokens?.length > 0 && (
                <div>
                  <p className="text-xs text-white/50 mb-2">Pay with:</p>
                  <div className="flex flex-wrap gap-2">
                    {product.accepted_tokens.map(token => (
                      <button
                        key={token.token_id}
                        onClick={() => setSelectedToken(token)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all
                          ${selectedToken?.token_id === token.token_id
                            ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                            : 'bg-white/5 border-white/15 text-white/70 hover:border-white/30'}`}
                      >
                        <span className="font-bold">{token.symbol}</span>
                        <span className="text-xs ml-1 opacity-60">({token.chain_name})</span>
                        {coinPrices[token.symbol] && (
                          <span className="ml-2 text-xs text-green-400">${coinPrices[token.symbol].toFixed(2)}</span>
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => setSelectedToken(null)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all
                        ${!selectedToken
                          ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                          : 'bg-white/5 border-white/15 text-white/70 hover:border-white/30'}`}
                    >
                      <CreditCard className="w-4 h-4 inline mr-1" />PayPal
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quantity */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-white/60">Quantity</span>
              <div className="flex items-center gap-2 bg-white/5 rounded-xl border border-white/10 p-1">
                <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all font-bold">−</button>
                <span className="w-10 text-center font-semibold">{qty}</span>
                <button onClick={() => setQty(q => Math.min(product.stock || 99, q + 1))} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all font-bold">+</button>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleBuyNow}
                disabled={product.stock === 0}
                className="flex-1 py-4 rounded-xl font-bold text-sm bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
              >
                <Zap className="w-4 h-4" />
                Buy Now
              </button>
              <button className="px-5 py-4 rounded-xl font-bold text-sm bg-white/5 border border-white/15 hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Cart
              </button>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Shield, label: 'Escrow Protected' },
                { icon: Package, label: 'Fast Shipping' },
                { icon: MessageCircle, label: 'Live Support' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/3 border border-white/8 text-white/50 text-xs text-center">
                  <Icon className="w-4 h-4" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Seller Info Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-1">
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4 sticky top-4">
              <h3 className="font-semibold text-white/80 flex items-center gap-2">
                <Store className="w-4 h-4 text-violet-400" />
                Seller Info
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                  {product.seller_user_avatar || product.seller_avatar
                    ? <img src={product.seller_user_avatar || product.seller_avatar} alt="" className="w-full h-full object-cover" />
                    : <span className="text-lg font-bold text-violet-300">{product.seller_name?.[0]?.toUpperCase()}</span>
                  }
                </div>
                <div>
                  <p className="font-semibold text-sm">{product.seller_name}</p>
                  {product.seller_username && <p className="text-xs text-white/40">@{product.seller_username}</p>}
                  {parseFloat(product.seller_rating) > 0 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-xs text-amber-400">{parseFloat(product.seller_rating).toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {product.seller_total_sales > 0 && (
                  <div className="flex items-center gap-2 text-white/50">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span>{product.seller_total_sales} sales</span>
                  </div>
                )}
                {product.seller_joined_at && (
                  <div className="flex items-center gap-2 text-white/50">
                    <Calendar className="w-4 h-4" />
                    <span>Joined {new Date(product.seller_joined_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-white/50">
                  <Clock className="w-4 h-4" />
                  <span>Listed {new Date(product.listed_at).toLocaleDateString()}</span>
                </div>
              </div>

              {product.seller_description && (
                <p className="text-xs text-white/40 leading-relaxed border-t border-white/8 pt-3">{product.seller_description}</p>
              )}

              {product.seller_slug && (
                <Link
                  href={`/seller/${product.seller_slug}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-white/15 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Store
                </Link>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <h3 className="font-semibold mb-3">Description</h3>
              <p className="text-white/60 leading-relaxed whitespace-pre-line">{product.description}</p>
            </div>

            {/* Direct link */}
            <div className="p-4 rounded-2xl bg-white/3 border border-white/8 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/40 mb-1">Product Link</p>
                <p className="text-sm text-white/60 truncate font-mono text-xs">{typeof window !== 'undefined' ? window.location.href : ''}</p>
              </div>
              <button
                onClick={handleShare}
                className="flex-shrink-0 px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm hover:bg-violet-500/30 transition-all flex items-center gap-2"
              >
                {linkCopied ? <><Check className="w-3.5 h-3.5" />Copied!</> : <><Share2 className="w-3.5 h-3.5" />Copy</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}