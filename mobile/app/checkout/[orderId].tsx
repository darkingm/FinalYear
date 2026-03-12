import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  Alert, Animated, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { apiClient, paymentClient } from '../../lib/api/client';
import { useAuthStore } from '../../lib/store/auth-store';
import {
  ArrowLeft, Shield, Wallet, CreditCard, CheckCircle2,
  Clock, AlertTriangle, Package, ChevronRight, Copy, ExternalLink, RefreshCw
} from 'lucide-react-native';

const { width: W } = Dimensions.get('window');

interface Order {
  order_id: number;
  internal_order_id: string;
  product_id: number;
  product_name: string;
  price_usd: number;
  amount_token: number | null;
  token_id: number | null;
  token_symbol: string | null;
  status: string;
  quantity: number;
  seller_wallet_address: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  UNPAID:            { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   label: 'Chờ thanh toán', icon: Clock },
  PENDING:           { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   label: 'Đang xử lý',     icon: RefreshCw },
  ONCHAIN_CONFIRMED: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',   label: 'Đã xác nhận',    icon: CheckCircle2 },
  DELIVERING:        { color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',    label: 'Đang giao hàng', icon: Package },
  COMPLETED:         { color: '#10b981', bg: 'rgba(16,185,129,0.1)',   label: 'Hoàn thành',     icon: CheckCircle2 },
  CANCELLED:         { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    label: 'Đã huỷ',         icon: AlertTriangle },
  DISPUTED:          { color: '#f97316', bg: 'rgba(249,115,22,0.1)',   label: 'Tranh chấp',     icon: AlertTriangle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', label: status, icon: Clock };
  const Icon = cfg.icon;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: cfg.bg }}>
      <Icon size={13} color={cfg.color} />
      <Text style={{ color: cfg.color, fontWeight: '700', fontSize: 12 }}>{cfg.label}</Text>
    </View>
  );
}

