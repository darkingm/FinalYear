import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

export enum P2PTradeStatus {
  PENDING = 'PENDING',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAYMENT_SUBMITTED = 'PAYMENT_SUBMITTED',
  VERIFYING = 'VERIFYING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED',
}

export enum P2PTradeType {
  BUY = 'BUY',   // User buying coins
  SELL = 'SELL', // User selling coins
}

interface P2PTradeAttributes {
  id: string;
  userId: string;
  tradeType: P2PTradeType;
  coinAmount: number;
  coinType: string; // 'BTC', 'ETH', etc.
  fiatAmount: number;
  fiatCurrency: string; // 'USD', 'VND', etc.
  exchangeRate: number;
  
  // Bank details
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  
  // Verification
  paymentProofImage?: string;
  verifiedByAdmin?: string;
  verificationNotes?: string;
  
  status: P2PTradeStatus;
  
  // Timestamps for different stages
  paymentSubmittedAt?: Date;
  verifiedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  
  createdAt?: Date;
  updatedAt?: Date;
}

interface P2PTradeCreationAttributes
  extends Optional<
    P2PTradeAttributes,
    'id' | 'status' | 'paymentProofImage' | 'verifiedByAdmin' | 'verificationNotes' |
    'paymentSubmittedAt' | 'verifiedAt' | 'completedAt' | 'cancelledAt'
  > {}

class P2PTrade extends Model<P2PTradeAttributes, P2PTradeCreationAttributes> implements P2PTradeAttributes {
  declare id: string;
  declare userId: string;
  declare tradeType: P2PTradeType;
  declare coinAmount: number;
  declare coinType: string;
  declare fiatAmount: number;
  declare fiatCurrency: string;
  declare exchangeRate: number;
  
  declare bankName: string;
  declare bankAccountNumber: string;
  declare bankAccountName: string;
  
  declare paymentProofImage?: string;
  declare verifiedByAdmin?: string;
  declare verificationNotes?: string;
  
  declare status: P2PTradeStatus;
  
  declare paymentSubmittedAt?: Date;
  declare verifiedAt?: Date;
  declare completedAt?: Date;
  declare cancelledAt?: Date;
  
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

P2PTrade.init(
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
    tradeType: {
      type: DataTypes.ENUM(...Object.values(P2PTradeType)),
      allowNull: false,
      field: 'trade_type',
    },
    coinAmount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'coin_amount',
    },
    coinType: {
      type: DataTypes.STRING(10),
      allowNull: false,
      field: 'coin_type',
    },
    fiatAmount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      field: 'fiat_amount',
    },
    fiatCurrency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      field: 'fiat_currency',
    },
    exchangeRate: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'exchange_rate',
    },
    
    bankName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'bank_name',
    },
    bankAccountNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'bank_account_number',
    },
    bankAccountName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'bank_account_name',
    },
    
    paymentProofImage: {
      type: DataTypes.STRING,
      field: 'payment_proof_image',
    },
    verifiedByAdmin: {
      type: DataTypes.STRING,
      field: 'verified_by_admin',
    },
    verificationNotes: {
      type: DataTypes.TEXT,
      field: 'verification_notes',
    },
    
    status: {
      type: DataTypes.ENUM(...Object.values(P2PTradeStatus)),
      defaultValue: P2PTradeStatus.PENDING,
    },
    
    paymentSubmittedAt: {
      type: DataTypes.DATE,
      field: 'payment_submitted_at',
    },
    verifiedAt: {
      type: DataTypes.DATE,
      field: 'verified_at',
    },
    completedAt: {
      type: DataTypes.DATE,
      field: 'completed_at',
    },
    cancelledAt: {
      type: DataTypes.DATE,
      field: 'cancelled_at',
    },
  },
  {
    sequelize,
    tableName: 'p2p_trades',
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['status'] },
      { fields: ['trade_type'] },
    ],
  }
);

export default P2PTrade;

