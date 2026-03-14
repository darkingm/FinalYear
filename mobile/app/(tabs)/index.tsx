import { useState, useEffect, useCallback } from 'react';
import {
  View, ScrollView, Text, Pressable, Image,
  RefreshControl, FlatList,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { useAuthStore } from '../../lib/store/auth-store';
import { apiClient } from '../../lib/api/client';
import { TrendingUp, TrendingDown, ShoppingBag, MessageCircle, MapPin, AlertCircle } from 'lucide-react-native';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { safeCall } from '../../lib/utils/api';

interface Product {
  product_id: number;
  name: string;
  base_price_usd: number;
  price_in_token: number | null;
  token_symbol: string | null;
  primary_image: string | null;
  category: string;
  has_nft?: boolean;
}

interface Ticker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
}

const TOP_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'MATICUSDT', 'BNBUSDT'];

/**
 * Format price for display:
 * - If sold in token: show "0.0500 ETH"
 * - Otherwise: show "$99.99"
 */
function priceDisplay(p: Product): { main: string; unit: string; isToken: boolean } {
  if (p.price_in_token != null && p.token_symbol) {
    const isSmall = ['ETH', 'WBTC', 'BTC'].includes(p.token_symbol);
    const dec = isSmall ? 6 : 4;
    return {
      main: Number(p.price_in_token).toFixed(dec),
      unit: p.token_symbol,
      isToken: true,
    };
  }
  return {
    main: `$${Number(p.base_price_usd).toFixed(2)}`,
    unit: '',
    isToken: false,
  };
}

function ProductCard({ p }: { p: Product }) {
  const price = priceDisplay(p);
  return (
    <Link href={`/products/${p.product_id}` as any} asChild>
      <Pressable
        style={{ width: '47.5%', backgroundColor: '#131722', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#1e2130' }}
      >
        {/* Image */}
        <View style={{ height: 140, backgroundColor: '#1a1f2e', position: 'relative' }}>
          {p.primary_image ? (
            <Image source={{ uri: p.primary_image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={32} color="#6b7280" />
            </View>
          )}
          {/* Token badge */}
          {p.token_symbol && (
            <View style={{ position: 'absolute', top: 7, right: 7, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: '#f0b90b', fontSize: 10, fontWeight: '800' }}>{p.token_symbol}</Text>
            </View>
          )}
          {/* NFT badge */}
          {p.has_nft && (
            <View style={{ position: 'absolute', top: 7, left: 7, backgroundColor: 'rgba(139,92,246,0.9)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: 'white', fontSize: 9, fontWeight: '800' }}>NFT</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={{ padding: 10, gap: 3 }}>
          <Text style={{ color: 'white', fontWeight: '600', fontSize: 12, lineHeight: 17 }} numberOfLines={2}>
            {p.name}
          </Text>
          {/* Price — show token amount + symbol clearly */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 2 }}>
            <Text style={{ color: '#f0b90b', fontWeight: '900', fontSize: 15 }}>
              {price.main}
            </Text>
            {price.unit !== '' && (
              <Text style={{ color: '#f0b90b', fontWeight: '700', fontSize: 11 }}>
                {price.unit}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [prodError, setProdError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setProdError(null);
    const { data, error } = await safeCall(
      () => apiClient.get('/api/products?limit=8').then(r => r.data.data ?? []),
      { tag: 'home.fetchProducts', fallback: [] as Product[] },
    );
    setProducts(data ?? []);
    if (error) setProdError(error);
  }, []);

  const fetchTickers = useCallback(async () => {
    try {
      const sym = TOP_SYMBOLS.map(s => `"${s}"`).join(',');
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${sym}]`);
      const data = await res.json();
      if (Array.isArray(data)) setTickers(data.slice(0, 4));
    } catch { /* Binance optional, don't block UI */ }
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchProducts(), fetchTickers()]);
    setLoading(false);
    setRefreshing(false);
  }, [fetchProducts, fetchTickers]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f0b90b" />}
      >
        {/* ── Header ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: '#9ca3af', fontSize: 13 }}>{t('greeting.morning')}</Text>
            <Text style={{ color: 'white', fontSize: 22, fontWeight: '900' }}>
              {isAuthenticated ? user?.username : 'Crypto Market'} 👋
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* Near Me shortcut */}
            <Link href="/products/nearby" asChild>
              <Pressable style={{ width: 40, height: 40, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' }}>
                <MapPin size={18} color="#10b981" />
              </Pressable>
            </Link>
            {/* AI Chat */}
            <Link href="/(tabs)/chat" asChild>
              <Pressable style={{ width: 40, height: 40, backgroundColor: 'rgba(240,185,11,0.1)', borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(240,185,11,0.3)' }}>
                <MessageCircle size={18} color="#f0b90b" />
              </Pressable>
            </Link>
          </View>
        </View>

        {/* ── Crypto Ticker ── */}
        {tickers.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 16, marginBottom: 10, textTransform: 'uppercase' }}>
              Thị trường Crypto
            </Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={tickers}
              keyExtractor={item => item.symbol}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
              renderItem={({ item }) => {
                const isPos = parseFloat(item.priceChangePercent) >= 0;
                const sym = item.symbol.replace('USDT', '');
                return (
                  <View style={{ backgroundColor: '#131722', borderRadius: 18, padding: 14, minWidth: 120, borderWidth: 1, borderColor: '#1e2130' }}>
                    <Text style={{ color: 'white', fontWeight: '800', fontSize: 14, marginBottom: 3 }}>{sym}</Text>
                    <Text style={{ color: 'white', fontFamily: 'monospace', fontSize: 12, marginBottom: 4 }}>
                      ${parseFloat(item.lastPrice).toLocaleString()}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      {isPos
                        ? <TrendingUp size={11} color="#10b981" />
                        : <TrendingDown size={11} color="#ef4444" />}
                      <Text style={{ color: isPos ? '#10b981' : '#ef4444', fontSize: 11, fontWeight: '700' }}>
                        {isPos ? '+' : ''}{parseFloat(item.priceChangePercent).toFixed(2)}%
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
          </View>
        )}

        {/* ── Featured Products ── */}
        <View style={{ paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ color: 'white', fontSize: 17, fontWeight: '900' }}>{t('home.featuredProducts')}</Text>
            <Link href="/products" asChild>
              <Pressable>
                <Text style={{ color: '#f0b90b', fontSize: 13, fontWeight: '700' }}>{t('home.viewAll')} →</Text>
              </Pressable>
            </Link>
          </View>

          {/* Error banner */}
          {prodError && !loading && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', padding: 12, marginBottom: 12 }}>
              <AlertCircle size={16} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontSize: 12, flex: 1 }}>
                Không kết nối được server. Kiểm tra mạng và thử kéo để làm mới.
              </Text>
            </View>
          )}

          {/* Loading skeleton */}
          {loading ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {[1, 2, 3, 4].map(i => (
                <View key={i} style={{ width: '47.5%' }}>
                  <SkeletonCard rows={2} />
                </View>
              ))}
            </View>
          ) : products.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
              <ShoppingBag size={40} color="#374151" />
              <Text style={{ color: '#6b7280', fontSize: 14 }}>Chưa có sản phẩm nào</Text>
              <Pressable onPress={onRefresh} style={{ backgroundColor: '#131722', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: '#1e2130' }}>
                <Text style={{ color: '#f0b90b', fontWeight: '700' }}>Thử lại</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {products.map(p => (
                <ProductCard key={p.product_id} p={p} />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
