'use client';

import { useState, useEffect } from 'react';
import { productService } from '@/services';
import type { Product } from '@/types';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowRight, ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';

const PLACEHOLDER_IMAGE = '/placeholder-product.svg';

export function FeaturedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedIds, setFailedIds] = useState<Set<number>>(new Set());
  const addItem = useCartStore((state) => state.addItem);

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    addItem({
      product_id: product.product_id,
      name: product.name,
      base_price_usd: Number(product.base_price_usd),
      metadata: product.metadata,
    });
    toast.success('Đã thêm vào giỏ hàng');
  };

  useEffect(() => {
    (async () => {
      const { products: list } = await productService.list({ limit: 8 });
      // Ensure list is an array before setting
      setProducts(Array.isArray(list) ? list : []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div>
        <div className="flex justify-between items-center mb-5">
          <div className="h-7 w-48 skeleton" />
          <div className="h-9 w-24 skeleton" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold">Featured Products</h2>
        <Link href="/products">
          <Button variant="ghost" size="sm" className="text-primary gap-1">
            View All <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {products.slice(0, 8).map((product, index) => {
          const imgSrc = (product.metadata?.images?.[0] && !failedIds.has(product.product_id))
            ? product.metadata.images[0]
            : PLACEHOLDER_IMAGE;

          return (
            <motion.div
              key={product.product_id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
            >
              <Link href={`/products/${product.product_id}`}>
                <div className="bg-card rounded-xl border border-border overflow-hidden card-hover group">
                  <div className="relative h-44 bg-muted">
                    <Image
                      src={imgSrc}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      unoptimized
                      onError={() => setFailedIds((prev) => new Set(prev).add(product.product_id))}
                    />
                  </div>

                  <div className="p-4">
                    <h3 className="font-semibold text-sm mb-1.5 line-clamp-1">{product.name}</h3>
                    <p className="text-muted-foreground text-xs mb-3 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>

                    <div className="flex justify-between items-center mb-3">
                      <span className="text-lg font-bold text-primary">
                        ${Number(product.base_price_usd).toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                        {product.stock} left
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={(e) => handleAddToCart(e, product)}
                        variant="outline"
                        className="flex-1 bg-background border-border hover:bg-primary/10 text-foreground transition-all h-8 text-xs font-medium px-2 z-10 relative"
                      >
                        <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Cart
                      </Button>
                      <Button
                        onClick={(e) => { e.preventDefault(); window.location.href = `/products/${product.product_id}`; }}
                        className="flex-1 bg-[#f0b90b] hover:bg-[#e6a800] text-black font-semibold h-8 text-xs px-2 shadow shadow-yellow-500/20 z-10 relative"
                      >
                        Mua ngay
                      </Button>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
