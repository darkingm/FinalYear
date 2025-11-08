import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

interface OrderItemAttributes {
  id: string;
  orderId: string;
  productId: string;
  productTitle: string;
  productImage: string;
  sellerId: string;
  sellerName: string;
  quantity: number;
  priceInCoins: number;
  priceInUSD: number;
  subtotalInCoins: number;
  subtotalInUSD: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface OrderItemCreationAttributes
  extends Optional<OrderItemAttributes, 'id'> {}

class OrderItem extends Model<OrderItemAttributes, OrderItemCreationAttributes> implements OrderItemAttributes {
  declare id: string;
  declare orderId: string;
  declare productId: string;
  declare productTitle: string;
  declare productImage: string;
  declare sellerId: string;
  declare sellerName: string;
  declare quantity: number;
  declare priceInCoins: number;
  declare priceInUSD: number;
  declare subtotalInCoins: number;
  declare subtotalInUSD: number;
  
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

OrderItem.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'order_id',
      references: {
        model: 'orders',
        key: 'id',
      },
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
  },
  {
    sequelize,
    tableName: 'order_items',
    underscored: true,
    indexes: [
      { fields: ['order_id'] },
      { fields: ['product_id'] },
      { fields: ['seller_id'] },
    ],
  }
);

export default OrderItem;

