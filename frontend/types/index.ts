// ============================================================================
// DOMAIN TYPES – Single source of truth for the entire frontend
// ============================================================================

// --- User ---
export type UserRole = 'buyer' | 'seller' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'banned';

export interface User {
  user_id: number;
  email: string;
  username: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  wallet_address: string | null;
  paypal_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// --- Product ---
export type ProductStatus = 'active' | 'inactive' | 'deleted';

export interface ProductMetadata {
  images?: string[];
  category?: string;
  attributes?: Record<string, string>;
  ipfs_hash?: string;
  accepted_tokens?: {
    crypto?: string[];
    fiat?: string[];
  };
}

export interface Product {
  product_id: number;
  seller_id: number;
  name: string;
  description: string;
  base_price_usd: number;
  metadata: ProductMetadata;
  status: ProductStatus;
  stock: number;
  seller_name: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProductPayload {
  name: string;
  description: string;
  base_price_usd: number;
  stock: number;
  category?: string;
  images?: File[];
  accepted_crypto?: string[];
  accept_paypal?: boolean;
}

// --- Order ---
export type OrderStatus =
  | 'UNPAID'
  | 'PAID'
  | 'ESCROW_LOCKED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'DISPUTE';

export type PaymentMethod = 'crypto' | 'paypal';

export interface Order {
  order_id: number;
  internal_order_id: string;
  product_id: number;
  product_name: string;
  product_metadata?: ProductMetadata;
  buyer_id: number;
  seller_id: number;
  buyer_name: string;
  seller_name: string;
  quantity: number;
  price_usd: number;
  token_id?: number;
  amount_token?: number;
  chain_id?: number;
  escrow_contract?: string;
  status: OrderStatus;
  payment_method: PaymentMethod | null;
  paypal_order_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderPayload {
  product_id: number;
  quantity: number;
  payment_method?: PaymentMethod;
}

// --- Payment / Crypto ---
export interface CryptoQuote {
  order_id: number;
  escrow_contract: string;
  token_address: string;
  chain_id: number;
  amount_token: number;
  amount_wei: string;
  calldata: string;
  token_price: number;
  expires_at: number;
}

export interface PaymentRecord {
  payment_id: number;
  order_id: number;
  tx_hash: string;
  chain_id: number;
  status: 'pending' | 'confirmed' | 'failed';
  from_address: string;
  to_address: string;
  block_number?: number;
  created_at: string;
}

// --- Wallet / Token ---
export interface TokenInfo {
  token_id: number;
  symbol: string;
  token_address: string;
  chain_id: number;
  decimals: number;
  is_active: boolean;
}

export interface TokenBalance {
  symbol: string;
  balance: number;
  balanceFormatted: string;
  usdValue: number;
  tokenAddress?: string;
  logo: string;
}

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  chainId: number | null;
  tokenBalances: TokenBalance[];
  totalUSD: number;
}

// --- Realtime / Price ---
export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

export interface CoinTicker {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openPrice: string;
  count: number;
}

// --- API Response wrappers ---
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// --- Notification ---
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
}

// --- Address ---
export interface Address {
  address_id: number;
  user_id: number;
  label: string;
  full_name: string;
  phone: string;
  address_line: string;
  street?: string;
  ward?: string;
  district?: string;
  province?: string;
  city?: string;
  state?: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

// --- Coupon ---
export interface Coupon {
  coupon_id: number;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed' | 'fixed_amount' | 'free_shipping';
  discount_value: number;
  min_order_amount?: number;
  min_order_usd?: number;
  max_discount_usd?: number;
  max_uses?: number;
  usage_limit?: number;
  per_user_limit?: number;
  used_count: number;
  starts_at?: string;
  expires_at: string;
  is_active: boolean;
  created_at?: string;
}

