import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CartItem {
  id: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
}

const loadCartFromStorage = (): CartState => {
  const saved = localStorage.getItem('cart');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      
      // Validate and migrate old data format
      if (parsed.items && Array.isArray(parsed.items)) {
        // Ensure all items have required fields
        const validItems = parsed.items.filter((item: any) => 
          item.id && item.name && item.image && typeof item.price === 'number' && typeof item.quantity === 'number'
        );
        
        // If items are invalid, clear cart
        if (validItems.length !== parsed.items.length) {
          console.warn('Invalid cart items detected, clearing cart');
          localStorage.removeItem('cart');
          return {
            items: [],
            totalItems: 0,
            totalPrice: 0,
          };
        }
        
        const totals = calculateTotals(validItems);
        return {
          items: validItems,
          totalItems: totals.totalItems,
          totalPrice: totals.totalPrice,
        };
      }
    } catch (error) {
      console.error('Error parsing cart from localStorage:', error);
      localStorage.removeItem('cart');
    }
  }
  return {
    items: [],
    totalItems: 0,
    totalPrice: 0,
  };
};

const saveCartToStorage = (state: CartState) => {
  localStorage.setItem('cart', JSON.stringify(state));
};

const calculateTotals = (items: CartItem[]) => {
  return items.reduce(
    (acc, item) => ({
      totalItems: acc.totalItems + item.quantity,
      totalPrice: acc.totalPrice + item.price * item.quantity,
    }),
    { totalItems: 0, totalPrice: 0 }
  );
};

const initialState: CartState = loadCartFromStorage();

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<CartItem>) => {
      // ✅ Đảm bảo ID là string và normalize
      const itemId = String(action.payload.id).trim();
      
      // ✅ Debug logging
      console.log('Adding to cart:', {
        itemId,
        itemIdType: typeof itemId,
        currentItems: state.items.map(i => ({ id: i.id, idType: typeof i.id })),
      });

      const existingItem = state.items.find(
        (item) => String(item.id).trim() === itemId // ✅ So sánh string normalized
      );

      if (existingItem) {
        existingItem.quantity += action.payload.quantity;
        console.log('Updated existing item quantity:', existingItem.quantity);
      } else {
        // ✅ Đảm bảo ID là string khi push
        state.items.push({
          ...action.payload,
          id: itemId, // ✅ Normalize ID
        });
        console.log('Added new item to cart');
      }

      const totals = calculateTotals(state.items);
      state.totalItems = totals.totalItems;
      state.totalPrice = totals.totalPrice;
      
      console.log('Cart state after add:', {
        totalItems: state.totalItems,
        items: state.items.map(i => ({ id: i.id, name: i.name, qty: i.quantity })),
      });
      
      saveCartToStorage(state);
    },
    removeFromCart: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((item) => item.id !== action.payload);
      
      const totals = calculateTotals(state.items);
      state.totalItems = totals.totalItems;
      state.totalPrice = totals.totalPrice;
      
      saveCartToStorage(state);
    },
    updateQuantity: (
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
      
      saveCartToStorage(state);
    },
    clearCart: (state) => {
      state.items = [];
      state.totalItems = 0;
      state.totalPrice = 0;
      saveCartToStorage(state);
    },
  },
});

export const { addToCart, removeFromCart, updateQuantity, clearCart } = cartSlice.actions;
export default cartSlice.reducer;

