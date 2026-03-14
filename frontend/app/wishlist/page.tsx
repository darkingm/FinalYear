'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Heart, Trash2, ShoppingCart, ArrowLeft } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { useWishlistStore } from '@/store/wishlist-store';
import { useCartStore } from '@/store/cart-store';
import { useAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';

export default function WishlistPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { items, removeItem } = useWishlistStore();
  const { addItem: addToCart } = useCartStore();
  const [removing, setRemoving] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?callbackUrl=/wishlist');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleRemove = (productId: number) => {
    setRemoving(productId);
    try {
      removeItem(productId);
      toast.success('Removed from wishlist');
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove');
    } finally {
      setRemoving(null);
    }
  };

  const handleAddToCart = async (item: any) => {
    try {
      addToCart(item);
      toast.success('Added to cart');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add to cart');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="fixed top-0 right-0 w-[40%] h-[40%] bg-rose-500/3 blur-[120px] rounded-full pointer-events-none" />
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Heart className="w-5 h-5 text-rose-400 fill-rose-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-foreground">Danh sách yêu thích</h1>
              <p className="text-muted-foreground text-sm">
                {items.length} sản phẩm
              </p>
            </div>
          </div>

        {/* Empty */}
        {items.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20 bg-card border border-border rounded-3xl"
          >
            <Heart className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-foreground">Danh sách yêu thích trống</h2>
            <p className="text-muted-foreground mb-6">
              Lưu sản phẩm yêu thích để mua sau
            </p>
            <Link href="/products">
              <button className="px-6 py-2.5 bg-[#f0b90b]/10 text-[#f0b90b] border border-[#f0b90b]/20 rounded-xl text-sm font-bold hover:bg-[#f0b90b]/20 transition-colors">
                Khám phá sản phẩm →
              </button>
            </Link>
          </motion.div>
        )}

        {/* Items */}
        {items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item, idx) => (
              <motion.div
                key={item.wishlist_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-shadow group"
              >
                {/* Image */}
                <Link href={`/products/${item.product_id}`}>
                  <div className="relative aspect-square bg-muted">
                    {item.primary_image ? (
                      <Image
                        src={item.primary_image}
                        alt={item.name || 'Product'}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No Image
                      </div>
                    )}
                    {item.status !== 'active' && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-semibold">Unavailable</span>
                      </div>
                    )}
                  </div>
                </Link>

                {/* Content */}
                <div className="p-4">
                  <Link href={`/products/${item.product_id}`}>
                    <h3 className="font-semibold text-lg mb-1 hover:text-primary transition-colors line-clamp-2">
                      {item.name}
                    </h3>
                  </Link>

                  {item.seller_name && (
                    <p className="text-sm text-muted-foreground mb-2">
                      by {item.seller_name}
                    </p>
                  )}

                  {/* Price & Rating */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-2xl font-bold text-primary">
                        ${parseFloat(item.base_price_usd?.toString() || '0').toFixed(2)}
                      </span>
                      {item.compare_price_usd && parseFloat(item.compare_price_usd.toString()) > parseFloat(item.base_price_usd?.toString() || '0') && (
                        <span className="text-sm text-muted-foreground line-through ml-2">
                          ${parseFloat(item.compare_price_usd.toString()).toFixed(2)}
                        </span>
                      )}
                    </div>
                    {item.avg_rating && item.avg_rating > 0 && (
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-yellow-500">★</span>
                        <span className="font-medium">{item.avg_rating.toFixed(1)}</span>
                        <span className="text-muted-foreground">({item.review_count || 0})</span>
                      </div>
                    )}
                  </div>

                  {/* Stock */}
                  {item.stock !== undefined && (
                    <p className={`text-sm mb-3 ${item.stock > 0 ? 'text-success' : 'text-destructive'}`}>
                      {item.stock > 0 ? `${item.stock} in stock` : 'Out of stock'}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleAddToCart(item)}
                      disabled={item.status !== 'active' || item.stock === 0}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Add to Cart
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemove(item.product_id)}
                      disabled={removing === item.product_id}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
