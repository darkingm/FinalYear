import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CartItem {
  productId: string;
  title: string;
  image: string;
  priceInCoins: number;
  priceInUSD: number;
  quantity: number;
  sellerId: string;
  sellerName: string;
}

interface CartState {
  items: CartItem[];
  totalItems: number;
  totalCoins: number;
  totalUSD: number;
}

const loadCartFromStorage = (): CartState => {
  const saved = localStorage.getItem('cart');
  if (saved) {
    return JSON.parse(saved);
  }
  return {
    items: [],
    totalItems: 0,
    totalCoins: 0,
    totalUSD: 0,
  };
};

const saveCartToStorage = (state: CartState) => {
  localStorage.setItem('cart', JSON.stringify(state));
};

const calculateTotals = (items: CartItem[]) => {
  return items.reduce(
    (acc, item) => ({
      totalItems: acc.totalItems + item.quantity,
      totalCoins: acc.totalCoins + item.priceInCoins * item.quantity,
      totalUSD: acc.totalUSD + item.priceInUSD * item.quantity,
    }),
    { totalItems: 0, totalCoins: 0, totalUSD: 0 }
  );
};

const initialState: CartState = loadCartFromStorage();

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<CartItem>) => {
      const existingItem = state.items.find(
        (item) => item.productId === action.payload.productId
      );

      if (existingItem) {
        existingItem.quantity += action.payload.quantity;
      } else {
        state.items.push(action.payload);
      }

      const totals = calculateTotals(state.items);
      state.totalItems = totals.totalItems;
      state.totalCoins = totals.totalCoins;
      state.totalUSD = totals.totalUSD;
      
      saveCartToStorage(state);
    },
    removeFromCart: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((item) => item.productId !== action.payload);
      
      const totals = calculateTotals(state.items);
      state.totalItems = totals.totalItems;
      state.totalCoins = totals.totalCoins;
      state.totalUSD = totals.totalUSD;
      
      saveCartToStorage(state);
    },
    updateQuantity: (
      state,
      action: PayloadAction<{ productId: string; quantity: number }>
    ) => {
      const item = state.items.find((item) => item.productId === action.payload.productId);
      
      if (item) {
        item.quantity = action.payload.quantity;
      }

      const totals = calculateTotals(state.items);
      state.totalItems = totals.totalItems;
      state.totalCoins = totals.totalCoins;
      state.totalUSD = totals.totalUSD;
      
      saveCartToStorage(state);
    },
    clearCart: (state) => {
      state.items = [];
      state.totalItems = 0;
      state.totalCoins = 0;
      state.totalUSD = 0;
      saveCartToStorage(state);
    },
  },
});

export const { addToCart, removeFromCart, updateQuantity, clearCart } = cartSlice.actions;
export default cartSlice.reducer;

