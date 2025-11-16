import Order from './Order.model';
import OrderItem from './OrderItem.model';

// Define associations after both models are initialized
Order.hasMany(OrderItem, {
  foreignKey: 'orderId',
  as: 'items',
  onDelete: 'CASCADE',
});

OrderItem.belongsTo(Order, {
  foreignKey: 'orderId',
  as: 'order',
});

export { Order, OrderItem };
