import { apiClient } from './client';

export const adminApi = {
    // Dashboard
    dashboard: () => apiClient.get('/api/admin/dashboard'),

    // Orders
    orders: {
        list: (params?: { page?: number; limit?: number; status?: string; search?: string; payment_method?: string }) =>
            apiClient.get('/api/admin/orders', { params }),
        getById: (id: number) => apiClient.get(`/api/admin/orders/${id}`),
        updateStatus: (id: number, status: string, notes?: string) =>
            apiClient.patch(`/api/admin/orders/${id}/status`, { status, notes }),
        // On-chain dispute resolution — uses ADMIN_PRIVATE_KEY on server (no MetaMask needed)
        resolveDispute: (id: number, winner: 'BUYER' | 'SELLER', notes?: string) =>
            apiClient.post(`/api/admin/orders/${id}/resolve-dispute`, { winner, notes }),
    },

    // Users
    users: {
        list: (params?: { page?: number; limit?: number; role?: string; status?: string; search?: string }) =>
            apiClient.get('/api/admin/users', { params }),
        updateStatus: (id: number, status: string) =>
            apiClient.patch(`/api/admin/users/${id}/status`, { status }),
        updateRole: (id: number, role: string) =>
            apiClient.patch(`/api/admin/users/${id}/role`, { role }),
    },

    // Disputes
    disputes: {
        list: (params?: { page?: number; limit?: number; status?: string }) =>
            apiClient.get('/api/admin/disputes', { params }),
        resolve: (id: number, resolution: string, status: 'resolved' | 'closed') =>
            apiClient.patch(`/api/admin/disputes/${id}/resolve`, { resolution, status }),
    },

    // Refunds
    refunds: {
        list: (params?: { page?: number; limit?: number; status?: string }) =>
            apiClient.get('/api/admin/refunds', { params }),
        initiate: (order_id: number, reason: string) =>
            apiClient.post('/api/admin/refunds', { order_id, reason }),
        updateStatus: (id: number, status: string, tx_hash?: string) =>
            apiClient.patch(`/api/admin/refunds/${id}/status`, { status, tx_hash }),
    },

    // Products
    products: {
        list: (params?: { page?: number; limit?: number; status?: string; search?: string }) =>
            apiClient.get('/api/admin/products', { params }),
        updateStatus: (id: number, status: string) =>
            apiClient.patch(`/api/admin/products/${id}/status`, { status }),
    },

    // Tokens
    tokens: {
        list: () => apiClient.get('/api/admin/tokens'),
        update: (id: number, is_active: boolean) =>
            apiClient.patch(`/api/admin/tokens/${id}`, { is_active }),
    },

    // Audit Logs
    auditLogs: (params?: { page?: number; limit?: number; entity_type?: string }) =>
        apiClient.get('/api/admin/audit-logs', { params }),

    // Escrow
    escrow: {
        orders: () => apiClient.get('/api/admin/escrow/orders'),
    },
};
