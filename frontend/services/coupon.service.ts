import { apiClient } from '@/lib/api/client';

export interface CreateCouponPayload {
    code: string;
    description?: string;
    discount_type: 'percentage' | 'fixed' | 'fixed_amount' | 'free_shipping';
    discount_value: number;
    min_order_amount?: number;
    min_order_usd?: number;
    max_uses?: number;
    usage_limit?: number;
    per_user_limit?: number;
    starts_at?: string;
    expires_at?: string;
    max_discount_usd?: number;
}

class CouponService {
    async list() {
        const res = await apiClient.get('/api/coupons');
        return res.data || { coupons: [] };
    }

    async validate(code: string) {
        const res = await apiClient.post('/api/coupons/validate', { code });
        return res.data;
    }

    async create(data: any) {
        const res = await apiClient.post('/api/coupons', data);
        return res.data;
    }

    async delete(couponId: number) {
        const res = await apiClient.delete(`/api/coupons/${couponId}`);
        return res.data;
    }
}

export const couponService = new CouponService();
