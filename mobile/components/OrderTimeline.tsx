import { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import {
  ShoppingCart, CreditCard, Package, Truck, ScanLine, CheckCircle, XCircle, AlertTriangle,
} from 'lucide-react-native';

// ── Types ────────────────────────────────────────────────────────────────────
export type StepState = 'done' | 'active' | 'pending' | 'error';

export interface TimelineStep {
  id: string;
  label: string;
  sublabel?: string;
  timestamp?: string;
  state: StepState;
  icon: React.ComponentType<any>;
  color: string;
}

interface OrderTimelineProps {
  steps: TimelineStep[];
}

// ── Step colors ───────────────────────────────────────────────────────────────
const STATE_COLORS: Record<StepState, { dot: string; line: string; label: string }> = {
  done:    { dot: '#10b981', line: '#10b981', label: 'white' },
  active:  { dot: '#f0b90b', line: '#1e2130', label: 'white' },
  pending: { dot: '#1e2130', line: '#1e2130', label: '#4b5563' },
  error:   { dot: '#ef4444', line: '#1e2130', label: '#ef4444' },
};

// ── Single Step Component ─────────────────────────────────────────────────────
function Step({ step, isLast }: { step: TimelineStep; isLast: boolean }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const StepIcon = step.state === 'error' ? XCircle : step.icon;
  const colors = STATE_COLORS[step.state];

  useEffect(() => {
    if (step.state !== 'active') return;
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.25, duration: 800, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [step.state]);

  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      {/* Left: dot + line */}
      <View style={{ alignItems: 'center', width: 36 }}>
        {/* Outer pulse ring for active */}
        {step.state === 'active' && (
          <Animated.View style={{
            position: 'absolute', top: -4,
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: `${colors.dot}20`,
            transform: [{ scale: pulseAnim }],
          }} />
        )}
        {/* Dot */}
        <View style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: step.state === 'pending' ? '#131722' : `${colors.dot}20`,
          borderWidth: 2,
          borderColor: colors.dot,
          alignItems: 'center', justifyContent: 'center',
          zIndex: 1,
        }}>
          <StepIcon
            size={16}
            color={step.state === 'pending' ? '#374151' : colors.dot}
          />
        </View>
        {/* Vertical line */}
        {!isLast && (
          <View style={{
            width: 2, flex: 1, marginTop: 4,
            backgroundColor: step.state === 'done' ? '#10b981' : '#1e2130',
            minHeight: 32,
          }} />
        )}
      </View>

      {/* Right: content */}
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 24, paddingTop: 6 }}>
        <Text style={{
          color: colors.label,
          fontWeight: step.state === 'active' ? '800' : '600',
          fontSize: step.state === 'active' ? 15 : 14,
        }}>
          {step.label}
        </Text>
        {step.sublabel && (
          <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 2, lineHeight: 18 }}>
            {step.sublabel}
          </Text>
        )}
        {step.timestamp && (
          <View style={{
            marginTop: 6, alignSelf: 'flex-start',
            backgroundColor: step.state === 'done' ? 'rgba(16,185,129,0.08)' : 'rgba(107,114,128,0.08)',
            borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
          }}>
            <Text style={{
              color: step.state === 'done' ? '#10b981' : '#6b7280',
              fontSize: 10, fontWeight: '600',
            }}>
              🕐 {step.timestamp}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function OrderTimeline({ steps }: OrderTimelineProps) {
  return (
    <View style={{
      backgroundColor: '#131722',
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: '#1e2130',
    }}>
      <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 20 }}>
        TIẾN TRÌNH ĐƠN HÀNG
      </Text>
      {steps.map((step, i) => (
        <Step key={step.id} step={step} isLast={i === steps.length - 1} />
      ))}
    </View>
  );
}

