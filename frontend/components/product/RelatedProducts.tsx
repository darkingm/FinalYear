'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { ProductCard, type ProductCardData } from '@/components/product/ProductCard';
import { useClientTranslation } from '@/lib/hooks/useClientTranslation';

interface RelatedProductsProps {
  currentProductId: number;
  category?: string;
}

export function RelatedProducts({ currentProductId, category }: RelatedProductsProps) {
  const { t } = useClientTranslation();
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    const fetchRelatedProducts = async () => {
      try {
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        params.append('limit', '12');
        const response = await apiClient.get(`/api/products?${params}`);
        const allProducts = response.data.data ?? [];
        setProducts(allProducts.filter((product: ProductCardData) => product.product_id !== currentProductId));
      } catch (error) {
        console.error('Error fetching related products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRelatedProducts();
  }, [currentProductId, category]);

  const scroll = (direction: 'left' | 'right') => {
    const container = document.getElementById('related-products-container');
    if (!container) return;

    const nextPosition = direction === 'left' ? scrollPosition - 320 : scrollPosition + 320;
    container.scrollTo({ left: nextPosition, behavior: 'smooth' });
    setScrollPosition(nextPosition);
  };

  if (loading) {
    return (
      <div className="mt-12">
        <div className="mb-4 h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((index) => (
            <div key={index} className="w-[260px] flex-shrink-0">
              <div className="mb-2 h-60 animate-pulse rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="mt-12"
    >
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('product.relatedProducts')}</h2>
        <div className="flex gap-2">
          <button onClick={() => scroll('left')} className="rounded-full bg-muted p-2 transition-colors hover:bg-muted/80">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => scroll('right')} className="rounded-full bg-muted p-2 transition-colors hover:bg-muted/80">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        id="related-products-container"
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
        onScroll={(event) => setScrollPosition(event.currentTarget.scrollLeft)}
      >
        {products.map((product, index) => (
          <div key={product.product_id} className="w-[280px] flex-shrink-0">
            <ProductCard product={product} index={index} variant="grid" showAddToCart />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
