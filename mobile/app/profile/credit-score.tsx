import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, Animated, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../lib/store/auth-store';
import { apiClient } from '../../lib/api/client';
import {
  Award, Star, Shield, TrendingUp, TrendingDown, Zap,
  ExternalLink, ChevronRight, Package, AlertTriangle, Crown,
} from 'lucide-react-native';

// ── Types ────────────────────────────────────────────────────────────────────
interface CreditInfo {
  score: number;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND';
  tierIndex: number;
  hasSBT: boolean;
  tierFee: number;
  canInstallment: boolean;
  openSeaUrl: string | null;
  completedOrders?: number;
  disputeCount?: number;
}

// ── Tier Config ──────────────────────────────────────────────────────────────
const TIER_CONFIG = {
  BRONZE:  { colors: ['#92400e','#b45309'] as const, icon: Award,  glow: '#b45309', label: 'Đồng', next: 100, desc: 'Mới bắt đầu' },
  SILVER:  { colors: ['#6b7280','#9ca3af'] as const, icon: Star,   glow: '#9ca3af', label: 'Bạc',  next: 300, desc: 'Giảm phí 0.5%' },
  GOLD:    { colors: ['#b45309','#f0b90b'] as const, icon: Crown,  glow: '#f0b90b', label: 'Vàng', next: 600, desc: 'Trả góp + Giảm phí 1%' },
  DIAMOND: { colors: ['#6d28d9','#a78bfa'] as const, icon: Zap,    glow: '#a78bfa', label: 'Kim cương', next: null, desc: 'VIP - Mọi đặc quyền' },
};

const SCORE_MILESTONES = [
  { score: 0,   label: 'Đồng',       color: '#b45309' },
  { score: 100, label: 'Bạc',        color: '#9ca3af' },
  { score: 300, label: 'Vàng',       color: '#f0b90b' },
  { score: 600, label: 'Kim cương',  color: '#a78bfa' },
];