// ── Builder Helper ────────────────────────────────────────────────────────────
export function buildTimelineSteps(
  status: string,
  order: any,
): TimelineStep[] {
  const fmt = (d?: string) =>
    d ? new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : undefined;

  const isDone = (s: string) => {
    const order: Record<string, number> = {
      UNPAID: 0, PENDING: 1, ONCHAIN_CONFIRMED: 2, DELIVERING: 3, COMPLETED: 5,
    };
    const curIdx = order[status] ?? -1;
    const stepIdx = order[s] ?? -1;
    return stepIdx < curIdx;
  };
  const isCurrent = (s: string) => status === s;
  const stepState = (s: string): StepState => {
    if (status === 'CANCELLED' || status === 'DISPUTED') {
      return isDone(s) ? 'done' : isCurrent(s) ? 'error' : 'pending';
    }
    if (isDone(s)) return 'done';
    if (isCurrent(s)) return 'active';
    return 'pending';
  };

  const steps: TimelineStep[] = [
    {
      id: 'placed',
      label: 'Đặt hàng thành công',
      sublabel: `${order?.product_name ?? 'Sản phẩm'} × ${order?.quantity ?? 1}`,
      timestamp: fmt(order?.created_at),
      state: 'done', // always done if order exists
      icon: ShoppingCart,
      color: '#10b981',
    },
    {
      id: 'paid',
      label: 'Thanh toán Escrow',
      sublabel: status === 'UNPAID'
        ? 'Đang chờ thanh toán qua ví Web3'
        : order?.amount_token && order?.token_symbol
          ? `${Number(order.amount_token).toFixed(6)} ${order.token_symbol}`
          : `$${Number(order?.price_usd ?? 0).toFixed(2)} USDT`,
      timestamp: status !== 'UNPAID' ? fmt(order?.updated_at) : undefined,
      state: status === 'UNPAID' ? 'active' : 'done',
      icon: CreditCard,
      color: '#3b82f6',
    },
    {
      id: 'confirmed',
      label: 'Seller xác nhận & đóng gói',
      sublabel: stepState('ONCHAIN_CONFIRMED') === 'done'
        ? 'Seller đã xác nhận đơn hàng trên blockchain'
        : stepState('ONCHAIN_CONFIRMED') === 'active'
          ? 'Seller đang chuẩn bị hàng...'
          : 'Chờ Seller xác nhận',
      state: stepState('ONCHAIN_CONFIRMED'),
      icon: Package,
      color: '#8b5cf6',
    },
    {
      id: 'delivering',
      label: 'Đang vận chuyển',
      sublabel: stepState('DELIVERING') === 'active'
        ? order?.tracking_number
          ? `${order.shipping_carrier ?? 'Vận chuyển'}: ${order.tracking_number}`
          : 'Hàng đang trên đường đến bạn'
        : stepState('DELIVERING') === 'done'
          ? 'Đã giao thành công'
          : 'Chờ bàn giao cho đơn vị vận chuyển',
      state: stepState('DELIVERING'),
      icon: Truck,
      color: '#06b6d4',
    },
  ];

  // NFC Verify step — chỉ hiện nếu đơn hàng có NFT
  if (order?.has_nft) {
    steps.push({
      id: 'nfc',
      label: 'Xác thực NFC/QR vật phẩm',
      sublabel: order?.nfc_verified
        ? '✓ Sản phẩm đã được xác thực trên blockchain'
        : status === 'DELIVERING'
          ? 'Quét mã QR/NFC trên sản phẩm để xác thực'
          : 'Xác thực vật phẩm thực với NFT',
      timestamp: order?.nfc_verified ? fmt(order?.updated_at) : undefined,
      state: order?.nfc_verified ? 'done' : stepState('DELIVERING') === 'active' ? 'active' : 'pending',
      icon: ScanLine,
      color: '#a78bfa',
    });
  }

  // Final step
  const isCancelled = status === 'CANCELLED';
  const isDisputed = status === 'DISPUTED';
  steps.push({
    id: 'done',
    label: isCancelled ? 'Đơn hàng đã huỷ' : isDisputed ? 'Đang trong quá trình tranh chấp' : 'Hoàn tất & Nhận hàng',
    sublabel: isCancelled
      ? 'Tiền đã được hoàn trả từ Escrow'
      : isDisputed
        ? 'Đội ngũ hỗ trợ đang xem xét khiếu nại'
        : status === 'COMPLETED'
          ? 'Cảm ơn bạn! Credit Score đã được cập nhật'
          : 'Xác nhận nhận hàng để hoàn tất',
    timestamp: status === 'COMPLETED' ? fmt(order?.updated_at) : undefined,
    state: isCancelled || isDisputed
      ? 'error'
      : status === 'COMPLETED' ? 'done' : 'pending',
    icon: isCancelled || isDisputed ? AlertTriangle : CheckCircle,
    color: isCancelled || isDisputed ? '#ef4444' : '#10b981',
  });

  return steps;
}
