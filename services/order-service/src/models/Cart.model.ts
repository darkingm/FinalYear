import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

interface CartItemAttributes {
  id: string;
  userId: string;
  productId: string;
  productTitle: string;
  productImage: string;
  sellerId: string;
  sellerName: string;
  quantity: number;
  priceInCoins: number;
  priceInUSD: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CartItemCreationAttributes
  extends Optional<CartItemAttributes, 'id'> {}

class CartItem extends Model<CartItemAttributes, CartItemCreationAttributes> implements CartItemAttributes {
  declare id: string;
  declare userId: string;
  declare productId: string;
  declare productTitle: string;
  declare productImage: string;
  declare sellerId: string;
  declare sellerName: string;
  declare quantity: number;
  declare priceInCoins: number;
  declare priceInUSD: number;
  
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

CartItem.init(
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
    productId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'product_id',
    },
    productTitle: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'product_title',
    },
    productImage: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'product_image',
    },
    sellerId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'seller_id',
    },
    sellerName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'seller_name',
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
      },
    },
    priceInCoins: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'price_in_coins',
    },
    priceInUSD: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      field: 'price_in_usd',
    },
  },
  {
    sequelize,
    tableName: 'cart_items',
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['product_id'] },
      { fields: ['user_id', 'product_id'], unique: true },
    ],
  }
);

export default CartItem;

