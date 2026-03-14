import { useState, useEffect, useCallback } from 'react';
import { sellerService } from '../services/seller.service';
import type { SellerStats, SellerProduct } from '../types';

export function useSellerStats(period: '1d' | '7d' | '30d' = '7d') {
  const [stats, setStats] = useState<SellerStats | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (invalidate = false) => {
    setError(null);
    if (invalidate) {
      setRefreshing(true);
      await sellerService.invalidateStats();
    } else {
      setLoading(true);
    }

    const { data, error: err } = await sellerService.getStats(period);
    setStats(data);
    if (err) setError(err);
    setLoading(false);
    setRefreshing(false);
  }, [period]);

  useEffect(() => { fetch(); }, [fetch]);

  return {
    stats, loading, refreshing, error,
    refresh: () => fetch(true),
  };
}

export function useSellerProducts(status?: string) {
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetch = useCallback(async (reset = true) => {
    if (reset) { setLoading(true); setPage(1); }
    const { data, error: err } = await sellerService.getProducts(reset ? 1 : page, status);
    if (reset) setProducts(data ?? []);
    else setProducts(prev => [...prev, ...(data ?? [])]);
    setHasMore((data ?? []).length === 20);
    if (err) setError(err);
    setLoading(false);
    setRefreshing(false);
  }, [status, page]);

  useEffect(() => { fetch(true); }, [status]);

  const loadMore = () => {
    if (!hasMore || loading) return;
    setPage(p => p + 1);
  };

  const refresh = () => { setRefreshing(true); fetch(true); };

  return { products, loading, refreshing, error, hasMore, loadMore, refresh };
}
