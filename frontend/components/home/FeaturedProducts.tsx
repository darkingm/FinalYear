'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowRight, ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/store/cart-store';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

const PLACEHOLDER_IMAGE = '/placeholder-product.svg';

interface Product {
  product_id: number;
  name: string;
  description: string;
  base_price_usd: number;
  price_in_token?: number | null;
  token_symbol?: string | null;
  stock: number;
  primary_image?: string | null;
  images?: string[] | null;
  metadata?: Record<string, any>;
}

export function FeaturedProducts() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedIds, setFailedIds] = useState<Set<number>>(new Set());
  const addItem = useCartStore((state) => state.addItem);

  const getImgSrc = (product: Product) => {
    if (failedIds.has(product.product_id)) return PLACEHOLDER_IMAGE;
    if (product.primary_image) return product.primary_image;
    if (product.images?.[0]) return product.images[0];
    if (product.metadata?.images?.[0]) return product.metadata.images[0];
    return PLACEHOLDER_IMAGE;
  };

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    addItem({ product_id: product.product_id, name: product.name, base_price_usd: Number(product.base_price_usd), metadata: product.metadata });
    toast.success(t('product.addedToCart'));
  };

  useEffect(() => {
    apiClient.get('/api/products?limit=8&is_featured=true').then(r => {
      const list = r.data?.data ?? [];
      setProducts(Array.isArray(list) ? list : []);
    }).catch(() => setProducts([])).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <div className="flex justify-between items-center mb-5">
          <div className="h-7 w-48 skeleton" />
          <div className="h-9 w-24 skeleton" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-64 skeleton rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold">{t('home.featuredProducts')}</h2>
        <Link href="/products">
          <Button variant="ghost" size="sm" className="text-primary gap-1">
            {t('home.viewAll')} <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {products.slice(0, 8).map((product, index) => (
          <motion.div key={product.product_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: index * 0.04 }}>
            <Link href={`/products/${product.product_id}`}>
              <div className="bg-card rounded-xl border border-border overflow-hidden card-hover group">
                <div className="relative h-44 bg-muted">
                  <Image src={getImgSrc(product)} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" unoptimized onError={() => setFailedIds(prev => new Set(prev).add(product.product_id))} />
                  {product.token_symbol && (
                    <span className="absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">{product.token_symbol}</span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-sm mb-1.5 line-clamp-1">{product.name}</h3>
                  <p className="text-muted-foreground text-xs mb-3 line-clamp-2 leading-relaxed">{product.description}</p>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-bold text-primary">
                      {product.price_in_token && product.token_symbol
                        ? `${Number(product.price_in_token).toFixed(2)} ${product.token_symbol}`
                        : `$${Number(product.base_price_usd).toFixed(2)}`}
                    </span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{product.stock} left</span>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={(e) => handleAddToCart(e, product)} variant="outline"
                      className="flex-1 bg-background border-border hover:bg-primary/10 text-foreground transition-all h-8 text-xs font-medium px-2 z-10 relative">
                      <ShoppingCart className="w-3.5 h-3.5 mr-1" /> {t('product.addToCart')}
                    </Button>
                    <Button onClick={(e) => { e.preventDefault(); window.location.href = `/products/${product.product_id}`; }}
                      className="flex-1 bg-[#f0b90b] hover:bg-[#e6a800] text-black font-semibold h-8 text-xs px-2 shadow shadow-yellow-500/20 z-10 relative">
                      {t('product.buyNow')}
                    </Button>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
