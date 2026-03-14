import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../lib/store/auth-store';
import { apiClient } from '../../lib/api/client';
import { Package, ShoppingBag, LogIn, ChevronRight, Clock } from 'lucide-react-native';
import OrderStatusBadge from '../../components/OrderStatusBadge';

interface Order {
  order_id: number;
  internal_order_id: string;
  product_name: string;
  primary_image: string | null;
  status: string;
  price_usd: number;
  amount_token: string | null;
  token_symbol: string | null;
  quantity: number;
  created_at: string;
}

const FILTER_TABS = [
  { key: '',           label: 'Tất cả' },
  { key: 'UNPAID',     label: 'Chờ TT' },
  { key: 'DELIVERING', label: 'Đang giao' },
  { key: 'COMPLETED',  label: 'Hoàn thành' },
  { key: 'DISPUTED',   label: 'Tranh chấp' },
];

export default function OrdersScreen() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('');

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = activeFilter ? `?status=${activeFilter}` : '';
      const r = await apiClient.get(`/api/orders${params}`);
      setOrders(r.data.orders ?? []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [activeFilter, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    fetchOrders();
  }, [fetchOrders, isAuthenticated]);

  // Not logged in
  if (!isAuthenticated) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <Package size={64} color="#374151" />
      <Text style={{ color: 'white', fontSize: 20, fontWeight: '800', marginTop: 16, textAlign: 'center' }}>
        {t('order.myOrders')}
      </Text>
      <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 22 }}>
        Đăng nhập để xem lịch sử mua hàng và theo dõi đơn hàng của bạn.
      </Text>
      <Link href="/auth/login" asChild>
        <Pressable style={{ backgroundColor: '#f0b90b', borderRadius: 16, paddingHorizontal: 32, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <LogIn size={18} color="black" />
          <Text style={{ color: 'black', fontWeight: '800', fontSize: 16 }}>{t('auth.login')}</Text>
        </Pressable>
      </Link>
    </SafeAreaView>
  );

  const filteredOrders = activeFilter
    ? orders.filter(o => o.status === activeFilter)
    : orders;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 0 }}>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: '900' }}>{t('order.myOrders')}</Text>
        <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>{orders.length} đơn hàng</Text>
      </View>

      {/* Filter Tabs */}
      <View style={{ marginTop: 16, paddingBottom: 4 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTER_TABS}
          keyExtractor={t => t.key}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item }) => {
            const isActive = activeFilter === item.key;
            const count = item.key
              ? orders.filter(o => o.status === item.key).length
              : orders.length;
            return (
              <Pressable
                onPress={() => setActiveFilter(item.key)}
                style={{
                  paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99,
                  backgroundColor: isActive ? '#f0b90b' : '#131722',
                  borderWidth: 1, borderColor: isActive ? '#f0b90b' : '#1e2130',
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                }}
              >
                <Text style={{ color: isActive ? 'black' : '#9ca3af', fontWeight: '700', fontSize: 13 }}>
                  {item.label}
                </Text>
                {count > 0 && (
                  <View style={{ backgroundColor: isActive ? 'rgba(0,0,0,0.2)' : '#1e2130', borderRadius: 99, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                    <Text style={{ color: isActive ? 'black' : '#6b7280', fontSize: 10, fontWeight: '800' }}>{count}</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#f0b90b" size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={o => String(o.order_id)}
          contentContainerStyle={{ padding: 16, paddingTop: 12, flexGrow: 1 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchOrders(true); }}
              tintColor="#f0b90b"
            />
          }
          ListEmptyComponent={() => (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
              <ShoppingBag size={56} color="#374151" />
              <Text style={{ color: '#6b7280', marginTop: 16, fontSize: 16, fontWeight: '600' }}>
                {activeFilter ? `Không có đơn hàng "${FILTER_TABS.find(t => t.key === activeFilter)?.label}"` : t('order.noOrders')}
              </Text>
              {!activeFilter && (
                <Link href="/(tabs)/index" asChild>
                  <Pressable style={{ marginTop: 20, backgroundColor: '#f0b90b', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}>
                    <Text style={{ color: 'black', fontWeight: '800' }}>Mua sắm ngay</Text>
                  </Pressable>
                </Link>
              )}
            </View>
          )}
          renderItem={({ item: o }) => {
            const priceDisplay = o.amount_token && o.token_symbol
              ? `${Number(o.amount_token).toFixed(4)} ${o.token_symbol}`
              : `$${Number(o.price_usd).toFixed(2)}`;
            return (
              <Link href={`/orders/${o.order_id}`} asChild>
                <Pressable style={{
                  backgroundColor: '#131722', borderRadius: 20, padding: 14,
                  borderWidth: 1, borderColor: '#1e2130',
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                }}>
                  {/* Product Thumbnail */}
                  <View style={{ width: 60, height: 60, borderRadius: 14, backgroundColor: '#1e2130', overflow: 'hidden', flexShrink: 0 }}>
                    {o.primary_image ? (
                      <Image source={{ uri: o.primary_image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={24} color="#374151" />
                      </View>
                    )}
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{o.product_name}</Text>
                    <Text style={{ color: '#4b5563', fontSize: 11 }}>
                      {`#${o.internal_order_id?.split('-')[0]?.toUpperCase() ?? o.order_id}`}  •  {new Date(o.created_at).toLocaleDateString('vi-VN')}
                    </Text>
                    <OrderStatusBadge status={o.status} size="sm" />
                  </View>

                  {/* Price + Chevron */}
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ color: '#f0b90b', fontWeight: '800', fontSize: 14 }}>{priceDisplay}</Text>
                    <Text style={{ color: '#4b5563', fontSize: 11 }}>× {o.quantity}</Text>
                    <ChevronRight size={14} color="#374151" />
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
