import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

interface WalletAttributes {
  id: string;
  userId: string;
  coinSymbol: string;
  availableBalance: number;
  lockedBalance: number;
  walletAddress?: string;
  version: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface WalletCreationAttributes extends Optional<WalletAttributes, 'id' | 'version'> {}

class Wallet extends Model<WalletAttributes, WalletCreationAttributes> implements WalletAttributes {
  declare id: string;
  declare userId: string;
  declare coinSymbol: string;
  declare availableBalance: number;
  declare lockedBalance: number;
  declare walletAddress?: string;
  declare version: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // Helper method to get total balance
  public getTotalBalance(): number {
    return this.availableBalance + this.lockedBalance;
  }

  // Helper method to check if can deduct
  public canDeduct(amount: number): boolean {
    return this.availableBalance >= amount;
  }
}

Wallet.init(
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
    coinSymbol: {
      type: DataTypes.STRING(10),
      allowNull: false,
      field: 'coin_symbol',
    },
    availableBalance: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
      field: 'available_balance',
      validate: {
        min: 0,
      },
    },
    lockedBalance: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
      field: 'locked_balance',
      validate: {
        min: 0,
      },
    },
    walletAddress: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'wallet_address',
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  },
  {
    sequelize,
    tableName: 'wallets',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['coin_symbol'] },
      { unique: true, fields: ['user_id', 'coin_symbol'] },
    ],
    version: true, // Enable optimistic locking
  }
);

export default Wallet;
