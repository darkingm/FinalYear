import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ProductAcceptedTokenView } from '@/lib/products/types';

export interface CartItem {
  cart_item_id: string;
  product_id: number;
  name: string;
  base_price_usd: number;
  price_in_token?: number;
  token_symbol?: string;
  selected_token_id?: number | null;
  quantity: number;
  image_url?: string;
  metadata?: { images?: string[] };
  seller_id?: number;
  accepted_tokens?: ProductAcceptedTokenView[];
}

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity' | 'cart_item_id'> & { cart_item_id?: string }) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getTotalItems: () => number;
}

function buildCartItemId(item: {
  product_id: number;
  selected_token_id?: number | null;
  token_symbol?: string;
}) {
  return `${item.product_id}:${item.selected_token_id ?? item.token_symbol ?? 'default'}`;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const cart_item_id = item.cart_item_id || buildCartItemId(item);
          const existing = state.items.find(i => i.cart_item_id === cart_item_id);
          if (existing) {
            return {
              items: state.items.map(i =>
                i.cart_item_id === cart_item_id ? { ...i, quantity: i.quantity + 1 } : i
              ),
            };
          }
          return { items: [...state.items, { ...item, cart_item_id, quantity: 1 }] };
        }),
      removeItem: (cartItemId) =>
        set((state) => ({ items: state.items.filter(i => i.cart_item_id !== cartItemId) })),
      updateQuantity: (cartItemId, quantity) =>
        set((state) => ({
          items: quantity <= 0
            ? state.items.filter(i => i.cart_item_id !== cartItemId)
            : state.items.map(i =>
                i.cart_item_id === cartItemId ? { ...i, quantity } : i
              ),
        })),
      clearCart: () => set({ items: [] }),
      getTotal: () => get().items.reduce((sum, i) => sum + i.base_price_usd * i.quantity, 0),
      getTotalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: 'web3market-cart',       // localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),  // Only persist items
    }
  )
);

