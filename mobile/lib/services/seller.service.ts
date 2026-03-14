/**
 * Seller Service — seller dashboard, product management, flash sales.
 */
import { apiClient } from '../api/client';
import { safeCall } from '../utils/api';
import { cache } from '../utils/cache';
import type { SellerStats, SellerProduct, FlashSale } from '../types';

const STATS_TTL = 3 * 60 * 1000; // 3 min

export const sellerService = {
  async getStats(period: '1d' | '7d' | '30d' = '7d') {
    return safeCall(
      () => cache.getOrFetch(
        `seller:stats:${period}`,
        async () => {
          const res = await apiClient.get(`/api/seller/stats?period=${period}`);
          return res.data as SellerStats;
        },
        STATS_TTL,
      ),
      { tag: 'sellerService.getStats', fallback: undefined },
    );
  },

  async getProducts(page = 1, status?: string) {
    return safeCall(async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.set('status', status);
      const res = await apiClient.get(`/api/seller/products?${params}`);
      return res.data.products as SellerProduct[];
    }, { tag: 'sellerService.getProducts', fallback: [] as SellerProduct[] });
  },

  async updateStock(productId: number, delta: number, reason?: string) {
    return safeCall(
      () => apiClient.patch(`/api/seller/products/${productId}/stock`, { delta, reason }),
      { tag: 'sellerService.updateStock' },
    );
  },

  async getFlashSales() {
    return safeCall(async () => {
      const res = await apiClient.get('/api/seller/flash-sales');
      return res.data.sales as FlashSale[];
    }, { tag: 'sellerService.getFlashSales', fallback: [] as FlashSale[] });
  },

  async createFlashSale(payload: {
    product_id: number;
    discount_percent: number;
    start_at: string;
    end_at: string;
    quantity_limit: number;
  }) {
    return safeCall(
      () => apiClient.post('/api/seller/flash-sales', payload),
      { tag: 'sellerService.createFlashSale' },
    );
  },

  async cancelFlashSale(saleId: number) {
    return safeCall(
      () => apiClient.delete(`/api/seller/flash-sales/${saleId}`),
      { tag: 'sellerService.cancelFlashSale' },
    );
  },

  async invalidateStats() {
    await cache.clearPrefix('seller:stats:');
  },
};
