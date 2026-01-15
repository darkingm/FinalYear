import { createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../api/client';
import { orderEndpoints } from '../../api/endpoints';
import { Order } from '../../api/types';
import {
  setOrders,
  addOrder,
  setCurrentOrder,
  updateOrder,
  setLoading,
  setError,
} from '../slices/orderSlice';

export const fetchOrdersAsync = createAsyncThunk(
  'order/fetch',
  async (params?: { status?: string }, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      const response = await apiClient.get(orderEndpoints.list, { params });
      
      if (response.data.success) {
        const orders = response.data.data.orders || response.data.data || [];
        dispatch(setOrders(orders));
        dispatch(setLoading(false));
        return orders;
      }
      
      throw new Error('Failed to fetch orders');
    } catch (error: any) {
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.error || 'Failed to fetch orders'));
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch orders');
    }
  }
);

export const fetchOrderByIdAsync = createAsyncThunk(
  'order/fetchById',
  async (id: string, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      const response = await apiClient.get(orderEndpoints.detail(id));
      
      if (response.data.success) {
        const order = response.data.data.order || response.data.data;
        dispatch(setCurrentOrder(order));
        dispatch(setLoading(false));
        return order;
      }
      
      throw new Error('Failed to fetch order');
    } catch (error: any) {
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.error || 'Failed to fetch order'));
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch order');
    }
  }
);

export const createOrderAsync = createAsyncThunk(
  'order/create',
  async (orderData: any, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      const response = await apiClient.post(orderEndpoints.create, orderData);
      
      if (response.data.success) {
        const order = response.data.data.order || response.data.data;
        dispatch(addOrder(order));
        dispatch(setLoading(false));
        return { success: true, data: order };
      }
      
      throw new Error('Failed to create order');
    } catch (error: any) {
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.error || 'Failed to create order'));
      return rejectWithValue(error.response?.data?.error || 'Failed to create order');
    }
  }
);

export const cancelOrderAsync = createAsyncThunk(
  'order/cancel',
  async ({ id, reason }: { id: string; reason: string }, { dispatch, rejectWithValue }) => {
    try {
      const response = await apiClient.post(orderEndpoints.cancel(id), { reason });
      
      if (response.data.success) {
        const order = response.data.data.order || response.data.data;
        dispatch(updateOrder({ id, ...order }));
        return order;
      }
      
      throw new Error('Failed to cancel order');
    } catch (error: any) {
      dispatch(setError(error.response?.data?.error || 'Failed to cancel order'));
      return rejectWithValue(error.response?.data?.error || 'Failed to cancel order');
    }
  }
);


