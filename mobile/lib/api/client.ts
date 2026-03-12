import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://103.20.96.79:3001';
const PAYMENT_URL = process.env.EXPO_PUBLIC_PAYMENT_URL || 'http://103.20.96.79:3002';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export const paymentClient = axios.create({
  baseURL: PAYMENT_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Inject JWT token
const injectToken = async (config: any) => {
  const token = await SecureStore.getItemAsync('jwt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
};

apiClient.interceptors.request.use(injectToken);
paymentClient.interceptors.request.use(injectToken);

// Handle 401
const handle401 = async (error: any) => {
  if (error.response?.status === 401) {
    await SecureStore.deleteItemAsync('jwt_token');
  }
  return Promise.reject(error);
};

apiClient.interceptors.response.use(res => res, handle401);
paymentClient.interceptors.response.use(res => res, handle401);
