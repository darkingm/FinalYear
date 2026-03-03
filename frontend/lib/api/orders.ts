import { apiClient } from './client';

export interface CreateOrderPayload {
  product_id: number;
  quantity: number;
  payment_method?: 'crypto' | 'paypal';
}

export const ordersApi = {
  list: (params?: { page?: number; limit?: number }) =>
    apiClient.get('/api/orders', { params }),
  getById: (id: number) => apiClient.get(`/api/orders/${id}`),
  getByInternalId: (internalOrderId: string) =>
    apiClient.get(`/api/orders/internal/${internalOrderId}`),
  create: (data: CreateOrderPayload) => apiClient.post('/api/orders', data),
  cancel: (id: number) => apiClient.post(`/api/orders/${id}/cancel`),
};
