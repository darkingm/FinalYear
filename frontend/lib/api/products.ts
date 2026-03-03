import { apiClient } from './client';

export interface ProductListParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  payment_crypto?: boolean;
  payment_paypal?: boolean;
}

export const productsApi = {
  list: (params?: ProductListParams) =>
    apiClient.get('/api/products', { params }),
  getById: (id: number) => apiClient.get(`/api/products/${id}`),
  create: (data: FormData) =>
    apiClient.post('/api/products', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id: number, data: FormData) =>
    apiClient.put(`/api/products/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id: number) => apiClient.delete(`/api/products/${id}`),
};
