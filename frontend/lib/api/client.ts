import axios from 'axios';
import { getSession } from 'next-auth/react';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_MAIN_API_URL || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
  },
  withCredentials: true,
});

export const paymentClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_PAYMENT_API_URL || 'http://localhost:3002',
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
  },
  withCredentials: true,
});

// Helper: get token from localStorage or refresh from session
async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('auth_token');
  if (stored) return stored;
  // Try to refresh from NextAuth session
  try {
    const session = await getSession() as any;
    if (session?.accessToken) {
      localStorage.setItem('auth_token', session.accessToken);
      return session.accessToken;
    }
  } catch (_) { /* ignore */ }
  return null;
}

// ─── Request interceptors ─────────────────────────────────────────────────
// On every request, pull the freshest token from the NextAuth session.
// This picks up auto-refreshed tokens that the JWT callback may have updated.
async function attachToken(config: any) {
  if (typeof window === 'undefined') return config;
  try {
    const session = await getSession() as any;
    const token = session?.accessToken || localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      // Keep localStorage in sync (so other logic that reads it stays current)
      localStorage.setItem('auth_token', token);
    }
  } catch {
    const stored = localStorage.getItem('auth_token');
    if (stored) config.headers.Authorization = `Bearer ${stored}`;
  }
  return config;
}

apiClient.interceptors.request.use(attachToken, (e) => Promise.reject(e));
paymentClient.interceptors.request.use(attachToken, (e) => Promise.reject(e));

// ─── Response interceptors ────────────────────────────────────────────────
// On 401: force a fresh session read (bypasses NextAuth cache) to pick up
// any token that the JWT callback just refreshed, then retry once.
async function handle401(error: any, client: any) {
  if (error.response?.status === 401 && typeof window !== 'undefined') {
    const original = error.config;
    if (!original._retried) {
      original._retried = true;
      try {
        // Clear potentially stale token from localStorage FIRST
        localStorage.removeItem('auth_token');

        // Small delay to let the JWT callback finish if it's in-flight
        await new Promise(r => setTimeout(r, 500));
        const session = await getSession() as any;

        // Check if session has a valid, non-error state
        if (session?.accessToken && !session?.error) {
          localStorage.setItem('auth_token', session.accessToken);
          original.headers.Authorization = `Bearer ${session.accessToken}`;
          return client(original);
        }
      } catch { /* ignore */ }

      // No valid session — clear everything and redirect to login
      localStorage.removeItem('auth_token');
      // Don't redirect if already on login page (prevents redirect loop)
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
  }
  return Promise.reject(error);
}

apiClient.interceptors.response.use((r) => r, (e) => handle401(e, apiClient));
paymentClient.interceptors.response.use((r) => r, (e) => handle401(e, paymentClient));
