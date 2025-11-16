import { Request, Response } from 'express';
import { Transaction } from 'sequelize';
import Order, { OrderStatus, PaymentStatus } from '../models/Order.model';
import OrderItem from '../models/OrderItem.model';
import CartItem from '../models/Cart.model';
import { sequelize } from '../database';
import { publishEvent } from '../utils/rabbitmq';
import logger from '../utils/logger';

export class OrderController {
  // Create order from cart
  static async createOrder(req: Request, res: Response) {
    const transaction: Transaction = await sequelize.transaction();

    try {
      const userId = req.headers['x-user-id'] as string;
      const {
        shippingName,
        shippingEmail,
        shippingPhone,
        shippingAddress,
        shippingCity,
        shippingCountry,
        shippingPostalCode,
        paymentMethod,
        notes,
      } = req.body;

      // Get cart items
      const cartItems = await CartItem.findAll({
        where: { userId },
      });

      if (cartItems.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: 'Cart is empty',
        });
      }

      // Calculate totals
      const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      const subtotalInCoins = cartItems.reduce((sum, item) => {
        return sum + parseFloat(item.priceInCoins.toString()) * item.quantity;
      }, 0);
      const subtotalInUSD = cartItems.reduce((sum, item) => {
        return sum + parseFloat(item.priceInUSD.toString()) * item.quantity;
      }, 0);

      // Calculate shipping (example: 0.01 coins or $10)
      const shippingFeeInCoins = 0.01;
      const shippingFeeInUSD = 10;

      const totalInCoins = subtotalInCoins + shippingFeeInCoins;
      const totalInUSD = subtotalInUSD + shippingFeeInUSD;

      // Create order
      const order = await Order.create(
        {
          userId,
          shippingName,
          shippingEmail,
          shippingPhone,
          shippingAddress,
          shippingCity,
          shippingCountry,
          shippingPostalCode,
          totalItems,
          subtotalInCoins,
          subtotalInUSD,
          shippingFeeInCoins,
          shippingFeeInUSD,
          totalInCoins,
          totalInUSD,
          paymentMethod,
          paymentStatus: PaymentStatus.PENDING,
          orderStatus: OrderStatus.PENDING,
          notes,
        },
        { transaction }
      );

      // Create order items
      const orderItems = await Promise.all(
        cartItems.map((cartItem) => {
          const priceInCoins = parseFloat(cartItem.priceInCoins.toString());
          const priceInUSD = parseFloat(cartItem.priceInUSD.toString());

          return OrderItem.create(
            {
              orderId: order.id,
              productId: cartItem.productId,
              productTitle: cartItem.productTitle,
              productImage: cartItem.productImage,
              sellerId: cartItem.sellerId,
              sellerName: cartItem.sellerName,
              quantity: cartItem.quantity,
              priceInCoins: cartItem.priceInCoins,
              priceInUSD: cartItem.priceInUSD,
              subtotalInCoins: priceInCoins * cartItem.quantity,
              subtotalInUSD: priceInUSD * cartItem.quantity,
            },
            { transaction }
          );
        })
      );

      // Clear cart
      await CartItem.destroy({
        where: { userId },
        transaction,
      });

      await transaction.commit();

