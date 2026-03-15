import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  Alert, Animated, Dimensions, TouchableOpacity,
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
  Clock, AlertTriangle, Package, ChevronDown, RefreshCw, ChevronRight,
} from 'lucide-react-native';

const { width: W } = Dimensions.get('window');

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Order {
  order_id: number;
  internal_order_id: string;
  product_id: number;
  product_name: string;
  price_usd: number;
  total_amount: number;
  amount_token: number | null;
  token_id: number | null;
  token_symbol: string | null;   // ← từ JOIN token_whitelist trên product
  chain_id: number | null;
  status: string;
  quantity: number;
  seller_wallet_address: string | null;
  created_at: string;
}

// ─── Supported networks for payment ────────────────────────────────────────────
// Backend đã deploy contract trên Polygon Amoy (80002)
// Testnet chains được hỗ trợ từ crypto-payment.service.ts
const SUPPORTED_CHAINS: { chain_id: number; name: string; symbol: string; color: string; badge: string }[] = [
  { chain_id: 80002,  name: 'Polygon Amoy',    symbol: 'MATIC', color: '#8b5cf6', badge: 'Testnet' },
  { chain_id: 97,     name: 'BNB Testnet',     symbol: 'BNB',   color: '#f0b90b', badge: 'Testnet' },
  { chain_id: 421614, name: 'Arbitrum Sepolia', symbol: 'ETH',   color: '#3b82f6', badge: 'Testnet' },
  { chain_id: 137,    name: 'Polygon',         symbol: 'MATIC', color: '#8b5cf6', badge: 'Mainnet' },
  { chain_id: 42161,  name: 'Arbitrum',        symbol: 'ETH',   color: '#3b82f6', badge: 'Mainnet' },
];

// ─── Status config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  UNPAID:            { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   label: 'Chờ thanh toán', icon: Clock },
  TX_SUBMITTED:      { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   label: 'Đang xử lý',     icon: RefreshCw },
  PENDING:           { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   label: 'Đang xử lý',     icon: RefreshCw },
  ONCHAIN_CONFIRMED: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',   label: 'Đã xác nhận',    icon: CheckCircle2 },
  DELIVERING:        { color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',    label: 'Đang giao hàng', icon: Package },
  COMPLETED:         { color: '#10b981', bg: 'rgba(16,185,129,0.1)',   label: 'Hoàn thành',     icon: CheckCircle2 },
  CANCELLED:         { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    label: 'Đã huỷ',         icon: AlertTriangle },
  DISPUTED:          { color: '#f97316', bg: 'rgba(249,115,22,0.1)',   label: 'Tranh chấp',     icon: AlertTriangle },
};

const STATUS_TO_STEP: Record<string, number> = {
  UNPAID: 0, TX_SUBMITTED: 1, PENDING: 1, ONCHAIN_CONFIRMED: 2, DELIVERING: 3, COMPLETED: 4,
};

// ─── Sub-components ─────────────────────────────────────────────────────────────
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

