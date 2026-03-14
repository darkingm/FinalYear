import { useState } from 'react';
import { View, Text, ScrollView, Pressable, FlatList, Image, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import {
  TrendingUp, Package, ShoppingBag, Star, AlertTriangle,
  Plus, Zap, BarChart2, ChevronRight, RefreshCw,
} from 'lucide-react-native';
import { useAuthStore } from '../../lib/store/auth-store';
import { useSellerStats, useSellerProducts } from '../../lib/hooks/useSellerStats';
import { sellerService } from '../../lib/services/seller.service';
import { SkeletonCard, SkeletonList } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatPriceCompact, formatDate } from '../../lib/utils/format';
import type { SellerStats, SellerProduct } from '../../lib/types';

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#f0b90b', icon }: {
  label: string; value: string; sub?: string; color?: string; icon: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: '#131722', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#1e2130', gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#6b7280', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Text>
        {icon}
      </View>
      <Text style={{ color, fontWeight: '900', fontSize: 22 }}>{value}</Text>
      {sub && <Text style={{ color: '#4b5563', fontSize: 10 }}>{sub}</Text>}
    </View>
  );
}

// ─── Mini Line Chart (SVG-free sparkline) ────────────────────────────────────
function Sparkline({ data, color = '#f0b90b' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 200, H = 40;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');

  // Use View-based chart (no SVG dep needed - simple bars)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 50, gap: 3, paddingTop: 4 }}>
      {data.slice(-14).map((v, i) => {
        const h = Math.max(4, ((v - min) / range) * 44);
        return (
          <View key={i} style={{ flex: 1, height: h, backgroundColor: color, borderRadius: 3, opacity: i === data.length - 1 ? 1 : 0.5 }} />
        );
      })}
    </View>
  );
}