      // Publish event
      await publishEvent('order.created', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId,
        totalInCoins,
        totalInUSD,
        paymentMethod,
      });

      res.status(201).json({
        success: true,
        data: {
          order,
          items: orderItems,
        },
        message: 'Order created successfully',
      });
    } catch (error: any) {
      await transaction.rollback();
      logger.error('Create order error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create order',
        details: error.message,
      });
    }
  }

  // Get user's orders
  static async getOrders(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { page = 1, limit = 20, status } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const where: any = { userId };
      if (status) where.orderStatus = status;

      const { count, rows } = await Order.findAndCountAll({
        where,
        limit: limitNum,
        offset,
        order: [['createdAt', 'DESC']],
      });

      res.json({
        success: true,
        data: {
          orders: rows,
          pagination: {
            total: count,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(count / limitNum),
          },
        },
      });
    } catch (error: any) {
      logger.error('Get orders error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch orders',
      });
    }
  }

  // Get recent orders for user
  static async getRecentOrders(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const limit = parseInt(req.query.limit as string) || 5;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      // ✅ Fetch orders first
      const orders = await Order.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        limit,
      });

      // ✅ Fetch order items separately for each order
      // (Workaround until associations are fully working)
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await OrderItem.findAll({
            where: { orderId: order.id },
          });
          return {
            ...order.toJSON(),
            items: items.map(item => item.toJSON()),
          };
        })
      );

      res.json({
        success: true,
        data: ordersWithItems,
      });
    } catch (error: any) {
      logger.error('Get recent orders error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch recent orders',
      });
    }
  }

  // Get order by ID
  static async getOrderById(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { id } = req.params;

      const order = await Order.findOne({
        where: { id, userId },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found',
        });
      }

      const orderItems = await OrderItem.findAll({
        where: { orderId: id },
      });

      res.json({
        success: true,
        data: {
          order,
          items: orderItems,
        },
      });
    } catch (error: any) {
      logger.error('Get order error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch order',
      });
    }
  }

  // Cancel order
  static async cancelOrder(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { id } = req.params;
      const { reason } = req.body;

      const order = await Order.findOne({
        where: { id, userId },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found',
        });
      }

      if (![OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(order.orderStatus)) {
        return res.status(400).json({
          success: false,
          error: 'Order cannot be cancelled at this stage',
        });
      }

      order.orderStatus = OrderStatus.CANCELLED;
      order.cancelledAt = new Date();
      order.cancellationReason = reason;
      await order.save();

      // Publish event
      await publishEvent('order.cancelled', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId,
        reason,
      });

      res.json({
        success: true,
        message: 'Order cancelled successfully',
      });
    } catch (error: any) {
      logger.error('Cancel order error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel order',
      });
    }
  }

  // Admin: Update order status
  static async updateOrderStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, trackingNumber } = req.body;

      const order = await Order.findByPk(id);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found',
        });
      }

      order.orderStatus = status;

      if (status === OrderStatus.SHIPPED && trackingNumber) {
        order.trackingNumber = trackingNumber;
        order.shippedAt = new Date();
      }

      if (status === OrderStatus.DELIVERED) {
        order.deliveredAt = new Date();
      }

      await order.save();

      // Publish event
      await publishEvent('order.status.updated', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status,
      });

      res.json({
        success: true,
        message: 'Order status updated',
      });
    } catch (error: any) {
      logger.error('Update order status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update order status',
      });
    }
  }

  // Admin: Get all orders
  static async getAllOrders(req: Request, res: Response) {
    try {
      const { page = 1, limit = 50, status } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const where: any = {};
      if (status) where.orderStatus = status;

      const { count, rows } = await Order.findAndCountAll({
        where,
        limit: limitNum,
        offset,
        order: [['createdAt', 'DESC']],
      });

      res.json({
        success: true,
        data: {
          orders: rows,
          pagination: {
            total: count,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(count / limitNum),
          },
        },
      });
    } catch (error: any) {
      logger.error('Get all orders error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch orders',
      });
    }
  }

  // Get order statistics
  static async getOrderStats(req: Request, res: Response) {
    try {
      const totalOrders = await Order.count();
      const pendingOrders = await Order.count({
        where: { orderStatus: OrderStatus.PENDING },
      });
      const processingOrders = await Order.count({
        where: { orderStatus: OrderStatus.PROCESSING },
      });
      const completedOrders = await Order.count({
        where: { orderStatus: OrderStatus.DELIVERED },
      });
      const cancelledOrders = await Order.count({
        where: { orderStatus: OrderStatus.CANCELLED },
      });

      res.json({
        success: true,
        data: {
          totalOrders,
          pendingOrders,
          processingOrders,
          completedOrders,
          cancelledOrders,
        },
      });
    } catch (error: any) {
      logger.error('Get order stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
      });
    }
  }
}

