import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  fetchCart,
  addToCartAsync,
  updateCartItemAsync,
  removeFromCartAsync,
  clearCartAsync,
} from '../thunks/cartThunks';

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

interface CartState {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  loading: boolean;
  error: string | null;
}

const calculateTotals = (items: CartItem[]) => {
  return items.reduce(
    (acc, item) => ({
      totalItems: acc.totalItems + item.quantity,
      totalPrice: acc.totalPrice + item.price * item.quantity,
    }),
    { totalItems: 0, totalPrice: 0 }
  );
};

const initialState: CartState = {
  items: [],
  totalItems: 0,
  totalPrice: 0,
  loading: false,
  error: null,
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    // Local actions for immediate UI updates (will sync with backend)
    addToCartLocal: (state, action: PayloadAction<CartItem>) => {
      const itemId = String(action.payload.id).trim();
      const existingItem = state.items.find(
        (item) => String(item.id).trim() === itemId
      );

      if (existingItem) {
        existingItem.quantity += action.payload.quantity || 1;
      } else {
        state.items.push({
          ...action.payload,
          id: itemId,
        });
      }

      const totals = calculateTotals(state.items);
      state.totalItems = totals.totalItems;
      state.totalPrice = totals.totalPrice;
    },
    removeFromCartLocal: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((item) => item.id !== action.payload);
      const totals = calculateTotals(state.items);
      state.totalItems = totals.totalItems;
      state.totalPrice = totals.totalPrice;
    },
    updateQuantityLocal: (
      state,
      action: PayloadAction<{ id: string; quantity: number }>
    ) => {
      const item = state.items.find((item) => item.id === action.payload.id);
      if (item) {
        item.quantity = action.payload.quantity;
      }
      const totals = calculateTotals(state.items);
      state.totalItems = totals.totalItems;
      state.totalPrice = totals.totalPrice;
    },
    clearCartLocal: (state) => {
      state.items = [];
      state.totalItems = 0;
      state.totalPrice = 0;
    },
  },
  extraReducers: (builder) => {
    // Fetch cart
    builder
      .addCase(fetchCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCart.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.totalItems = action.payload.totalItems;
        state.totalPrice = action.payload.totalPrice;
        state.error = null;
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Add to cart
    builder
      .addCase(addToCartAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addToCartAsync.fulfilled, (state, action) => {
        state.loading = false;
        const existingItem = state.items.find(
          (item) => item.id === action.payload.id
        );
        if (existingItem) {
          existingItem.quantity = action.payload.quantity;
        } else {
          state.items.push(action.payload);
        }
        const totals = calculateTotals(state.items);
        state.totalItems = totals.totalItems;
        state.totalPrice = totals.totalPrice;
      })
      .addCase(addToCartAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Update cart item
    builder
      .addCase(updateCartItemAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCartItemAsync.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.removed) {
          state.items = state.items.filter((item) => item.id !== action.payload.id);
        } else {
          const index = state.items.findIndex((item) => item.id === action.payload.id);
          if (index !== -1) {
            state.items[index] = action.payload;
          }
        }
        const totals = calculateTotals(state.items);
        state.totalItems = totals.totalItems;
        state.totalPrice = totals.totalPrice;
      })
      .addCase(updateCartItemAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Remove from cart
    builder
      .addCase(removeFromCartAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeFromCartAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.items = state.items.filter((item) => item.id !== action.payload);
        const totals = calculateTotals(state.items);
        state.totalItems = totals.totalItems;
        state.totalPrice = totals.totalPrice;
      })
      .addCase(removeFromCartAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Clear cart
    builder
      .addCase(clearCartAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(clearCartAsync.fulfilled, (state) => {
        state.loading = false;
        state.items = [];
        state.totalItems = 0;
        state.totalPrice = 0;
      })
      .addCase(clearCartAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  addToCartLocal,
  removeFromCartLocal,
  updateQuantityLocal,
  clearCartLocal,
} = cartSlice.actions;
export default cartSlice.reducer;

