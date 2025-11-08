export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPING = 'SHIPPING',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  COIN = 'COIN',
  CREDIT_CARD = 'CREDIT_CARD',
  PAYPAL = 'PAYPAL',
  BANK_TRANSFER = 'BANK_TRANSFER',
  P2P = 'P2P',
}

export interface IOrderItem {
  productId: string;
  productTitle: string;
  productImage: string;
  sellerId: string;
  sellerName: string;
  quantity: number;
  priceInCoins: number;
  priceInUSD: number;
  totalCoins: number;
  totalUSD: number;
}

export interface IOrder {
  id: string;
  orderNumber: string;
  userId: string;
  items: IOrderItem[];
  totalItems: number;
  subtotalCoins: number;
  subtotalUSD: number;
  shippingFeeCoins: number;
  shippingFeeUSD: number;
  taxCoins: number;
  taxUSD: number;
  totalCoins: number;
  totalUSD: number;
  paymentMethod: PaymentMethod;
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  status: OrderStatus;
  shippingAddress: IShippingAddress;
  trackingNumber?: string;
  notes?: string;
  transactionHash?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
}

export interface IShippingAddress {
  fullName: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface ICart {
  userId: string;
  items: ICartItem[];
  totalItems: number;
  totalCoins: number;
  totalUSD: number;
  updatedAt: Date;
}

export interface ICartItem {
  productId: string;
  quantity: number;
  addedAt: Date;
}

export interface ICreateOrderRequest {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  shippingAddress: IShippingAddress;
  paymentMethod: PaymentMethod;
  notes?: string;
}

