'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { apiClient } from '@/lib/api/client';

export type CreditTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND';

export interface CreditScoreData {
  score: number;
  tier: CreditTier;
  completedOrders: number;
  disputeCount: number;
  platformFee: number;          // basis points e.g. 250 = 2.5%
  platformFeePercent: string;   // "2.50%"
  canInstallment: boolean;
  canPriorityList: boolean;
  sbtTokenId?: number | null;
  walletAddress?: string;
  lastUpdated?: string;
  loading: boolean;
  error: string | null;
}

const TIER_CONFIG: Record<CreditTier, { fee: number; color: string; emoji: string; label: string; minScore: number }> = {
  BRONZE:  { fee: 250, color: '#cd7f32', emoji: '🥉', label: 'Bronze',  minScore: 0   },
  SILVER:  { fee: 200, color: '#9ca3af', emoji: '🥈', label: 'Silver',  minScore: 100 },
  GOLD:    { fee: 150, color: '#f0b90b', emoji: '🥇', label: 'Gold',    minScore: 300 },
  DIAMOND: { fee: 100, color: '#7dd3fc', emoji: '💎', label: 'Diamond', minScore: 600 },
};

export function getTierConfig(tier: CreditTier) {
  return TIER_CONFIG[tier] ?? TIER_CONFIG.BRONZE;
}

export function computeTier(score: number): CreditTier {
  if (score >= 600) return 'DIAMOND';
  if (score >= 300) return 'GOLD';
  if (score >= 100) return 'SILVER';
  return 'BRONZE';
}

export function useCreditScore() {
  const { address, isConnected } = useAccount();
  const [data, setData] = useState<CreditScoreData>({
    score: 0,
    tier: 'BRONZE',
    completedOrders: 0,
    disputeCount: 0,
    platformFee: 250,
    platformFeePercent: '2.50%',
    canInstallment: false,
    canPriorityList: false,
    loading: false,
    error: null,
  });

  const fetchScore = useCallback(async () => {
    if (!isConnected || !address) return;
    setData(prev => ({ ...prev, loading: true, error: null }));
    try {
      // Use existing /api/nft/credit/:wallet endpoint
      const res = await apiClient.get(`/api/nft/credit/${address}`);
      const d = res.data?.data ?? res.data;
      const score = Number(d?.score ?? 0);
      const tier = (d?.tier as CreditTier) ?? computeTier(score);
      const cfg = TIER_CONFIG[tier];
      setData({
        score,
        tier,
        completedOrders: Number(d?.completed_orders ?? d?.completedOrders ?? 0),
        disputeCount: Number(d?.dispute_count ?? d?.disputeCount ?? 0),
        platformFee: cfg.fee,
        platformFeePercent: (cfg.fee / 100).toFixed(2) + '%',
        canInstallment: tier === 'GOLD' || tier === 'DIAMOND',
        canPriorityList: tier === 'GOLD' || tier === 'DIAMOND',
        sbtTokenId: d?.sbt_token_id ?? null,
        walletAddress: address,
        lastUpdated: d?.last_updated ?? d?.lastUpdated,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      // No score yet (new user) — default BRONZE
      setData(prev => ({
        ...prev,
        loading: false,
        error: null, // not an error, just unregistered
        walletAddress: address,
      }));
    }
  }, [address, isConnected]);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  return { ...data, refetch: fetchScore, tierConfig: getTierConfig(data.tier) };
}
