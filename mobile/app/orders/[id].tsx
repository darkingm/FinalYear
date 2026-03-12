import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { apiClient } from '../../lib/api/client';
import {
  ArrowLeft, Package, Shield, Truck, CheckCircle2, Clock,
  ChevronRight, AlertTriangle, RefreshCw, Star
} from 'lucide-react-native';

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: any }> = {
  UNPAID:            { color: '#f59e0b', label: 'Chờ thanh toán', icon: Clock },
  PENDING:           { color: '#3b82f6', label: 'Đang xử lý',     icon: RefreshCw },
  ONCHAIN_CONFIRMED: { color: '#8b5cf6', label: 'Đã xác nhận',    icon: CheckCircle2 },
  DELIVERING:        { color: '#06b6d4', label: 'Đang giao hàng', icon: Truck },
  COMPLETED:         { color: '#10b981', label: 'Hoàn thành',     icon: CheckCircle2 },
  CANCELLED:         { color: '#ef4444', label: 'Đã huỷ',         icon: AlertTriangle },
  DISPUTED:          { color: '#f97316', label: 'Tranh chấp',     icon: AlertTriangle },
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/api/orders/${id}`)
      .then(r => setOrder(r.data.order ?? r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: '#0c0e14', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#f0b90b" />
    </View>
  );

  if (!order) return (
    <View style={{ flex: 1, backgroundColor: '#0c0e14', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Package size={48} color="#6b7280" />
      <Text style={{ color: 'white', fontWeight: '700', marginTop: 12, fontSize: 16 }}>Không tìm thấy đơn hàng</Text>
      <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
        <Text style={{ color: '#f0b90b' }}>Quay lại</Text>
      </Pressable>
    </View>
  );

  const cfg = STATUS_CONFIG[order.status] ?? { color: '#6b7280', label: order.status, icon: Clock };
  const Icon = cfg.icon;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e2130' }}>
        <Pressable onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#131722', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <ArrowLeft size={18} color="#9ca3af" />
        </Pressable>
        <Text style={{ color: 'white', fontWeight: '800', fontSize: 16, flex: 1 }}>Chi tiết đơn hàng</Text>
        <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: `${cfg.color}18` }}>
          <Text style={{ color: cfg.color, fontWeight: '700', fontSize: 11 }}>{cfg.label}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Status Icon */}
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: `${cfg.color}18`, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Icon size={36} color={cfg.color} />
          </View>
          <Text style={{ color: 'white', fontWeight: '800', fontSize: 18 }}>{cfg.label}</Text>
          <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
            {new Date(order.created_at).toLocaleString('vi-VN')}
          </Text>
        </View>

        {/* Order Info Card */}
        <View style={{ backgroundColor: '#131722', borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#1e2130' }}>
          <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Thông tin đơn hàng</Text>
          {[
            { label: 'Mã đơn hàng', value: `#${order.internal_order_id?.split('-')[0]?.toUpperCase()}` },
            { label: 'Sản phẩm', value: order.product_name },
            { label: 'Số lượng', value: `${order.quantity}` },
            { label: 'Tổng tiền', value: order.amount_token && order.token_symbol ? `${Number(order.amount_token).toFixed(6)} ${order.token_symbol}` : `$${Number(order.price_usd).toFixed(2)}` },
          ].map((item, i, arr) => (
            <View key={item.label}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }}>
                <Text style={{ color: '#6b7280', fontSize: 13 }}>{item.label}</Text>
                <Text style={{ color: i === arr.length - 1 ? '#f0b90b' : 'white', fontWeight: i === arr.length - 1 ? '800' : '500', fontSize: 13, maxWidth: '60%', textAlign: 'right' }} numberOfLines={1}>{item.value}</Text>
              </View>
              {i < arr.length - 1 && <View style={{ height: 1, backgroundColor: '#1e2130' }} />}
            </View>
          ))}
        </View>

        {/* Escrow info */}
        <View style={{ backgroundColor: 'rgba(16,185,129,0.06)', borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(16,185,129,0.15)', flexDirection: 'row', gap: 10 }}>
          <Shield size={18} color="#10b981" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#10b981', fontWeight: '700', fontSize: 12 }}>Bảo vệ Escrow</Text>
            <Text style={{ color: '#6b7280', fontSize: 11, lineHeight: 16, marginTop: 2 }}>
              Tiền được giữ trong smart contract cho đến khi bạn xác nhận nhận hàng.
            </Text>
          </View>
        </View>

        {/* Actions */}
        {order.status === 'UNPAID' && (
          <Link href={`/checkout/${order.order_id}`} asChild>
            <Pressable style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
              <LinearGradient colors={['#f0b90b', '#e6a800']} style={{ paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: 'black', fontWeight: '800', fontSize: 15 }}>💳 Thanh toán ngay</Text>
              </LinearGradient>
            </Pressable>
          </Link>
        )}

        {order.status === 'DELIVERING' && (
          <Pressable
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Xác nhận', 'Bạn đã nhận được hàng?', [
                { text: 'Chưa', style: 'cancel' },
                { text: 'Đã nhận', onPress: () => apiClient.post(`/api/orders/${order.order_id}/confirm-delivery`).then(() => router.back()) }
              ]);
            }}
            style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}
          >
            <LinearGradient colors={['#10b981', '#059669']} style={{ paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>✓ Xác nhận đã nhận hàng</Text>
            </LinearGradient>
          </Pressable>
        )}

        {order.status === 'COMPLETED' && (
          <Pressable style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
            <LinearGradient colors={['#8b5cf6', '#7c3aed']} style={{ paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              <Star size={16} color="white" />
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>Đánh giá sản phẩm</Text>
            </LinearGradient>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
