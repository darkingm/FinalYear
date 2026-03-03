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

export interface OAuthPayload {
  provider: 'google' | 'facebook';
  providerId: string;
  email: string;
  name: string;
  image?: string;
}

export interface LinkWalletPayload {
  wallet_address: string;
  message: string;
  signature: string;
}

export const authApi = {
  login: (data: LoginPayload) => apiClient.post('/api/auth/login', data),
  register: (data: RegisterPayload) => apiClient.post('/api/auth/register', data),
  oauth: (data: OAuthPayload) => apiClient.post('/api/auth/oauth', data),
  refresh: () => apiClient.post('/api/auth/refresh'),
  logout: () => apiClient.post('/api/auth/logout'),
  getProfile: () => apiClient.get('/api/users/profile'),
  linkWallet: (data: LinkWalletPayload) => apiClient.post('/api/auth/link-wallet', data),
};
