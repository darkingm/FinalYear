import { create } from 'zustand';

interface CartItem {
    product_id: number;
    name: string;
    base_price_usd: number;
    quantity: number;
    metadata?: { images?: string[] };
}

interface CartStore {
    items: CartItem[];
    addItem: (item: Omit<CartItem, 'quantity'>) => void;
    removeItem: (productId: number) => void;
    updateQuantity: (productId: number, quantity: number) => void;
    clearCart: () => void;
    getTotal: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
    items: [],
    addItem: (item) =>
        set((state) => {
            const existing = state.items.find(i => i.product_id === item.product_id);
            if (existing) {
                return {
                    items: state.items.map(i =>
                        i.product_id === item.product_id ? { ...i, quantity: i.quantity + 1 } : i
                    ),
                };
            }
            return { items: [...state.items, { ...item, quantity: 1 }] };
        }),
    removeItem: (productId) =>
        set((state) => ({ items: state.items.filter(i => i.product_id !== productId) })),
    updateQuantity: (productId, quantity) =>
        set((state) => ({
            items: state.items.map(i =>
                i.product_id === productId ? { ...i, quantity } : i
            ),
        })),
    clearCart: () => set({ items: [] }),
    getTotal: () => get().items.reduce((sum, i) => sum + i.base_price_usd * i.quantity, 0),
}));
