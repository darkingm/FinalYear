'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Star } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useTranslation } from 'react-i18next';
import { ProductCard, type ProductCardData } from '@/components/product/ProductCard';

export function FeaturedProducts() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/api/products?limit=8').then(r => {
      const list = r.data?.data ?? [];
      setProducts(Array.isArray(list) ? list.slice(0, 8) : []);
    }).catch(() => setProducts([])).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-[#f0b90b] fill-current" />
          <h2 className="text-xl font-bold text-foreground">{t('home.featuredProducts')}</h2>
        </div>
        <Link href="/products" className="flex items-center gap-1 text-sm text-[#f0b90b] hover:text-[#e6a800] font-medium transition-colors">
          {t('home.viewAll')} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="h-44 bg-muted animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-muted rounded animate-pulse w-1/3" />
                <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                <div className="h-6 bg-muted rounded animate-pulse w-1/2 mt-2" />
                <div className="h-8 bg-muted rounded-xl animate-pulse w-full mt-3" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <p>Chưa có sản phẩm nổi bật.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {products.map((product, index) => (
            <ProductCard
              key={product.product_id}
              product={product}
              index={index}
              variant="grid"
              showAddToCart
            />
          ))}
        </div>
      )}
    </div>
  );
}
