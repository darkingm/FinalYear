export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentType {
  ORDER = 'ORDER',
  P2P_BUY = 'P2P_BUY',
  P2P_SELL = 'P2P_SELL',
  WITHDRAWAL = 'WITHDRAWAL',
  DEPOSIT = 'DEPOSIT',
  REFUND = 'REFUND',
}

export interface IPayment {
  id: string;
  userId: string;
  orderId?: string;
  p2pTradeId?: string;
  type: PaymentType;
  method: string;
  amountCoins: number;
  amountUSD: number;
  status: PaymentStatus;
  transactionHash?: string;
  gatewayPaymentId?: string;
  gatewayResponse?: any;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  failedReason?: string;
}

export interface ICreditCardPayment {
  cardNumber: string;
  cardHolderName: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
}

export interface IP2PTrade {
  id: string;
  type: 'BUY' | 'SELL';
  sellerId: string;
  sellerName: string;
  buyerId: string;
  buyerName: string;
  amountCoins: number;
  pricePerCoin: number;
  totalUSD: number;
  status: 'PENDING' | 'AWAITING_PAYMENT' | 'PAYMENT_SUBMITTED' | 'VERIFYING' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
  bankTransferProof?: string;
  sellerBankAccount: {
    accountNumber: string;
    bankName: string;
    accountName: string;
  };
  buyerBankAccount?: {
    accountNumber: string;
    bankName: string;
    accountName: string;
  };
  bankVerificationStatus?: 'PENDING' | 'VERIFIED' | 'FAILED';
  escrowTransactionHash?: string;
  releaseTransactionHash?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  expiresAt: Date;
}

export interface ICreateP2PTradeRequest {
  type: 'BUY' | 'SELL';
  amountCoins: number;
  pricePerCoin: number;
  bankAccountNumber: string;
  bankName: string;
  bankAccountName: string;
}

export interface ISubmitP2PPaymentRequest {
  tradeId: string;
  bankTransferProof: string;
  transferFromAccount: string;
}

