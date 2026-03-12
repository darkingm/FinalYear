import { useState, useEffect } from 'react';
import { View, Text, FlatList, Pressable, Image, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../lib/api/client';
import { useCartStore } from '../../lib/store/cart-store';
import { Search, ShoppingBag, Package, Star, ShoppingCart } from 'lucide-react-native';

interface Product {
  product_id: number;
  name: string;
  description: string;
  base_price_usd: number;
  price_in_token: number | null;
  token_symbol: string | null;
  primary_image: string | null;
  category: string;
  stock: number;
  seller_name: string;
  rating_avg: number;
}

const CATEGORIES = ['', 'electronics', 'fashion', 'accessories', 'gaming', 'home'];

export default function ProductsScreen() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const addItem = useCartStore(s => s.addItem);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category) params.append('category', category);
      const res = await apiClient.get(`/api/products?${params}`);
      setProducts(res.data.data ?? []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, [category]);

  const priceDisplay = (p: Product) => {
    if (p.price_in_token && p.token_symbol) {
      const dec = ['ETH', 'WBTC'].includes(p.token_symbol) ? 6 : 4;
      return `${Number(p.price_in_token).toFixed(dec)} ${p.token_symbol}`;
    }
    return `$${Number(p.base_price_usd).toFixed(2)}`;
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0c0e14]">
      {/* Header */}
      <View className="px-4 pt-4 pb-3 border-b border-[#1e2130]">
        <Text className="text-white text-2xl font-bold mb-3">{t('nav.products')}</Text>
        <View className="flex-row items-center bg-[#131722] rounded-xl px-3 border border-[#1e2130]">
          <Search size={16} color="#6b7280" />
          <TextInput
            className="flex-1 py-3 px-2 text-white text-sm"
            placeholder={t('product.searchProducts')}
            placeholderTextColor="#6b7280"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={fetchProducts}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Category Filter */}
      <View className="h-12 mt-3">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          keyExtractor={item => item}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setCategory(item)}
              className={`mr-2 px-4 py-2 rounded-full border ${category === item ? 'bg-[#f0b90b] border-[#f0b90b]' : 'bg-[#131722] border-[#1e2130]'}`}
            >
              <Text className={`text-xs font-semibold ${category === item ? 'text-black' : 'text-gray-400'}`}>
                {item === '' ? t('product.allCategories') : item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* Products */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#f0b90b" size="large" />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={p => String(p.product_id)}
          numColumns={2}
          contentContainerStyle={{ padding: 12 }}
          columnWrapperStyle={{ gap: 10 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={() => (
            <View className="flex-1 items-center justify-center py-20">
              <Package size={48} color="#6b7280" />
              <Text className="text-gray-500 mt-3 text-center">{t('product.noProducts')}</Text>
            </View>
          )}
          renderItem={({ item: p }) => (
            <Link href={`/products/${p.product_id}`} asChild style={{ flex: 1 }}>
              <Pressable className="bg-[#131722] rounded-2xl overflow-hidden border border-[#1e2130] active:opacity-80">
                <View className="h-40 bg-[#1e2130]">
                  {p.primary_image ? (
                    <Image source={{ uri: p.primary_image }} className="w-full h-full" resizeMode="cover" />
                  ) : (
                    <View className="w-full h-full items-center justify-center">
                      <ShoppingBag size={28} color="#6b7280" />
                    </View>
                  )}
                  {p.stock === 0 && (
                    <View className="absolute inset-0 bg-black/60 items-center justify-center">
                      <Text className="text-white font-bold text-xs bg-red-500/80 px-3 py-1 rounded-full">{t('product.outOfStock')}</Text>
                    </View>
                  )}
                  {p.token_symbol && (
                    <View className="absolute top-2 right-2 bg-black/70 px-2 py-0.5 rounded-full">
                      <Text className="text-[#f0b90b] text-[10px] font-bold">{p.token_symbol}</Text>
                    </View>
                  )}
                </View>
                <View className="p-3">
                  <Text className="text-white font-semibold text-xs mb-0.5" numberOfLines={1}>{p.name}</Text>
                  <Text className="text-[#f0b90b] font-bold text-sm">{priceDisplay(p)}</Text>
                  {p.token_symbol && (
                    <Text className="text-gray-500 text-[10px]">≈ ${Number(p.base_price_usd).toFixed(2)}</Text>
                  )}
                  <View className="flex-row items-center gap-1 mt-1">
                    <Text className="text-gray-500 text-[10px] flex-1" numberOfLines={1}>{p.seller_name}</Text>
                    {parseFloat(String(p.rating_avg)) > 0 && (
                      <View className="flex-row items-center gap-0.5">
                        <Star size={10} color="#f0b90b" fill="#f0b90b" />
                        <Text className="text-gray-400 text-[10px]">{Number(p.rating_avg).toFixed(1)}</Text>
                      </View>
                    )}
                  </View>
                  <Pressable
                    onPress={() => addItem({ product_id: p.product_id, name: p.name, price: Number(p.base_price_usd), token_symbol: p.token_symbol ?? undefined, price_in_token: p.price_in_token ?? undefined })}
                    className="mt-2 bg-[#f0b90b]/10 border border-[#f0b90b]/30 rounded-lg py-1.5 items-center flex-row justify-center gap-1"
                  >
                    <ShoppingCart size={12} color="#f0b90b" />
                    <Text className="text-[#f0b90b] text-[11px] font-semibold">{t('product.addToCart')}</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Link>
          )}
        />
      )}
    </SafeAreaView>
  );
}