// ── Component ────────────────────────────────────────────────────────────────
export default function CreditScoreScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Animations
  const scoreAnim  = useRef(new Animated.Value(0)).current;
  const glowAnim   = useRef(new Animated.Value(0)).current;
  const cardScale  = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    loadCreditInfo();
  }, []);

  const loadCreditInfo = async () => {
    setLoading(true);
    setError('');
    try {
      const wallet = user?.wallet_address;
      if (!wallet) {
        setCreditInfo({ score: 0, tier: 'BRONZE', tierIndex: 0, hasSBT: false, tierFee: 2.5, canInstallment: false, openSeaUrl: null });
        return;
      }
      const res = await apiClient.get(`/api/nft/credit/${wallet}`);
      setCreditInfo(res.data.data);
      animateIn(res.data.data.score);
    } catch (e: any) {
      setError('Không thể tải điểm tín dụng');
    } finally {
      setLoading(false);
    }
  };

  const animateIn = (targetScore: number) => {
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.timing(scoreAnim, { toValue: Math.min(targetScore, 600), duration: 1500, useNativeDriver: false }),
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 1800, useNativeDriver: false }),
      ])),
    ]).start();
  };

  const tier = creditInfo ? TIER_CONFIG[creditInfo.tier] : TIER_CONFIG.BRONZE;
  const TierIcon = tier.icon;
  const nextScore = tier.next ?? 600;
  const progress = creditInfo ? Math.min((creditInfo.score / nextScore) * 100, 100) : 0;

  // ┌────────────────────────────────────┐
  // │ RENDER                              │
  // └────────────────────────────────────┘
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
          <Shield size={22} color="#f0b90b" style={{ marginRight: 10 }} />
          <Text style={{ color: 'white', fontSize: 22, fontWeight: '800' }}>Credit Score</Text>
        </View>

        {loading ? (
          <View style={{ paddingTop: 100, alignItems: 'center' }}>
            <ActivityIndicator color="#f0b90b" size="large" />
            <Text style={{ color: '#6b7280', marginTop: 12 }}>Đang tải dữ liệu on-chain...</Text>
          </View>
        ) : error ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 60, alignItems: 'center' }}>
            <AlertTriangle size={48} color="#ef4444" />
            <Text style={{ color: '#ef4444', marginTop: 12, textAlign: 'center' }}>{error}</Text>
            <Pressable onPress={loadCreditInfo} style={{ marginTop: 20, backgroundColor: '#1e2130', borderRadius: 12, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: '#f0b90b', fontWeight: '700' }}>Thử lại</Text>
            </Pressable>
          </View>
        ) : creditInfo && (
          <>
            {/* SBT Card — main hero */}
            <Animated.View style={{ marginHorizontal: 16, transform: [{ scale: cardScale }] }}>
              <LinearGradient
                colors={tier.colors}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ borderRadius: 24, padding: 24, marginVertical: 8 }}
              >
                {/* Tier badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TierIcon size={28} color="white" />
                    <View>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' }}>HẠNG</Text>
                      <Text style={{ color: 'white', fontSize: 20, fontWeight: '900' }}>{tier.label.toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>ĐIỂM UY TÍN</Text>
                    <Text style={{ color: 'white', fontSize: 38, fontWeight: '900', lineHeight: 44 }}>{creditInfo.score}</Text>
                  </View>
                </View>

                {/* Progress bar to next tier */}
                {tier.next && (
                  <View style={{ marginTop: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>{creditInfo.score} điểm</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
                        {tier.next - creditInfo.score} điểm nữa lên cấp
                      </Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3 }}>
                      <View style={{ width: `${progress}%`, height: '100%', backgroundColor: 'white', borderRadius: 3 }} />
                    </View>
                  </View>
                )}

                {/* SBT info */}
                <View style={{ marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>
                      {creditInfo.hasSBT ? '✓ Soulbound NFT (ERC-5192)' : 'Chưa có SBT'}
                    </Text>
                  </View>
                  {creditInfo.openSeaUrl && (
                    <Pressable onPress={() => Linking.openURL(creditInfo.openSeaUrl!)} style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <ExternalLink size={10} color="white" />
                      <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>OpenSea</Text>
                    </Pressable>
                  )}
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Tier Roadmap */}
            <View style={{ marginHorizontal: 16, marginTop: 16 }}>
              <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', marginBottom: 12 }}>LỘ TRÌNH HẠNG</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                {SCORE_MILESTONES.map((m, i) => {
                  const reached = creditInfo.score >= m.score;
                  return (
                    <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                      <View style={{
                        width: 36, height: 36, borderRadius: 18,
                        backgroundColor: reached ? m.color : '#1e2130',
                        borderWidth: 2, borderColor: reached ? m.color : '#374151',
                        alignItems: 'center', justifyContent: 'center',
                        marginBottom: 6,
                      }}>
                        <Text style={{ color: reached ? 'black' : '#6b7280', fontSize: 10, fontWeight: '900' }}>{m.score}</Text>
                      </View>
                      <Text style={{ color: reached ? m.color : '#6b7280', fontSize: 9, fontWeight: '700', textAlign: 'center' }}>{m.label}</Text>
                      {i < SCORE_MILESTONES.length - 1 && (
                        <View style={{ position: 'absolute', left: '72%', top: 16, width: '56%', height: 2, backgroundColor: reached ? m.color : '#1e2130' }} />
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Privileges */}
            <View style={{ marginHorizontal: 16, marginTop: 20 }}>
              <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', marginBottom: 10 }}>ĐẶC QUYỀN CỦA BẠN</Text>
              {[
                { label: `Phí sàn ${creditInfo.tierFee}%`, active: true, icon: TrendingDown, desc: 'Phí chuẩn 2.5%' },
                { label: 'Mua trả góp', active: creditInfo.canInstallment, icon: Zap, desc: 'Chỉ từ hạng Vàng' },
                { label: 'Đăng bán ưu tiên', active: creditInfo.tierIndex >= 2, icon: TrendingUp, desc: 'Sản phẩm lên top sớm hơn' },
                { label: 'Vay không thế chấp', active: creditInfo.tierIndex >= 3, icon: Crown, desc: 'Dựa trên điểm uy tín (sắp ra mắt)' },
              ].map((p, i) => {
                const PIcon = p.icon;
                return (
                  <View key={i} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    backgroundColor: p.active ? 'rgba(240,185,11,0.05)' : '#131722',
                    borderWidth: 1, borderColor: p.active ? 'rgba(240,185,11,0.2)' : '#1e2130',
                    borderRadius: 14, padding: 14, marginBottom: 8,
                  }}>
                    <View style={{
                      width: 38, height: 38, borderRadius: 19,
                      backgroundColor: p.active ? 'rgba(240,185,11,0.15)' : '#1e2130',
                      alignItems: 'center', justifyContent: 'center'
                    }}>
                      <PIcon size={18} color={p.active ? '#f0b90b' : '#4b5563'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.active ? 'white' : '#6b7280', fontWeight: '700', fontSize: 14 }}>{p.label}</Text>
                      <Text style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }} numberOfLines={1}>{p.desc}</Text>
                    </View>
                    <View style={{
                      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
                      backgroundColor: p.active ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)'
                    }}>
                      <Text style={{ color: p.active ? '#22c55e' : '#6b7280', fontSize: 10, fontWeight: '700' }}>
                        {p.active ? 'Đang có' : 'Chưa mở khóa'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* How to earn */}
            <View style={{ marginHorizontal: 16, marginTop: 20, backgroundColor: '#131722', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e2130' }}>
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 15, marginBottom: 14 }}>Cách tăng điểm</Text>
              {[
                { delta: '+15', label: 'Hoàn thành đơn hàng không khiếu nại', color: '#22c55e' },
                { delta: '+5',  label: 'Thanh toán trong vòng 1 giờ', color: '#22c55e' },
                { delta: '+3',  label: 'Nhận đánh giá 5 sao từ seller', color: '#22c55e' },
                { delta: '-30', label: 'Mở khiếu nại với seller', color: '#ef4444' },
                { delta: '-50', label: 'Bị phát hiện gian lận', color: '#ef4444' },
              ].map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <View style={{
                    width: 44, height: 26, borderRadius: 13,
                    backgroundColor: item.color === '#22c55e' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Text style={{ color: item.color, fontWeight: '900', fontSize: 12 }}>{item.delta}</Text>
                  </View>
                  <Text style={{ color: '#d1d5db', fontSize: 13, flex: 1 }}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* What is SBT */}
            <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: '#131722', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e2130' }}>
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 14, marginBottom: 8 }}>Soulbound Token (SBT) là gì?</Text>
              <Text style={{ color: '#9ca3af', fontSize: 12, lineHeight: 20 }}>
                SBT là NFT không thể chuyển nhượng (ERC-5192) gắn với danh tính của bạn. Nó lưu trữ lịch sử uy tín giao dịch vĩnh viễn trên blockchain Polygon, không thể mua bán hay làm giả.
                {'\n\n'}
                Trong tương lai, điểm SBT có thể dùng để vay USDT không cần tài sản thế chấp — giải quyết bài toán Undercollateralized Loans trong DeFi.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
