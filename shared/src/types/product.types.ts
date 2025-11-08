export enum ProductStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SOLD = 'SOLD',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

export enum ProductCondition {
  NEW = 'NEW',
  LIKE_NEW = 'LIKE_NEW',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  POOR = 'POOR',
}

export interface IProduct {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar?: string;
  title: string;
  description: string;
  category: string;
  subCategory?: string;
  images: string[];
  priceInCoins: number;
  priceInUSD: number;
  condition: ProductCondition;
  status: ProductStatus;
  quantity: number;
  location: string;
  tags: string[];
  views: number;
  likes: number;
  tokenized: boolean;
  tokenAddress?: string;
  tokenId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductFilter {
  category?: string;
  subCategory?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: ProductCondition;
  location?: string;
  sellerId?: string;
  status?: ProductStatus;
  search?: string;
  semanticSearch?: boolean;
  tags?: string[];
}

export interface IProductListResponse {
  products: IProduct[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ICreateProductRequest {
  title: string;
  description: string;
  category: string;
  subCategory?: string;
  images: string[];
  priceInCoins: number;
  condition: ProductCondition;
  quantity: number;
  location: string;
  tags?: string[];
  tokenize?: boolean;
}

export interface IUpdateProductRequest extends Partial<ICreateProductRequest> {
  status?: ProductStatus;
}

