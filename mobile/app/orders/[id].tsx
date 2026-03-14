import { useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  Alert, Image, Linking, Animated, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft, Shield, RefreshCw, ExternalLink, ScanLine,
  Star, ShoppingBag, MessageCircle, AlertTriangle, Copy, Zap,
} from 'lucide-react-native';
import { useOrder } from '../../lib/hooks/useOrder';
import OrderTimeline, { buildTimelineSteps } from '../../components/OrderTimeline';
import OrderStatusBadge from '../../components/OrderStatusBadge';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { order, loading, refreshing, error, refresh, confirmDelivery } = useOrder(id);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Xác nhận nhận hàng',
      'Bằng cách xác nhận, tiền sẽ được giải phóng từ Escrow sang Seller và Credit Score của bạn sẽ tăng +15 điểm.',
      [
        { text: 'Chưa nhận', style: 'cancel' },
        {
          text: '✓ Đã nhận hàng',
          onPress: async () => {
            try {
              await confirmDelivery();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('🎉 Thành công!', 'Đơn hàng hoàn tất. Credit Score của bạn đã được cập nhật!');
            } catch {
              Alert.alert('Lỗi', 'Không thể xác nhận. Vui lòng thử lại.');
            }
          },
        },
      ],
    );
  };

  const handleDispute = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert(
      '⚠️ Mở khiếu nại',
      'Bạn sẽ mất -30 Credit Score nếu khiếu nại không có cơ sở. Chỉ mở khi thực sự cần thiết.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xác nhận khiếu nại',
          style: 'destructive',
          onPress: () => router.push(`/orders/${id}/dispute` as any),
        },
      ],
    );
  };

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (loading) return (
    <View style={{ flex: 1, backgroundColor: '#0c0e14', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#f0b90b" />
      <Text style={{ color: '#6b7280', marginTop: 12 }}>Đang tải đơn hàng...</Text>
    </View>
  );

  if (error || !order) return (
    <View style={{ flex: 1, backgroundColor: '#0c0e14', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <AlertTriangle size={48} color="#ef4444" />
      <Text style={{ color: 'white', fontWeight: '700', marginTop: 12, fontSize: 16, textAlign: 'center' }}>
        {error || 'Không tìm thấy đơn hàng'}
      </Text>
      <Pressable onPress={() => router.back()} style={{ marginTop: 20, backgroundColor: '#131722', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}>
        <Text style={{ color: '#f0b90b', fontWeight: '700' }}>Quay lại</Text>
      </Pressable>
    </View>
  );

  const timelineSteps = buildTimelineSteps(order.status, order);
  const orderCode = `#${order.internal_order_id?.split('-')[0]?.toUpperCase() ?? order.order_id}`;
  const priceDisplay = order.amount_token && order.token_symbol
    ? `${Number(order.amount_token).toFixed(6)} ${order.token_symbol}`
    : `$${Number(order.price_usd).toFixed(2)}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      {/* ── Header ── */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e2130',
      }}>
        <Pressable
          onPress={() => router.back()}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#131722', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <ArrowLeft size={18} color="#9ca3af" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>Chi tiết đơn hàng</Text>
          <Text style={{ color: '#6b7280', fontSize: 11 }}>{orderCode}</Text>
        </View>
        <Pressable onPress={refresh} style={{ padding: 8 }}>
          <RefreshCw size={18} color="#6b7280" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#f0b90b" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Product Hero ── */}
        <View style={{ backgroundColor: '#131722', borderRadius: 20, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: '#1e2130' }}>
          {order.primary_image ? (
            <Image source={{ uri: order.primary_image }} style={{ width: '100%', height: 180 }} resizeMode="cover" />
          ) : (
            <View style={{ height: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e2130' }}>
              <ShoppingBag size={40} color="#374151" />
            </View>
          )}
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 17, flex: 1 }} numberOfLines={2}>
                {order.product_name}
              </Text>
              <OrderStatusBadge status={order.status} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              <View>
                <Text style={{ color: '#6b7280', fontSize: 11 }}>Tổng thanh toán</Text>
                <Text style={{ color: '#f0b90b', fontWeight: '900', fontSize: 22 }}>{priceDisplay}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: '#6b7280', fontSize: 11 }}>Số lượng</Text>
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>× {order.quantity}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Order Timeline ── */}
        <View style={{ marginBottom: 14 }}>
          <OrderTimeline steps={timelineSteps} />
        </View>

        {/* ── Escrow Shield ── */}
        <View style={{
          backgroundColor: 'rgba(16,185,129,0.06)', borderRadius: 16, padding: 14,
          marginBottom: 14, borderWidth: 1, borderColor: 'rgba(16,185,129,0.15)',
          flexDirection: 'row', gap: 12, alignItems: 'center',
        }}>
          <Shield size={22} color="#10b981" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 13 }}>Bảo vệ Escrow Smart Contract</Text>
            <Text style={{ color: '#6b7280', fontSize: 11, lineHeight: 16, marginTop: 3 }}>
              Tiền được khoá trong hợp đồng thông minh cho đến khi bạn xác nhận nhận hàng. Không bên nào có thể can thiệp.
            </Text>
          </View>
        </View>

        {/* ── NFT Badge ── */}
        {order.has_nft && (
          <View style={{
            backgroundColor: 'rgba(139,92,246,0.06)', borderRadius: 16, padding: 14,
            marginBottom: 14, borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Zap size={18} color="#a78bfa" />
              <Text style={{ color: '#a78bfa', fontWeight: '800', fontSize: 13 }}>Sản phẩm có NFT (RWA)</Text>
              {order.nfc_verified && (
                <View style={{ backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: '#10b981', fontSize: 10, fontWeight: '700' }}>✓ Đã xác thực</Text>
                </View>
              )}
            </View>
            {order.nft_tx_hash && (
              <Pressable
                onPress={() => Linking.openURL(`https://amoy.polygonscan.com/tx/${order.nft_tx_hash}`)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Text style={{ color: '#6b7280', fontSize: 10, fontFamily: 'monospace' }} numberOfLines={1}>
                  Tx: {order.nft_tx_hash.slice(0, 20)}...
                </Text>
                <ExternalLink size={10} color="#6b7280" />
              </Pressable>
            )}
          </View>
        )}

        {/* ── Order Info Table ── */}
        <View style={{ backgroundColor: '#131722', borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#1e2130' }}>
          <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Thông tin đơn hàng</Text>
          {[
            { label: 'Mã đơn hàng', value: orderCode, mono: true },
            { label: 'Người bán', value: order.seller_name ?? 'Seller' },
            { label: 'Ngày đặt', value: new Date(order.created_at).toLocaleString('vi-VN') },
            order.tracking_number ? { label: 'Mã vận đơn', value: `${order.shipping_carrier ?? ''} ${order.tracking_number}`, mono: true } : null,
            order.estimated_delivery ? { label: 'Dự kiến giao', value: new Date(order.estimated_delivery).toLocaleDateString('vi-VN') } : null,
          ].filter(Boolean).map((item: any, i, arr) => (
            <View key={item.label}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }}>
                <Text style={{ color: '#6b7280', fontSize: 13 }}>{item.label}</Text>
                <Text style={{
                  color: 'white', fontWeight: '600', fontSize: 13,
                  maxWidth: '55%', textAlign: 'right',
                  fontFamily: item.mono ? 'monospace' : undefined,
                }} numberOfLines={1}>
                  {item.value}
                </Text>
              </View>
              {i < arr.length - 1 && <View style={{ height: 1, backgroundColor: '#1e2130' }} />}
            </View>
          ))}
        </View>

        {/* ── Action Buttons ── */}
        <View style={{ gap: 10 }}>
          {/* UNPAID: Pay now */}
          {order.status === 'UNPAID' && (
            <Link href={`/checkout/${order.order_id}` as any} asChild>
              <Pressable style={{ borderRadius: 16, overflow: 'hidden' }}>
                <LinearGradient colors={['#f0b90b', '#e6a800']} style={{ paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 20 }}>💳</Text>
                  <Text style={{ color: 'black', fontWeight: '900', fontSize: 16 }}>Thanh toán ngay</Text>
                </LinearGradient>
              </Pressable>
            </Link>
          )}

          {/* DELIVERING: Confirm + NFC */}
          {order.status === 'DELIVERING' && (
            <>
              <Pressable onPress={handleConfirm} style={{ borderRadius: 16, overflow: 'hidden' }}>
                <LinearGradient colors={['#10b981', '#059669']} style={{ paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                  <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>✓ Xác nhận đã nhận hàng</Text>
                </LinearGradient>
              </Pressable>
              {order.has_nft && !order.nfc_verified && (
                <Link href={{ pathname: '/products/nfc-verify', params: { productId: String(order.order_id), tokenId: order.nft_token_id ?? '' } }} asChild>
                  <Pressable style={{ borderRadius: 16, backgroundColor: '#131722', borderWidth: 2, borderColor: '#8b5cf6', paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                    <ScanLine size={18} color="#a78bfa" />
                    <Text style={{ color: '#a78bfa', fontWeight: '800', fontSize: 15 }}>Quét NFC/QR xác thực vật phẩm</Text>
                  </Pressable>
                </Link>
              )}
              <Pressable onPress={handleDispute} style={{ borderRadius: 16, backgroundColor: '#131722', borderWidth: 1, borderColor: '#374151', paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                <AlertTriangle size={16} color="#f97316" />
                <Text style={{ color: '#f97316', fontWeight: '700', fontSize: 14 }}>Mở khiếu nại</Text>
              </Pressable>
            </>
          )}

          {/* COMPLETED: Rate + Re-buy */}
          {order.status === 'COMPLETED' && (
            <>
              <Pressable style={{ borderRadius: 16, overflow: 'hidden' }}>
                <LinearGradient colors={['#8b5cf6', '#7c3aed']} style={{ paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                  <Star size={18} color="white" fill="white" />
                  <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>Đánh giá sản phẩm & Seller</Text>
                </LinearGradient>
              </Pressable>
              <Link href={`/products/${order.order_id}` as any} asChild>
                <Pressable style={{ borderRadius: 16, backgroundColor: '#131722', borderWidth: 1, borderColor: '#1e2130', paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                  <ShoppingBag size={16} color="#f0b90b" />
                  <Text style={{ color: '#f0b90b', fontWeight: '700', fontSize: 14 }}>Mua lại sản phẩm này</Text>
                </Pressable>
              </Link>
            </>
          )}

          {/* DISPUTED */}
          {order.status === 'DISPUTED' && (
            <View style={{ backgroundColor: 'rgba(249,115,22,0.08)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)', flexDirection: 'row', gap: 12 }}>
              <AlertTriangle size={22} color="#f97316" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#f97316', fontWeight: '800' }}>Đang xử lý tranh chấp</Text>
                <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4, lineHeight: 18 }}>
                  Đội ngũ hỗ trợ đang xem xét vụ kiện. Thời gian giải quyết: 3-5 ngày làm việc.
                </Text>
              </View>
            </View>
          )}

          {/* Chat with Seller */}
          <Link href={`/orders/${id}/chat` as any} asChild>
            <Pressable style={{ borderRadius: 16, backgroundColor: '#131722', borderWidth: 1, borderColor: '#1e2130', paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              <MessageCircle size={16} color="#f0b90b" />
              <Text style={{ color: '#f0b90b', fontWeight: '700', fontSize: 14 }}>Nhắn tin với Seller</Text>
            </Pressable>
          </Link>

          {/* Review - completed orders only */}
          {order.status === 'COMPLETED' && (
            <Link href={{ pathname: '/orders/review', params: { orderId: String(order.order_id), productId: String(order.product_id), productName: order.product_name } } as any} asChild>
              <Pressable style={{ borderRadius: 16, overflow: 'hidden' }}>
                <LinearGradient colors={['#8b5cf6', '#7c3aed']} style={{ paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                  <Star size={18} color="white" fill="white" />
                  <Text style={{ color: 'white', fontWeight: '900', fontSize: 15 }}>Đánh giá sản phẩm</Text>
                </LinearGradient>
              </Pressable>
            </Link>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
