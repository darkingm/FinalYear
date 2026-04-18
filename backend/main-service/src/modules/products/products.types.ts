export interface ProductAcceptedTokenInput {
  token_id?: number;
  symbol?: string | null;
  amount?: string | number | null;
  price_in_token?: string | number | null;
  is_primary?: boolean | null;
  chain_id?: number | null;
  chain_name?: string | null;
  decimals?: number | null;
  token_address?: string | null;
}

export interface ProductAcceptedTokenRow {
  token_id: number;
  symbol: string;
  price_in_token: string;
  is_primary: boolean;
}

export interface ProductAcceptedTokenView extends ProductAcceptedTokenRow {
  chain_id?: number | null;
  chain_name?: string | null;
  decimals?: number | null;
  token_address?: string | null;
  logo_symbol: string;
}

export interface ProductImageView {
  url: string;
  sort_order: number;
  is_primary: boolean;
}

export interface LegacyAcceptedTokenMigrationRow {
  product_id: number;
  token_id: number;
  price_in_token: string;
  is_primary: boolean;
}

export interface ProductReadModel {
  accepted_tokens: ProductAcceptedTokenView[];
  images: ProductImageView[];
  primary_image: string | null;
  token_symbol?: string | null;
  [key: string]: unknown;
}
