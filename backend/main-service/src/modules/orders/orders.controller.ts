import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { query } from '../../config/database';
import { publishEvent } from '../../config/rabbitmq';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export async function createOrder(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const buyerId = req.user!.user_id;
    const { product_id, quantity, payment_method } = req.body;

    if (!product_id || !quantity) {
      throw new AppError('product_id and quantity are required', 400);
    }

    // Get product details
    const productResult = await query(
      'SELECT * FROM products WHERE product_id = $1 AND status = $2',
      [product_id, 'active']
    );

    if (productResult.rows.length === 0) {
      throw new AppError('Product not found or inactive', 404);
    }

    const product = productResult.rows[0];

    // Check inventory
    const inventoryResult = await query(
      'SELECT * FROM inventory WHERE product_id = $1',
      [product_id]
    );

    if (inventoryResult.rows.length === 0 || inventoryResult.rows[0].available < quantity) {
      throw new AppError('Insufficient stock', 400);
    }

    // Calculate price
    const pricingMode = product.pricing_mode || 'usd';
    const priceUsd = product.base_price_usd ? Number(product.base_price_usd) * quantity : 0;
    const subtotal = priceUsd;
    const shippingFee = 0; // TODO: calculate from shipping method
    const totalAmount = subtotal + shippingFee;

    const priceToken = product.price_token ? parseFloat(product.price_token) : 0;
    const subtotalToken = priceToken * quantity;

    const internalOrderId = uuidv4();

    // Generate order number: ORD-YYYY-NNNNN
    const year = new Date().getFullYear();
    const seqResult = await query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 10) AS INTEGER)), 0) + 1 AS next_seq
       FROM orders WHERE order_number LIKE $1`,
      [`ORD-${year}-%`]
    );
    const nextSeq = seqResult.rows[0].next_seq;
    const orderNumber = `ORD-${year}-${String(nextSeq).padStart(5, '0')}`;

    // Create order
    const orderResult = await query(
      `INSERT INTO orders (
        internal_order_id, buyer_id, seller_id, product_id, quantity, 
        price_usd, subtotal, shipping_fee, total_amount,
        payment_method, order_number, status, pricing_mode, product_token_id, price_token, subtotal_token
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'UNPAID', $12, $13, $14, $15)
      RETURNING *`,
      [
        internalOrderId, buyerId, product.seller_id, product_id, quantity,
        priceUsd, subtotal, shippingFee, totalAmount,
        payment_method || 'crypto', orderNumber,
        pricingMode, product.token_id, product.price_token, subtotalToken
      ]
    );

    const order = orderResult.rows[0];
    const inventory = inventoryResult.rows[0];

    // Lock inventory (use inventory_id, not product_id)
    await query(
      `INSERT INTO inventory_locks (inventory_id, order_id, quantity, expires_at, status)
       VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', 'active')`,
      [inventory.inventory_id, order.order_id, quantity]
    );

    await query(
      `UPDATE inventory SET available = available - $1, reserved = reserved + $1
       WHERE inventory_id = $2`,
      [quantity, inventory.inventory_id]
    );

    // Publish event
    await publishEvent('order.created', {
      order_id: order.order_id,
      buyer_id: buyerId,
      seller_id: product.seller_id,
      product_id,
      price_usd: priceUsd,
      timestamp: Date.now(),
    });

    logger.info('Order created', { order_id: order.order_id });

    res.status(201).json({
      success: true,
      order,
    });
  } catch (error: any) {
    logger.error('Create order error:', error);
    next(error);
  }
}

export async function getOrders(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT o.*, p.name as product_name, p.metadata->'images'->0 as product_image
       FROM orders o
       JOIN products p ON o.product_id = p.product_id
       WHERE o.buyer_id = $1 OR o.seller_id = $1
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({
      success: true,
      orders: result.rows,
      pagination: { page, limit },
    });
  } catch (error: any) {
    logger.error('Get orders error:', error);
    next(error);
  }
}

