import { apiClient } from '@/lib/api/client';

export interface Address {
    address_id: number;
    user_id: number;
    label: string;
    full_name: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    is_default: boolean;
}

class AddressService {
    async list() {
        const res = await apiClient.get('/api/users/addresses');
        return res.data.addresses || [];
    }

    async create(data: Partial<Address>) {
        const res = await apiClient.post('/api/users/addresses', data);
        return res.data;
    }

    async update(id: number, data: Partial<Address>) {
        const res = await apiClient.put(`/api/users/addresses/${id}`, data);
        return res.data;
    }

    async delete(id: number) {
        const res = await apiClient.delete(`/api/users/addresses/${id}`);
        return res.data;
    }

    async setDefault(id: number) {
        const res = await apiClient.patch(`/api/users/addresses/${id}/default`);
        return res.data;
    }

    async remove(id: number) {
        return this.delete(id);
    }
}

export const addressService = new AddressService();
