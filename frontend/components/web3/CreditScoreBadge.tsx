'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useCreditScore, type CreditTier, getTierConfig } from '@/lib/hooks/useCreditScore';
import { useAccount } from 'wagmi';
import { Shield, TrendingUp, Award, Zap, ChevronRight, RefreshCw, Info } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// ─────────────────────────────────────────────────────────────
// Tier progress bar
// ─────────────────────────────────────────────────────────────
const TIER_THRESHOLDS: Record<CreditTier, { next: number; label: string }> = {
  BRONZE:  { next: 100, label: 'Silver' },
  SILVER:  { next: 300, label: 'Gold' },
  GOLD:    { next: 600, label: 'Diamond' },
  DIAMOND: { next: 600, label: 'Max' },
};

function TierProgressBar({ score, tier }: { score: number; tier: CreditTier }) {
  const cfg = TIER_THRESHOLDS[tier];
  const prev = tier === 'BRONZE' ? 0 : tier === 'SILVER' ? 100 : tier === 'GOLD' ? 300 : 600;
  const progress = tier === 'DIAMOND' ? 100 : Math.min(100, ((score - prev) / (cfg.next - prev)) * 100);
  const tierCfg = getTierConfig(tier);

  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
        <span className="font-medium">Điểm hiện tại: <span style={{ color: tierCfg.color }} className="font-bold">{score}</span></span>
        {tier !== 'DIAMOND' && (
          <span>Cần {cfg.next - score} điểm → {cfg.label}</span>
        )}
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${tierCfg.color}80, ${tierCfg.color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Score item row
// ─────────────────────────────────────────────────────────────
function ScoreRow({ icon, label, value, color = 'text-foreground' }: {
  icon: React.ReactNode; label: string; value: string | number; color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="w-4 h-4 flex items-center justify-center">{icon}</span>
        {label}
      </div>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main CreditScoreBadge component
// ─────────────────────────────────────────────────────────────
interface CreditScoreBadgeProps {
  variant?: 'compact' | 'full' | 'mini';
  className?: string;
}

export function CreditScoreBadge({ variant = 'full', className = '' }: CreditScoreBadgeProps) {
  const { isConnected } = useAccount();
  const { score, tier, completedOrders, disputeCount, platformFeePercent,
    canInstallment, canPriorityList, sbtTokenId, loading, refetch, tierConfig } = useCreditScore();
  const [showInfo, setShowInfo] = useState(false);

  if (!isConnected) {
    if (variant === 'mini') return null;
    return (
      <div className={`bg-card border border-border rounded-2xl p-5 text-center ${className}`}>
        <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Kết nối ví để xem Credit Score</p>
      </div>
    );
  }

  // Mini badge (for header/profile avatar)
  if (variant === 'mini') {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border"
        style={{
          color: tierConfig.color,
          borderColor: `${tierConfig.color}40`,
          backgroundColor: `${tierConfig.color}15`,
        }}
        title={`Credit Score: ${score} — ${tierConfig.label}`}
      >
        {tierConfig.emoji} {tierConfig.label}
      </span>
    );
  }

  // Compact card
  if (variant === 'compact') {
    return (
      <div className={`bg-card border border-border rounded-2xl p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{tierConfig.emoji}</span>
            <div>
              <p className="text-xs text-muted-foreground">Credit Score</p>
              <p className="font-bold text-foreground" style={{ color: tierConfig.color }}>{score} pts</p>
            </div>
          </div>
          <span
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ color: tierConfig.color, backgroundColor: `${tierConfig.color}20` }}
          >
            {tierConfig.label}
          </span>
        </div>
        <TierProgressBar score={score} tier={tier} />
        <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
          <Shield className="w-3 h-3" />
          Phí nền tảng: <span className="text-foreground font-bold ml-1">{platformFeePercent}</span>
        </div>
      </div>
    );
  }

  // Full card
  return (
    <div className={`bg-card border border-border rounded-3xl overflow-hidden ${className}`}>
      {/* Header */}
      <div
        className="relative p-6 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${tierConfig.color}20 0%, ${tierConfig.color}08 100%)`,
          borderBottom: `1px solid ${tierConfig.color}30`,
        }}
      >
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20"
          style={{ background: tierConfig.color, transform: 'translate(30%, -30%)' }} />

        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shadow-lg"
              style={{ background: `${tierConfig.color}20`, border: `2px solid ${tierConfig.color}40` }}
            >
              {tierConfig.emoji}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Web3Market Credit</p>
              <h3 className="text-2xl font-black" style={{ color: tierConfig.color }}>{tierConfig.label}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {sbtTokenId ? `SBT #${sbtTokenId}` : 'Chưa mint SBT'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black text-foreground">{loading ? '...' : score}</p>
            <p className="text-xs text-muted-foreground">điểm tín dụng</p>
            <button
              onClick={refetch}
              disabled={loading}
              className="mt-1 p-1 rounded-lg hover:bg-muted transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <TierProgressBar score={score} tier={tier} />
      </div>

      {/* Stats */}
      <div className="p-6">
        <div className="mb-5">
          <ScoreRow
            icon={<Award className="w-4 h-4 text-emerald-500" />}
            label="Đơn hoàn thành"
            value={completedOrders}
            color="text-emerald-500"
          />
          <ScoreRow
            icon={<TrendingUp className="w-4 h-4 text-red-400" />}
            label="Tranh chấp"
            value={disputeCount}
            color={disputeCount > 0 ? 'text-red-400' : 'text-muted-foreground'}
          />
          <ScoreRow
            icon={<Zap className="w-4 h-4 text-[#f0b90b]" />}
            label="Phí nền tảng"
            value={platformFeePercent}
            color="text-[#f0b90b]"
          />
        </div>

        {/* Privileges */}
        <div className="space-y-2 mb-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Đặc quyền</p>
          {[
            { label: 'Mua trả góp', enabled: canInstallment, tier: 'GOLD' },
            { label: 'Ưu tiên hiển thị sản phẩm', enabled: canPriorityList, tier: 'GOLD' },
            { label: 'Phí ưu đãi tối đa (1.0%)', enabled: tier === 'DIAMOND', tier: 'DIAMOND' },
          ].map(priv => (
            <div
              key={priv.label}
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm ${
                priv.enabled
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-muted border border-border text-muted-foreground'
              }`}
            >
              <span>{priv.label}</span>
              {priv.enabled ? (
                <span className="text-xs font-bold">✓ Đã mở</span>
              ) : (
                <span className="text-xs text-muted-foreground">🔒 {priv.tier}+</span>
              )}
            </div>
          ))}
        </div>

        {/* How to earn */}
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors px-1 mb-3"
        >
          <span className="flex items-center gap-1"><Info className="w-3.5 h-3.5" /> Cách tăng điểm</span>
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showInfo ? 'rotate-90' : ''}`} />
        </button>

        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-muted/50 rounded-xl p-4 text-xs space-y-1.5 text-muted-foreground mb-3">
                <p className="text-emerald-400 font-bold">+15 điểm</p>
                <p className="text-muted-foreground mb-2">Hoàn thành đơn hàng (không tranh chấp)</p>
                <p className="text-emerald-400 font-bold">+5 điểm</p>
                <p className="text-muted-foreground mb-2">Thanh toán đúng hạn (&lt;1 giờ)</p>
                <p className="text-emerald-400 font-bold">+3 điểm</p>
                <p className="text-muted-foreground mb-2">Đánh giá 5 sao cho đơn hàng</p>
                <p className="text-red-400 font-bold">-30 điểm</p>
                <p className="text-muted-foreground mb-2">Mở tranh chấp</p>
                <p className="text-red-400 font-bold">-50 điểm</p>
                <p className="text-muted-foreground">Bị flag gian lận</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Link href="/profile/credit">
          <button
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
            style={{
              background: `${tierConfig.color}20`,
              color: tierConfig.color,
              border: `1px solid ${tierConfig.color}40`,
            }}
          >
            Xem lịch sử điểm <ChevronRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </div>
  );
}
