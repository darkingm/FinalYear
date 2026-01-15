// Auth Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  fullName: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      username: string;
      fullName: string;
      role: string;
    };
  };
}

// Product Types
export interface Product {
  _id: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar?: string;
  title: string;
  description: string;
  category: string;
  images: string[];
  priceInCoins: number;
  priceInUSD: number;
  coinSymbol: string;
  condition: 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'POOR';
  status: 'DRAFT' | 'ACTIVE' | 'SOLD' | 'SUSPENDED' | 'DELETED';
  quantity: number;
  location: string;
  views: number;
  likes: string[];
  rating?: number;
  reviews?: number;
}

// Cart Types
export interface CartItem {
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

// Order Types
export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  shippingName: string;
  shippingEmail: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingCountry: string;
  shippingPostalCode: string;
  totalItems: number;
  subtotalInCoins: number;
  subtotalInUSD: number;
  shippingFeeInCoins: number;
  shippingFeeInUSD: number;
  totalInCoins: number;
  totalInUSD: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  voucherCode?: string;
  voucherDiscountAmount?: number;
  createdAt: string;
  updatedAt: string;
}

// Coin Types
export interface Coin {
  coinId: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  priceChangePercentage24h: number;
}

// Wallet Types
export interface CoinBalance {
  coinId: string;
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
}

// P2P Types
export interface P2PTrade {
  id: string;
  userId: string;
  tradeType: 'BUY' | 'SELL';
  coinAmount: number;
  coinType: string;
  fiatAmount: number;
  fiatCurrency: string;
  exchangeRate: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  status: string;
  paymentProofImage?: string;
  createdAt: string;
  updatedAt: string;
}

// Chat Types
export interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'file';
  createdAt: string;
}


