import { createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../api/axios';

// Define RootState interface inline to avoid circular dependency
// This matches the actual store structure
interface RootState {
  auth: {
    isAuthenticated: boolean;
    user: {
      id: string;
      email: string;
      username: string;
      fullName: string;
      role: string;
    } | null;
  };
  cart: {
    items: any[];
    totalItems: number;
    totalPrice: number;
  };
}

interface BackendCartItem {
  id: string;
  productId: string;
  productTitle: string;
  productImage: string;
  sellerId: string;
  sellerName: string;
  quantity: number;
  priceInCoins: number;
  priceInUSD: number;
}

interface CartItem {
  id: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  productId?: string;
  sellerId?: string;
  sellerName?: string;
  priceInCoins?: number;
}

// Fetch cart from backend
export const fetchCart = createAsyncThunk(
  'cart/fetchCart',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      if (!state.auth.isAuthenticated || !state.auth.user) {
        return { items: [], totalItems: 0, totalPrice: 0 };
      }

      const response = await axios.get('/api/v1/cart');
      
      if (response.data.success) {
        const backendItems: BackendCartItem[] = response.data.data.items || [];
        
        // Convert backend format to frontend format
        const items: CartItem[] = backendItems.map((item) => ({
          id: item.id,
          productId: item.productId,
          name: item.productTitle,
          image: item.productImage,
          price: parseFloat(item.priceInUSD.toString()),
          quantity: item.quantity,
          sellerId: item.sellerId,
          sellerName: item.sellerName,
          priceInCoins: parseFloat(item.priceInCoins.toString()),
        }));

        const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        return { items, totalItems, totalPrice };
      }

      return { items: [], totalItems: 0, totalPrice: 0 };
    } catch (error: any) {
      // If not authenticated, return empty cart
      if (error.response?.status === 401) {
        return { items: [], totalItems: 0, totalPrice: 0 };
      }
      // Network error or other errors
      const errorMessage = error.response?.data?.error 
        || error.message 
        || 'Failed to fetch cart. Please try again.';
      console.error('Error fetching cart:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Add item to cart (sync with backend)
export const addToCartAsync = createAsyncThunk(
  'cart/addToCartAsync',
  async (
    item: {
      productId: string;
      name: string;
      image: string;
      price: number;
      quantity?: number;
      priceInCoins?: number;
      sellerId?: string;
      sellerName?: string;
    },
    { getState, rejectWithValue }
  ) => {
    try {
      const state = getState() as RootState;
      if (!state.auth.isAuthenticated || !state.auth.user) {
        return rejectWithValue('User not authenticated');
      }

      // Get product details if needed
      let product = null;
      try {
        const productResponse = await axios.get(`/api/v1/products/${item.productId}`);
        product = productResponse.data.data?.product;
      } catch (productError: any) {
        // If product fetch fails, continue with provided data
        console.warn('Failed to fetch product details:', productError);
      }

      const response = await axios.post('/api/v1/cart', {
        productId: item.productId,
        productTitle: item.name,
        productImage: item.image,
        sellerId: product?.sellerId || item.sellerId || '',
        sellerName: product?.seller?.name || item.sellerName || '',
        quantity: item.quantity || 1,
        priceInCoins: item.priceInCoins || product?.priceInCoins || 0,
        priceInUSD: item.price,
      });

      if (response.data.success) {
        const backendItem: BackendCartItem = response.data.data;
        return {
          id: backendItem.id,
          productId: backendItem.productId,
          name: backendItem.productTitle,
          image: backendItem.productImage,
          price: parseFloat(backendItem.priceInUSD.toString()),
          quantity: backendItem.quantity,
          sellerId: backendItem.sellerId,
          sellerName: backendItem.sellerName,
          priceInCoins: parseFloat(backendItem.priceInCoins.toString()),
        };
      }

      return rejectWithValue('Failed to add item to cart');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error 
        || error.message 
        || 'Failed to add item to cart. Please try again.';
      console.error('Error adding to cart:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Update cart item quantity (sync with backend)
export const updateCartItemAsync = createAsyncThunk(
  'cart/updateCartItemAsync',
  async (
    { id, quantity }: { id: string; quantity: number },
    { getState, rejectWithValue }
  ) => {
    try {
      const state = getState() as RootState;
      if (!state.auth.isAuthenticated || !state.auth.user) {
        return rejectWithValue('User not authenticated');
      }

      if (quantity <= 0) {
        // Remove item
        await axios.delete(`/api/v1/cart/${id}`);
        return { id, removed: true };
      }

      const response = await axios.put(`/api/v1/cart/${id}`, { quantity });

      if (response.data.success) {
        const backendItem: BackendCartItem = response.data.data;
        return {
          id: backendItem.id,
          productId: backendItem.productId,
          name: backendItem.productTitle,
          image: backendItem.productImage,
          price: parseFloat(backendItem.priceInUSD.toString()),
          quantity: backendItem.quantity,
          sellerId: backendItem.sellerId,
          sellerName: backendItem.sellerName,
          priceInCoins: parseFloat(backendItem.priceInCoins.toString()),
        };
      }

      return rejectWithValue('Failed to update cart item');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error 
        || error.message 
        || 'Failed to update cart item. Please try again.';
      console.error('Error updating cart item:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Remove item from cart (sync with backend)
export const removeFromCartAsync = createAsyncThunk(
  'cart/removeFromCartAsync',
  async (id: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      if (!state.auth.isAuthenticated || !state.auth.user) {
        return rejectWithValue('User not authenticated');
      }

      await axios.delete(`/api/v1/cart/${id}`);
      return id;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error 
        || error.message 
        || 'Failed to remove item from cart. Please try again.';
      console.error('Error removing from cart:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Clear cart (sync with backend)
export const clearCartAsync = createAsyncThunk(
  'cart/clearCartAsync',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      if (!state.auth.isAuthenticated || !state.auth.user) {
        return;
      }

      await axios.delete('/api/v1/cart');
      return true;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error 
        || error.message 
        || 'Failed to clear cart. Please try again.';
      console.error('Error clearing cart:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

