import { createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../api/client';
import { voucherEndpoints } from '../../api/endpoints';

export const validateVoucherAsync = createAsyncThunk(
  'voucher/validate',
  async (
    data: {
      code: string;
      totalAmount: number;
      productIds: string[];
      categories: string[];
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await apiClient.post(voucherEndpoints.validate, data);
      
      if (response.data.success) {
        return { success: true, data: response.data.data };
      }
      
      throw new Error('Invalid voucher');
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Invalid voucher code');
    }
  }
);


