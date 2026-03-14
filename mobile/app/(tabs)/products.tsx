import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, Pressable, Image, TextInput,
  ActivityIndicator, ScrollView, RefreshControl, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../lib/api/client';
import {
  Search, SlidersHorizontal, X, Star, Package, ShoppingBag,
  Zap, TrendingUp, ChevronDown, MapPin,
} from 'lucide-react-native';

interface Product {
  product_id: number;
  name: string;
  base_price_usd: number;
  price_in_token: number | null;
  token_symbol: string | null;
  primary_image: string | null;
  category: string;
  stock: number;
  seller_name: string;
  rating_avg: number;
  review_count: number;
  has_nft: boolean;
}

const CATEGORIES = [
  { key: '', label: '🌐 Tất cả', icon: '🌐' },
  { key: 'electronics', label: '📱 Điện tử', icon: '📱' },
  { key: 'fashion', label: '👕 Thời trang', icon: '👕' },
  { key: 'accessories', label: '⌚ Phụ kiện', icon: '⌚' },
  { key: 'gaming', label: '🎮 Gaming', icon: '🎮' },
  { key: 'home', label: '🏠 Gia dụng', icon: '🏠' },
  { key: 'sports', label: '⚽ Thể thao', icon: '⚽' },
  { key: 'collectibles', label: '💎 Sưu tầm', icon: '💎' },
];

const SORT_OPTIONS = [
  { key: 'newest', label: 'Mới nhất' },
  { key: 'price_asc', label: 'Giá: Thấp → Cao' },
  { key: 'price_desc', label: 'Giá: Cao → Thấp' },
  { key: 'rating', label: 'Đánh giá cao nhất' },
  { key: 'popular', label: 'Phổ biến nhất' },
];

const PRICE_RANGES = [
  { key: '', label: 'Mọi giá' },
  { key: '0-50', label: '< $50' },
  { key: '50-200', label: '$50 – $200' },
  { key: '200-1000', label: '$200 – $1,000' },
  { key: '1000-', label: '> $1,000' },
];

