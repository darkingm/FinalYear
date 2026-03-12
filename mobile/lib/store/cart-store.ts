import { create } from 'zustand';

interface CartItem {
  product_id: number;
  name: string;
  price: number;
  token_symbol?: string;
  price_in_token?: number;
  quantity: number;
  image?: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (product_id: number) => void;
  updateQty: (product_id: number, qty: number) => void;
  clear: () => void;
  totalItems: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (item) => {
    const existing = get().items.find(i => i.product_id === item.product_id);
    if (existing) {
      set(s => ({ items: s.items.map(i => i.product_id === item.product_id ? { ...i, quantity: i.quantity + 1 } : i) }));
    } else {
      set(s => ({ items: [...s.items, { ...item, quantity: 1 }] }));
    }
  },

  removeItem: (product_id) => set(s => ({ items: s.items.filter(i => i.product_id !== product_id) })),

  updateQty: (product_id, qty) => {
    if (qty <= 0) {
      get().removeItem(product_id);
    } else {
      set(s => ({ items: s.items.map(i => i.product_id === product_id ? { ...i, quantity: qty } : i) }));
    }
  },

  clear: () => set({ items: [] }),

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}));
