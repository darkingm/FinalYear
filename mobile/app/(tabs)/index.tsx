import { useState, useEffect } from 'react';
import { View, ScrollView, Text, Pressable, Image, ActivityIndicator, RefreshControl, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { useAuthStore } from '../../lib/store/auth-store';
import { apiClient } from '../../lib/api/client';
import { TrendingUp, TrendingDown, ShoppingBag, MessageCircle } from 'lucide-react-native';

interface Product {
  product_id: number;
  name: string;
  base_price_usd: number;
  price_in_token: number | null;
  token_symbol: string | null;
  primary_image: string | null;
  category: string;
}

interface Ticker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
}

const TOP_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'MATICUSDT', 'BNBUSDT'];

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [prodRes] = await Promise.all([
        apiClient.get('/api/products?limit=8'),
      ]);
      setProducts(prodRes.data.data ?? []);
    } catch {}
    // Fetch ticker from Binance
    try {
      const sym = TOP_SYMBOLS.map(s => `"${s}"`).join(',');
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${sym}]`);
      const data = await res.json();
      if (Array.isArray(data)) setTickers(data.slice(0, 4));
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchData(); }, []);

  const priceDisplay = (p: Product) => {
    if (p.price_in_token && p.token_symbol) {
      const dec = ['ETH', 'WBTC'].includes(p.token_symbol) ? 6 : 4;
      return `${Number(p.price_in_token).toFixed(dec)} ${p.token_symbol}`;
    }
    return `$${Number(p.base_price_usd).toFixed(2)}`;
  };

  if (loading) return (
    <View className="flex-1 bg-[#0c0e14] items-center justify-center">
      <ActivityIndicator size="large" color="#f0b90b" />
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#0c0e14]">
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#f0b90b" />}
      >
        {/* Header */}
        <View className="px-4 pt-4 pb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-gray-400 text-sm">{t('greeting.morning')}</Text>
            <Text className="text-white text-2xl font-bold">{isAuthenticated ? user?.username : 'Crypto Market'} 👋</Text>
          </View>
          <Link href="/chat" asChild>
            <Pressable className="w-10 h-10 bg-[#f0b90b]/10 rounded-full items-center justify-center border border-[#f0b90b]/30">
              <MessageCircle size={20} color="#f0b90b" />
            </Pressable>
          </Link>
        </View>

        {/* Ticker Strip */}
        <View className="px-4 mb-6">
          <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Crypto Market</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={tickers}
            keyExtractor={item => item.symbol}
            renderItem={({ item }) => {
              const isPos = parseFloat(item.priceChangePercent) >= 0;
              const sym = item.symbol.replace('USDT', '');
              return (
                <View className="mr-3 bg-[#131722] rounded-2xl p-3.5 min-w-[120px] border border-[#1e2130]">
                  <Text className="text-white font-bold text-sm mb-1">{sym}</Text>
                  <Text className="text-white font-mono text-xs">${parseFloat(item.lastPrice).toLocaleString()}</Text>
                  <View className="flex-row items-center gap-1 mt-1">
                    {isPos ? <TrendingUp size={12} color="#10b981" /> : <TrendingDown size={12} color="#ef4444" />}
                    <Text className={`text-xs font-semibold ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isPos ? '+' : ''}{parseFloat(item.priceChangePercent).toFixed(2)}%
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        </View>

        {/* Featured Products */}
        <View className="px-4">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-white text-lg font-bold">{t('home.featuredProducts')}</Text>
            <Link href="/products">
              <Text className="text-[#f0b90b] text-sm font-semibold">{t('home.viewAll')} →</Text>
            </Link>
          </View>
          <View className="flex-row flex-wrap gap-3">
            {products.map((p, i) => (
              <Link key={p.product_id} href={`/products/${p.product_id}`} asChild>
                <Pressable
                  className="bg-[#131722] rounded-2xl overflow-hidden border border-[#1e2130] active:opacity-80"
                  style={{ width: '47.5%' }}
                >
                  <View className="h-36 bg-[#1e2130]">
                    {p.primary_image ? (
                      <Image source={{ uri: p.primary_image }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                      <View className="w-full h-full items-center justify-center">
                        <ShoppingBag size={32} color="#6b7280" />
                      </View>
                    )}
                    {p.token_symbol && (
                      <View className="absolute top-2 right-2 bg-black/70 rounded-full px-2 py-0.5">
                        <Text className="text-[#f0b90b] text-[10px] font-bold">{p.token_symbol}</Text>
                      </View>
                    )}
                  </View>
                  <View className="p-3">
                    <Text className="text-white font-semibold text-sm" numberOfLines={1}>{p.name}</Text>
                    <Text className="text-[#f0b90b] font-bold text-base mt-1">{priceDisplay(p)}</Text>
                  </View>
                </Pressable>
              </Link>
            ))}
          </View>
        </View>

        <View className="h-24" />
      </ScrollView>
    </SafeAreaView>
  );
}
