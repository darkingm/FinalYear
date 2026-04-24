import { apiClient } from './client';

export interface LoginPayload {
  email?: string;
  username?: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
  wallet_address?: string;
  captcha_token?: string;
}

// OAuthPayload is handled server-side by NextAuth — not available from client
// See frontend/app/api/auth/[...nextauth]/route.ts

export interface LinkWalletPayload {
  wallet_address: string;
  message: string;
  signature: string;
}

export const authApi = {
  login: (data: LoginPayload) => apiClient.post('/api/auth/login', data),
  register: (data: RegisterPayload) => apiClient.post('/api/auth/register', data),
  // oauth: removed — /api/auth/oauth is internal-only (requires X-Internal-Service-Key)
  refresh: () => apiClient.post('/api/auth/refresh'),
  logout: (refreshToken?: string) => apiClient.post('/api/auth/logout', refreshToken ? { refreshToken } : {}),
  getProfile: () => apiClient.get('/api/users/profile'),
  linkWallet: (data: LinkWalletPayload) => apiClient.post('/api/auth/link-wallet', data),
};
