export interface ProductAcceptedTokenView {
  token_id: number;
  symbol: string;
  price_in_token: string;
  estimated_usdt?: string | null;
  is_primary: boolean;
  logo_symbol?: string;
  chain_id?: number | null;
  chain_name?: string | null;
  decimals?: number | null;
  token_address?: string | null;
}

export interface ProductPricingDisplayRow extends ProductAcceptedTokenView {
  display_amount: string;
}

export interface ProductTokenChipView extends ProductAcceptedTokenView {
  amountLabel: string;
  isActive: boolean;
}

export interface ProductTokenChipState {
  activeToken: ProductAcceptedTokenView | null;
  visible: ProductTokenChipView[];
  hiddenCount: number;
  all: ProductTokenChipView[];
}

export interface ProductEditorSeedToken {
  token_id: number;
  symbol: string;
  usd_rate: number;
  name?: string;
  is_primary?: boolean;
}

export interface ProductEditorTokenRow {
  token_id: number;
  symbol: string;
  usd_rate: number;
  amount: string;
  is_primary: boolean;
}

export interface ProductGalleryImage {
  url: string;
  sort_order: number;
  is_primary: boolean;
}

export interface ProductEditorImageDraft extends ProductGalleryImage {
  id: string;
  file?: File;
}

export interface ProductUpsertAcceptedTokenPayload {
  token_id: number;
  symbol: string;
  amount: string;
  is_primary: boolean;
}

export interface ProductUpsertPayload {
  name: string;
  description: string;
  category: string;
  base_price_usd: number;
  stock: number;
  accepted_tokens: ProductUpsertAcceptedTokenPayload[];
  images: ProductGalleryImage[];
  metadata?: Record<string, unknown>;
}
