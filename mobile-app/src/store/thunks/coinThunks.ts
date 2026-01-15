import { createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../api/client';
import { coinEndpoints } from '../../api/endpoints';
import { Coin } from '../../api/types';
import { setCoins, setLoading, setError } from '../slices/walletSlice';

export const fetchTop10Coins = createAsyncThunk(
  'coin/fetchTop10',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      const response = await apiClient.get(coinEndpoints.top10);
      
      if (response.data.success) {
        const coins = response.data.data.coins || [];
        dispatch(setCoins(coins));
        dispatch(setLoading(false));
        return coins;
      }
      
      throw new Error('Failed to fetch coins');
    } catch (error: any) {
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.error || 'Failed to fetch coins'));
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch coins');
    }
  }
);


