import { View, Text } from 'react-native';

interface Props {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_MAP: Record<string, { label: string; color: string; emoji: string }> = {
  UNPAID:            { label: 'Chờ thanh toán', color: '#f59e0b', emoji: '⏳' },
  PENDING:           { label: 'Đang xử lý',     color: '#3b82f6', emoji: '🔄' },
  ONCHAIN_CONFIRMED: { label: 'Đã xác nhận',    color: '#8b5cf6', emoji: '⛓️' },
  DELIVERING:        { label: 'Đang giao hàng', color: '#06b6d4', emoji: '🚚' },
  COMPLETED:         { label: 'Hoàn thành',     color: '#10b981', emoji: '✅' },
  CANCELLED:         { label: 'Đã huỷ',         color: '#ef4444', emoji: '❌' },
  DISPUTED:          { label: 'Tranh chấp',     color: '#f97316', emoji: '⚠️' },
};

export default function OrderStatusBadge({ status, size = 'md' }: Props) {
  const cfg = STATUS_MAP[status] ?? { label: status, color: '#6b7280', emoji: '❓' };
  const isSmall = size === 'sm';

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: isSmall ? 4 : 6,
      paddingHorizontal: isSmall ? 8 : 12,
      paddingVertical: isSmall ? 3 : 6,
      borderRadius: 99,
      backgroundColor: `${cfg.color}18`,
      borderWidth: 1,
      borderColor: `${cfg.color}40`,
      alignSelf: 'flex-start',
    }}>
      <Text style={{ fontSize: isSmall ? 10 : 13 }}>{cfg.emoji}</Text>
      <Text style={{
        color: cfg.color,
        fontWeight: '700',
        fontSize: isSmall ? 10 : 12,
        letterSpacing: 0.2,
      }}>
        {cfg.label}
      </Text>
    </View>
  );
}
