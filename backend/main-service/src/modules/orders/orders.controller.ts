import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { query } from '../../config/database';
import { publishEvent } from '../../config/rabbitmq';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// ─── Create Order ─────────────────────────────────────────────────────────────
export async function createOrder(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const buyerId = req.user!.user_id;
    const { product_id, quantity, payment_method } = req.body;

    if (!product_id || !quantity) {
      throw new AppError('product_id and quantity are required', 400);
    }

    const productResult = await query(
      'SELECT * FROM products WHERE product_id = $1 AND status = $2',
      [product_id, 'active']
    );
    if (productResult.rows.length === 0) throw new AppError('Product not found or inactive', 404);
    const product = productResult.rows[0];

    const inventoryResult = await query(
      'SELECT * FROM inventory WHERE product_id = $1',
      [product_id]
    );
    if (inventoryResult.rows.length === 0 || inventoryResult.rows[0].available < quantity) {
      throw new AppError('Insufficient stock', 400);
    }

    const priceUsd = product.base_price_usd ? Number(product.base_price_usd) * quantity : 0;
    const subtotal = priceUsd;
    const shippingFee = 0;
    const totalAmount = subtotal + shippingFee;
    const amountToken = product.price_in_token ? Number(product.price_in_token) * quantity : null;

    const internalOrderId = uuidv4();
    const year = new Date().getFullYear();
    const seqResult = await query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 10) AS INTEGER)), 0) + 1 AS next_seq
       FROM orders WHERE order_number LIKE $1`,
      [`ORD-${year}-%`]
    );
    const orderNumber = `ORD-${year}-${String(seqResult.rows[0].next_seq).padStart(5, '0')}`;

    const orderResult = await query(
      `INSERT INTO orders (
         internal_order_id, buyer_id, seller_id, product_id, quantity,
         price_usd, subtotal, shipping_fee, total_amount,
         token_id, amount_token,
         payment_method, order_number, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'UNPAID')
       RETURNING *`,
      [
        internalOrderId, buyerId, product.seller_id, product_id, quantity,
        priceUsd, subtotal, shippingFee, totalAmount,
        product.token_id || null, amountToken,
        payment_method || 'crypto', orderNumber,
      ]
    );

    const order = orderResult.rows[0];
    const inventory = inventoryResult.rows[0];

    await query(
      `INSERT INTO inventory_locks (inventory_id, order_id, quantity, expires_at, status)
       VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', 'active')`,
      [inventory.inventory_id, order.order_id, quantity]
    );
    await query(
      `UPDATE inventory SET available = available - $1, reserved = reserved + $1 WHERE inventory_id = $2`,
      [quantity, inventory.inventory_id]
    );

    await publishEvent('order.created', {
      order_id: order.order_id, buyer_id: buyerId,
      seller_id: product.seller_id, product_id, price_usd: priceUsd,
      timestamp: Date.now(),
    });

    logger.info('Order created', { order_id: order.order_id });
    res.status(201).json({ success: true, order });
  } catch (error: any) {
    logger.error('Create order error:', error);
    next(error);
  }
}

