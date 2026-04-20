import { apiClient } from './client';
import { publicRequestConfig } from './request-auth';

export const rwaApi = {
    assets: {
        list: () => apiClient.get('/api/rwa/assets', publicRequestConfig),
        get: (id: string) => apiClient.get(`/api/rwa/assets/${id}`, publicRequestConfig),
        create: (data: any) => apiClient.post('/api/rwa/assets', data),
        updateStatus: (id: string, status: string) => apiClient.patch(`/api/rwa/assets/${id}/status`, { status }),
    },
    kyc: {
        grant: (wallet: string, userId?: number, jurisdiction?: string) =>
            apiClient.post('/api/rwa/kyc/grant', { wallet_address: wallet, user_id: userId, jurisdiction }),
        revoke: (wallet: string) => apiClient.post('/api/rwa/kyc/revoke', { wallet_address: wallet }),
        status: (wallet: string) => apiClient.get(`/api/rwa/kyc/status/${wallet}`, publicRequestConfig),
    },
    profit: {
        deposit: (assetId: string, amountEth: string, description?: string) =>
            apiClient.post(`/api/rwa/profit/${assetId}/deposit`, { amount_eth: amountEth, description }),
        history: (assetId: string) => apiClient.get(`/api/rwa/profit/${assetId}/history`, publicRequestConfig),
        stats: (assetId: string) => apiClient.get(`/api/rwa/profit/${assetId}/stats`, publicRequestConfig),
    },
    portfolio: {
        get: (userId: number) => apiClient.get(`/api/rwa/portfolio/${userId}`),
        pending: (assetId: string, wallet: string) => apiClient.get(`/api/rwa/portfolio/${assetId}/pending/${wallet}`),
        purchase: (data: { asset_id: string; user_id: number; wallet_address: string; token_amount: number; cost_usd: number; idempotency_key?: string }) =>
            apiClient.post('/api/rwa/portfolio/purchase', data),
    },
    holders: {
        list: (assetId: string, limit = 20) => apiClient.get(`/api/rwa/holders/${assetId}/holders?limit=${limit}`, publicRequestConfig),
        concentration: (assetId: string) => apiClient.get(`/api/rwa/holders/${assetId}/concentration`, publicRequestConfig),
    },
    governance: {
        proposals: (assetId: string, status?: string) =>
            apiClient.get(`/api/rwa/governance/${assetId}/proposals${status ? `?status=${status}` : ''}`, publicRequestConfig),
        proposalDetail: (proposalId: number) =>
            apiClient.get(`/api/rwa/governance/proposals/${proposalId}`, publicRequestConfig),
        createProposal: (assetId: string, data: any) =>
            apiClient.post(`/api/rwa/governance/${assetId}/proposals`, data),
        vote: (proposalId: number, data: { voter_address: string; support: boolean; weight: number; tx_hash?: string }) =>
            apiClient.post(`/api/rwa/governance/proposals/${proposalId}/vote`, data),
        execute: (proposalId: number, data?: { execute_tx_hash?: string }) =>
            apiClient.post(`/api/rwa/governance/proposals/${proposalId}/execute`, data || {}),
    },
    buyout: {
        list: (assetId: string) => apiClient.get(`/api/rwa/buyout/${assetId}/proposals`, publicRequestConfig),
        detail: (id: number) => apiClient.get(`/api/rwa/buyout/detail/${id}`, publicRequestConfig),
        propose: (assetId: string, data: any) => apiClient.post(`/api/rwa/buyout/${assetId}/propose`, data),
        updateStatus: (id: number, data: any) => apiClient.patch(`/api/rwa/buyout/${id}/status`, data),
        claim: (id: number, data: any) => apiClient.post(`/api/rwa/buyout/${id}/claim`, data),
    },
    market: {
        listings: (assetId: string, status?: string) =>
            apiClient.get(`/api/rwa/market/${assetId}/listings${status ? `?status=${status}` : ''}`, publicRequestConfig),
        trades: (assetId: string) => apiClient.get(`/api/rwa/market/${assetId}/trades`, publicRequestConfig),
        createListing: (assetId: string, data: any) => apiClient.post(`/api/rwa/market/${assetId}/list`, data),
        cancelListing: (id: number) => apiClient.patch(`/api/rwa/market/listings/${id}/cancel`, {}),
        buy: (listingId: number, data: any) => apiClient.post(`/api/rwa/market/listings/${listingId}/buy`, data),
    },
};
