import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  COIN = 'COIN',
  P2P = 'P2P',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

interface PaymentAttributes {
  id: string;
  userId: string;
  orderId?: string;
  amount: number;
  currency: string; // 'USD', 'BTC', 'ETH', etc.
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  
  // Stripe specific
  stripePaymentIntentId?: string;
  stripeCustomerId?: string;
  
  // P2P specific
  p2pTradeId?: string;
  
  // Metadata
  metadata?: any;
  errorMessage?: string;
  
  createdAt?: Date;
  updatedAt?: Date;
}

interface PaymentCreationAttributes
  extends Optional<
    PaymentAttributes,
    'id' | 'orderId' | 'status' | 'stripePaymentIntentId' | 'stripeCustomerId' |
    'p2pTradeId' | 'metadata' | 'errorMessage'
  > {}

class Payment extends Model<PaymentAttributes, PaymentCreationAttributes> implements PaymentAttributes {
  declare id: string;
  declare userId: string;
  declare orderId?: string;
  declare amount: number;
  declare currency: string;
  declare paymentMethod: PaymentMethod;
  declare status: PaymentStatus;
  
  declare stripePaymentIntentId?: string;
  declare stripeCustomerId?: string;
  declare p2pTradeId?: string;
  
  declare metadata?: any;
  declare errorMessage?: string;
  
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Payment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'user_id',
    },
    orderId: {
      type: DataTypes.STRING,
      field: 'order_id',
    },
    amount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    paymentMethod: {
      type: DataTypes.ENUM(...Object.values(PaymentMethod)),
      allowNull: false,
      field: 'payment_method',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(PaymentStatus)),
      defaultValue: PaymentStatus.PENDING,
    },
    
    stripePaymentIntentId: {
      type: DataTypes.STRING,
      field: 'stripe_payment_intent_id',
    },
    stripeCustomerId: {
      type: DataTypes.STRING,
      field: 'stripe_customer_id',
    },
    
    p2pTradeId: {
      type: DataTypes.STRING,
      field: 'p2p_trade_id',
    },
    
    metadata: {
      type: DataTypes.JSONB,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      field: 'error_message',
    },
  },
  {
    sequelize,
    tableName: 'payments',
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['order_id'] },
      { fields: ['status'] },
      { fields: ['stripe_payment_intent_id'] },
    ],
  }
);

export default Payment;

