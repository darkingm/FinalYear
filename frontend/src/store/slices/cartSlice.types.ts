// Cart types - separated to avoid circular dependencies
export interface CartItem {
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

export interface CartState {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  loading: boolean;
  error: string | null;
}



