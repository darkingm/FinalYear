'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import { publicRequestConfig } from '@/lib/api/request-auth';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard, type ProductCardData } from '@/components/product/ProductCard';
import { toast } from 'sonner';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Grid3X3, List, SlidersHorizontal, X, ShoppingBag,
  Plus, ChevronDown, Sparkles, TrendingUp, Tag, Package,
  Gem, Coins, Zap, Shield,
} from 'lucide-react';



/* ─── Types ─────────────────────────────────────────────────── */
interface TokenProduct {
  product_id: number;
  name: string;
  description: string;
  base_price_usd: string;
  primary_image: string;
  category: string;
  rating_avg: string;
  review_count: number;
  accepted_tokens: Array<{
    token_id: number;
    symbol: string;
    name: string;
    price_in_token: string;
    chain_id: number;
    chain_name: string;
    is_primary: boolean;
  }>;
  seller_name: string;
  seller_slug?: string | null;
  seller_username: string;
  seller_user_avatar: string;
}

/* ─── Constants ──────────────────────────────────────────────── */
const CATEGORIES = [
  { value: '', label: 'Tất cả', icon: '🛍️' },
  { value: 'electronics', label: 'Điện tử', icon: '💻' },
  { value: 'fashion', label: 'Thời trang', icon: '👗' },
  { value: 'home', label: 'Nhà cửa', icon: '🏠' },
  { value: 'accessories', label: 'Phụ kiện', icon: '⌚' },
  { value: 'gaming', label: 'Gaming', icon: '🎮' },
  { value: 'books', label: 'Sách', icon: '📚' },
  { value: 'collectibles', label: 'Sưu tập', icon: '💎' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { value: 'price_asc', label: 'Giá thấp nhất', icon: <TrendingUp className="w-3.5 h-3.5 rotate-180" /> },
  { value: 'price_desc', label: 'Giá cao nhất', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { value: 'popular', label: 'Phổ biến nhất', icon: <Tag className="w-3.5 h-3.5" /> },
];

/* ─── Skeleton ───────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="h-48 bg-muted animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-muted rounded animate-pulse w-1/3" />
        <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
        <div className="h-6 bg-muted rounded animate-pulse w-1/2 mt-2" />
        <div className="h-9 bg-muted rounded-xl animate-pulse w-full mt-3" />
      </div>
    </div>
  );
}

/* ─── NFT Product Card ───────────────────────────────────────── */
function NFTProductCard({ product, index }: { product: TokenProduct; index: number }) {
  const mappedProduct: ProductCardData = {
    product_id: product.product_id,
    name: product.name,
    description: product.description,
    base_price_usd: product.base_price_usd,
    primary_image: product.primary_image,
    category: product.category,
    rating_avg: product.rating_avg,
    seller_name: product.seller_name,
    seller_slug: product.seller_slug,
    seller_user_avatar: product.seller_user_avatar,
    accepted_tokens: product.accepted_tokens,
  };

  return (
    <ProductCard
      product={mappedProduct}
      index={index}
      variant="grid"
      showAddToCart
    />
  );
}

/* ─── NFT Stats Bar ─────────────────────────────────────────── */
function NFTStatsBar({ products }: { products: TokenProduct[] }) {
  const totalVol = products.reduce((sum, p) => sum + parseFloat(p.base_price_usd), 0);
  const chains = [...new Set(products.flatMap(p => p.accepted_tokens?.map(t => t.chain_name) || []))];
  const tokens = [...new Set(products.flatMap(p => p.accepted_tokens?.map(t => t.symbol) || []))];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Tổng sản phẩm tokenized', value: products.length.toString(), icon: Gem, color: '#8247e5' },
        { label: 'Tổng giá trị (USD)', value: `$${(totalVol / 1000).toFixed(1)}K`, icon: Coins, color: '#f0b90b' },
        { label: 'Blockchain hỗ trợ', value: chains.length.toString(), icon: Zap, color: '#12aaff' },
        { label: 'Token chấp nhận', value: tokens.length.toString(), icon: Shield, color: '#22c55e' },
      ].map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="p-4 rounded-2xl bg-card border border-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-black text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground truncate">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Content ───────────────────────────────────────────── */
function ProductsPageContent() {
  const searchParams = useSearchParams();
  const { session } = useAuth();

  const [activeTab, setActiveTab] = useState<'products' | 'nft'>(
    searchParams.get('tab') === 'nft' ? 'nft' : 'products'
  );

  // Products tab state
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [sort, setSort] = useState('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [sortOpen, setSortOpen] = useState(false);

  // NFT tab state
  const [nftProducts, setNftProducts] = useState<TokenProduct[]>([]);
  const [nftLoading, setNftLoading] = useState(false);
  const [nftCategory, setNftCategory] = useState('');
  const [nftChain, setNftChain] = useState('');

  // Fetch regular products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (search) params.append('search', search);
      const res = await apiClient.get(`/api/products?${params}`, publicRequestConfig);
      let data: ProductCardData[] = res.data.data ?? [];
      if (priceRange.min) data = data.filter(p => Number(p.base_price_usd) >= Number(priceRange.min));
      if (priceRange.max) data = data.filter(p => Number(p.base_price_usd) <= Number(priceRange.max));
      if (sort === 'price_asc') data.sort((a, b) => Number(a.base_price_usd) - Number(b.base_price_usd));
      if (sort === 'price_desc') data.sort((a, b) => Number(b.base_price_usd) - Number(a.base_price_usd));
      setProducts(data);
    } catch { toast.error('Không thể tải sản phẩm'); }
    finally { setLoading(false); }
  }, [category, search, priceRange, sort]);

  // Fetch NFT/tokenized products
  const fetchNFTProducts = useCallback(async () => {
    setNftLoading(true);
    try {
      const res = await apiClient.get('/api/products?has_token=true&limit=50', publicRequestConfig);
      let data: TokenProduct[] = (res.data.data ?? []).filter(
        (p: any) => p.accepted_tokens?.length > 0
      );
      if (nftCategory) data = data.filter(p => p.category === nftCategory);
      if (nftChain) data = data.filter(p =>
        p.accepted_tokens?.some(t => t.chain_name?.toLowerCase().includes(nftChain.toLowerCase()))
      );
      setNftProducts(data);
    } catch { toast.error('Không thể tải sản phẩm NFT'); }
    finally { setNftLoading(false); }
  }, [nftCategory, nftChain]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => {
    if (activeTab === 'nft') fetchNFTProducts();
  }, [activeTab, fetchNFTProducts]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setSearch(searchInput); };
  const clearFilters = () => {
    setCategory(''); setSearch(''); setSearchInput('');
    setPriceRange({ min: '', max: '' });
  };
  const hasActiveFilters = category || search || priceRange.min || priceRange.max;
  const currentSort = SORT_OPTIONS.find(s => s.value === sort) || SORT_OPTIONS[0];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-[#f0b90b]/8 via-transparent to-transparent">
        <div className="absolute top-0 right-0 w-[500px] h-[200px] bg-[#f0b90b]/5 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-[20%] w-64 h-32 bg-[#8247e5]/5 blur-3xl pointer-events-none" />
        <div className="container mx-auto px-4 py-8 max-w-7xl relative">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
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
                {loading ? 'Đang tải...' : `${products.length} sản phẩm · ${nftProducts.length} NFT tokenized`}
              </p>
            </div>
            {session && (
              <Link href="/products/create">
                <button className="flex items-center gap-2 px-5 py-2.5 bg-[#f0b90b] hover:bg-[#e6a800] text-black font-bold rounded-xl shadow-lg shadow-yellow-500/20 transition-all hover:-translate-y-0.5 text-sm">
                  <Plus className="w-4 h-4" />
                  Đăng bán sản phẩm
                </button>
              </Link>
            )}
          </motion.div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
        {/* Tabs */}
        <div className="flex gap-1.5 p-1 bg-card border border-border rounded-2xl w-fit mb-6">
          {[
            {
              key: 'products', label: 'Sản phẩm', icon: Package,
              desc: `${products.length}`
            },
            {
              key: 'nft', label: 'NFT & Token hóa', icon: Gem,
              desc: nftProducts.length ? `${nftProducts.length}` : '•', special: true
            },
          ].map(({ key, label, icon: Icon, desc, special }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as 'products' | 'nft')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === key
                ? special
                  ? 'bg-gradient-to-r from-[#8247e5] to-[#12aaff] text-white shadow-md'
                  : 'bg-[#f0b90b] text-black shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeTab === key
                ? 'bg-black/20 text-white'
                : 'bg-muted text-muted-foreground'
                }`}>
                {desc}
              </span>
            </button>
          ))}
        </div>

        {/* ── TAB: PRODUCTS ── */}
        {activeTab === 'products' && (
          <>
            {/* Search + Filter */}
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-2xl border border-border p-4 mb-5 shadow-sm"
            >
              <div className="flex flex-col lg:flex-row gap-3">
                <form onSubmit={handleSearch} className="flex gap-2 flex-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      placeholder="Tìm kiếm sản phẩm..."
                      value={searchInput}
                      onChange={e => setSearchInput(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm text-foreground placeholder:text-muted-foreground transition-all"
                    />
                  </div>
                  <button type="submit" className="px-4 py-2.5 bg-[#f0b90b] hover:bg-[#e6a800] text-black font-bold rounded-xl text-sm shadow shadow-yellow-500/20">
                    Tìm
                  </button>
                </form>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Sort */}
                  <div className="relative">
                    <button
                      onClick={() => setSortOpen(v => !v)}
                      className="flex items-center gap-2 px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      {currentSort.icon} {currentSort.label}
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {sortOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.97 }}
                          className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-30 min-w-[160px] overflow-hidden"
                        >
                          {SORT_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => { setSort(opt.value); setSortOpen(false); }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors ${sort === opt.value ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-muted'
                                }`}
                            >
                              {opt.icon} {opt.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button
                    onClick={() => setShowFilters(v => !v)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${showFilters || hasActiveFilters
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    Lọc
                    {hasActiveFilters && (
                      <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">!</span>
                    )}
                  </button>

                  <div className="hidden md:flex border border-border rounded-xl overflow-hidden">
                    {(['grid', 'list'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setViewMode(m)}
                        className={`p-2.5 transition-colors ${viewMode === m ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                      >
                        {m === 'grid' ? <Grid3X3 className="w-4 h-4" /> : <List className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {showFilters && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="pt-4 mt-4 border-t border-border flex flex-wrap gap-4 items-end">
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Giá tối thiểu ($)</label>
                        <input type="number" placeholder="0" value={priceRange.min}
                          onChange={e => setPriceRange(p => ({ ...p, min: e.target.value }))}
                          className="w-28 px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Giá tối đa ($)</label>
                        <input type="number" placeholder="9999" value={priceRange.max}
                          onChange={e => setPriceRange(p => ({ ...p, max: e.target.value }))}
                          className="w-28 px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
                      </div>
                      <button onClick={fetchProducts} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90">Áp dụng</button>
                      {hasActiveFilters && (
                        <button onClick={clearFilters} className="flex items-center gap-1.5 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-colors">
                          <X className="w-3.5 h-3.5" /> Xóa bộ lọc
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Category pills */}
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-all flex-shrink-0 ${category === cat.value
                    ? 'bg-[#f0b90b] text-black border-transparent shadow-md'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground'
                    }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>

            {/* Active filter chips */}
            {search && (
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-sm">
                  🔍 "{search}"
                  <button onClick={() => { setSearch(''); setSearchInput(''); }}><X className="w-3.5 h-3.5" /></button>
                </span>
              </div>
            )}

            {/* Product Grid/List */}
            {loading ? (
              <div className={viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
                : 'space-y-4'}>
                {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : products.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-24 bg-card rounded-2xl border border-border">
                <Package className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
                <h3 className="text-xl font-bold mb-2">Không tìm thấy sản phẩm</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  {hasActiveFilters ? 'Thử điều chỉnh bộ lọc.' : 'Chưa có sản phẩm nào. Hãy là người đầu tiên đăng bán!'}
                </p>
                <div className="flex gap-3 justify-center">
                  {hasActiveFilters && (
                    <button onClick={clearFilters} className="px-5 py-2.5 bg-card border border-border rounded-xl text-sm font-semibold hover:bg-muted">Xóa bộ lọc</button>
                  )}
                  {session && (
                    <Link href="/products/create">
                      <button className="px-5 py-2.5 bg-[#f0b90b] text-black font-bold rounded-xl text-sm">+ Đăng bán ngay</button>
                    </Link>
                  )}
                </div>
              </motion.div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${viewMode}-${category}-${sort}`}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className={viewMode === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
                    : 'space-y-4'}
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
          </>
        )}

        {/* ── TAB: NFT & TOKENIZED ── */}
        {activeTab === 'nft' && (
          <>
            {/* NFT Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl mb-6 bg-gradient-to-br from-[#8247e5]/20 via-[#12aaff]/10 to-[#f0b90b]/10 border border-[#8247e5]/20 p-6">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#8247e5]/20 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Gem className="w-6 h-6 text-[#8247e5]" />
                    <h2 className="text-xl font-black text-foreground">NFT & Tài sản Token hóa</h2>
                  </div>
                  <p className="text-muted-foreground text-sm max-w-md">
                    Sản phẩm được đại diện bởi NFT trên blockchain. Mua = sở hữu token, quyền sở hữu minh bạch, có thể giao dịch trên các marketplace NFT.
                  </p>
                </div>
                {session && (
                  <Link href="/seller/upload">
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8247e5] to-[#12aaff] text-white font-bold rounded-xl shadow-lg text-sm whitespace-nowrap hover:opacity-90 transition-opacity">
                      <Zap className="w-4 h-4" />
                      Tokenize tài sản
                    </button>
                  </Link>
                )}
              </div>
            </div>

            {/* Stats */}
            {!nftLoading && nftProducts.length > 0 && (
              <NFTStatsBar products={nftProducts} />
            )}

            {/* Chain filter */}
            <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide">
              {[
                { key: '', label: 'Tất cả chain' },
                { key: 'polygon', label: '🔷 Polygon' },
                { key: 'arbitrum', label: '⚡ Arbitrum' },
                { key: 'bnb', label: '🟡 BNB Chain' },
                { key: 'eth', label: '💎 Ethereum' },
              ].map(c => (
                <button
                  key={c.key}
                  onClick={() => setNftChain(c.key)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-all flex-shrink-0 ${nftChain === c.key
                    ? 'bg-gradient-to-r from-[#8247e5] to-[#12aaff] text-white border-transparent shadow-md'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground'
                    }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {nftLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : nftProducts.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-24 rounded-2xl border border-[#8247e5]/20 bg-gradient-to-br from-[#8247e5]/5 to-transparent">
                <Gem className="w-16 h-16 mx-auto text-[#8247e5]/30 mb-4" />
                <h3 className="text-xl font-bold mb-2">Chưa có sản phẩm NFT</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Hãy là người đầu tiên tokenize tài sản của bạn trên blockchain!
                </p>
                {session && (
                  <Link href="/seller/upload">
                    <button className="px-6 py-3 bg-gradient-to-r from-[#8247e5] to-[#12aaff] text-white font-bold rounded-xl shadow-lg">
                      🚀 Tokenize ngay
                    </button>
                  </Link>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
              >
                {nftProducts.map((product, index) => (
                  <NFTProductCard key={product.product_id} product={product} index={index} />
                ))}
              </motion.div>
            )}
          </>
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
