import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { query, getClient } from '../../config/database';
import { publishEvent } from '../../config/rabbitmq';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { isBuyerOnchainCompletionSync, shouldTriggerEscrowRelease } from './orders.logic';

// ─── Create Multiple Orders (Cart Checkout) ─────────────────────────────────
export async function checkoutCart(req: AuthRequest, res: Response, next: NextFunction) {
  const client = await getClient();
  try {
    const buyerId = req.user!.user_id;
    const { items, payment_method } = req.body;
    // items: Array<{ product_id: number, quantity: number }>

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('Cart items are required', 400);
    }

    await client.query('BEGIN');

    const createdOrders = [];
    const internalOrderId = uuidv4();
    const year = new Date().getFullYear();

    for (const item of items) {
      const { product_id, quantity } = item;

      if (!product_id || quantity <= 0) {
        throw new AppError('Invalid product_id or quantity in cart', 400);
      }

      const productResult = await client.query(
        'SELECT * FROM products WHERE product_id = $1 AND status = $2 FOR SHARE',
        [product_id, 'active']
      );
      if (productResult.rows.length === 0) throw new AppError(`Product ${product_id} not found or inactive`, 404);
      const product = productResult.rows[0];

      const inventoryResult = await client.query(
        'SELECT * FROM inventory WHERE product_id = $1 FOR UPDATE',
        [product_id]
      );
      if (inventoryResult.rows.length === 0 || inventoryResult.rows[0].available < quantity) {
        throw new AppError(`Insufficient stock for product ${product.name}`, 400);
      }
      const inventory = inventoryResult.rows[0];

      const priceUsd = product.base_price_usd ? Number(product.base_price_usd) * quantity : 0;
      const subtotal = priceUsd;
      const shippingFee = 0;
      const totalAmount = subtotal + shippingFee;
      const amountToken = product.price_in_token ? Number(product.price_in_token) * quantity : null;

      const seqResult = await client.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 10) AS INTEGER)), 0) + 1 AS next_seq
         FROM orders WHERE order_number LIKE $1`,
        [`ORD-${year}-%`]
      );
      const orderNumber = `ORD-${year}-${String(seqResult.rows[0].next_seq).padStart(5, '0')}`;

      const orderResult = await client.query(
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

      await client.query(
        `INSERT INTO inventory_locks (inventory_id, order_id, quantity, expires_at, status)
         VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', 'active')`,
        [inventory.inventory_id, order.order_id, quantity]
      );

      await client.query(
        `UPDATE inventory SET available = available - $1, reserved = reserved + $1 WHERE inventory_id = $2`,
        [quantity, inventory.inventory_id]
      );

      // We publish the event immediately (fire and forget)
      // Though strictly speaking, we might want to wait for commit, but it's fine for now
      await publishEvent('order.created', {
        order_id: order.order_id, buyer_id: buyerId,
        seller_id: product.seller_id, product_id, price_usd: priceUsd,
        timestamp: Date.now(),
      }).catch(err => logger.warn('Publish order.created failed (Cart Checkout):', err));

      createdOrders.push(order);
    }

    await client.query('COMMIT');

    logger.info('Cart Checkout created multiple orders', {
      buyer_id: buyerId,
      internal_order_id: internalOrderId,
      orderCount: createdOrders.length
    });

    res.status(201).json({ success: true, internal_order_id: internalOrderId, orders: createdOrders });
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('Checkout cart error:', error);
    next(error);
  } finally {
    client.release();
  }
}

