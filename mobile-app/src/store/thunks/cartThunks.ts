import { createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../api/client';
import { cartEndpoints } from '../../api/endpoints';
import { CartItem } from '../../api/types';
import {
  setCartItems,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  setLoading,
  setError,
} from '../slices/cartSlice';

export const fetchCartAsync = createAsyncThunk(
  'cart/fetch',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      const response = await apiClient.get(cartEndpoints.get);
      
      if (response.data.success) {
        const items = response.data.data.items || response.data.data || [];
        dispatch(setCartItems(items));
        dispatch(setLoading(false));
        return items;
      }
      
      throw new Error('Failed to fetch cart');
    } catch (error: any) {
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.error || 'Failed to fetch cart'));
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch cart');
    }
  }
);

export const addToCartAsync = createAsyncThunk(
  'cart/add',
  async (item: {
    productId: string;
    productTitle: string;
    productImage: string;
    sellerId: string;
    sellerName: string;
    quantity: number;
    priceInCoins: number;
    priceInUSD: number;
  }, { dispatch, rejectWithValue }) => {
    try {
      const response = await apiClient.post(cartEndpoints.add, item);
      
      if (response.data.success) {
        const cartItem = response.data.data;
        dispatch(addToCart(cartItem));
        return cartItem;
      }
      
      throw new Error('Failed to add to cart');
    } catch (error: any) {
      dispatch(setError(error.response?.data?.error || 'Failed to add to cart'));
      return rejectWithValue(error.response?.data?.error || 'Failed to add to cart');
    }
  }
);

export const updateCartItemAsync = createAsyncThunk(
  'cart/update',
  async ({ id, quantity }: { id: string; quantity: number }, { dispatch, rejectWithValue }) => {
    try {
      const response = await apiClient.put(cartEndpoints.update(id), { quantity });
      
      if (response.data.success) {
        const cartItem = response.data.data;
        dispatch(updateCartItem({ id, quantity }));
        return cartItem;
      }
      
      throw new Error('Failed to update cart item');
    } catch (error: any) {
      dispatch(setError(error.response?.data?.error || 'Failed to update cart item'));
      return rejectWithValue(error.response?.data?.error || 'Failed to update cart item');
    }
  }
);

export const removeFromCartAsync = createAsyncThunk(
  'cart/remove',
  async (id: string, { dispatch, rejectWithValue }) => {
    try {
      await apiClient.delete(cartEndpoints.remove(id));
      dispatch(removeFromCart(id));
      return id;
    } catch (error: any) {
      dispatch(setError(error.response?.data?.error || 'Failed to remove from cart'));
      return rejectWithValue(error.response?.data?.error || 'Failed to remove from cart');
    }
  }
);

export const clearCartAsync = createAsyncThunk(
  'cart/clear',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      await apiClient.delete(cartEndpoints.clear);
      dispatch(clearCart());
    } catch (error: any) {
      dispatch(setError(error.response?.data?.error || 'Failed to clear cart'));
      return rejectWithValue(error.response?.data?.error || 'Failed to clear cart');
    }
  }
);


