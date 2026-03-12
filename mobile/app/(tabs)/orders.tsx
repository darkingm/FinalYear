import { useState, useEffect } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../lib/store/auth-store';
import { apiClient } from '../../lib/api/client';
import { Package, ChevronRight, ShoppingBag, LogIn } from 'lucide-react-native';

interface Order {
  order_id: number;
  internal_order_id: string;
  product_name: string;
  status: string;
  price_usd: number;
  amount_token: number | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  UNPAID: '#f59e0b',
  PENDING: '#3b82f6',
  ONCHAIN_CONFIRMED: '#8b5cf6',
  DELIVERING: '#06b6d4',
  COMPLETED: '#10b981',
  CANCELLED: '#ef4444',
  DISPUTED: '#f97316',
};

export default function OrdersScreen() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    apiClient.get('/api/orders').then(r => setOrders(r.data.orders ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) return (
    <SafeAreaView className="flex-1 bg-[#0c0e14] items-center justify-center px-8">
      <Package size={64} color="#6b7280" />
      <Text className="text-white text-xl font-bold mt-4 text-center">{t('order.myOrders')}</Text>
      <Text className="text-gray-400 text-center mt-2 mb-6">{t('auth.loginToContinue')}</Text>
      <Link href="/auth/login" asChild>
        <Pressable className="bg-[#f0b90b] rounded-xl px-8 py-3.5 flex-row items-center gap-2">
          <LogIn size={18} color="black" />
          <Text className="text-black font-bold">{t('auth.login')}</Text>
        </Pressable>
      </Link>
    </SafeAreaView>
  );

  if (loading) return (
    <SafeAreaView className="flex-1 bg-[#0c0e14] items-center justify-center">
      <ActivityIndicator color="#f0b90b" size="large" />
    </SafeAreaView>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#0c0e14]">
      <View className="px-4 pt-4 pb-3 border-b border-[#1e2130]">
        <Text className="text-white text-2xl font-bold">{t('order.myOrders')}</Text>
        <Text className="text-gray-400 text-sm mt-0.5">{orders.length} {t('product.items')}</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={o => String(o.order_id)}
        contentContainerStyle={{ padding: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={() => (
          <View className="items-center py-20">
            <ShoppingBag size={48} color="#6b7280" />
            <Text className="text-gray-500 mt-3 text-center">{t('order.noOrders')}</Text>
          </View>
        )}
        renderItem={({ item: o }) => (
          <Link href={`/orders/${o.order_id}`} asChild>
            <Pressable className="bg-[#131722] rounded-2xl p-4 border border-[#1e2130] flex-row items-center gap-3 active:opacity-80">
              <View className="w-12 h-12 bg-[#1e2130] rounded-xl items-center justify-center flex-shrink-0">
                <Package size={22} color="#6b7280" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-semibold text-sm" numberOfLines={1}>{o.product_name}</Text>
                <Text className="text-gray-500 text-xs mt-0.5">#{o.internal_order_id?.split('-')[0]?.toUpperCase()}</Text>
                <View className="flex-row items-center gap-2 mt-1.5">
                  <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: `${STATUS_COLORS[o.status] ?? '#6b7280'}20` }}>
                    <Text className="text-xs font-semibold" style={{ color: STATUS_COLORS[o.status] ?? '#6b7280' }}>{o.status}</Text>
                  </View>
                  <Text className="text-gray-500 text-xs">{new Date(o.created_at).toLocaleDateString()}</Text>
                </View>
              </View>
              <View className="items-end">
                <Text className="text-[#f0b90b] font-bold text-sm">${Number(o.price_usd).toFixed(2)}</Text>
                <ChevronRight size={16} color="#6b7280" />
              </View>
            </Pressable>
          </Link>
        )}
      />
    </SafeAreaView>
  );
}
