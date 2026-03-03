import { apiClient } from '@/lib/api/client';

export interface Dispute {
    dispute_id: number;
    order_id: number;
    raised_by: number;
    raised_by_name?: string;
    resolver_id?: number;
    resolver_name?: string;
    reason: string;
    reason_type?: string;
    evidence_urls?: string[];
    status: string;
    resolution?: string;
    resolution_type?: string;
    internal_order_id?: string;
    order_status?: string;
    total_usd?: number;
    created_at: string;
    updated_at: string;
    resolved_at?: string;
}

class DisputeService {
    async list(params?: { status?: string; page?: number; limit?: number }) {
        try {
            const res = await apiClient.get('/api/admin/disputes', { params });
            return { disputes: res.data.disputes || [] };
        } catch {
            return { disputes: [] };
        }
    }

    async getById(disputeId: number) {
        const res = await apiClient.get(`/api/admin/disputes`, { params: { dispute_id: disputeId } });
        return res.data;
    }

    async escalate(disputeId: number) {
        const res = await apiClient.post(`/api/disputes/${disputeId}/escalate`);
        return res.data;
    }
}

export const disputeService = new DisputeService();