// ─── Get Orders List ──────────────────────────────────────────────────────────
export async function getOrders(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const [result, countResult] = await Promise.all([
      query(
        `SELECT
           o.*,
           p.name           AS product_name,
           p.metadata       AS product_metadata,
           p.price_in_token,
           tw.symbol        AS token_symbol,
           COALESCE(pi.image_url, p.metadata->>'primaryImage') AS primary_image
         FROM orders o
         JOIN products p ON o.product_id = p.product_id
         LEFT JOIN token_whitelist tw ON p.token_id = tw.token_id
         LEFT JOIN LATERAL (
           SELECT image_url FROM product_images
           WHERE product_id = p.product_id
           ORDER BY is_primary DESC, sort_order ASC LIMIT 1
         ) pi ON true
         WHERE o.buyer_id = $1 OR o.seller_id = $1
         ORDER BY o.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      query(
        `SELECT COUNT(*) AS total FROM orders WHERE buyer_id = $1 OR seller_id = $1`,
        [userId]
      ),
    ]);

    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      orders: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    logger.error('Get orders error:', error);
    next(error);
  }
}

// ─── Get Single Order ─────────────────────────────────────────────────────────
export async function getOrder(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const orderId = parseInt(req.params.id);

    const result = await query(
      `SELECT
         o.*,
         p.name           AS product_name,
         p.metadata       AS product_metadata,
         p.price_in_token,
         tw.symbol        AS token_symbol,
         buyer.username   AS buyer_name,
         seller_u.username AS seller_name,
         COALESCE(pi.image_url, p.metadata->>'primaryImage') AS primary_image
       FROM orders o
       JOIN products p ON o.product_id = p.product_id
       LEFT JOIN token_whitelist tw ON p.token_id = tw.token_id
       LEFT JOIN users buyer    ON o.buyer_id  = buyer.user_id
       LEFT JOIN users seller_u ON o.seller_id = seller_u.user_id
       LEFT JOIN LATERAL (
         SELECT image_url FROM product_images
         WHERE product_id = p.product_id
         ORDER BY is_primary DESC, sort_order ASC LIMIT 1
       ) pi ON true
       WHERE o.order_id = $1 AND (o.buyer_id = $2 OR o.seller_id = $2)`,
      [orderId, userId]
    );

    if (result.rows.length === 0) throw new AppError('Order not found', 404);
    res.json({ success: true, order: result.rows[0] });
  } catch (error: any) {
    logger.error('Get order error:', error);
    next(error);
  }
}

// ─── Get Order by Internal UUID ───────────────────────────────────────────────
export async function getOrderByInternalId(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const internalOrderId = req.params.internalOrderId;

    const result = await query(
      `SELECT o.*, p.name AS product_name, p.metadata AS product_metadata,
              buyer.username AS buyer_name, seller_u.username AS seller_name
       FROM orders o
       JOIN products p ON o.product_id = p.product_id
       LEFT JOIN users buyer    ON o.buyer_id  = buyer.user_id
       LEFT JOIN users seller_u ON o.seller_id = seller_u.user_id
       WHERE o.internal_order_id = $1 AND (o.buyer_id = $2 OR o.seller_id = $2)`,
      [internalOrderId, userId]
    );

    if (result.rows.length === 0) throw new AppError('Order not found', 404);
    res.json({ success: true, order: result.rows[0] });
  } catch (error: any) {
    logger.error('Get order by internal id error:', error);
    next(error);
  }
}

// ─── Cancel Order ─────────────────────────────────────────────────────────────
export async function cancelOrder(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const orderId = parseInt(req.params.id);

    const orderResult = await query(
      'SELECT * FROM orders WHERE order_id = $1 AND buyer_id = $2',
      [orderId, userId]
    );
    if (orderResult.rows.length === 0) throw new AppError('Order not found', 404);

    const order = orderResult.rows[0];
    if (order.status !== 'UNPAID') throw new AppError('Order cannot be cancelled', 400);

    await query(`UPDATE orders SET status = 'CANCELLED', updated_at = NOW() WHERE order_id = $1`, [orderId]);
    await query(`DELETE FROM inventory_locks WHERE order_id = $1`, [orderId]);
    await query(
      `UPDATE inventory SET available = available + $1 WHERE product_id = $2`,
      [order.quantity, order.product_id]
    );

    await publishEvent('order.cancelled', { order_id: orderId, timestamp: Date.now() });
    logger.info('Order cancelled', { order_id: orderId });
    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error: any) {
    logger.error('Cancel order error:', error);
    next(error);
  }
}

// ─── Update Order Status ──────────────────────────────────────────────────────
export async function updateOrderStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const orderId = parseInt(req.params.id);
    const { status } = req.body;

    const allowedStatuses = ['SHIPPED', 'DELIVERED', 'COMPLETED', 'DISPUTED'];
    if (!allowedStatuses.includes(status)) throw new AppError('Invalid status update', 400);

    const orderResult = await query(
      'SELECT * FROM orders WHERE order_id = $1 AND (buyer_id = $2 OR seller_id = $2)',
      [orderId, userId]
    );
    if (orderResult.rows.length === 0) throw new AppError('Order not found', 404);

    const order = orderResult.rows[0];
    if (order.seller_id === userId && !['SHIPPED', 'DELIVERED'].includes(status)) {
      throw new AppError('Sellers can only mark SHIPPED or DELIVERED', 403);
    }
    if (order.buyer_id === userId && !['COMPLETED', 'DISPUTED'].includes(status)) {
      throw new AppError('Buyers can only mark COMPLETED or DISPUTED', 403);
    }

    await query(`UPDATE orders SET status = $1, updated_at = NOW() WHERE order_id = $2`, [status, orderId]);
    await publishEvent('order.status_updated', { order_id: orderId, status, timestamp: Date.now() });

    // Auto-release escrow if order is completed and paid with crypto
    if (status === 'COMPLETED' && order.payment_method === 'crypto') {
      try {
        const paymentApiUrl = process.env.PAYMENT_API_URL || 'http://localhost:5001/api';
        await axios.post(`${paymentApiUrl}/crypto-payment/release`, {
          order_id: orderId
        }, {
          headers: {
            Authorization: req.headers.authorization // Pass along the user's token
          }
        });
        logger.info(`Called payment service to release funds for order ${orderId}`);
      } catch (err: any) {
        logger.error(`Failed to trigger escrow release for order ${orderId}:`, err.message);
        // We don't throw here to not break the status update, but it should be retried or handled
      }
    }

    // Auto-refund if order is disputed
    // In real app, Admin resolves dispute to Refund or Release. For testing, if buyer disputes, we might refund.
    // However, the rule says: "Quy trình Refund / Giải quyết Tranh chấp: Thưc tế, Admin can thiệp. Hàm refund ở SC."
    // So the admin will call the refund API directly, we don't auto-refund here.

    res.json({ success: true, message: 'Order status updated', status });
  } catch (error: any) {
    logger.error('Update order status error:', error);
    next(error);
  }
}

// ─── Logistics Webhook ────────────────────────────────────────────────────────
export async function handleLogisticsWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const { order_id, status, tracking_number } = req.body;

    if (!order_id || !status) {
      return res.status(400).json({ success: false, message: 'order_id and status are required' });
    }

    const orderResult = await query('SELECT * FROM orders WHERE order_id = $1', [order_id]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Allowed statuses from webhook
    if (!['SHIPPED', 'DELIVERED', 'RETURNED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid webhook status' });
    }

    let updateQuery = `UPDATE orders SET status = $1, updated_at = NOW()`;
    const queryParams: any[] = [status];
    let paramIndex = 2;

    if (tracking_number) {
      updateQuery += `, metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{tracking_number}', $${paramIndex}::jsonb)`;
      queryParams.push(JSON.stringify(tracking_number));
      paramIndex++;
    }

    updateQuery += ` WHERE order_id = $${paramIndex}`;
    queryParams.push(order_id);

    await query(updateQuery, queryParams);

    await publishEvent('order.status_updated', {
      order_id, status, tracking_number, source: 'webhook', timestamp: Date.now()
    });

    logger.info(`Logistics webhook processed for order ${order_id}: ${status}`);

    res.json({ success: true, message: 'Webhook processed' });
  } catch (error: any) {
    logger.error('Logistics webhook error:', error);
    next(error);
  }
}