// ─── Network picker ──────────────────────────────────────────────────────────────
function NetworkPicker({
  selected,
  onSelect,
  productTokenSymbol,
}: {
  selected: typeof SUPPORTED_CHAINS[0];
  onSelect: (c: typeof SUPPORTED_CHAINS[0]) => void;
  productTokenSymbol: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        Mạng thanh toán
      </Text>
      <TouchableOpacity
        onPress={() => { setOpen(o => !o); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#131722', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 2, borderColor: selected.color + '60' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: selected.color }} />
          <View>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>{selected.name}</Text>
            <Text style={{ color: '#6b7280', fontSize: 11 }}>
              {productTokenSymbol ?? selected.symbol}
              {'  ·  '}
              <Text style={{ color: selected.badge === 'Testnet' ? '#f59e0b' : '#10b981' }}>{selected.badge}</Text>
            </Text>
          </View>
        </View>
        <ChevronDown size={16} color="#6b7280" style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </TouchableOpacity>

      {open && (
        <View style={{ backgroundColor: '#131722', borderRadius: 14, marginTop: 4, borderWidth: 1, borderColor: '#1e2130', overflow: 'hidden' }}>
          {SUPPORTED_CHAINS.map((chain, idx) => (
            <TouchableOpacity
              key={chain.chain_id}
              onPress={() => { onSelect(chain); setOpen(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 14, paddingVertical: 12,
                backgroundColor: selected.chain_id === chain.chain_id ? 'rgba(255,255,255,0.05)' : 'transparent',
                borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: '#1e2130',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: chain.color }} />
                <View>
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>{chain.name}</Text>
                  <Text style={{ color: '#6b7280', fontSize: 11 }}>
                    {chain.symbol}
                    {'  ·  '}
                    <Text style={{ color: chain.badge === 'Testnet' ? '#f59e0b' : '#10b981' }}>{chain.badge}</Text>
                  </Text>
                </View>
              </View>
              {selected.chain_id === chain.chain_id && <CheckCircle2 size={16} color={chain.color} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────────
export default function CheckoutScreen() {
  const { orderId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [payMethod, setPayMethod] = useState<'crypto' | 'paypal'>('crypto');

  // ── Network/token selection ──
  // Mặc định chọn Polygon Amoy (testnet đang có contract)
  const [selectedChain, setSelectedChain] = useState(SUPPORTED_CHAINS[0]);

  // ── Quote state ──
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // ── Payment state ──
  const [paying, setPaying] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => { loadOrder(); }, [orderId]);

  // Reset quote khi đổi mạng
  useEffect(() => { setQuote(null); setQuoteError(null); }, [selectedChain]);

  // Pulse animation when pending
  useEffect(() => {
    if (order?.status === 'TX_SUBMITTED' || order?.status === 'UNPAID') {
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
      const fetchedOrder: Order = res.data.order ?? res.data;
      setOrder(fetchedOrder);

      // Nếu sản phẩm đã có chain_id → tự động chọn mạng phù hợp
      if (fetchedOrder.chain_id) {
        const matchedChain = SUPPORTED_CHAINS.find(c => c.chain_id === fetchedOrder.chain_id);
        if (matchedChain) setSelectedChain(matchedChain);
      }
    } catch (e: any) {
      Alert.alert('Lỗi', 'Không thể tải đơn hàng');
    }
    setLoading(false);
  };

  // ── Determine token symbol to use ──────────────────────────────────────────
  // Ưu tiên: token của sản phẩm (seller đã set) → fallback native token của chain
  const resolveTokenSymbol = (): string => {
    if (order?.token_symbol) return order.token_symbol;
    return selectedChain.symbol; // native token (MATIC, BNB, ETH)
  };

  // ── Get Quote ───────────────────────────────────────────────────────────────
  const getQuote = async () => {
    if (!order) return;

    const tokenSymbol = resolveTokenSymbol();
    setQuoteLoading(true);
    setQuoteError(null);
    setQuote(null);

    try {
      const res = await paymentClient.post('/api/payments/crypto/generate-quote', {
        order_id: order.order_id,
        token_symbol: tokenSymbol,           // ← FIX: gửi token symbol
        preferred_chain_id: selectedChain.chain_id, // ← FIX: gửi chain id
      });
      setQuote(res.data.quote ?? res.data);
    } catch (e: any) {
      const msg = e.response?.data?.message ?? e.response?.data?.error ?? 'Không thể lấy báo giá';
      setQuoteError(msg);
      Alert.alert('Lỗi lấy báo giá', msg);
    }
    setQuoteLoading(false);
  };

  // ── Confirm Payment ─────────────────────────────────────────────────────────
  // Lưu ý: đây là nơi tích hợp WalletConnect/MetaMask sau
  // Hiện tại show thông tin quote để user confirm rồi submit tx_hash
  const handleConfirmPayment = async () => {
    if (!order || !quote) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPaying(true);

    Alert.alert(
      'Xác nhận thanh toán',
      `Bạn sẽ thanh toán:\n\n` +
      `💰 ${Number(quote.amount_token ?? quote.amount).toFixed(6)} ${resolveTokenSymbol()}\n` +
      `🌐 Mạng: ${selectedChain.name}\n` +
      `🔒 Escrow: ${quote.escrow_contract?.slice(0, 10)}...${quote.escrow_contract?.slice(-4)}\n\n` +
      `Vui lòng xác nhận trong ví của bạn (WalletConnect).`,
      [
        { text: 'Huỷ', style: 'cancel', onPress: () => setPaying(false) },
        {
          text: 'Mở ví & Ký',
          onPress: async () => {
            // TODO: Tích hợp WalletConnect để ký tx thực sự
            // Hiện tại giả lập với tx hash placeholder để test flow
            Alert.alert(
              'Chưa tích hợp WalletConnect',
              'Bước tiếp theo: tích hợp WalletConnect để ký giao dịch thực sự.\n\n' +
              'Calldata đã sẵn sàng:\n' + (quote.calldata?.slice(0, 40) ?? 'N/A') + '...',
              [{ text: 'OK', onPress: () => setPaying(false) }]
            );
          }
        }
      ]
    );
  };

  // ─── Loading / Error states ──────────────────────────────────────────────────
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
  const tokenSymbol = resolveTokenSymbol();

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
        {/* Progress */}
        <StepProgress current={currentStep} />

        {/* Order Summary */}
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
            <View style={{ alignItems: 'flex-end' }}>
              {/* Hiển thị giá token nếu có, không thì USD */}
              {order.amount_token && order.token_symbol ? (
                <>
                  <Text style={{ color: '#f0b90b', fontWeight: '800', fontSize: 18 }}>
                    {Number(order.amount_token).toFixed(6)} {order.token_symbol}
                  </Text>
                  <Text style={{ color: '#4b5563', fontSize: 11, marginTop: 2 }}>
                    ≈ ${Number(order.price_usd ?? order.total_amount).toFixed(2)} USD
                  </Text>
                </>
              ) : (
                <Text style={{ color: '#f0b90b', fontWeight: '800', fontSize: 18 }}>
                  ${Number(order.price_usd ?? order.total_amount).toFixed(2)}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Escrow Banner */}
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
                Tiền giữ trong smart contract cho đến khi bạn xác nhận nhận hàng.
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Payment section — chỉ hiện khi UNPAID */}
        {order.status === 'UNPAID' && (
          <View style={{ marginBottom: 16 }}>
            {/* Method tabs */}
            <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Phương thức thanh toán
            </Text>
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

            {/* ── Crypto panel ── */}
            {payMethod === 'crypto' && (
              <View style={{ backgroundColor: '#131722', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e2130' }}>
                {/* Network picker — luôn hiển thị để user có thể thay đổi */}
                <NetworkPicker
                  selected={selectedChain}
                  onSelect={(chain) => setSelectedChain(chain)}
                  productTokenSymbol={order.token_symbol}
                />

                {/* Token info chip */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, backgroundColor: '#0c0e14', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: selectedChain.color }} />
                  <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                    Token:{' '}
                    <Text style={{ color: 'white', fontWeight: '700' }}>
                      {tokenSymbol}
                    </Text>
                    {order.token_symbol && order.token_symbol !== selectedChain.symbol && (
                      <Text style={{ color: '#f59e0b' }}> (sản phẩm yêu cầu {order.token_symbol})</Text>
                    )}
                  </Text>
                </View>

                {/* Quote display */}
                {!quote ? (
                  <View>
                    <Text style={{ color: '#9ca3af', fontSize: 13, lineHeight: 20, marginBottom: 14 }}>
                      Nhấn để lấy giá thanh toán bằng{' '}
                      <Text style={{ color: '#f0b90b', fontWeight: '700' }}>{tokenSymbol}</Text>
                      {' '}trên{' '}
                      <Text style={{ color: selectedChain.color, fontWeight: '700' }}>{selectedChain.name}</Text>
                    </Text>

                    {quoteError && (
                      <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}>
                        <Text style={{ color: '#ef4444', fontSize: 12, lineHeight: 18 }}>⚠️ {quoteError}</Text>
                        <Text style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>Thử chọn mạng khác hoặc kiểm tra token được hỗ trợ.</Text>
                      </View>
                    )}

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
                    {/* Quote card */}
                    <View style={{ backgroundColor: '#0c0e14', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                        <Text style={{ color: '#6b7280', fontSize: 12 }}>Số lượng thanh toán</Text>
                        <Text style={{ color: '#f0b90b', fontWeight: '800', fontSize: 15 }}>
                          {Number(quote.amount_token ?? quote.amount).toFixed(6)} {tokenSymbol}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ color: '#6b7280', fontSize: 12 }}>Mạng</Text>
                        <Text style={{ color: selectedChain.color, fontWeight: '600', fontSize: 12 }}>{selectedChain.name}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ color: '#6b7280', fontSize: 12 }}>Địa chỉ Escrow</Text>
                        <Text style={{ color: '#9ca3af', fontSize: 11 }}>
                          {quote.escrow_contract?.slice(0, 8)}...{quote.escrow_contract?.slice(-4)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ color: '#6b7280', fontSize: 12 }}>Hết hạn</Text>
                        <Text style={{ color: '#f59e0b', fontSize: 12 }}>10 phút</Text>
                      </View>
                      {quote.token_price && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ color: '#6b7280', fontSize: 12 }}>Giá token</Text>
                          <Text style={{ color: '#4b5563', fontSize: 12 }}>${Number(quote.token_price).toFixed(4)} / {tokenSymbol}</Text>
                        </View>
                      )}
                    </View>

                    {/* Action buttons */}
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Pressable
                        onPress={() => { setQuote(null); setQuoteError(null); }}
                        style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#1e2130', alignItems: 'center' }}
                      >
                        <Text style={{ color: '#6b7280', fontWeight: '600', fontSize: 13 }}>Làm mới</Text>
                      </Pressable>
                      <Pressable onPress={handleConfirmPayment} disabled={paying} style={{ flex: 2, borderRadius: 12, overflow: 'hidden' }}>
                        <LinearGradient colors={['#f0b90b', '#e6a800']} style={{ paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                          {paying ? <ActivityIndicator color="black" /> : <>
                            <Wallet size={17} color="black" />
                            <Text style={{ color: 'black', fontWeight: '800', fontSize: 14 }}>Xác nhận & Ký</Text>
                          </>}
                        </LinearGradient>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* ── PayPal panel ── */}
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

        {/* Status messages */}
        {order.status === 'TX_SUBMITTED' && (
          <View style={{ backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color="#3b82f6" />
            <Text style={{ color: '#3b82f6', fontWeight: '700', fontSize: 14 }}>Giao dịch đang được xác nhận</Text>
            <Text style={{ color: '#6b7280', fontSize: 12, textAlign: 'center' }}>Blockchain đang xử lý giao dịch của bạn...</Text>
          </View>
        )}

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
