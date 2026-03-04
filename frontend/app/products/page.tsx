'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { toast } from 'sonner';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Grid3X3, List, SlidersHorizontal, X, Star, ShoppingBag, ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/store/cart-store';
import { getProductGallery } from '@/lib/utils/product-images';

const PRODUCT_IMAGES = [
  '/products/gallery/headphones-1.png', '/products/gallery/smartwatch-1.png', '/products/gallery/laptop-1.png',
  '/products/gallery/camera-1.png', '/products/gallery/sneakers-1.png', '/products/gallery/speaker-1.png',
];

interface Product {
  product_id: number;
  name: string;
  description: string;
  base_price_usd: number;
  metadata: { images?: string[]; category?: string; accepted_tokens?: { crypto?: string[]; fiat?: string[] } };
  stock: number;
  seller_name: string;
}

function ProductCard({ product, index, viewMode }: { product: Product; index: number; viewMode: 'grid' | 'list' }) {
  const [imgFailed, setImgFailed] = useState(false);
  const gallery = getProductGallery(product.name, product.metadata?.category, product.metadata?.images);
  const displaySrc = imgFailed
    ? PRODUCT_IMAGES[index % PRODUCT_IMAGES.length]
    : (gallery[0] || PRODUCT_IMAGES[index % PRODUCT_IMAGES.length]);

  const addItem = useCartStore((state) => state.addItem);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({
      product_id: product.product_id,
      name: product.name,
      base_price_usd: Number(product.base_price_usd),
      metadata: product.metadata,
    });
    toast.success('Đã thêm vào giỏ hàng');
  };

  if (viewMode === 'list') {
    return (
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: index * 0.03 }}>
        <Link href={`/products/${product.product_id}`}>
          <div className="bg-card rounded-xl border border-border hover:shadow-lg hover:border-primary/50 transition-all p-4 flex gap-4 cursor-pointer group">
            <div className="relative w-32 h-32 bg-muted rounded-xl overflow-hidden flex-shrink-0">
              <Image src={displaySrc} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform" unoptimized onError={() => setImgFailed(true)} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-foreground mb-1 line-clamp-1 group-hover:text-primary transition-colors">{product.name}</h3>
              <p className="text-muted-foreground text-sm mb-2 line-clamp-2">{product.description}</p>
              <div className="flex items-center gap-2 mb-2">
                {product.metadata?.accepted_tokens?.crypto?.slice(0, 3).map(token => (
                  <span key={token} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">{token}</span>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xl font-bold text-foreground">${Number(product.base_price_usd).toFixed(2)}</span>
                  <span className="text-sm text-muted-foreground ml-2">{product.stock} left</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={(e) => { e.preventDefault(); handleAddToCart(e); }}
                    variant="outline"
                    className="bg-background border-border text-foreground hover:bg-primary/10 px-3 h-8 text-xs font-semibold"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Thêm vào giỏ
                  </Button>
                  <Button
                    onClick={(e) => { e.preventDefault(); window.location.href = `/products/${product.product_id}`; }}
                    className="bg-[#f0b90b] text-black hover:bg-[#e6a800] px-3 h-8 text-xs font-semibold shadow-md border-none"
                  >
                    Mua ngay
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }}>
      <Link href={`/products/${product.product_id}`} className="block h-full">
        <div className="bg-card h-full flex flex-col rounded-2xl border border-border hover:shadow-xl hover:border-primary/50 transition-all cursor-pointer overflow-hidden group card-hover">
          <div className="relative h-48 bg-muted overflow-hidden">
            <Image src={displaySrc} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized onError={() => setImgFailed(true)} />
            {product.stock === 0 && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                <span className="text-destructive font-semibold px-4 py-2 bg-destructive/10 rounded-lg border border-destructive/20">Out of Stock</span>
              </div>
            )}
            {product.metadata?.category && (
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-white/90 backdrop-blur-sm text-xs font-medium text-gray-700 shadow-sm">
                {product.metadata.category}
              </span>
            )}
          </div>
          <div className="p-4 flex flex-col flex-grow">
            <h3 className="font-semibold text-sm text-foreground mb-1 line-clamp-1 group-hover:text-primary transition-colors">{product.name}</h3>
            <p className="text-muted-foreground text-xs mb-3 line-clamp-2 min-h-[32px]">{product.description}</p>
            <div className="mt-auto">
              <div className="flex justify-between items-center mb-3">
                <span className="text-lg font-bold text-foreground">${Number(product.base_price_usd).toFixed(2)}</span>
                <div className="flex items-center gap-1 text-yellow-500">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span className="text-xs font-medium text-muted-foreground">4.8</span>
                </div>
              </div>
              {product.metadata?.accepted_tokens && (
                <div className="flex gap-1 flex-wrap">
                  {product.metadata.accepted_tokens.crypto?.slice(0, 3).map(token => (
                    <span key={token} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">{token}</span>
                  ))}
                  {product.metadata.accepted_tokens.fiat?.includes('paypal') && (
                    <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded font-medium">PayPal</span>
                  )}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={(e) => { e.preventDefault(); handleAddToCart(e); }}
                  variant="outline"
                  className="flex-1 bg-background border-border hover:bg-primary/10 hover:border-primary/50 text-foreground transition-all h-8 text-xs font-medium px-2"
                >
                  <ShoppingCart className="w-3.5 h-3.5 flex-shrink-0" />
                  Giỏ hàng
                </Button>
                <Button
                  onClick={(e) => { e.preventDefault(); window.location.href = `/products/${product.product_id}`; }}
                  className="flex-1 bg-[#f0b90b] hover:bg-[#e6a800] text-black font-semibold h-8 text-xs px-2 shadow shadow-yellow-500/20"
                >
                  Mua ngay
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

import { Suspense } from 'react';

function ProductsPageContent() {
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (search) params.append('search', search);
      const response = await apiClient.get(`/api/products?${params}`);
      let data = response.data.data || [];
      if (priceRange.min) data = data.filter((p: Product) => Number(p.base_price_usd) >= Number(priceRange.min));
      if (priceRange.max) data = data.filter((p: Product) => Number(p.base_price_usd) <= Number(priceRange.max));
      setProducts(data);
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  }, [category, search, priceRange]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchProducts(); };
  const clearFilters = () => { setCategory(''); setSearch(''); setPriceRange({ min: '', max: '' }); };
  const categoriesList = [
    { value: '', label: 'All Categories' }, { value: 'electronics', label: 'Electronics' },
    { value: 'fashion', label: 'Fashion' }, { value: 'home', label: 'Home & Garden' },
    { value: 'sports', label: 'Sports' }, { value: 'books', label: 'Books' }, { value: 'toys', label: 'Toys' },
  ];
  const hasActiveFilters = category || search || priceRange.min || priceRange.max;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Products</h1>
            <span className="text-muted-foreground">({products.length} items)</span>
          </div>
          {session && (
            <Link href="/products/create">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 gap-2">+ Sell Product</Button>
            </Link>
          )}
        </motion.div>

        {/* Search & Filters */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-2xl shadow-sm border border-border p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-accent border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm text-foreground placeholder:text-muted-foreground" />
              </div>
              <Button type="submit" className="bg-[#f0b90b] hover:bg-[#e6a800] text-black">Search</Button>
            </form>

            <div className="flex gap-2">
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="px-4 py-2.5 bg-accent border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm text-foreground">
                {categoriesList.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
              </select>
              <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className={`border-border ${showFilters ? 'bg-primary/10 text-primary border-primary/30' : 'text-foreground hover:bg-accent'}`}>
                <SlidersHorizontal className="w-4 h-4" />
              </Button>
              <div className="hidden md:flex border border-border rounded-xl overflow-hidden">
                <button onClick={() => setViewMode('grid')} className={`p-2.5 ${viewMode === 'grid' ? 'bg-[#f0b90b] text-black' : 'bg-card text-muted-foreground hover:bg-accent'}`}>
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode('list')} className={`p-2.5 ${viewMode === 'list' ? 'bg-[#f0b90b] text-black' : 'bg-card text-muted-foreground hover:bg-accent'}`}>
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="pt-4 mt-4 border-t border-border flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Min Price</label>
                    <input type="number" placeholder="$0" value={priceRange.min} onChange={(e) => setPriceRange(p => ({ ...p, min: e.target.value }))}
                      className="w-32 px-3 py-2 bg-accent border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder-muted-foreground" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Max Price</label>
                    <input type="number" placeholder="$1000" value={priceRange.max} onChange={(e) => setPriceRange(p => ({ ...p, max: e.target.value }))}
                      className="w-32 px-3 py-2 bg-accent border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder-muted-foreground" />
                  </div>
                  <Button onClick={fetchProducts} size="sm" className="bg-[#f0b90b] hover:bg-[#e6a800] text-black">Apply</Button>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-destructive hover:text-destructive/80 hover:bg-destructive/10">
                      <X className="w-4 h-4 mr-1" /> Clear All
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Products */}
        {loading ? (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5' : 'space-y-4'}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-card rounded-2xl overflow-hidden border border-border">
                <div className="h-48 bg-muted animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-muted rounded animate-pulse" />
                  <div className="h-6 bg-muted rounded animate-pulse w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 bg-card rounded-2xl border border-border">
            <Search className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No products found</h3>
            <p className="text-muted-foreground mb-6">{hasActiveFilters ? 'Try adjusting your search or filters' : 'Be the first to sell a product!'}</p>
            {session && (<Link href="/products/create"><Button className="bg-[#f0b90b] text-black">Create Product</Button></Link>)}
          </motion.div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5' : 'space-y-4'}>
            {products.map((product, index) => (
              <ProductCard key={product.product_id} product={product} index={index} viewMode={viewMode} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>}>
      <ProductsPageContent />
    </Suspense>
  );
}
