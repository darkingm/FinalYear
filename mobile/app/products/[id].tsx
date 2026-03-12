'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, ActivityIndicator,
  Dimensions, Share, Alert, Animated, NativeScrollEvent, NativeSyntheticEvent
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { apiClient } from '../../lib/api/client';
import { useCartStore } from '../../lib/store/cart-store';
import { useAuthStore } from '../../lib/store/auth-store';
import {
  ArrowLeft, Share2, Heart, ShoppingCart, Zap, Star,
  Shield, Package, ChevronRight, TrendingUp, TrendingDown, RefreshCw, User
} from 'lucide-react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const HERO_H = SCREEN_H * 0.46;

interface Product {
  product_id: number;
  name: string;
  description: string;
  base_price_usd: number;
  price_in_token: number | null;
  token_id: number | null;
  token_symbol: string | null;
  category: string;
  stock: number;
  seller_name: string;
  seller_slug: string | null;
  seller_avatar: string | null;
  seller_user_avatar: string | null;
  seller_rating: number;
  listed_at: string;
  primary_image: string | null;
  images: Array<{ url: string }> | null;
  rating_avg: string;
  review_count: number;
}

function useLivePrice(symbol: string | null, intervalMs = 5000) {
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number>(0);

  useEffect(() => {
    if (!symbol || symbol === 'USDT' || symbol === 'USDC') {
      setPrice(1);
      return;
    }
    const fetch_ = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`);
        const d = await res.json();
        setPrice(parseFloat(d.lastPrice));
        setChange(parseFloat(d.priceChangePercent));
      } catch {}
    };
    fetch_();
    const iv = setInterval(fetch_, intervalMs);
    return () => clearInterval(iv);
  }, [symbol]);

  return { price, change };
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const addItem = useCartStore(s => s.addItem);
  const { isAuthenticated } = useAuthStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [liked, setLiked] = useState(false);
  const [qty, setQty] = useState(1);
  const [addedAnim] = useState(new Animated.Value(1));

  const scrollY = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const { price: tokenPrice, change: tokenChange } = useLivePrice(product?.token_symbol ?? null);

  useEffect(() => {
    apiClient.get(`/api/products/${id}`)
      .then(r => setProduct(r.data.data ?? r.data.product))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const usdEstimate = product?.price_in_token && tokenPrice
    ? (Number(product.price_in_token) * tokenPrice * qty).toFixed(2)
    : null;

  const images = product?.images?.length
    ? product.images.map(img => (typeof img === 'string' ? img : img.url))
    : product?.primary_image ? [product.primary_image] : [];

  const handleAddToCart = () => {
    if (!product) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addItem({
      product_id: product.product_id,
      name: product.name,
      price: Number(product.base_price_usd),
      token_symbol: product.token_symbol ?? undefined,
      price_in_token: product.price_in_token ?? undefined,
    });
    Animated.sequence([
      Animated.spring(addedAnim, { toValue: 0.9, useNativeDriver: true }),
      Animated.spring(addedAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
  };

  const handleBuyNow = () => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // Create order then navigate to checkout
    apiClient.post('/api/orders', { product_id: product?.product_id, quantity: qty })
      .then(r => {
        const orderId = r.data?.order?.order_id ?? r.data?.orderId;
        if (orderId) router.push(`/checkout/${orderId}`);
      })
      .catch(e => Alert.alert('Lỗi', e.response?.data?.message ?? 'Không thể đặt hàng'));
  };

  const handleLike = () => {
    setLiked(l => !l);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true }),
      Animated.spring(heartScale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
  };

  const handleShare = () => {
    Share.share({ message: `Check out ${product?.name} on CryptoMarket!` });
  };

  // Header opacity based on scroll
  const headerBg = scrollY.interpolate({ inputRange: [HERO_H - 100, HERO_H - 40], outputRange: [0, 1], extrapolate: 'clamp' });

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: '#0c0e14', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#f0b90b" />
    </View>
  );

  if (!product) return (
    <View style={{ flex: 1, backgroundColor: '#0c0e14', alignItems: 'center', justifyContent: 'center' }}>
      <Package size={48} color="#6b7280" />
      <Text style={{ color: '#6b7280', marginTop: 12 }}>Sản phẩm không tồn tại</Text>
      <Pressable onPress={() => router.back()} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#f0b90b', borderRadius: 12 }}>
        <Text style={{ color: 'black', fontWeight: 'bold' }}>Quay lại</Text>
      </Pressable>
    </View>
  );

  const priceLine = product.price_in_token && product.token_symbol
    ? `${Number(product.price_in_token).toFixed(['ETH', 'WBTC'].includes(product.token_symbol) ? 6 : 4)} ${product.token_symbol}`
    : `$${Number(product.base_price_usd).toFixed(2)}`;

  return (
    <View style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      {/* Sticky transparent → solid header on scroll */}
      <Animated.View style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
        paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: headerBg.interpolate ? undefined : 'transparent',
      }}>
        <Animated.View style={{ opacity: headerBg, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0c0e14' }} />
        <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={handleShare} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <Share2 size={18} color="white" />
          </Pressable>
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Pressable onPress={handleLike} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
              <Heart size={18} color={liked ? '#ef4444' : 'white'} fill={liked ? '#ef4444' : 'none'} />
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image */}
        <View style={{ width: SCREEN_W, height: HERO_H, backgroundColor: '#131722' }}>
          {images.length > 0 ? (
            <Image source={{ uri: images[imgIdx] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Package size={64} color="#6b7280" />
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(12,14,20,0.9)']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 }}
          />
          {/* Image dots */}
          {images.length > 1 && (
            <View style={{ position: 'absolute', bottom: 16, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
              {images.map((_, i) => (
                <Pressable key={i} onPress={() => setImgIdx(i)}>
                  <View style={{ width: i === imgIdx ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i === imgIdx ? '#f0b90b' : 'rgba(255,255,255,0.4)', transition: 'width 0.3s' }} />
                </Pressable>
              ))}
            </View>
          )}
          {/* Stock badge */}
          {product.stock === 0 && (
            <View style={{ position: 'absolute', top: 70, left: 16, backgroundColor: 'rgba(239,68,68,0.9)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>{t('product.outOfStock')}</Text>
            </View>
          )}
          {product.category && (
            <View style={{ position: 'absolute', top: 70, right: 16, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>
              <Text style={{ color: 'white', fontSize: 11, textTransform: 'capitalize' }}>{product.category}</Text>
            </View>
          )}
        </View>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: -40, paddingHorizontal: 16, marginBottom: 8 }}>
            {images.map((img, i) => (
              <Pressable key={i} onPress={() => setImgIdx(i)} style={{ marginRight: 8 }}>
                <View style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: i === imgIdx ? '#f0b90b' : 'transparent' }}>
                  <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Content */}
        <View style={{ paddingHorizontal: 16, paddingTop: images.length <= 1 ? 8 : 0 }}>
          {/* Category & Name */}
          <Text style={{ color: '#f0b90b', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
            {product.category}
          </Text>
          <Text style={{ color: 'white', fontSize: 22, fontWeight: '800', lineHeight: 28, marginBottom: 8 }}>
            {product.name}
          </Text>

          {/* Rating */}
          {parseFloat(product.rating_avg) > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              {[1,2,3,4,5].map(s => (
                <Star key={s} size={14} color="#f0b90b" fill={s <= Math.round(parseFloat(product.rating_avg)) ? '#f0b90b' : 'none'} />
              ))}
              <Text style={{ color: '#f0b90b', fontWeight: '700', fontSize: 13 }}>{Number(product.rating_avg).toFixed(1)}</Text>
              <Text style={{ color: '#6b7280', fontSize: 12 }}>({product.review_count} đánh giá)</Text>
            </View>
          )}

          {/* Price Card */}
          <View style={{ backgroundColor: '#131722', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1e2130' }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
              <Text style={{ color: '#f0b90b', fontSize: 28, fontWeight: '900', fontFamily: 'monospace' }}>
                {priceLine}
              </Text>
            </View>

            {/* Live USD estimate */}
            {usdEstimate && tokenPrice && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <RefreshCw size={10} color="#6b7280" />
                  <Text style={{ color: '#6b7280', fontSize: 11 }}>≈ ${usdEstimate} USD</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  {tokenChange >= 0
                    ? <TrendingUp size={11} color="#10b981" />
                    : <TrendingDown size={11} color="#ef4444" />
                  }
                  <Text style={{ color: tokenChange >= 0 ? '#10b981' : '#ef4444', fontSize: 11, fontWeight: '700' }}>
                    {tokenChange >= 0 ? '+' : ''}{tokenChange.toFixed(2)}% 24h
                  </Text>
                </View>
              </View>
            )}
            {product.price_in_token && (
              <Text style={{ color: '#4b5563', fontSize: 11, marginTop: 4 }}>
                Giá gốc: ${Number(product.base_price_usd).toFixed(2)} USD
              </Text>
            )}

            {/* Quantity selector */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
              <Text style={{ color: '#9ca3af', fontSize: 13, flex: 1 }}>{t('product.quantity')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0c0e14', borderRadius: 12, borderWidth: 1, borderColor: '#1e2130' }}>
                <Pressable
                  onPress={() => qty > 1 && setQty(q => q - 1)}
                  style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: qty > 1 ? 'white' : '#4b5563', fontSize: 20, fontWeight: '300' }}>−</Text>
                </Pressable>
                <Text style={{ color: 'white', fontWeight: '700', minWidth: 28, textAlign: 'center', fontSize: 15 }}>{qty}</Text>
                <Pressable
                  onPress={() => qty < product.stock && setQty(q => q + 1)}
                  style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: qty < product.stock ? 'white' : '#4b5563', fontSize: 20, fontWeight: '300' }}>+</Text>
                </Pressable>
              </View>
              <Text style={{ color: '#6b7280', fontSize: 11 }}>{product.stock} còn lại</Text>
            </View>
          </View>

          {/* Escrow Shield */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', marginBottom: 16 }}>
            <Shield size={18} color="#10b981" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#10b981', fontWeight: '700', fontSize: 12 }}>Smart Contract Escrow</Text>
              <Text style={{ color: '#6b7280', fontSize: 11 }}>Tiền được bảo vệ đến khi bạn nhận hàng</Text>
            </View>
          </View>

          {/* Description */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16, marginBottom: 8 }}>Mô tả sản phẩm</Text>
            <Text style={{ color: '#9ca3af', lineHeight: 22, fontSize: 14 }}>{product.description}</Text>
          </View>

          {/* Seller Card */}
          <View style={{ backgroundColor: '#131722', borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#1e2130' }}>
            <Text style={{ color: '#6b7280', fontSize: 11, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Người bán</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {product.seller_user_avatar ? (
                <Image source={{ uri: product.seller_user_avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
              ) : (
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0b90b', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: 'black', fontWeight: '900', fontSize: 18 }}>{product.seller_name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>{product.seller_name}</Text>
                {product.seller_rating > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Star size={11} color="#f0b90b" fill="#f0b90b" />
                    <Text style={{ color: '#f0b90b', fontSize: 12 }}>{Number(product.seller_rating).toFixed(1)}</Text>
                  </View>
                )}
              </View>
              <ChevronRight size={18} color="#6b7280" />
            </View>
          </View>

          <View style={{ height: 120 }} />
        </View>
      </Animated.ScrollView>

      {/* Fixed Bottom CTA */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingTop: 12, paddingBottom: 34, paddingHorizontal: 16,
        backgroundColor: 'rgba(12,14,20,0.95)',
        borderTopWidth: 1, borderTopColor: '#1e2130',
        flexDirection: 'row', gap: 10,
      }}>
        <Animated.View style={{ transform: [{ scale: addedAnim }] }}>
          <Pressable
            onPress={handleAddToCart}
            disabled={product.stock === 0}
            style={{
              width: 52, height: 52, borderRadius: 16,
              backgroundColor: '#1e2130', borderWidth: 1, borderColor: '#2d3147',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ShoppingCart size={22} color="#f0b90b" />
          </Pressable>
        </Animated.View>

        <Pressable
          onPress={handleBuyNow}
          disabled={product.stock === 0}
          style={{ flex: 1, height: 52, borderRadius: 16, overflow: 'hidden' }}
        >
          <LinearGradient
            colors={product.stock > 0 ? ['#f0b90b', '#e6a800'] : ['#374151', '#374151']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Zap size={20} color={product.stock > 0 ? 'black' : '#6b7280'} fill={product.stock > 0 ? 'black' : 'none'} />
            <Text style={{ color: product.stock > 0 ? 'black' : '#6b7280', fontWeight: '800', fontSize: 16 }}>
              {product.stock === 0 ? t('product.outOfStock') : t('product.buyNow')}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
