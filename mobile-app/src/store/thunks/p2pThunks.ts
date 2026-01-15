import { createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../api/client';
import { paymentEndpoints } from '../../api/endpoints';
import { P2PTrade } from '../../api/types';
import {
  setTrades,
  addTrade,
  setCurrentTrade,
  updateTrade,
  setLoading,
  setError,
} from '../slices/p2pSlice';

export const fetchP2PTradesAsync = createAsyncThunk(
  'p2p/fetch',
  async (params?: { tradeType?: 'BUY' | 'SELL'; coinType?: string }, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      const response = await apiClient.get(paymentEndpoints.p2pList, { params });
      
      if (response.data.success) {
        const trades = response.data.data.trades || response.data.data || [];
        dispatch(setTrades(trades));
        dispatch(setLoading(false));
        return trades;
      }
      
      throw new Error('Failed to fetch P2P trades');
    } catch (error: any) {
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.error || 'Failed to fetch P2P trades'));
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch P2P trades');
    }
  }
);

export const fetchP2PTradeByIdAsync = createAsyncThunk(
  'p2p/fetchById',
  async (id: string, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      const response = await apiClient.get(paymentEndpoints.p2pDetail(id));
      
      if (response.data.success) {
        const trade = response.data.data.trade || response.data.data;
        dispatch(setCurrentTrade(trade));
        dispatch(setLoading(false));
        return trade;
      }
      
      throw new Error('Failed to fetch P2P trade');
    } catch (error: any) {
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.error || 'Failed to fetch P2P trade'));
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch P2P trade');
    }
  }
);

export const createP2PTradeAsync = createAsyncThunk(
  'p2p/create',
  async (tradeData: {
    tradeType: 'BUY' | 'SELL';
    coinAmount: number;
    coinType: string;
    fiatAmount: number;
    fiatCurrency: string;
    exchangeRate: number;
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
  }, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      const response = await apiClient.post(paymentEndpoints.p2pCreate, tradeData);
      
      if (response.data.success) {
        const trade = response.data.data.trade || response.data.data;
        dispatch(addTrade(trade));
        dispatch(setLoading(false));
        return trade;
      }
      
      throw new Error('Failed to create P2P trade');
    } catch (error: any) {
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.error || 'Failed to create P2P trade'));
      return rejectWithValue(error.response?.data?.error || 'Failed to create P2P trade');
    }
  }
);

export const submitPaymentProofAsync = createAsyncThunk(
  'p2p/submitProof',
  async ({ id, paymentProofImage }: { id: string; paymentProofImage: string }, { dispatch, rejectWithValue }) => {
    try {
      const response = await apiClient.post(paymentEndpoints.p2pProof(id), {
        paymentProofImage,
      });
      
      if (response.data.success) {
        const trade = response.data.data.trade || response.data.data;
        dispatch(updateTrade({ id, ...trade }));
        return trade;
      }
      
      throw new Error('Failed to submit payment proof');
    } catch (error: any) {
      dispatch(setError(error.response?.data?.error || 'Failed to submit payment proof'));
      return rejectWithValue(error.response?.data?.error || 'Failed to submit payment proof');
    }
  }
);

export const cancelP2PTradeAsync = createAsyncThunk(
  'p2p/cancel',
  async (id: string, { dispatch, rejectWithValue }) => {
    try {
      const response = await apiClient.post(paymentEndpoints.p2pCancel(id));
      
      if (response.data.success) {
        const trade = response.data.data.trade || response.data.data;
        dispatch(updateTrade({ id, ...trade }));
        return trade;
      }
      
      throw new Error('Failed to cancel P2P trade');
    } catch (error: any) {
      dispatch(setError(error.response?.data?.error || 'Failed to cancel P2P trade'));
      return rejectWithValue(error.response?.data?.error || 'Failed to cancel P2P trade');
    }
  }
);


