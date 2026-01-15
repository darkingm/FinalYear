import { createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../api/client';
import { authEndpoints } from '../../api/endpoints';
import { LoginRequest, RegisterRequest, AuthResponse } from '../../api/types';
import * as Keychain from 'react-native-keychain';
import { setCredentials, setLoading, setError, logout } from '../slices/authSlice';

export const loginAsync = createAsyncThunk(
  'auth/login',
  async (credentials: LoginRequest, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      const response = await apiClient.post<AuthResponse>(authEndpoints.login, credentials);
      
      if (response.data.success) {
        const { accessToken, refreshToken, user } = response.data.data;
        
        // Store tokens securely
        await Keychain.setGenericPassword(refreshToken, accessToken);
        
        dispatch(setCredentials({ user, accessToken, refreshToken }));
        dispatch(setLoading(false));
        
        return response.data.data;
      }
      
      throw new Error('Login failed');
    } catch (error: any) {
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.error || 'Login failed'));
      return rejectWithValue(error.response?.data?.error || 'Login failed');
    }
  }
);

export const registerAsync = createAsyncThunk(
  'auth/register',
  async (userData: RegisterRequest, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      const response = await apiClient.post(authEndpoints.register, userData);
      
      if (response.data.success) {
        dispatch(setLoading(false));
        return response.data;
      }
      
      throw new Error('Registration failed');
    } catch (error: any) {
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.error || 'Registration failed'));
      return rejectWithValue(error.response?.data?.error || 'Registration failed');
    }
  }
);

export const forgotPasswordAsync = createAsyncThunk(
  'auth/forgotPassword',
  async (email: string, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      const response = await apiClient.post(authEndpoints.forgotPassword, { email });
      dispatch(setLoading(false));
      return response.data;
    } catch (error: any) {
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.error || 'Failed to send OTP'));
      return rejectWithValue(error.response?.data?.error || 'Failed to send OTP');
    }
  }
);

export const verifyOTPAsync = createAsyncThunk(
  'auth/verifyOTP',
  async (data: { email: string; otp: string }, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      const response = await apiClient.post(authEndpoints.verifyOTP, data);
      dispatch(setLoading(false));
      return response.data;
    } catch (error: any) {
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.error || 'OTP verification failed'));
      return rejectWithValue(error.response?.data?.error || 'OTP verification failed');
    }
  }
);

export const logoutAsync = createAsyncThunk(
  'auth/logout',
  async (_, { dispatch }) => {
    await Keychain.resetGenericPassword();
    dispatch(logout());
  }
);


