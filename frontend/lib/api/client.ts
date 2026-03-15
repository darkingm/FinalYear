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

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

paymentClient.interceptors.request.use(
  async (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: on 401, try refreshing session token before redirecting
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Attempt to refresh token from NextAuth session
      const originalRequest = error.config;
      if (!originalRequest._retried) {
        originalRequest._retried = true;
        try {
          const session = await getSession() as any;
          if (session?.accessToken) {
            localStorage.setItem('auth_token', session.accessToken);
            originalRequest.headers.Authorization = `Bearer ${session.accessToken}`;
            return apiClient(originalRequest);
          }
        } catch (_) { /* session unavailable */ }
      }
      // Token cannot be refreshed — clear and redirect to login
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

paymentClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const originalRequest = error.config;
      if (!originalRequest._retried) {
        originalRequest._retried = true;
        try {
          const session = await getSession() as any;
          if (session?.accessToken) {
            localStorage.setItem('auth_token', session.accessToken);
            originalRequest.headers.Authorization = `Bearer ${session.accessToken}`;
            return paymentClient(originalRequest);
          }
        } catch (_) { /* ignore */ }
      }
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