function StepProgress({ current }: { current: number }) {
  const steps = ['Đặt hàng', 'Thanh toán', 'Xác nhận', 'Giao hàng', 'Hoàn thành'];
  return (
    <View style={{ marginVertical: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {steps.map((s, i) => (
          <View key={s} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              {i > 0 && <View style={{ flex: 1, height: 2, backgroundColor: i <= current ? '#f0b90b' : '#1e2130' }} />}
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: i <= current ? '#f0b90b' : '#1e2130', alignItems: 'center', justifyContent: 'center', borderWidth: i === current ? 2 : 0, borderColor: 'rgba(240,185,11,0.5)' }}>
                {i < current
                  ? <CheckCircle2 size={14} color="black" />
                  : <Text style={{ color: i <= current ? 'black' : '#6b7280', fontSize: 10, fontWeight: '700' }}>{i + 1}</Text>
                }
              </View>
              {i < steps.length - 1 && <View style={{ flex: 1, height: 2, backgroundColor: i < current ? '#f0b90b' : '#1e2130' }} />}
            </View>
            <Text style={{ color: i <= current ? '#f0b90b' : '#6b7280', fontSize: 9, marginTop: 4, textAlign: 'center', fontWeight: i === current ? '700' : '400' }} numberOfLines={1}>{s}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const STATUS_TO_STEP: Record<string, number> = {
  UNPAID: 0, PENDING: 1, ONCHAIN_CONFIRMED: 2, DELIVERING: 3, COMPLETED: 4,
};

export default function CheckoutScreen() {
  const { orderId } = useLocalSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [payMethod, setPayMethod] = useState<'crypto' | 'paypal'>('crypto');
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [polling, setPolling] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: payMethod === 'crypto' ? 0 : 1, duration: 250, useNativeDriver: true }).start();
  }, [payMethod]);

  // Pulse animation for pending status
  useEffect(() => {
    if (order?.status === 'PENDING' || order?.status === 'UNPAID') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [order?.status]);

  const loadOrder = async () => {
    try {
      const res = await apiClient.get(`/api/orders/${orderId}`);
      setOrder(res.data.order ?? res.data);
    } catch {}
    setLoading(false);
  };

  const getQuote = async () => {
    if (!order) return;
    setQuoteLoading(true);
    try {
      const res = await paymentClient.post('/api/payments/crypto/generate-quote', { order_id: order.order_id });
      setQuote(res.data.quote ?? res.data);
    } catch (e: any) {
      Alert.alert('Lỗi', e.response?.data?.message ?? 'Không thể lấy báo giá');
    }
    setQuoteLoading(false);
  };

  const handleConfirmPayment = async () => {
    if (!order || !quote) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPaying(true);
    Alert.alert(
      'Xác nhận thanh toán',
      `Bạn sẽ thanh toán ${quote.amount} ${quote.token_symbol} đến địa chỉ Escrow.\n\nVui lòng xác nhận giao dịch trong ví của bạn.`,
      [
        { text: 'Huỷ', style: 'cancel', onPress: () => setPaying(false) },
        {
          text: 'Xác nhận',
          onPress: async () => {
            try {
              await paymentClient.post('/api/payments/crypto/submit', {
                order_id: order.order_id,
                tx_hash: '0xPENDING_WALLET_CONNECT',
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              loadOrder();
            } catch {}
            setPaying(false);
          }
        }
      ]
    );
  };

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: '#0c0e14', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#f0b90b" />
      <Text style={{ color: '#6b7280', marginTop: 12, fontSize: 13 }}>Đang tải đơn hàng...</Text>
    </View>
  );

  if (!order) return (
    <View style={{ flex: 1, backgroundColor: '#0c0e14', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <AlertTriangle size={48} color="#ef4444" />
      <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>Không tìm thấy đơn hàng</Text>
      <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
        <Text style={{ color: '#f0b90b', fontWeight: '600' }}>Quay lại</Text>
      </Pressable>
    </View>
  );

  const currentStep = STATUS_TO_STEP[order.status] ?? 0;
  const isCompleted = ['COMPLETED', 'CANCELLED'].includes(order.status);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e2130' }}>
        <Pressable onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#131722', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <ArrowLeft size={18} color="#9ca3af" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>Thanh toán</Text>
          <Text style={{ color: '#6b7280', fontSize: 11 }}>#{order.internal_order_id?.split('-')[0]?.toUpperCase()}</Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Progress Bar */}
        <StepProgress current={currentStep} />

        {/* Order Summary Card */}
        <View style={{ backgroundColor: '#131722', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1e2130' }}>
          <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Đơn hàng</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 48, height: 48, backgroundColor: '#1e2130', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
              <Package size={22} color="#6b7280" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{order.product_name}</Text>
              <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>Số lượng: {order.quantity}</Text>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: '#1e2130', marginVertical: 12 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#6b7280', fontSize: 13 }}>Tổng tiền</Text>
            <Text style={{ color: '#f0b90b', fontWeight: '800', fontSize: 18 }}>
              {order.amount_token && order.token_symbol
                ? `${Number(order.amount_token).toFixed(6)} ${order.token_symbol}`
                : `$${Number(order.price_usd).toFixed(2)}`
              }
            </Text>
          </View>
          {order.amount_token && (
            <Text style={{ color: '#4b5563', fontSize: 11, textAlign: 'right', marginTop: 2 }}>≈ ${Number(order.price_usd).toFixed(2)} USD</Text>
          )}
        </View>

        {/* Escrow info */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <LinearGradient
            colors={['rgba(16,185,129,0.1)', 'rgba(16,185,129,0.05)']}
            style={{ borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <View style={{ width: 40, height: 40, backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={20} color="#10b981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#10b981', fontWeight: '700', fontSize: 13 }}>Bảo vệ Escrow đang hoạt động</Text>
              <Text style={{ color: '#6b7280', fontSize: 11, lineHeight: 16, marginTop: 2 }}>
                Tiền của bạn được giữ an toàn trong hợp đồng thông minh cho đến khi bạn xác nhận nhận hàng.
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Payment Method - only show if UNPAID */}
        {order.status === 'UNPAID' && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Phương thức thanh toán</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              {[
                { id: 'crypto', label: 'Crypto Wallet', icon: Wallet },
                { id: 'paypal', label: 'PayPal', icon: CreditCard },
              ].map(m => (
                <Pressable
                  key={m.id}
                  onPress={() => { setPayMethod(m.id as any); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 2, borderColor: payMethod === m.id ? '#f0b90b' : '#1e2130', backgroundColor: payMethod === m.id ? 'rgba(240,185,11,0.08)' : '#131722', alignItems: 'center', gap: 6 }}
                >
                  <m.icon size={22} color={payMethod === m.id ? '#f0b90b' : '#6b7280'} />
                  <Text style={{ color: payMethod === m.id ? '#f0b90b' : '#6b7280', fontWeight: '700', fontSize: 12 }}>{m.label}</Text>
                </Pressable>
              ))}
            </View>

            {payMethod === 'crypto' && (
              <View style={{ backgroundColor: '#131722', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e2130' }}>
                {!quote ? (
                  <View>
                    <Text style={{ color: '#9ca3af', fontSize: 13, lineHeight: 20, marginBottom: 14 }}>
                      Nhấn bên dưới để nhận báo giá thanh toán bằng <Text style={{ color: '#f0b90b', fontWeight: '700' }}>{order.token_symbol ?? 'Token'}</Text>
                    </Text>
                    <Pressable onPress={getQuote} disabled={quoteLoading} style={{ borderRadius: 12, overflow: 'hidden' }}>
                      <LinearGradient colors={['#f0b90b', '#e6a800']} style={{ paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                        {quoteLoading
                          ? <ActivityIndicator color="black" size="small" />
                          : <>
                              <RefreshCw size={16} color="black" />
                              <Text style={{ color: 'black', fontWeight: '800', fontSize: 14 }}>Lấy báo giá</Text>
                            </>
                        }
                      </LinearGradient>
                    </Pressable>
                  </View>
                ) : (
                  <View>
                    <View style={{ backgroundColor: '#0c0e14', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ color: '#6b7280', fontSize: 12 }}>Số lượng</Text>
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>{quote.amount} {quote.token_symbol}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ color: '#6b7280', fontSize: 12 }}>Địa chỉ Escrow</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={{ color: '#9ca3af', fontSize: 11 }}>{quote.escrow_address?.slice(0, 8)}...{quote.escrow_address?.slice(-4)}</Text>
                          <Copy size={12} color="#6b7280" />
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#6b7280', fontSize: 12 }}>Hết hạn</Text>
                        <Text style={{ color: '#f59e0b', fontSize: 12 }}>15 phút</Text>
                      </View>
                    </View>
                    <Pressable onPress={handleConfirmPayment} disabled={paying} style={{ borderRadius: 12, overflow: 'hidden' }}>
                      <LinearGradient colors={['#f0b90b', '#e6a800']} style={{ paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                        {paying ? <ActivityIndicator color="black" /> : <>
                          <Wallet size={18} color="black" />
                          <Text style={{ color: 'black', fontWeight: '800', fontSize: 15 }}>Xác nhận & Thanh toán</Text>
                        </>}
                      </LinearGradient>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            {payMethod === 'paypal' && (
              <View style={{ backgroundColor: '#131722', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e2130', alignItems: 'center', gap: 10 }}>
                <Text style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>Bạn sẽ được chuyển đến PayPal để hoàn tất thanh toán</Text>
                <Pressable style={{ borderRadius: 12, overflow: 'hidden', width: '100%' }}>
                  <View style={{ backgroundColor: '#003087', paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderRadius: 12 }}>
                    <CreditCard size={18} color="white" />
                    <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>Thanh toán với PayPal</Text>
                  </View>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Completed or other status message */}
        {order.status === 'COMPLETED' && (
          <View style={{ alignItems: 'center', padding: 24 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(16,185,129,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <CheckCircle2 size={36} color="#10b981" />
            </View>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: '800', marginBottom: 6 }}>Hoàn thành! 🎉</Text>
            <Text style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              Cảm ơn bạn đã mua hàng. Thanh toán đã được giải ngân cho người bán.
            </Text>
          </View>
        )}

        {order.status === 'DELIVERING' && (
          <View style={{ backgroundColor: 'rgba(6,182,212,0.08)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(6,182,212,0.2)', alignItems: 'center', gap: 8 }}>
            <Package size={28} color="#06b6d4" />
            <Text style={{ color: '#06b6d4', fontWeight: '700', fontSize: 14 }}>Hàng đang trên đường giao</Text>
            <Text style={{ color: '#6b7280', fontSize: 12, textAlign: 'center' }}>Khi nhận được hàng, hãy xác nhận để giải ngân thanh toán cho người bán</Text>
            <Pressable style={{ marginTop: 4, borderRadius: 12, overflow: 'hidden', width: '100%' }}>
              <LinearGradient colors={['#10b981', '#059669']} style={{ paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>✓ Xác nhận đã nhận hàng</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
