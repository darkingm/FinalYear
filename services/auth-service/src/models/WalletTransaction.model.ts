import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER = 'TRANSFER',
  ORDER_PURCHASE = 'ORDER_PURCHASE',
  ORDER_RECEIVED = 'ORDER_RECEIVED',
  ORDER_REFUND = 'ORDER_REFUND',
  ADMIN_ADJUSTMENT = 'ADMIN_ADJUSTMENT',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

interface WalletTransactionAttributes {
  id: string;
  userId: string;
  transactionType: TransactionType;
  coinSymbol: string;
  amount: number;
  fee: number;
  balanceAfter: number;
  relatedOrderId?: string;
  relatedUserId?: string;
  relatedTransactionId?: string;
  txHash?: string;
  fromAddress?: string;
  toAddress?: string;
  description?: string;
  status: TransactionStatus;
  createdAt?: Date;
}

interface WalletTransactionCreationAttributes extends Optional<WalletTransactionAttributes, 'id'> {}

class WalletTransaction extends Model<WalletTransactionAttributes, WalletTransactionCreationAttributes> 
  implements WalletTransactionAttributes {
  declare id: string;
  declare userId: string;
  declare transactionType: TransactionType;
  declare coinSymbol: string;
  declare amount: number;
  declare fee: number;
  declare balanceAfter: number;
  declare relatedOrderId?: string;
  declare relatedUserId?: string;
  declare relatedTransactionId?: string;
  declare txHash?: string;
  declare fromAddress?: string;
  declare toAddress?: string;
  declare description?: string;
  declare status: TransactionStatus;
  declare readonly createdAt: Date;
}

WalletTransaction.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    transactionType: {
      type: DataTypes.ENUM(...Object.values(TransactionType)),
      allowNull: false,
      field: 'transaction_type',
    },
    coinSymbol: {
      type: DataTypes.STRING(10),
      allowNull: false,
      field: 'coin_symbol',
    },
    amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
    fee: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
    },
    balanceAfter: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      field: 'balance_after',
    },
    relatedOrderId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'related_order_id',
    },
    relatedUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'related_user_id',
    },
    relatedTransactionId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'related_transaction_id',
    },
    txHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'tx_hash',
    },
    fromAddress: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'from_address',
    },
    toAddress: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'to_address',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(TransactionStatus)),
      allowNull: false,
      defaultValue: TransactionStatus.COMPLETED,
    },
  },
  {
    sequelize,
    tableName: 'wallet_transactions',
    underscored: true,
    timestamps: true,
    updatedAt: false, // Transactions are immutable
    indexes: [
      { fields: ['user_id'] },
      { fields: ['coin_symbol'] },
      { fields: ['transaction_type'] },
      { fields: ['status'] },
      { fields: ['created_at'] },
      { fields: ['user_id', 'coin_symbol', 'created_at'] },
    ],
  }
);

export default WalletTransaction;
