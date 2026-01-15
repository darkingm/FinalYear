import { createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../api/client';
import { productEndpoints } from '../../api/endpoints';
import { Product } from '../../api/types';
import {
  setProducts,
  appendProducts,
  setFeaturedProducts,
  setCurrentProduct,
  setLoading,
  setError,
  setPagination,
} from '../slices/productSlice';

export const fetchFeaturedProducts = createAsyncThunk(
  'product/fetchFeatured',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      const response = await apiClient.get(productEndpoints.featured, {
        params: { limit: 8 },
      });
      
      if (response.data.success) {
        const products = response.data.data.products || [];
        dispatch(setFeaturedProducts(products));
        dispatch(setLoading(false));
        return products;
      }
      
      throw new Error('Failed to fetch featured products');
    } catch (error: any) {
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.error || 'Failed to fetch featured products'));
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch featured products');
    }
  }
);

export const fetchProducts = createAsyncThunk(
  'product/fetchProducts',
  async (params: { page?: number; limit?: number; category?: string; search?: string; sortBy?: string; sortOrder?: string }, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      const response = await apiClient.get(productEndpoints.list, { params });
      
      if (response.data.success) {
        const { products, pagination } = response.data.data;
        if (params.page === 1) {
          dispatch(setProducts(products));
        } else {
          dispatch(appendProducts(products));
        }
        dispatch(setPagination(pagination));
        dispatch(setLoading(false));
        return { products, pagination };
      }
      
      throw new Error('Failed to fetch products');
    } catch (error: any) {
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.error || 'Failed to fetch products'));
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch products');
    }
  }
);

export const fetchProductById = createAsyncThunk(
  'product/fetchById',
  async (id: string, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      const response = await apiClient.get(productEndpoints.detail(id));
      
      if (response.data.success) {
        const product = response.data.data.product || response.data.data;
        dispatch(setCurrentProduct(product));
        dispatch(setLoading(false));
        return product;
      }
      
      throw new Error('Failed to fetch product');
    } catch (error: any) {
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.error || 'Failed to fetch product'));
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch product');
    }
  }
);

export const toggleLikeProduct = createAsyncThunk(
  'product/toggleLike',
  async (id: string, { dispatch, rejectWithValue }) => {
    try {
      const response = await apiClient.post(productEndpoints.like(id));
      
      if (response.data.success) {
        // Update product in store
        dispatch(setCurrentProduct(response.data.data.product));
        return response.data.data;
      }
      
      throw new Error('Failed to toggle like');
    } catch (error: any) {
      dispatch(setError(error.response?.data?.error || 'Failed to toggle like'));
      return rejectWithValue(error.response?.data?.error || 'Failed to toggle like');
    }
  }
);


