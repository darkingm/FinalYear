'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard, type ProductCardData } from '@/components/product/ProductCard';
import { toast } from 'sonner';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Grid3X3, List, SlidersHorizontal, X, ShoppingBag,
  Plus, ChevronDown, Sparkles, TrendingUp, Tag, Package,
} from 'lucide-react';

interface Token { token_id: number; symbol: string; chain_id: number }

const CATEGORIES = [
  { value: '',            label: 'Tất cả',        icon: '🛍️' },
  { value: 'electronics', label: 'Điện tử',        icon: '💻' },
  { value: 'fashion',     label: 'Thời trang',     icon: '👗' },
  { value: 'home',        label: 'Nhà cửa',        icon: '🏠' },
  { value: 'accessories', label: 'Phụ kiện',       icon: '⌚' },
  { value: 'gaming',      label: 'Gaming',         icon: '🎮' },
  { value: 'books',       label: 'Sách',           icon: '📚' },
  { value: 'toys',        label: 'Đồ chơi',        icon: '🧸' },
];

const SORT_OPTIONS = [
  { value: 'newest',    label: 'Mới nhất',        icon: <Sparkles className="w-3.5 h-3.5" /> },
  { value: 'price_asc', label: 'Giá thấp nhất',  icon: <TrendingUp className="w-3.5 h-3.5 rotate-180" /> },
  { value: 'price_desc', label: 'Giá cao nhất',  icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { value: 'popular',   label: 'Phổ biến nhất',  icon: <Tag className="w-3.5 h-3.5" /> },
];

function SkeletonCard() {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="h-44 bg-muted animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-muted rounded animate-pulse w-1/3" />
        <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
        <div className="h-3 bg-muted rounded animate-pulse w-full" />
        <div className="h-6 bg-muted rounded animate-pulse w-1/2 mt-2" />
        <div className="h-8 bg-muted rounded-xl animate-pulse w-full mt-3" />
      </div>
    </div>
  );
}

function ProductsPageContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { session } = useAuth();

  const [products, setProducts]     = useState<ProductCardData[]>([]);
  const [tokens, setTokens]         = useState<Token[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState(searchParams.get('q') || '');
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [category, setCategory]     = useState(searchParams.get('category') || '');
  const [tokenFilter, setTokenFilter] = useState(searchParams.get('token') || '');
  const [sort, setSort]             = useState('newest');
  const [viewMode, setViewMode]     = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [sortOpen, setSortOpen]     = useState(false);

  useEffect(() => {
    apiClient.get('/api/products/tokens').then(r => setTokens(r.data.data ?? [])).catch(() => {});
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (search)   params.append('search', search);
      if (tokenFilter) params.append('token', tokenFilter);
      const res = await apiClient.get(`/api/products?${params}`);
      let data: ProductCardData[] = res.data.data ?? [];

      // Client-side filters
      if (priceRange.min) data = data.filter(p => Number(p.base_price_usd) >= Number(priceRange.min));
      if (priceRange.max) data = data.filter(p => Number(p.base_price_usd) <= Number(priceRange.max));

      // Sort
      if (sort === 'price_asc')  data.sort((a, b) => Number(a.base_price_usd) - Number(b.base_price_usd));
      if (sort === 'price_desc') data.sort((a, b) => Number(b.base_price_usd) - Number(a.base_price_usd));
      // newest/popular rely on backend default order

      setProducts(data);
    } catch { toast.error('Không thể tải sản phẩm'); }
    finally { setLoading(false); }
  }, [category, search, tokenFilter, priceRange, sort]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const clearFilters = () => {
    setCategory(''); setSearch(''); setSearchInput('');
    setPriceRange({ min: '', max: '' }); setTokenFilter('');
  };

  const hasActiveFilters = category || search || priceRange.min || priceRange.max || tokenFilter;
  const currentSort = SORT_OPTIONS.find(s => s.value === sort) || SORT_OPTIONS[0];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Hero banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#f0b90b]/8 via-background to-background border-b border-border">
        <div className="absolute top-0 right-0 w-[500px] h-[200px] bg-[#f0b90b]/5 blur-3xl rounded-full" />
        <div className="container mx-auto px-4 py-8 max-w-7xl relative">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-[#f0b90b]/10 border border-[#f0b90b]/20 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-[#f0b90b]" />
                </div>
                <h1 className="text-3xl font-black text-foreground">Marketplace</h1>
              </div>
              <p className="text-muted-foreground text-sm ml-[52px]">
                {loading ? 'Đang tải...' : `${products.length} sản phẩm Web3`}
              </p>
            </div>
            {session && (
              <Link href="/products/create">
                <button className="flex items-center gap-2 px-5 py-2.5 bg-[#f0b90b] hover:bg-[#e6a800] text-black font-bold rounded-xl shadow-lg shadow-yellow-500/20 transition-all hover:-translate-y-0.5">
                  <Plus className="w-4 h-4" />
                  Đăng bán sản phẩm
                </button>
              </Link>
            )}
          </motion.div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">

        {/* Search + Filter bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl border border-border p-4 mb-6 shadow-sm"
        >
          {/* Top row */}
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  placeholder="Tìm kiếm sản phẩm..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm text-foreground placeholder:text-muted-foreground transition-all"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 bg-[#f0b90b] hover:bg-[#e6a800] text-black font-bold rounded-xl text-sm transition-all shadow shadow-yellow-500/20"
              >
                Tìm
              </button>
            </form>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Token filter */}
              <select
                value={tokenFilter}
                onChange={e => setTokenFilter(e.target.value)}
                className="px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[110px]"
              >
                <option value="">Tất cả Token</option>
                {tokens.map(tk => (
                  <option key={tk.token_id} value={tk.symbol}>{tk.symbol}</option>
                ))}
              </select>

              {/* Sort dropdown */}
              <div className="relative">
                <button
                  onClick={() => setSortOpen(v => !v)}
                  className="flex items-center gap-2 px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground hover:bg-muted transition-colors"
                >
                  {currentSort.icon}
                  {currentSort.label}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {sortOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-30 min-w-[160px]"
                    >
                      {SORT_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => { setSort(opt.value); setSortOpen(false); }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors ${
                            sort === opt.value
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-foreground hover:bg-muted'
                          }`}
                        >
                          {opt.icon} {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Advanced filter toggle */}
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  showFilters || hasActiveFilters
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Lọc
                {hasActiveFilters && (
                  <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">
                    !
                  </span>
                )}
              </button>

              {/* View toggle */}
              <div className="hidden md:flex border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2.5 transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Advanced filter panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-4 mt-4 border-t border-border flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Giá tối thiểu ($)</label>
                    <input
                      type="number" placeholder="0" value={priceRange.min}
                      onChange={e => setPriceRange(p => ({ ...p, min: e.target.value }))}
                      className="w-28 px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Giá tối đa ($)</label>
                    <input
                      type="number" placeholder="9999" value={priceRange.max}
                      onChange={e => setPriceRange(p => ({ ...p, max: e.target.value }))}
                      className="w-28 px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                    />
                  </div>
                  <button
                    onClick={fetchProducts}
                    className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
                  >
                    Áp dụng
                  </button>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> Xóa bộ lọc
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Category pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide"
        >
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-all flex-shrink-0 ${
                category === cat.value
                  ? 'bg-[#f0b90b] text-black border-transparent shadow-md shadow-yellow-500/20'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-border/70'
              }`}
            >
              <span>{cat.icon}</span> {cat.label}
            </button>
          ))}
        </motion.div>

        {/* Active filter chips */}
        {(search || tokenFilter) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {search && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-sm">
                🔍 "{search}"
                <button onClick={() => { setSearch(''); setSearchInput(''); }} className="hover:text-red-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            {tokenFilter && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0b90b]/10 text-[#f0b90b] border border-[#f0b90b]/20 rounded-full text-sm">
                🪙 {tokenFilter}
                <button onClick={() => setTokenFilter('')} className="hover:text-red-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Product grid / list */}
        {loading ? (
          <div className={viewMode === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
            : 'space-y-4'
          }>
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : products.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24 bg-card rounded-2xl border border-border"
          >
            <Package className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">Không tìm thấy sản phẩm</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'Thử điều chỉnh bộ lọc hoặc xóa bộ lọc để xem tất cả sản phẩm.'
                : 'Chưa có sản phẩm nào. Hãy là người đầu tiên đăng bán!'}
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-5 py-2.5 bg-card border border-border text-foreground font-semibold rounded-xl hover:bg-muted transition-colors text-sm"
                >
                  Xóa bộ lọc
                </button>
              )}
              {session && (
                <Link href="/products/create">
                  <button className="px-5 py-2.5 bg-[#f0b90b] text-black font-bold rounded-xl hover:bg-[#e6a800] transition-colors text-sm shadow shadow-yellow-500/20">
                    + Đăng bán ngay
                  </button>
                </Link>
              )}
            </div>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${viewMode}-${category}-${sort}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
                : 'space-y-4'
              }
            >
              {products.map((product, index) => (
                <ProductCard
                  key={product.product_id}
                  product={product}
                  index={index}
                  variant={viewMode}
                  showAddToCart
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Load more hint */}
        {!loading && products.length >= 20 && (
          <div className="text-center mt-10 text-muted-foreground text-sm">
            Hiển thị {products.length} sản phẩm đầu tiên. Dùng bộ lọc để tìm chính xác hơn.
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    }>
      <ProductsPageContent />
    </Suspense>
  );
}
