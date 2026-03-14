import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../api/client';

export interface OrderDetail {
  order_id: number;
  internal_order_id: string;
  product_name: string;
  primary_image: string | null;
  status: string;
  price_usd: number;
  amount_token: string | null;
  token_symbol: string | null;
  quantity: number;
  created_at: string;
  updated_at: string;
  seller_name: string | null;
  seller_wallet: string | null;
  buyer_address: string | null;
  // NFT info
  has_nft: boolean;
  nft_token_id: string | null;
  nft_tx_hash: string | null;
  nfc_verified: boolean;
  product_id: number;
  // tracking
  estimated_delivery: string | null;
  tracking_number: string | null;
  shipping_carrier: string | null;
}

const ACTIVE_STATUSES = ['PENDING', 'ONCHAIN_CONFIRMED', 'DELIVERING'];
const POLL_INTERVAL = 15_000; // 15 seconds

export function useOrder(orderId: string | number) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrder = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await apiClient.get(`/api/orders/${orderId}`);
      const data = res.data.order ?? res.data;
      setOrder(data);
      return data;
    } catch (e: any) {
      setError(e.response?.data?.message || 'Không thể tải đơn hàng');
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetchOrder(false);
  }, [fetchOrder]);

  // Auto-poll when order is in active status
  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  useEffect(() => {
    if (!order) return;
    if (ACTIVE_STATUSES.includes(order.status)) {
      timerRef.current = setInterval(() => fetchOrder(true), POLL_INTERVAL);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [order?.status, fetchOrder]);

  const confirmDelivery = useCallback(async () => {
    await apiClient.post(`/api/orders/${orderId}/confirm-delivery`);
    await fetchOrder(true);
  }, [orderId, fetchOrder]);

  const openDispute = useCallback(async (reason: string) => {
    await apiClient.post(`/api/orders/${orderId}/dispute`, { reason });
    await fetchOrder(true);
  }, [orderId, fetchOrder]);

  return { order, loading, refreshing, error, refresh, confirmDelivery, openDispute };
}