// ─── Product Row ──────────────────────────────────────────────────────────────
function ProductRow({ product }: { product: SellerProduct }) {
  const isLow = product.stock <= product.low_stock_threshold && product.stock > 0;
  const isOut = product.stock === 0;

  const handleUpdateStock = () => {
    Alert.prompt(
      'Cập nhật kho hàng',
      `Số lượng hiện tại: ${product.stock}. Nhập số muốn thêm (+) hoặc trừ (-):`,
      async (input) => {
        const delta = parseInt(input, 10);
        if (isNaN(delta)) return;
        const { error } = await sellerService.updateStock(product.product_id, delta);
        if (error) Alert.alert('Lỗi', error);
      },
      'plain-text',
    );
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#1e2130', gap: 12 }}>
      {/* Thumbnail */}
      <View style={{ width: 50, height: 50, borderRadius: 12, backgroundColor: '#1e2130', overflow: 'hidden', flexShrink: 0 }}>
        {product.primary_image ? (
          <Image source={{ uri: product.primary_image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Package size={20} color="#374151" />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{product.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
          <View style={{
            paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99,
            backgroundColor: isOut ? 'rgba(239,68,68,0.15)' : isLow ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
          }}>
            <Text style={{
              fontSize: 10, fontWeight: '700',
              color: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#10b981',
            }}>
              {isOut ? 'Hết hàng' : isLow ? `Còn ${product.stock}` : `${product.stock} sản phẩm`}
            </Text>
          </View>
          {product.has_nft && (
            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: 'rgba(139,92,246,0.15)' }}>
              <Text style={{ color: '#a78bfa', fontSize: 10, fontWeight: '700' }}>NFT</Text>
            </View>
          )}
        </View>
      </View>

      {/* Sales + Stock Action */}
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={{ color: '#f0b90b', fontWeight: '800', fontSize: 13 }}>{product.sales_count} bán</Text>
        <Pressable onPress={handleUpdateStock} style={{ backgroundColor: '#1e2130', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
          <Text style={{ color: '#9ca3af', fontSize: 10, fontWeight: '600' }}>Kho hàng</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SellerScreen() {
  const { user, isAuthenticated } = useAuthStore();
  const [period, setPeriod] = useState<'1d' | '7d' | '30d'>('7d');
  const { stats, loading, refreshing, error, refresh } = useSellerStats(period);
  const { products, loading: prodLoading } = useSellerProducts();
  const router = useRouter();

  if (!isAuthenticated) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      <EmptyState
        icon={<BarChart2 size={36} color="#6b7280" />}
        title="Seller Dashboard"
        subtitle="Đăng nhập với tài khoản Seller để quản lý cửa hàng."
        action={{ label: 'Đăng nhập', onPress: () => router.push('/auth/login') }}
      />
    </SafeAreaView>
  );

  if ((user as any)?.role !== 'seller' && (user as any)?.role !== 'admin') return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      <EmptyState
        icon={<ShoppingBag size={36} color="#6b7280" />}
        title="Dành cho Seller"
        subtitle="Tài khoản của bạn chưa đăng ký làm Seller. Liên hệ admin để được nâng cấp."
      />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#f0b90b" />}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: 'white', fontSize: 22, fontWeight: '900' }}>Seller Dashboard</Text>
            <Text style={{ color: '#6b7280', fontSize: 12 }}>Xin chào, {user?.username}</Text>
          </View>
          <Pressable onPress={refresh} style={{ padding: 8 }}>
            <RefreshCw size={18} color="#6b7280" />
          </Pressable>
        </View>

        {/* Period Selector */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 }}>
          {(['1d', '7d', '30d'] as const).map(p => (
            <Pressable
              key={p} onPress={() => setPeriod(p)}
              style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: 99, backgroundColor: period === p ? '#f0b90b' : '#131722', borderWidth: 1, borderColor: period === p ? '#f0b90b' : '#1e2130' }}
            >
              <Text style={{ color: period === p ? 'black' : '#9ca3af', fontWeight: '700', fontSize: 12 }}>
                {p === '1d' ? 'Hôm nay' : p === '7d' ? '7 ngày' : '30 ngày'}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            {[0, 1].map(i => <SkeletonCard key={i} rows={2} />)}
          </View>
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} compact />
        ) : stats ? (
          <>
            {/* Revenue Card */}
            <View style={{ marginHorizontal: 16, marginBottom: 14 }}>
              <LinearGradient colors={['#1a1f2e', '#131722']} style={{ borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#1e2130' }}>
                <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>DOANH THU</Text>
                <Text style={{ color: '#f0b90b', fontWeight: '900', fontSize: 34, marginTop: 6 }}>
                  {formatPriceCompact(stats.revenue_7d)}
                </Text>
                <Text style={{ color: '#4b5563', fontSize: 12, marginBottom: 14 }}>trong {period === '1d' ? 'hôm nay' : period}</Text>
                <Sparkline data={stats.revenue_chart.map(r => r.amount)} />
              </LinearGradient>
            </View>

            {/* Stats Grid */}
            <View style={{ paddingHorizontal: 16, flexDirection: 'row', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <StatCard label="Đơn hàng" value={String(stats.orders_total)} sub={`${stats.orders_pending} chờ xử lý`} color="#3b82f6" icon={<ShoppingBag size={16} color="#3b82f6" />} />
              <StatCard label="Hoàn thành" value={`${Math.round(stats.fulfillment_rate)}%`} sub={`${stats.orders_completed} đơn`} color="#10b981" icon={<TrendingUp size={16} color="#10b981" />} />
            </View>
            <View style={{ paddingHorizontal: 16, flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <StatCard label="Đánh giá TB" value={stats.avg_rating.toFixed(1)} sub={`${stats.products_active} sp active`} color="#f0b90b" icon={<Star size={16} color="#f0b90b" />} />
              <StatCard label="Hết hàng" value={String(stats.products_out_of_stock)} sub="sản phẩm" color={stats.products_out_of_stock > 0 ? '#ef4444' : '#10b981'} icon={<AlertTriangle size={16} color={stats.products_out_of_stock > 0 ? '#ef4444' : '#10b981'} />} />
            </View>
          </>
        ) : null}

        {/* Quick Actions */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 }}>THAO TÁC NHANH</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Link href="/products/create" asChild>
              <Pressable style={{ flex: 1, backgroundColor: '#131722', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#1e2130', gap: 8 }}>
                <Plus size={22} color="#f0b90b" />
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 12, textAlign: 'center' }}>Thêm sản phẩm</Text>
              </Pressable>
            </Link>
            <Link href="/seller/flash-sale" asChild>
              <Pressable style={{ flex: 1, backgroundColor: '#131722', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#1e2130', gap: 8 }}>
                <Zap size={22} color="#a78bfa" />
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 12, textAlign: 'center' }}>Flash Sale</Text>
              </Pressable>
            </Link>
            <Link href="/leaderboard" asChild>
              <Pressable style={{ flex: 1, backgroundColor: '#131722', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#1e2130', gap: 8 }}>
                <BarChart2 size={22} color="#10b981" />
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 12, textAlign: 'center' }}>Leaderboard</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        {/* Products */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 }}>
            <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>SẢN PHẨM</Text>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: '#f0b90b', fontSize: 12, fontWeight: '600' }}>Xem tất cả</Text>
              <ChevronRight size={12} color="#f0b90b" />
            </Pressable>
          </View>
          <View style={{ backgroundColor: '#131722', borderRadius: 20, marginHorizontal: 16, borderWidth: 1, borderColor: '#1e2130', overflow: 'hidden' }}>
            {prodLoading ? (
              <View style={{ padding: 16 }}><SkeletonList count={3} /></View>
            ) : products.slice(0, 5).map(p => (
              <ProductRow key={p.product_id} product={p} />
            ))}
            {!prodLoading && products.length === 0 && (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ color: '#6b7280' }}>Chưa có sản phẩm nào</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
