import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import {
  clearSessionAccessToken,
  ensureSessionAccessToken,
  getStoredAccessToken,
  refreshSessionAccessToken,
} from '@/lib/auth/session-token-manager';
import { logAuthEvent } from '@/lib/auth/auth-log';
import { buildLoginRedirectUrl } from '@/lib/auth/login-redirect';
import { getRequestAuthMode, type AuthAwareRequestConfig } from '@/lib/api/request-auth';

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

type AuthAwareAxiosConfig = InternalAxiosRequestConfig & AuthAwareRequestConfig & { _retried?: boolean };

// ─── Request interceptors ─────────────────────────────────────────────────
// Read from the local token cache first and only consult NextAuth when cold.
async function attachToken(config: AuthAwareAxiosConfig) {
  if (typeof window === 'undefined') return config;
  if (!getRequestAuthMode(config).attachToken) return config;
  const token = getStoredAccessToken() || await ensureSessionAccessToken();

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
}

apiClient.interceptors.request.use(attachToken, (e) => Promise.reject(e));
paymentClient.interceptors.request.use(attachToken, (e) => Promise.reject(e));

// ─── Response interceptors ────────────────────────────────────────────────
// On 401: invalidate the stale access token and let a single shared session
// refresh serve all concurrent callers.
async function handle401(error: any, client: AxiosInstance) {
  if (error.response?.status === 401 && typeof window !== 'undefined') {
    const original = (error.config ?? {}) as AuthAwareAxiosConfig;
    if (!getRequestAuthMode(original).redirectOn401) {
      return Promise.reject(error);
    }
    if (!original._retried) {
      original._retried = true;
      try {
        clearSessionAccessToken();
        const freshToken = await refreshSessionAccessToken();

        if (freshToken) {
          original.headers = original.headers ?? {};
          original.headers.Authorization = `Bearer ${freshToken}`;
          return client(original);
        }
      } catch { /* ignore */ }

      // No valid session — clear everything and redirect to login with callback
      clearSessionAccessToken();
      const callbackUrl = `${window.location.pathname}${window.location.search}`;
      logAuthEvent('client_reauth_redirect', {
        eventSource: client?.defaults?.baseURL ?? 'unknown-client',
        reasonCode: 'backend_401_after_refresh',
        statusCode: error.response?.status ?? null,
        path: window.location.pathname,
      });
      if (!window.location.pathname.includes('/login')) {
        window.location.href = buildLoginRedirectUrl(callbackUrl, 'reauth_required');
      }
    }
  }
  return Promise.reject(error);
}

apiClient.interceptors.response.use((r) => r, (e) => handle401(e, apiClient));
paymentClient.interceptors.response.use((r) => r, (e) => handle401(e, paymentClient));