export default function ProductsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [priceRange, setPriceRange] = useState('');
  const [onlyNFT, setOnlyNFT] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const filterAnim = useRef(new Animated.Value(0)).current;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const fetchProducts = useCallback(async (reset = true) => {
    if (reset) { setLoading(true); setPage(1); }
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (category) params.set('category', category);
      if (sortBy) params.set('sort', sortBy);
      if (priceRange) {
        const [min, max] = priceRange.split('-');
        if (min) params.set('min_price', min);
        if (max) params.set('max_price', max);
      }
      if (onlyNFT) params.set('has_nft', '1');
      params.set('page', reset ? '1' : String(page));
      params.set('limit', '20');

      const res = await apiClient.get(`/api/products?${params}`);
      const data = res.data.data ?? [];
      if (reset) setProducts(data);
      else setProducts(prev => [...prev, ...data]);
      setHasMore(data.length === 20);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [debouncedSearch, category, sortBy, priceRange, onlyNFT, page]);

  useEffect(() => { fetchProducts(true); }, [debouncedSearch, category, sortBy, priceRange, onlyNFT]);

  // Animate filter panel
  useEffect(() => {
    Animated.spring(filterAnim, {
      toValue: showFilters ? 1 : 0,
      useNativeDriver: false,
      tension: 100,
      friction: 10,
    }).start();
  }, [showFilters]);

  const filterHeight = filterAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 220] });

  const activeFilterCount = [category, priceRange, onlyNFT, sortBy !== 'newest'].filter(Boolean).length;

  const priceDisplay = (p: Product) => {
    if (p.price_in_token && p.token_symbol) {
      const dec = ['ETH', 'WBTC'].includes(p.token_symbol) ? 6 : 4;
      return { main: `${Number(p.price_in_token).toFixed(dec)}`, unit: p.token_symbol };
    }
    return { main: `$${Number(p.base_price_usd).toFixed(2)}`, unit: '' };
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      {/* ── Header & Search ── */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Text style={{ color: 'white', fontSize: 22, fontWeight: '900', flex: 1 }}>
            {t('nav.products')}
          </Text>
          {/* Near Me button */}
          <Link href="/products/nearby" asChild>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#131722', borderWidth: 1, borderColor: '#1e2130', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 }}>
              <MapPin size={14} color="#10b981" />
              <Text style={{ color: '#10b981', fontWeight: '700', fontSize: 12 }}>Gần bạn</Text>
            </Pressable>
          </Link>
          <Pressable
            onPress={() => setShowFilters(v => !v)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: showFilters ? '#f0b90b' : '#131722',
              borderWidth: 1, borderColor: showFilters ? '#f0b90b' : '#1e2130',
              borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
            }}
          >
            <SlidersHorizontal size={16} color={showFilters ? 'black' : '#9ca3af'} />
            <Text style={{ color: showFilters ? 'black' : '#9ca3af', fontWeight: '700', fontSize: 13 }}>
              Lọc {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
            </Text>
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: '#131722', borderRadius: 14, borderWidth: 1,
          borderColor: search ? '#f0b90b40' : '#1e2130',
          paddingHorizontal: 14, paddingVertical: 11,
        }}>
          <Search size={18} color={search ? '#f0b90b' : '#4b5563'} />
          <TextInput
            style={{ flex: 1, color: 'white', fontSize: 15 }}
            placeholder="Tìm kiếm sản phẩm, thương hiệu..."
            placeholderTextColor="#4b5563"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
              <X size={16} color="#6b7280" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ── Filter Panel (animated) ── */}
      <Animated.View style={{ height: filterHeight, overflow: 'hidden' }}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}>
          {/* Sort */}
          <View>
            <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>SẮP XẾP</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SORT_OPTIONS.map(opt => (
                <Pressable
                  key={opt.key} onPress={() => setSortBy(opt.key)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99,
                    backgroundColor: sortBy === opt.key ? '#f0b90b' : '#131722',
                    borderWidth: 1, borderColor: sortBy === opt.key ? '#f0b90b' : '#1e2130',
                  }}
                >
                  <Text style={{ color: sortBy === opt.key ? 'black' : '#9ca3af', fontWeight: '700', fontSize: 12 }}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Price Range */}
          <View>
            <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>MỨC GIÁ</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {PRICE_RANGES.map(r => (
                <Pressable
                  key={r.key} onPress={() => setPriceRange(r.key)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99,
                    backgroundColor: priceRange === r.key ? '#3b82f6' : '#131722',
                    borderWidth: 1, borderColor: priceRange === r.key ? '#3b82f6' : '#1e2130',
                  }}
                >
                  <Text style={{ color: priceRange === r.key ? 'white' : '#9ca3af', fontWeight: '700', fontSize: 12 }}>
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* NFT Only toggle */}
          <Pressable
            onPress={() => setOnlyNFT(v => !v)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99,
              backgroundColor: onlyNFT ? 'rgba(139,92,246,0.15)' : '#131722',
              borderWidth: 1, borderColor: onlyNFT ? '#8b5cf6' : '#1e2130',
            }}
          >
            <Zap size={14} color={onlyNFT ? '#a78bfa' : '#6b7280'} />
            <Text style={{ color: onlyNFT ? '#a78bfa' : '#6b7280', fontWeight: '700', fontSize: 12 }}>
              Chỉ sản phẩm có NFT
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* ── Category Tabs ── */}
      <View style={{ paddingBottom: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {CATEGORIES.map(cat => (
            <Pressable
              key={cat.key} onPress={() => setCategory(cat.key)}
              style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99,
                backgroundColor: category === cat.key ? '#f0b90b' : '#131722',
                borderWidth: 1, borderColor: category === cat.key ? '#f0b90b' : '#1e2130',
              }}
            >
              <Text style={{ color: category === cat.key ? 'black' : '#9ca3af', fontWeight: '600', fontSize: 12 }}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── Results Count ── */}
      {!loading && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TrendingUp size={13} color="#6b7280" />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>
            {products.length} sản phẩm {debouncedSearch ? `cho "${debouncedSearch}"` : ''}
          </Text>
        </View>
      )}

      {/* ── Product Grid ── */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#f0b90b" size="large" />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={p => String(p.product_id)}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 16, gap: 12 }}
          contentContainerStyle={{ paddingBottom: 100, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchProducts(true); }}
              tintColor="#f0b90b"
            />
          }
          onEndReached={() => { if (hasMore) { setPage(p => p + 1); fetchProducts(false); } }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={() => (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
              <Package size={56} color="#374151" />
              <Text style={{ color: '#6b7280', marginTop: 16, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                {debouncedSearch ? `Không tìm thấy "${debouncedSearch}"` : 'Chưa có sản phẩm'}
              </Text>
              {debouncedSearch && (
                <Pressable onPress={() => setSearch('')} style={{ marginTop: 12, backgroundColor: '#131722', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
                  <Text style={{ color: '#f0b90b', fontWeight: '700' }}>Xóa tìm kiếm</Text>
                </Pressable>
              )}
            </View>
          )}
          renderItem={({ item: p }) => {
            const price = priceDisplay(p);
            return (
              <Link href={`/products/${p.product_id}`} asChild style={{ flex: 1 }}>
                <Pressable style={{
                  backgroundColor: '#131722', borderRadius: 20, overflow: 'hidden',
                  borderWidth: 1, borderColor: '#1e2130', flex: 1,
                }}>
                  {/* Image */}
                  <View style={{ height: 150, backgroundColor: '#1a1f2e', position: 'relative' }}>
                    {p.primary_image ? (
                      <Image source={{ uri: p.primary_image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <ShoppingBag size={36} color="#374151" />
                      </View>
                    )}
                    {/* NFT Badge */}
                    {p.has_nft && (
                      <View style={{
                        position: 'absolute', top: 8, left: 8,
                        backgroundColor: 'rgba(139,92,246,0.9)', borderRadius: 8,
                        paddingHorizontal: 6, paddingVertical: 3,
                        flexDirection: 'row', alignItems: 'center', gap: 3,
                      }}>
                        <Zap size={9} color="white" />
                        <Text style={{ color: 'white', fontSize: 9, fontWeight: '800' }}>NFT</Text>
                      </View>
                    )}
                    {/* Token badge */}
                    {p.token_symbol && (
                      <View style={{
                        position: 'absolute', top: 8, right: 8,
                        backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 8,
                        paddingHorizontal: 6, paddingVertical: 3,
                      }}>
                        <Text style={{ color: '#f0b90b', fontSize: 9, fontWeight: '800' }}>{p.token_symbol}</Text>
                      </View>
                    )}
                    {/* Out of stock */}
                    {p.stock === 0 && (
                      <View style={{
                        ...StyleSheet.absoluteFillObject,
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ color: 'white', fontWeight: '800', fontSize: 13 }}>Hết hàng</Text>
                      </View>
                    )}
                  </View>

                  {/* Info */}
                  <View style={{ padding: 12, gap: 4 }}>
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
                      {p.name}
                    </Text>

                    {/* Rating */}
                    {p.rating_avg > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Star size={10} color="#f0b90b" fill="#f0b90b" />
                        <Text style={{ color: '#f0b90b', fontSize: 10, fontWeight: '700' }}>
                          {Number(p.rating_avg).toFixed(1)}
                        </Text>
                        <Text style={{ color: '#4b5563', fontSize: 10 }}>({p.review_count})</Text>
                      </View>
                    )}

                    {/* Price */}
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
                      <Text style={{ color: '#f0b90b', fontWeight: '900', fontSize: 16 }}>{price.main}</Text>
                      {price.unit && <Text style={{ color: '#f0b90b', fontWeight: '600', fontSize: 10 }}>{price.unit}</Text>}
                    </View>

                    {/* Seller */}
                    <Text style={{ color: '#4b5563', fontSize: 10 }} numberOfLines={1}>
                      {p.seller_name || 'Seller'}
                    </Text>
                  </View>
                </Pressable>
              </Link>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

// Need to import StyleSheet
import { StyleSheet } from 'react-native';
