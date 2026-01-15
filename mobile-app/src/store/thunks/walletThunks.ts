import { createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../api/client';
import { userEndpoints } from '../../api/endpoints';
import { CoinBalance } from '../../api/types';
import { setBalances, setLoading, setError } from '../slices/walletSlice';

export const fetchBalancesAsync = createAsyncThunk(
  'wallet/fetchBalances',
  async (userId: string, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      const response = await apiClient.get(userEndpoints.balances(userId));
      
      if (response.data.success) {
        const balances = response.data.data.balances || response.data.data || [];
        dispatch(setBalances(balances));
        dispatch(setLoading(false));
        return balances;
      }
      
      throw new Error('Failed to fetch balances');
    } catch (error: any) {
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.error || 'Failed to fetch balances'));
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch balances');
    }
  }
);

export const withdrawAsync = createAsyncThunk(
  'wallet/withdraw',
  async (
    {
      userId,
      coinId,
      coinSymbol,
      amount,
      walletAddress,
      network,
    }: {
      userId: string;
      coinId: string;
      coinSymbol: string;
      amount: number;
      walletAddress: string;
      network: string;
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      dispatch(setLoading(true));
      const response = await apiClient.post(userEndpoints.withdraw(userId), {
        coinId,
        coinSymbol,
        amount,
        walletAddress,
        network,
      });
      
      if (response.data.success) {
        dispatch(setLoading(false));
        return response.data.data;
      }
      
      throw new Error('Failed to withdraw');
    } catch (error: any) {
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.error || 'Failed to withdraw'));
      return rejectWithValue(error.response?.data?.error || 'Failed to withdraw');
    }
  }
);


