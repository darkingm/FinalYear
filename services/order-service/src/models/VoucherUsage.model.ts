import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

interface VoucherUsageAttributes {
  id: string;
  voucherId: string;
  userId: string;
  orderId: string;
  discountAmount: number;
  createdAt?: Date;
}

interface VoucherUsageCreationAttributes
  extends Optional<VoucherUsageAttributes, 'id'> {}

class VoucherUsage extends Model<VoucherUsageAttributes, VoucherUsageCreationAttributes>
  implements VoucherUsageAttributes {
  declare id: string;
  declare voucherId: string;
  declare userId: string;
  declare orderId: string;
  declare discountAmount: number;

  declare readonly createdAt: Date;
}

VoucherUsage.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    voucherId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'voucher_id',
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'user_id',
    },
    orderId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'order_id',
    },
    discountAmount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      field: 'discount_amount',
    },
  },
  {
    sequelize,
    tableName: 'voucher_usages',
    underscored: true,
    indexes: [
      { fields: ['voucher_id'] },
      { fields: ['user_id'] },
      { fields: ['order_id'] },
      { fields: ['user_id', 'voucher_id'] }, // For checking max uses per user
    ],
  }
);

export default VoucherUsage;