// ─── Create Single Order ─────────────────────────────────────────────────────────────
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
              tw.symbol AS token_symbol,
              buyer.username AS buyer_name, seller_u.username AS seller_name,
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
    // Use UPDATE + status='released' (not DELETE) so the DB trigger release_inventory() fires correctly
    const lockUpdate = await query(
      `UPDATE inventory_locks SET status = 'released' WHERE order_id = $1 AND status = 'active' RETURNING inventory_id, quantity`,
      [orderId]
    );

    // For any locks that were already gone (edge case), restore inventory manually with safe bounds
    if (lockUpdate.rowCount === 0) {
      await query(
        `UPDATE inventory SET available = LEAST(total_stock, available + $1),
                              reserved  = GREATEST(0, reserved - $1)
         WHERE product_id = $2`,
        [order.quantity, order.product_id]
      );
    }
    // Note: if lockUpdate succeeded, the DB trigger handles available/reserved automatically

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
    const { status, tracking_number, reason, evidence_urls, completion_source, release_tx_hash } = req.body;

    const allowedStatuses = ['SHIPPED', 'DELIVERED', 'COMPLETED', 'DISPUTED'];
    if (!allowedStatuses.includes(status)) throw new AppError('Invalid status update', 400);

    const orderResult = await query(
      'SELECT * FROM orders WHERE order_id = $1 AND (buyer_id = $2 OR seller_id = $2)',
      [orderId, userId]
    );
    if (orderResult.rows.length === 0) throw new AppError('Order not found', 404);

    const order = orderResult.rows[0];

    // Role-based permission check
    if (order.seller_id === userId && !['SHIPPED', 'DELIVERED'].includes(status)) {
      throw new AppError('Sellers can only mark SHIPPED or DELIVERED', 403);
    }
    if (order.buyer_id === userId && !['COMPLETED', 'DISPUTED'].includes(status)) {
      throw new AppError('Buyers can only mark COMPLETED or DISPUTED', 403);
    }

    // Status transition validation
    // NOTE: PAID → COMPLETED allowed for buyer (skips SHIPPED step when seller doesn't update)
    // NOTE: ONCHAIN_CONFIRMED → COMPLETED allowed (crypto payment confirmed on-chain)
    const validTransitions: Record<string, string[]> = {
      UNPAID: ['CANCELLED'],
      TX_SUBMITTED: [],
      TX_FAILED: [],
      ONCHAIN_CONFIRMED: ['SHIPPED', 'COMPLETED', 'DISPUTED'],  // buyer can confirm from any paid state
      PAID: ['SHIPPED', 'COMPLETED', 'DISPUTED'],               // buyer can confirm even if seller didn't mark SHIPPED
      PAID_PAYPAL: ['SHIPPED', 'COMPLETED', 'DISPUTED'],
      SHIPPED: ['COMPLETED', 'DISPUTED'],
      DELIVERED: ['COMPLETED', 'DISPUTED'],
      COMPLETED: [],
      DISPUTED: [],
      REFUNDED: [],
      CANCELLED: [],
    };
    const allowedNext = validTransitions[order.status] || [];
    if (!allowedNext.includes(status)) {
      throw new AppError(`Cannot transition order from ${order.status} to ${status}`, 400);
    }

    const buyerOnchainCompletion = isBuyerOnchainCompletionSync(
      status,
      order.payment_method ?? null,
      completion_source
    );
    const releaseEscrowAfterCompletion = shouldTriggerEscrowRelease(
      status,
      order.payment_method ?? null,
      completion_source
    );

    // Anti-fraud: detect suspicious dispute patterns
    // If buyer tries to dispute AFTER an on-chain confirm was already recorded, flag it
    if (status === 'DISPUTED' && order.release_tx_hash) {
      // Escrow already released — buyer is disputing after money went to seller
      // Still allow but flag for admin with HIGH priority
      logger.warn(`FRAUD FLAG: Buyer ${userId} disputing order ${orderId} AFTER escrow release tx ${order.release_tx_hash}`);
    }

    // Build update query — include tracking_number if provided on SHIPPED
    if (status === 'SHIPPED' && tracking_number) {
      await query(
        `UPDATE orders SET status = $1, tracking_number = $2, updated_at = NOW() WHERE order_id = $3`,
        [status, tracking_number, orderId]
      );
    } else if (buyerOnchainCompletion && release_tx_hash) {
      await query(
        `UPDATE orders SET status = $1, release_tx_hash = $2, updated_at = NOW() WHERE order_id = $3`,
        [status, release_tx_hash, orderId]
      );
    } else {
      await query(
        `UPDATE orders SET status = $1, updated_at = NOW() WHERE order_id = $2`,
        [status, orderId]
      );
    }

    // Create dispute record if DISPUTED — so admin can see it in the disputes panel
    if (status === 'DISPUTED') {
      const disputeReason = reason || 'Buyer raised a dispute';
      const evidenceJson = JSON.stringify(evidence_urls || []);
      const afterRelease = !!order.release_tx_hash; // Detect fraudulent late disputes
      const priority = afterRelease ? 'fraud_flag' : 'normal';
      const flaggedReason = afterRelease
        ? `[⚠️ LATE DISPUTE - escrow already released tx:${order.release_tx_hash}] ${disputeReason}`
        : disputeReason;

      await query(
        `INSERT INTO disputes
           (order_id, raised_by, reason, status, priority, evidence_urls,
            buyer_wallet, seller_wallet, created_at, updated_at)
         VALUES ($1, $2, $3, 'open', $4, $5::jsonb, $6, $7, NOW(), NOW())
         ON CONFLICT (order_id) DO UPDATE
           SET reason          = EXCLUDED.reason,
               status          = 'open',
               priority        = EXCLUDED.priority,
               evidence_urls   = EXCLUDED.evidence_urls,
               updated_at      = NOW()`,
        [
          orderId,
          userId,
          flaggedReason,
          priority,
          evidenceJson,
          order.buyer_wallet || null,
          order.seller_wallet || null,
        ]
      ).catch(err => logger.warn('Failed to create/update dispute record:', err.message));
    }

    // Auto-release escrow when buyer confirms delivery (COMPLETED) for crypto orders
    let finalStatus = status;
    if (buyerOnchainCompletion && !release_tx_hash) {
      logger.warn('Buyer on-chain completion arrived without release_tx_hash', { order_id: orderId });
    }

    if (releaseEscrowAfterCompletion) {
      const internalKey = process.env.INTERNAL_SERVICE_KEY;
      const rollbackStatus = order.status;
      if (!internalKey) {
        logger.error('INTERNAL_SERVICE_KEY env var is not set — cannot release escrow');
        finalStatus = rollbackStatus;
        await query(`UPDATE orders SET status = $1, updated_at = NOW() WHERE order_id = $2`, [finalStatus, orderId]);
      } else {
        try {
          const paymentApiUrl = process.env.PAYMENT_SERVICE_URL || process.env.PAYMENT_API_URL || 'http://localhost:5001';
          await axios.post(`${paymentApiUrl}/api/payments/crypto/release`, {
            order_id: orderId
          }, {
            headers: { 'X-Internal-Service-Key': internalKey },
            timeout: 30000, // 30s for blockchain tx
          });
          logger.info(`Escrow release triggered for order ${orderId}`);
        } catch (err: any) {
          // Release failed — rollback to honest status and notify
          logger.error(`Failed to trigger escrow release for order ${orderId}:`, err.message);
          finalStatus = rollbackStatus;
          await query(
            `UPDATE orders SET status = $1, updated_at = NOW() WHERE order_id = $2`,
            [finalStatus, orderId]
          );
        }
      }
    }

    await publishEvent('order.status_updated', {
      order_id: orderId,
      status: finalStatus,
      completion_source: completion_source || null,
      release_tx_hash: buyerOnchainCompletion ? release_tx_hash || null : null,
      timestamp: Date.now(),
    });

    // Return the ACTUAL final status — never lie to the client
    res.json({ success: true, message: 'Order status updated', status: finalStatus });
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
