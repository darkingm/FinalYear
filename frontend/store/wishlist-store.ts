import { create } from 'zustand';

interface WishlistItem {
    product_id: number;
    wishlist_id?: number;
    name: string;
    base_price_usd: number;
    primary_image?: string;
    status?: string;
    seller_name?: string;
    compare_price_usd?: number | string;
    avg_rating?: number;
    review_count?: number;
    stock?: number;
    metadata?: { images?: string[] };
}

interface WishlistStore {
    items: WishlistItem[];
    addItem: (item: WishlistItem) => void;
    removeItem: (productId: number) => void;
    isWishlisted: (productId: number) => boolean;
    clearWishlist: () => void;
}

export const useWishlistStore = create<WishlistStore>((set, get) => ({
    items: [],
    addItem: (item) => set((state) => ({ items: [...state.items, item] })),
    removeItem: (productId) => set((state) => ({ items: state.items.filter(i => i.product_id !== productId) })),
    isWishlisted: (productId) => get().items.some(i => i.product_id === productId),
    clearWishlist: () => set({ items: [] }),
}));
