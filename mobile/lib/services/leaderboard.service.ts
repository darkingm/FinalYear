/**
 * Leaderboard + Installment services
 */
import { apiClient } from '../api/client';
import { safeCall } from '../utils/api';
import { cache } from '../utils/cache';
import type { LeaderboardData, InstallmentPlan } from '../types';

// ─── Leaderboard ──────────────────────────────────────────────────────────────
export const leaderboardService = {
  async get(limit = 50) {
    return safeCall(
      () => cache.getOrFetch(
        `leaderboard:${limit}`,
        async () => {
          const res = await apiClient.get(`/api/credit/leaderboard?limit=${limit}`);
          return res.data as LeaderboardData;
        },
        5 * 60 * 1000, // 5 min cache
      ),
      { tag: 'leaderboardService.get', fallback: undefined },
    );
  },
};

// ─── Installment ──────────────────────────────────────────────────────────────
export const installmentService = {
  /** Check eligibility and get plan for an order */
  async getPlan(orderId: number) {
    return safeCall(async () => {
      const res = await apiClient.get(`/api/orders/${orderId}/installment`);
      return res.data as InstallmentPlan;
    }, { tag: 'installmentService.getPlan', fallback: undefined });
  },

  /** Create installment plan */
  async createPlan(orderId: number) {
    return safeCall(
      () => apiClient.post(`/api/orders/${orderId}/installment`),
      { tag: 'installmentService.createPlan' },
    );
  },

  /** Pay a specific installment kỳ */
  async payKy(planId: number, kyNumber: number) {
    return safeCall(
      () => apiClient.post(`/api/installment/${planId}/pay`, { ky_number: kyNumber }),
      { tag: 'installmentService.payKy' },
    );
  },
};
