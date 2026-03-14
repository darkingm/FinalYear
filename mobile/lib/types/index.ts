// ─── NFT Types ────────────────────────────────────────────────────────────────
export interface NFTAttribute {
  trait_type: string;
  value: string | number;
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;          // IPFS URI e.g. ipfs://...
  imageUrl?: string;      // HTTP gateway URL (resolved)
  attributes: NFTAttribute[];
  physical_hash?: string;
  product_id?: number;
}

export interface NFTItem {
  token_id: string;
  contract_address: string;
  product_name: string;
  product_id: number;
  primary_image: string | null;
  nft_metadata_uri: string | null;
  mint_tx_hash: string | null;
  nfc_verified: boolean;
  owner_address: string;
  minted_at: string;
  metadata?: NFTMetadata;
}

// ─── Seller Types ─────────────────────────────────────────────────────────────
export interface SellerStats {
  revenue_today: number;
  revenue_7d: number;
  revenue_30d: number;
  orders_total: number;
  orders_pending: number;
  orders_completed: number;
  orders_cancelled: number;
  products_active: number;
  products_out_of_stock: number;
  avg_rating: number;
  fulfillment_rate: number;
  credit_score: number;
  revenue_chart: { date: string; amount: number }[];
}

export interface SellerProduct {
  product_id: number;
  name: string;
  stock: number;
  price_usd: number;
  price_in_token: number | null;
  token_symbol: string | null;
  primary_image: string | null;
  status: 'active' | 'inactive' | 'draft';
  sales_count: number;
  has_nft: boolean;
  low_stock_threshold: number;
}

// ─── Flash Sale Types ─────────────────────────────────────────────────────────
export interface FlashSale {
  id: number;
  product_id: number;
  product_name: string;
  primary_image: string | null;
  original_price: number;
  sale_price: number;
  discount_percent: number;
  start_at: string;
  end_at: string;
  quantity_limit: number;
  quantity_sold: number;
  is_active: boolean;
}

// ─── Installment Types ────────────────────────────────────────────────────────
export type InstallmentStatus = 'PENDING' | 'PAID' | 'OVERDUE';

export interface InstallmentKy {
  ky_number: number;         // 1, 2, 3
  amount: number;
  due_date: string;
  paid_at: string | null;
  status: InstallmentStatus;
  tx_hash: string | null;
}

export interface InstallmentPlan {
  plan_id: number;
  order_id: number;
  product_name: string;
  total_amount: number;
  token_symbol: string | null;
  installments: InstallmentKy[];
  is_eligible: boolean;
  ineligible_reason?: string;
}

// ─── Leaderboard Types ────────────────────────────────────────────────────────
export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  avatar: string | null;
  credit_score: number;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND';
  orders_completed: number;
  is_self?: boolean;
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
  self_rank: number | null;
  self_score: number;
  total_users: number;
}

// ─── Price History ────────────────────────────────────────────────────────────
export interface PriceHistoryPoint {
  date: string;
  price_usd: number;
  price_token: number | null;
  token_symbol: string | null;
}

// ─── Tier 4: AI Types ─────────────────────────────────────────────────────────

export interface AIDescriptionResult {
  name_suggestion: string;
  description: string;
  tags: string[];
  suggested_category: string;
  confidence: number;
}

export interface DynamicPricingSuggestion {
  product_id: number;
  suggested_price_usd: number;
  min_price_usd: number;
  max_price_usd: number;
  reasoning: string;
  market_trend: 'up' | 'down' | 'stable';
  confidence: number;
  comparable_products: { name: string; price_usd: number }[];
}

export type FraudRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface FraudScore {
  score: number;
  risk_level: FraudRiskLevel;
  flags: string[];
  recommendation: string;
  checked_at: string;
}

// ─── Tier 4: Geo Types ────────────────────────────────────────────────────────

export interface GeoCoords {
  latitude: number;
  longitude: number;
}

export interface GeoProduct {
  product_id: number;
  name: string;
  base_price_usd: number;
  price_in_token: number | null;
  token_symbol: string | null;
  primary_image: string | null;
  category: string;
  rating_avg: number;
  seller_name: string;
  seller_city: string;
  distance_km: number;
  has_nft: boolean;
  seller_lat: number;
  seller_lng: number;
}

