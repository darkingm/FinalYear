import { ActionReducerMapBuilder } from '@reduxjs/toolkit';
import type { CartState } from './cartSlice.types';

// Use string action types instead of importing thunks directly
// This avoids circular dependency issues
const FETCH_CART_PENDING = 'cart/fetchCart/pending';
const FETCH_CART_FULFILLED = 'cart/fetchCart/fulfilled';
const FETCH_CART_REJECTED = 'cart/fetchCart/rejected';

const ADD_TO_CART_PENDING = 'cart/addToCartAsync/pending';
const ADD_TO_CART_FULFILLED = 'cart/addToCartAsync/fulfilled';
const ADD_TO_CART_REJECTED = 'cart/addToCartAsync/rejected';

const UPDATE_CART_ITEM_PENDING = 'cart/updateCartItemAsync/pending';
const UPDATE_CART_ITEM_FULFILLED = 'cart/updateCartItemAsync/fulfilled';
const UPDATE_CART_ITEM_REJECTED = 'cart/updateCartItemAsync/rejected';

const REMOVE_FROM_CART_PENDING = 'cart/removeFromCartAsync/pending';
const REMOVE_FROM_CART_FULFILLED = 'cart/removeFromCartAsync/fulfilled';
const REMOVE_FROM_CART_REJECTED = 'cart/removeFromCartAsync/rejected';

const CLEAR_CART_PENDING = 'cart/clearCartAsync/pending';
const CLEAR_CART_FULFILLED = 'cart/clearCartAsync/fulfilled';
const CLEAR_CART_REJECTED = 'cart/clearCartAsync/rejected';

const calculateTotals = (items: CartState['items']) => {
  return items.reduce(
    (acc, item) => ({
      totalItems: acc.totalItems + item.quantity,
      totalPrice: acc.totalPrice + item.price * item.quantity,
    }),
    { totalItems: 0, totalPrice: 0 }
  );
};

export const buildCartExtraReducers = (builder: ActionReducerMapBuilder<CartState>) => {
  // Fetch cart
  builder
    .addCase(FETCH_CART_PENDING, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(FETCH_CART_FULFILLED, (state, action: any) => {
      state.loading = false;
      state.items = action.payload.items;
      state.totalItems = action.payload.totalItems;
      state.totalPrice = action.payload.totalPrice;
      state.error = null;
    })
    .addCase(FETCH_CART_REJECTED, (state, action: any) => {
      state.loading = false;
      state.error = (action.payload as string) || 'Failed to fetch cart';
    });

  // Add to cart
  builder
    .addCase(ADD_TO_CART_PENDING, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(ADD_TO_CART_FULFILLED, (state, action: any) => {
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
      state.error = null;
    })
    .addCase(ADD_TO_CART_REJECTED, (state, action: any) => {
      state.loading = false;
      state.error = (action.payload as string) || 'Failed to add item to cart';
    });

  // Update cart item
  builder
    .addCase(UPDATE_CART_ITEM_PENDING, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(UPDATE_CART_ITEM_FULFILLED, (state, action: any) => {
      state.loading = false;
      if ('removed' in action.payload && action.payload.removed) {
        state.items = state.items.filter((item) => item.id !== action.payload.id);
      } else {
        const index = state.items.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload as CartState['items'][0];
        }
      }
      const totals = calculateTotals(state.items);
      state.totalItems = totals.totalItems;
      state.totalPrice = totals.totalPrice;
      state.error = null;
    })
    .addCase(UPDATE_CART_ITEM_REJECTED, (state, action: any) => {
      state.loading = false;
      state.error = (action.payload as string) || 'Failed to update cart item';
    });

  // Remove from cart
  builder
    .addCase(REMOVE_FROM_CART_PENDING, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(REMOVE_FROM_CART_FULFILLED, (state, action: any) => {
      state.loading = false;
      state.items = state.items.filter((item) => item.id !== action.payload);
      const totals = calculateTotals(state.items);
      state.totalItems = totals.totalItems;
      state.totalPrice = totals.totalPrice;
      state.error = null;
    })
    .addCase(REMOVE_FROM_CART_REJECTED, (state, action: any) => {
      state.loading = false;
      state.error = (action.payload as string) || 'Failed to remove item from cart';
    });

  // Clear cart
  builder
    .addCase(CLEAR_CART_PENDING, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(CLEAR_CART_FULFILLED, (state) => {
      state.loading = false;
      state.items = [];
      state.totalItems = 0;
      state.totalPrice = 0;
      state.error = null;
    })
    .addCase(CLEAR_CART_REJECTED, (state, action: any) => {
      state.loading = false;
      state.error = (action.payload as string) || 'Failed to clear cart';
    });
};
