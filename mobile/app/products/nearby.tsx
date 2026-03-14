/**
 * Nearby Products — Geo-based marketplace screen.
 * Uses useGeoProducts hook for location + products.
 * Displays distance badges, seller city, and filter by radius/category.
 */
import { useState } from 'react';
import {
  View, Text, FlatList, Pressable, Image, RefreshControl,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import {
  MapPin, Navigation, Package, Star, Zap, SlidersHorizontal,
} from 'lucide-react-native';
import { useGeoProducts } from '../../lib/hooks/useGeoProducts';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { formatPrice } from '../../lib/utils/format';
import type { GeoProduct } from '../../lib/types';

const RADIUS_OPTIONS = [
  { label: '5 km',  value: 5  },
  { label: '20 km', value: 20 },
  { label: '50 km', value: 50 },
  { label: '100 km', value: 100 },
];

const CATEGORIES = [
  { key: '', label: '🌐 Tất cả' },
  { key: 'electronics', label: '📱 Điện tử' },
  { key: 'fashion', label: '👕 Thời trang' },
  { key: 'gaming', label: '🎮 Gaming' },
  { key: 'accessories', label: '⌚ Phụ kiện' },
];

function DistanceBadge({ km }: { km: number }) {
  const color = km <= 5 ? '#10b981' : km <= 20 ? '#f0b90b' : '#9ca3af';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: `${color}18`, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3 }}>
      <MapPin size={9} color={color} />
      <Text style={{ color, fontSize: 10, fontWeight: '700' }}>
        {km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`}
      </Text>
    </View>
  );
}

function GeoProductCard({ item }: { item: GeoProduct }) {
  return (
    <Link href={`/products/${item.product_id}` as any} asChild>
      <Pressable style={{ backgroundColor: '#131722', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#1e2130', marginBottom: 12, flexDirection: 'row', height: 100 }}>
        {/* Image */}
        <View style={{ width: 100, backgroundColor: '#1a1f2e', position: 'relative', flexShrink: 0 }}>
          {item.primary_image ? (
            <Image source={{ uri: item.primary_image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Package size={28} color="#374151" />
            </View>
          )}
          {item.has_nft && (
            <View style={{ position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(139,92,246,0.9)', borderRadius: 6, padding: 3 }}>
              <Zap size={9} color="white" />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <MapPin size={10} color="#6b7280" />
              <Text style={{ color: '#6b7280', fontSize: 10 }}>{item.seller_city}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: '#f0b90b', fontWeight: '900', fontSize: 15 }}>
              {formatPrice(item.base_price_usd)}
            </Text>
            <DistanceBadge km={item.distance_km} />
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

export default function NearbyProductsScreen() {
  const router = useRouter();
  const {
    products, coords, loading, refreshing, error,
    permissionDenied, refresh, setRadius, setCategory, radius, category,
  } = useGeoProducts();

  // ── Permission denied ──────────────────────────────────────────────────────
  if (permissionDenied) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e2130' }}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: 16 }}>
          <Text style={{ color: '#6b7280', fontSize: 13 }}>← Quay lại</Text>
        </Pressable>
        <Text style={{ color: 'white', fontSize: 20, fontWeight: '900' }}>Sản phẩm gần bạn</Text>
      </View>
      <EmptyState
        icon={<Navigation size={36} color="#6b7280" />}
        title="Cần quyền vị trí"
        subtitle="Hãy cho phép truy cập vị trí để xem sản phẩm từ seller trong khu vực của bạn."
        action={{ label: 'Thử lại', onPress: refresh }}
      />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1e2130' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Pressable onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#131722', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#9ca3af', fontSize: 18 }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: '900' }}>📍 Gần bạn</Text>
            {coords && (
              <Text style={{ color: '#6b7280', fontSize: 11 }}>
                {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
              </Text>
            )}
          </View>
          {!loading && (
            <View style={{ backgroundColor: '#131722', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: '#f0b90b', fontWeight: '700', fontSize: 13 }}>
                {products.length} kết quả
              </Text>
            </View>
          )}
        </View>

        {/* Radius selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
          {RADIUS_OPTIONS.map(opt => (
            <Pressable
              key={opt.value}
              onPress={() => setRadius(opt.value)}
              style={{
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99,
                backgroundColor: radius === opt.value ? '#f0b90b' : '#131722',
                borderWidth: 1, borderColor: radius === opt.value ? '#f0b90b' : '#1e2130',
                flexDirection: 'row', alignItems: 'center', gap: 5,
              }}
            >
              <Navigation size={10} color={radius === opt.value ? 'black' : '#6b7280'} />
              <Text style={{ color: radius === opt.value ? 'black' : '#9ca3af', fontWeight: '700', fontSize: 12 }}>
                {opt.label}
              </Text>
            </Pressable>
          ))}

          {/* Divider */}
          <View style={{ width: 1, backgroundColor: '#1e2130', marginHorizontal: 4 }} />

          {/* Category filter */}
          {CATEGORIES.map(cat => (
            <Pressable
              key={cat.key}
              onPress={() => setCategory(cat.key)}
              style={{
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99,
                backgroundColor: category === cat.key ? '#3b82f6' : '#131722',
                borderWidth: 1, borderColor: category === cat.key ? '#3b82f6' : '#1e2130',
              }}
            >
              <Text style={{ color: category === cat.key ? 'white' : '#9ca3af', fontWeight: '600', fontSize: 12 }}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={{ padding: 16 }}>
          <SkeletonList count={5} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : products.length === 0 ? (
        <EmptyState
          icon={<MapPin size={36} color="#6b7280" />}
          title="Không có sản phẩm nào"
          subtitle={`Chưa có seller nào trong vòng ${radius}km từ bạn. Thử mở rộng phạm vi tìm kiếm.`}
          action={{ label: 'Mở rộng lên 100km', onPress: () => setRadius(100) }}
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={p => String(p.product_id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#f0b90b" />}
          renderItem={({ item }) => <GeoProductCard item={item} />}
          ListHeaderComponent={() => (
            <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MapPin size={13} color="#f0b90b" />
              <Text style={{ color: '#6b7280', fontSize: 12 }}>
                Sắp xếp theo khoảng cách · bán kính {radius}km
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
