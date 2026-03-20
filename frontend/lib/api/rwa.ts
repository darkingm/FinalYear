import { apiClient } from './client';

export const rwaApi = {
    assets: {
        list: () => apiClient.get('/api/rwa/assets'),
        get: (id: string) => apiClient.get(`/api/rwa/assets/${id}`),
        create: (data: any) => apiClient.post('/api/rwa/assets', data),
        updateStatus: (id: string, status: string) => apiClient.patch(`/api/rwa/assets/${id}/status`, { status }),
    },
    kyc: {
        grant: (wallet: string, userId?: number, jurisdiction?: string) =>
            apiClient.post('/api/rwa/kyc/grant', { wallet_address: wallet, user_id: userId, jurisdiction }),
        revoke: (wallet: string) => apiClient.post('/api/rwa/kyc/revoke', { wallet_address: wallet }),
        status: (wallet: string) => apiClient.get(`/api/rwa/kyc/status/${wallet}`),
    },
    profit: {
        deposit: (assetId: string, amountEth: string, description?: string) =>
            apiClient.post(`/api/rwa/profit/${assetId}/deposit`, { amount_eth: amountEth, description }),
        history: (assetId: string) => apiClient.get(`/api/rwa/profit/${assetId}/history`),
        stats: (assetId: string) => apiClient.get(`/api/rwa/profit/${assetId}/stats`),
    },
    portfolio: {
        get: (userId: number) => apiClient.get(`/api/rwa/portfolio/${userId}`),
        pending: (assetId: string, wallet: string) => apiClient.get(`/api/rwa/portfolio/${assetId}/pending/${wallet}`),
        purchase: (data: { asset_id: string; user_id: number; wallet_address: string; token_amount: number; cost_usd: number }) =>
            apiClient.post('/api/rwa/portfolio/purchase', data),
    },
};
