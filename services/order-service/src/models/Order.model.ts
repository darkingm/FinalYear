import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

interface OrderAttributes {
  id: string;
  orderNumber: string;
  userId: string;
  
  // Delivery info
  shippingName: string;
  shippingEmail: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingCountry: string;
  shippingPostalCode: string;
  
  // Order summary
  totalItems: number;
  subtotalInCoins: number;
  subtotalInUSD: number;
  shippingFeeInCoins: number;
  shippingFeeInUSD: number;
  totalInCoins: number;
  totalInUSD: number;
  
  // Payment
  paymentMethod: string; // 'COIN', 'CREDIT_CARD', 'P2P'
  paymentStatus: PaymentStatus;
  paymentTransactionId?: string;
  paidAt?: Date;
  
  // Status
  orderStatus: OrderStatus;
  notes?: string;
  
  // Tracking
  trackingNumber?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  
  createdAt?: Date;
  updatedAt?: Date;
}

interface OrderCreationAttributes
  extends Optional<
    OrderAttributes,
    'id' | 'orderNumber' | 'paymentStatus' | 'orderStatus' |
    'paymentTransactionId' | 'paidAt' | 'trackingNumber' | 'shippedAt' |
    'deliveredAt' | 'cancelledAt' | 'cancellationReason' | 'notes'
  > {}

class Order extends Model<OrderAttributes, OrderCreationAttributes> implements OrderAttributes {
  declare id: string;
  declare orderNumber: string;
  declare userId: string;
  
  declare shippingName: string;
  declare shippingEmail: string;
  declare shippingPhone: string;
  declare shippingAddress: string;
  declare shippingCity: string;
  declare shippingCountry: string;
  declare shippingPostalCode: string;
  
  declare totalItems: number;
  declare subtotalInCoins: number;
  declare subtotalInUSD: number;
  declare shippingFeeInCoins: number;
  declare shippingFeeInUSD: number;
  declare totalInCoins: number;
  declare totalInUSD: number;
  
  declare paymentMethod: string;
  declare paymentStatus: PaymentStatus;
  declare paymentTransactionId?: string;
  declare paidAt?: Date;
  
  declare orderStatus: OrderStatus;
  declare notes?: string;
  
  declare trackingNumber?: string;
  declare shippedAt?: Date;
  declare deliveredAt?: Date;
  declare cancelledAt?: Date;
  declare cancellationReason?: string;
  
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Order.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    orderNumber: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      field: 'order_number',
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'user_id',
    },
    
    shippingName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'shipping_name',
    },
    shippingEmail: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'shipping_email',
    },
    shippingPhone: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'shipping_phone',
    },
    shippingAddress: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'shipping_address',
    },
    shippingCity: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'shipping_city',
    },
    shippingCountry: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'shipping_country',
    },
    shippingPostalCode: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'shipping_postal_code',
    },
    
    totalItems: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'total_items',
    },
    subtotalInCoins: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'subtotal_in_coins',
    },
    subtotalInUSD: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      field: 'subtotal_in_usd',
    },
    shippingFeeInCoins: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'shipping_fee_in_coins',
    },
    shippingFeeInUSD: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      field: 'shipping_fee_in_usd',
    },
    totalInCoins: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'total_in_coins',
    },
    totalInUSD: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      field: 'total_in_usd',
    },
    
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'payment_method',
    },
    paymentStatus: {
      type: DataTypes.ENUM(...Object.values(PaymentStatus)),
      defaultValue: PaymentStatus.PENDING,
      field: 'payment_status',
    },
    paymentTransactionId: {
      type: DataTypes.STRING,
      field: 'payment_transaction_id',
    },
    paidAt: {
      type: DataTypes.DATE,
      field: 'paid_at',
    },
    
    orderStatus: {
      type: DataTypes.ENUM(...Object.values(OrderStatus)),
      defaultValue: OrderStatus.PENDING,
      field: 'order_status',
    },
    notes: {
      type: DataTypes.TEXT,
    },
    
    trackingNumber: {
      type: DataTypes.STRING,
      field: 'tracking_number',
    },
    shippedAt: {
      type: DataTypes.DATE,
      field: 'shipped_at',
    },
    deliveredAt: {
      type: DataTypes.DATE,
      field: 'delivered_at',
    },
    cancelledAt: {
      type: DataTypes.DATE,
      field: 'cancelled_at',
    },
    cancellationReason: {
      type: DataTypes.TEXT,
      field: 'cancellation_reason',
    },
  },
  {
    sequelize,
    tableName: 'orders',
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['order_number'], unique: true },
      { fields: ['order_status'] },
      { fields: ['payment_status'] },
    ],
    hooks: {
      beforeCreate: async (order) => {
        // Generate order number
        order.orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      },
    },
  }
);

export default Order;

