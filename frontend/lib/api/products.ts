import { apiClient } from './client';
import { publicRequestConfig } from './request-auth';
import type { ProductUpsertPayload } from '@/lib/products/types';

export interface ProductListParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  payment_crypto?: boolean;
  payment_paypal?: boolean;
  token_symbol?: string;
}

export const productsApi = {
  list: (params?: ProductListParams) =>
    apiClient.get('/api/products', { params, ...publicRequestConfig }),
  getById: (id: number) => apiClient.get(`/api/products/${id}`, publicRequestConfig),
  create: (data: ProductUpsertPayload) =>
    apiClient.post('/api/products', data),
  update: (id: number, data: ProductUpsertPayload) =>
    apiClient.put(`/api/products/${id}`, data),
  delete: (id: number) => apiClient.delete(`/api/products/${id}`),

  /** Homepage: max 5 per coin, up to 20 total */
  homepage: (coins?: string) =>
    apiClient.get('/api/products/homepage', {
      params: coins ? { coins } : undefined,
      ...publicRequestConfig,
    }),

  /** Coin tab: products filtered by accepted token symbol */
  listByCoin: (symbol: string, limit = 5) =>
    apiClient.get('/api/products', {
      params: { token_symbol: symbol, limit },
      ...publicRequestConfig,
    }),
};
