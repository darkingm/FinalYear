/**
 * Geo Service — location permissions + nearby products.
 * Wraps expo-location so the rest of the app stays decoupled.
 */
import * as Location from 'expo-location';
import { apiClient } from '../api/client';
import { safeCall } from '../utils/api';
import { cache } from '../utils/cache';
import type { GeoCoords, GeoProduct } from '../types';

const GEO_CACHE_TTL = 3 * 60 * 1000; // 3 min

export const geoService = {
  /**
   * Request foreground location permission and return current coords.
   * Returns null if denied.
   */
  async getCurrentLocation(): Promise<GeoCoords | null> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  },

  /**
   * Fetch products near given coordinates.
   * Results include distance_km from the user.
   */
  async getNearbyProducts(
    coords: GeoCoords,
    options: { radius_km?: number; category?: string; limit?: number } = {},
  ) {
    const { radius_km = 50, category, limit = 30 } = options;
    const cacheKey = `geo:products:${coords.latitude.toFixed(2)}:${coords.longitude.toFixed(2)}:${radius_km}:${category ?? 'all'}`;

    return safeCall<GeoProduct[]>(
      () => cache.getOrFetch(
        cacheKey,
        async () => {
          const params = new URLSearchParams({
            lat: String(coords.latitude),
            lng: String(coords.longitude),
            radius_km: String(radius_km),
            limit: String(limit),
            ...(category ? { category } : {}),
          });
          const res = await apiClient.get(`/api/products/nearby?${params}`);
          return (res.data.products ?? []) as GeoProduct[];
        },
        GEO_CACHE_TTL,
      ),
      { tag: 'geoService.getNearbyProducts', fallback: [] as GeoProduct[] },
    );
  },

  /**
   * Calculate haversine distance between two coords (fallback for offline).
   */
  distanceKm(a: GeoCoords, b: GeoCoords): number {
    const R = 6371;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const c =
      2 *
      Math.atan2(
        Math.sqrt(
          sinDLat * sinDLat +
            Math.cos((a.latitude * Math.PI) / 180) *
              Math.cos((b.latitude * Math.PI) / 180) *
              sinDLng *
              sinDLng,
        ),
        Math.sqrt(
          1 -
            (sinDLat * sinDLat +
              Math.cos((a.latitude * Math.PI) / 180) *
                Math.cos((b.latitude * Math.PI) / 180) *
                sinDLng *
                sinDLng),
        ),
      );
    return R * c;
  },
};
