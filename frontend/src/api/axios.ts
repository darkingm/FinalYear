import axios from 'axios';
import { store } from '../store';
import { logout } from '../store/slices/authSlice';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    const token = store.getState().auth.accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If token expired, try to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = store.getState().auth.refreshToken;
        const response = await axios.post(`${API_URL}/api/v1/auth/refresh-token`, {
          refreshToken,
        });

        const { accessToken } = response.data.data;
        
        // Update token in store and localStorage
        store.dispatch({
          type: 'auth/setCredentials',
          payload: {
            ...store.getState().auth,
            accessToken,
          },
        });

        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        store.dispatch(logout());
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;

