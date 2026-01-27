import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

export enum AddressType {
  SHIPPING = 'shipping',
  BILLING = 'billing',
}

interface UserAddressAttributes {
  id: string;
  userId: string;
  addressType: AddressType;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateProvince?: string;
  postalCode?: string;
  country: string;
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserAddressCreationAttributes extends Optional<UserAddressAttributes, 'id'> {}

class UserAddress extends Model<UserAddressAttributes, UserAddressCreationAttributes> 
  implements UserAddressAttributes {
  declare id: string;
  declare userId: string;
  declare addressType: AddressType;
  declare recipientName: string;
  declare phone: string;
  declare addressLine1: string;
  declare addressLine2?: string;
  declare city: string;
  declare stateProvince?: string;
  declare postalCode?: string;
  declare country: string;
  declare isDefault: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

UserAddress.init(
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
    addressType: {
      type: DataTypes.ENUM(...Object.values(AddressType)),
      allowNull: false,
      field: 'address_type',
    },
    recipientName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'recipient_name',
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    addressLine1: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: 'address_line1',
    },
    addressLine2: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'address_line2',
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    stateProvince: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'state_province',
    },
    postalCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'postal_code',
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_default',
    },
  },
  {
    sequelize,
    tableName: 'user_addresses',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['user_id', 'is_default'] },
      { fields: ['user_id', 'address_type'] },
    ],
  }
);

export default UserAddress;
