import { useState, useEffect, useCallback } from 'react';
import { geoService } from '../services/geo.service';
import type { GeoCoords, GeoProduct } from '../types';

interface UseGeoProductsResult {
  products: GeoProduct[];
  coords: GeoCoords | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  permissionDenied: boolean;
  refresh: () => void;
  setRadius: (km: number) => void;
  setCategory: (cat: string) => void;
  radius: number;
  category: string;
}

export function useGeoProducts(): UseGeoProductsResult {
  const [products, setProducts] = useState<GeoProduct[]>([]);
  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [radius, setRadius] = useState(50);
  const [category, setCategory] = useState('');

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    // Step 1: get location
    const loc = await geoService.getCurrentLocation();
    if (!loc) {
      setPermissionDenied(true);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setCoords(loc);
    setPermissionDenied(false);

    // Step 2: fetch nearby
    const { data, error: err } = await geoService.getNearbyProducts(loc, {
      radius_km: radius,
      category: category || undefined,
    });
    setProducts(data ?? []);
    if (err) setError(err);

    setLoading(false);
    setRefreshing(false);
  }, [radius, category]);

  useEffect(() => { fetch(); }, [fetch]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetch(false);
  }, [fetch]);

  return {
    products, coords, loading, refreshing, error,
    permissionDenied, refresh, setRadius, setCategory, radius, category,
  };
}
