import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

export enum VoucherType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  FREE_SHIPPING = 'FREE_SHIPPING',
}

export enum VoucherStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  EXPIRED = 'EXPIRED',
}

interface VoucherAttributes {
  id: string;
  code: string;
  sellerId: string; // null for global vouchers
  title: string;
  description?: string;
  type: VoucherType;
  discountValue: number; // Percentage or fixed amount
  minPurchaseAmount?: number; // Minimum purchase to use voucher
  maxDiscountAmount?: number; // Maximum discount for percentage vouchers
  maxUses?: number; // Total uses allowed
  maxUsesPerUser?: number; // Uses per user
  usedCount: number;
  startDate: Date;
  endDate: Date;
  status: VoucherStatus;
  applicableCategories?: string[]; // Product categories
  applicableProducts?: string[]; // Product IDs
  createdAt?: Date;
  updatedAt?: Date;
}

interface VoucherCreationAttributes
  extends Optional<
    VoucherAttributes,
    | 'id'
    | 'sellerId'
    | 'description'
    | 'minPurchaseAmount'
    | 'maxDiscountAmount'
    | 'maxUses'
    | 'maxUsesPerUser'
    | 'usedCount'
    | 'applicableCategories'
    | 'applicableProducts'
    | 'status'
  > {}

class Voucher extends Model<VoucherAttributes, VoucherCreationAttributes>
  implements VoucherAttributes {
  declare id: string;
  declare code: string;
  declare sellerId: string;
  declare title: string;
  declare description?: string;
  declare type: VoucherType;
  declare discountValue: number;
  declare minPurchaseAmount?: number;
  declare maxDiscountAmount?: number;
  declare maxUses?: number;
  declare maxUsesPerUser?: number;
  declare usedCount: number;
  declare startDate: Date;
  declare endDate: Date;
  declare status: VoucherStatus;
  declare applicableCategories?: string[];
  declare applicableProducts?: string[];

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // Check if voucher is valid
  isValid(): boolean {
    const now = new Date();
    return (
      this.status === VoucherStatus.ACTIVE &&
      now >= this.startDate &&
      now <= this.endDate &&
      (!this.maxUses || this.usedCount < this.maxUses)
    );
  }

  // Calculate discount amount
  calculateDiscount(amount: number): number {
    if (!this.isValid() || (this.minPurchaseAmount && amount < this.minPurchaseAmount)) {
      return 0;
    }

    let discount = 0;

    switch (this.type) {
      case VoucherType.PERCENTAGE:
        discount = (amount * this.discountValue) / 100;
        if (this.maxDiscountAmount) {
          discount = Math.min(discount, this.maxDiscountAmount);
        }
        break;
      case VoucherType.FIXED_AMOUNT:
        discount = Math.min(this.discountValue, amount);
        break;
      case VoucherType.FREE_SHIPPING:
        discount = 0; // Will be handled separately
        break;
    }

    return Math.max(0, discount);
  }
}

Voucher.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
      },
    },
    sellerId: {
      type: DataTypes.STRING,
      allowNull: true, // null for global vouchers
      field: 'seller_id',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    type: {
      type: DataTypes.ENUM(...Object.values(VoucherType)),
      allowNull: false,
    },
    discountValue: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      field: 'discount_value',
    },
    minPurchaseAmount: {
      type: DataTypes.DECIMAL(18, 2),
      field: 'min_purchase_amount',
    },
    maxDiscountAmount: {
      type: DataTypes.DECIMAL(18, 2),
      field: 'max_discount_amount',
    },
    maxUses: {
      type: DataTypes.INTEGER,
      field: 'max_uses',
    },
    maxUsesPerUser: {
      type: DataTypes.INTEGER,
      field: 'max_uses_per_user',
    },
    usedCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'used_count',
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'start_date',
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'end_date',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(VoucherStatus)),
      defaultValue: VoucherStatus.ACTIVE,
    },
    applicableCategories: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      field: 'applicable_categories',
    },
    applicableProducts: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      field: 'applicable_products',
    },
  },
  {
    sequelize,
    tableName: 'vouchers',
    underscored: true,
    indexes: [
      { fields: ['code'], unique: true },
      { fields: ['seller_id'] },
      { fields: ['status'] },
      { fields: ['start_date', 'end_date'] },
    ],
    hooks: {
      beforeSave: async (voucher) => {
        // Update status based on dates
        const now = new Date();
        if (voucher.status === VoucherStatus.ACTIVE && now > voucher.endDate) {
          voucher.status = VoucherStatus.EXPIRED;
        }
      },
    },
  }
);

export default Voucher;