export async function getOrder(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const orderId = parseInt(req.params.id);

    const result = await query(
      `SELECT o.*, 
              p.name as product_name, 
              p.metadata as product_metadata,
              buyer.username as buyer_name,
              seller.username as seller_name
       FROM orders o
       JOIN products p ON o.product_id = p.product_id
       LEFT JOIN users buyer ON o.buyer_id = buyer.user_id
       LEFT JOIN users seller ON o.seller_id = seller.user_id
       WHERE o.order_id = $1 AND (o.buyer_id = $2 OR o.seller_id = $2)`,
      [orderId, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Order not found', 404);
    }

    res.json({
      success: true,
      order: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Get order error:', error);
    next(error);
  }
}

export async function getOrderByInternalId(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const internalOrderId = req.params.internalOrderId;

    const result = await query(
      `SELECT o.*, 
              p.name as product_name, 
              p.metadata as product_metadata,
              buyer.username as buyer_name,
              seller.username as seller_name
       FROM orders o
       JOIN products p ON o.product_id = p.product_id
       LEFT JOIN users buyer ON o.buyer_id = buyer.user_id
       LEFT JOIN users seller ON o.seller_id = seller.user_id
       WHERE o.internal_order_id = $1 AND (o.buyer_id = $2 OR o.seller_id = $2)`,
      [internalOrderId, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Order not found', 404);
    }

    res.json({
      success: true,
      order: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Get order by internal id error:', error);
    next(error);
  }
}

export async function cancelOrder(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const orderId = parseInt(req.params.id);

    // Check order exists and belongs to user
    const orderResult = await query(
      'SELECT * FROM orders WHERE order_id = $1 AND buyer_id = $2',
      [orderId, userId]
    );

    if (orderResult.rows.length === 0) {
      throw new AppError('Order not found', 404);
    }

    const order = orderResult.rows[0];

    if (order.status !== 'UNPAID') {
      throw new AppError('Order cannot be cancelled', 400);
    }

    // Update order status
    await query(
      `UPDATE orders SET status = 'CANCELLED', updated_at = NOW() WHERE order_id = $1`,
      [orderId]
    );

    // Release inventory lock
    await query(
      `DELETE FROM inventory_locks WHERE order_id = $1`,
      [orderId]
    );

    await query(
      `UPDATE inventory SET available = available + $1 WHERE product_id = $2`,
      [order.quantity, order.product_id]
    );

    // Publish event
    await publishEvent('order.cancelled', {
      order_id: orderId,
      timestamp: Date.now(),
    });

    logger.info('Order cancelled', { order_id: orderId });

    res.json({
      success: true,
      message: 'Order cancelled successfully',
    });
  } catch (error: any) {
    logger.error('Cancel order error:', error);
    next(error);
  }
}

export async function updateOrderStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const orderId = parseInt(req.params.id);
    const { status } = req.body;

    const allowedStatuses = ['SHIPPED', 'DELIVERED', 'COMPLETED', 'DISPUTED'];
    if (!allowedStatuses.includes(status)) {
      throw new AppError('Invalid status update', 400);
    }

    const orderResult = await query(
      'SELECT * FROM orders WHERE order_id = $1 AND (buyer_id = $2 OR seller_id = $2)',
      [orderId, userId, userId]
    );

    if (orderResult.rows.length === 0) {
      throw new AppError('Order not found', 404);
    }

    const order = orderResult.rows[0];

    // Basic permission checks:
    // Seller can mark SHIPPED, DELIVERED
    // Buyer can mark COMPLETED, DISPUTED
    if (order.seller_id === userId && !['SHIPPED', 'DELIVERED'].includes(status)) {
      throw new AppError('Sellers can only mark order as SHIPPED or DELIVERED', 403);
    }
    if (order.buyer_id === userId && !['COMPLETED', 'DISPUTED'].includes(status)) {
      throw new AppError('Buyers can only mark order as COMPLETED or DISPUTED', 403);
    }

    await query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE order_id = $2`,
      [status, orderId]
    );

    // Publish event
    await publishEvent('order.status_updated', {
      order_id: orderId,
      status: status,
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      message: 'Order status updated successfully',
      status: status
    });
  } catch (error: any) {
    logger.error('Update order status error:', error);
    next(error);
  }
}
