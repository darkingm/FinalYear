/**
 * FraudScoreBadge — compact badge showing fraud risk level.
 * Used in Order Detail (admin view) and Seller dashboard.
 */
import { View, Text, Pressable } from 'react-native';
import { ShieldCheck, ShieldAlert, ShieldX, Shield } from 'lucide-react-native';
import type { FraudRiskLevel } from '../../lib/types';

interface FraudScoreBadgeProps {
  risk_level: FraudRiskLevel;
  score: number;
  flags?: string[];
  compact?: boolean;
  onPress?: () => void;
}

const RISK_CONFIG: Record<FraudRiskLevel, {
  color: string; bg: string; border: string;
  label: string; Icon: any;
}> = {
  LOW:      { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)',  label: 'Rủi ro thấp',   Icon: ShieldCheck },
  MEDIUM:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)',  label: 'Rủi ro trung',  Icon: Shield },
  HIGH:     { color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.25)',  label: 'Rủi ro cao',    Icon: ShieldAlert },
  CRITICAL: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',   label: 'NGUY HIỂM',     Icon: ShieldX },
};

export function FraudScoreBadge({ risk_level, score, flags, compact = false, onPress }: FraudScoreBadgeProps) {
  const cfg = RISK_CONFIG[risk_level];

  if (compact) return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: cfg.bg, borderRadius: 8, borderWidth: 1,
        borderColor: cfg.border, paddingHorizontal: 8, paddingVertical: 4,
      }}
    >
      <cfg.Icon size={12} color={cfg.color} />
      <Text style={{ color: cfg.color, fontSize: 10, fontWeight: '700' }}>
        {cfg.label} ({score})
      </Text>
    </Pressable>
  );

  return (
    <View style={{
      backgroundColor: cfg.bg, borderRadius: 14, borderWidth: 1,
      borderColor: cfg.border, padding: 14, gap: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <cfg.Icon size={22} color={cfg.color} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: cfg.color, fontWeight: '800', fontSize: 15 }}>
            🤖 AI Fraud Score: {score}/100
          </Text>
          <Text style={{ color: cfg.color, fontSize: 12 }}>{cfg.label}</Text>
        </View>
      </View>

      {flags && flags.length > 0 && (
        <View style={{ gap: 4 }}>
          {flags.map((flag, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
              <Text style={{ color: cfg.color, fontSize: 12, marginTop: 1 }}>⚠</Text>
              <Text style={{ color: '#9ca3af', fontSize: 12, flex: 1, lineHeight: 18 }}>{flag}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
