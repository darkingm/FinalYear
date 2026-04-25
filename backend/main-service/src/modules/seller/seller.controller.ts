import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { query } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';

/**
 * Ensure a seller_profile exists for this user.
 * ALL authenticated users can be sellers — profile is auto-created on first use.
 */
async function ensureSellerProfile(userId: number): Promise<number> {
  await query(
    `INSERT INTO seller_profiles (user_id, display_name, created_at)
     VALUES ($1, (SELECT username FROM users WHERE user_id = $1), NOW())
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  const result = await query('SELECT seller_id FROM seller_profiles WHERE user_id = $1', [userId]);
  if (result.rows.length === 0) throw new AppError('Could not create seller profile', 500);
  return result.rows[0].seller_id;
}

// ─── Get Seller Dashboard Overview ────────────────────────────────────────────
export async function getSellerOverview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const days = parseInt(req.query.days as string) || 30;
    const sellerId = await ensureSellerProfile(userId);

    const since = `NOW() - INTERVAL '${days} days'`;

    const [
      revenueResult,
      ordersResult,
      productStatsResult,
      recentOrdersResult,
      topProductsResult,
      dailyRevenueResult,
      reviewStatsResult,
      conversionResult,
    ] = await Promise.all([
      // Revenue total + this period
      query(
        `SELECT
           COALESCE(SUM(total_amount), 0) AS total_revenue,
           COALESCE(SUM(total_amount) FILTER (WHERE created_at > ${since}), 0) AS period_revenue,
           COALESCE(SUM(total_amount) FILTER (WHERE created_at > NOW() - INTERVAL '1 day'), 0) AS today_revenue
         FROM orders
         WHERE seller_id = $1 AND status IN ('PAID','COMPLETED','ONCHAIN_CONFIRMED','DELIVERING')`,
        [sellerId]
      ),
      // Orders count + breakdown by status
      query(
        `SELECT
           COUNT(*) AS total_orders,
           COUNT(*) FILTER (WHERE created_at > ${since}) AS period_orders,
           COUNT(*) FILTER (WHERE status IN ('PAID','COMPLETED','ONCHAIN_CONFIRMED','DELIVERING') AND created_at > ${since}) AS completed_period,
           COUNT(*) FILTER (WHERE status = 'UNPAID') AS unpaid,
           COUNT(*) FILTER (WHERE status IN ('TX_SUBMITTED','ONCHAIN_PENDING','ONCHAIN_CONFIRMED','PAID','PAID_PAYPAL')) AS paid_pending,
           COUNT(*) FILTER (WHERE status = 'PROCESSING') AS processing,
           COUNT(*) FILTER (WHERE status IN ('SHIPPED','DELIVERING')) AS shipped,
           COUNT(*) FILTER (WHERE status = 'DELIVERED') AS delivered,
           COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed,
           COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled,
           COUNT(*) FILTER (WHERE status = 'DISPUTED') AS disputed,
           COUNT(*) FILTER (WHERE status = 'UNPAID') AS pending_payment
         FROM orders WHERE seller_id = $1`,
        [sellerId]
      ),
      // Product stats for the dashboard cards and low-stock alert.
      query(
        `SELECT
           COUNT(*) FILTER (WHERE p.status != 'deleted') AS total_products,
           COUNT(*) FILTER (WHERE p.status = 'active') AS active_products,
           COUNT(*) FILTER (
             WHERE p.status = 'active' AND COALESCE(inv.available, 0) <= 5
           ) AS low_stock_count
         FROM products p
         LEFT JOIN (
           SELECT product_id, SUM(available) AS available
           FROM inventory
           GROUP BY product_id
         ) inv ON inv.product_id = p.product_id
         WHERE p.seller_id = $1`,
        [sellerId]
      ),
      query(
        `SELECT o.*, p.name AS product_name,
                buyer.username AS buyer_name, buyer.avatar_url AS buyer_avatar,
                tw.symbol AS token_symbol,
                COALESCE(pi.image_url, p.metadata->>'primaryImage') AS product_image
         FROM orders o
         JOIN products p ON o.product_id = p.product_id
         JOIN users buyer ON o.buyer_id = buyer.user_id
         LEFT JOIN token_whitelist tw ON o.token_id = tw.token_id
         LEFT JOIN LATERAL (
           SELECT image_url FROM product_images WHERE product_id = p.product_id
           ORDER BY is_primary DESC, sort_order ASC LIMIT 1
         ) pi ON true
         WHERE o.seller_id = $1
         ORDER BY o.created_at DESC
         LIMIT 5`,
        [sellerId]
      ),
      // Top products by revenue
      query(
        `SELECT
           p.product_id, p.name, p.base_price_usd,
           COUNT(o.order_id) AS order_count,
           COALESCE(SUM(o.total_amount), 0) AS revenue,
           COALESCE(p.rating_avg, 0) AS rating,
           p.review_count,
           i.available AS stock
         FROM orders o
         JOIN products p ON o.product_id = p.product_id
         LEFT JOIN inventory i ON p.product_id = i.product_id
         WHERE o.seller_id = $1
           AND o.status IN ('PAID','COMPLETED','ONCHAIN_CONFIRMED','DELIVERING')
           AND o.created_at > ${since}
         GROUP BY p.product_id, p.name, p.base_price_usd, p.rating_avg, p.review_count, i.available
         ORDER BY revenue DESC
         LIMIT 10`,
        [sellerId]
      ),
      // Daily revenue for chart (last N days)
      query(
        `SELECT
           DATE(o.created_at) AS date,
           COALESCE(SUM(o.total_amount), 0) AS revenue,
           COUNT(*) AS orders
         FROM orders o
         WHERE o.seller_id = $1
           AND o.created_at > ${since}
           AND o.status IN ('PAID','COMPLETED','ONCHAIN_CONFIRMED','DELIVERING')
         GROUP BY DATE(o.created_at)
         ORDER BY date ASC`,
        [sellerId]
      ),
      // Review stats
      query(
        `SELECT
           COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0) AS avg_rating,
           COUNT(*) AS total_reviews,
           COUNT(*) FILTER (WHERE r.rating = 5) AS star5,
           COUNT(*) FILTER (WHERE r.rating = 4) AS star4,
           COUNT(*) FILTER (WHERE r.rating = 3) AS star3,
           COUNT(*) FILTER (WHERE r.rating = 2) AS star2,
           COUNT(*) FILTER (WHERE r.rating = 1) AS star1
         FROM reviews r
         JOIN products p ON r.product_id = p.product_id
         WHERE p.seller_id = $1 AND r.status = 'published'`,
        [sellerId]
      ),
      // Conversion stats
      query(
        `SELECT
           COUNT(DISTINCT o.order_id) AS total_orders,
           COUNT(DISTINCT o.buyer_id) AS unique_buyers
         FROM orders o WHERE o.seller_id = $1 AND o.created_at > ${since}`,
        [sellerId]
      ),
    ]);

    const revenue = revenueResult.rows[0] ?? {};
    const orders = ordersResult.rows[0] ?? {};
    const products = productStatsResult.rows[0] ?? {};
    const reviews = reviewStatsResult.rows[0] ?? {};
    const dashboard = {
      orders: {
        total_orders: Number(orders.total_orders ?? 0),
        unpaid: Number(orders.unpaid ?? 0),
        paid_pending: Number(orders.paid_pending ?? 0),
        processing: Number(orders.processing ?? 0),
        shipped: Number(orders.shipped ?? 0),
        delivered: Number(orders.delivered ?? 0),
        completed: Number(orders.completed ?? 0),
        cancelled: Number(orders.cancelled ?? 0),
        disputed: Number(orders.disputed ?? 0),
        total_revenue: String(revenue.total_revenue ?? '0'),
      },
      products: {
        total_products: Number(products.total_products ?? 0),
        active_products: Number(products.active_products ?? 0),
        low_stock_count: Number(products.low_stock_count ?? 0),
      },
      recent_orders: recentOrdersResult.rows,
      reviews: {
        avg_rating: String(reviews.avg_rating ?? '0'),
        review_count: Number(reviews.total_reviews ?? 0),
      },
    };

    res.json({
      success: true,
      data: {
        revenue,
        orders,
        productStats: products,
        recentOrders: recentOrdersResult.rows,
        topProducts: topProductsResult.rows,
        dailyRevenue: dailyRevenueResult.rows,
        reviews,
        conversion: conversionResult.rows[0],
        dashboard,
        sellerId,
        period: days,
      },
    });
  } catch (error) {
    logger.error('getSellerOverview error:', error);
    next(error);
  }
}

// ─── Get Seller Product Performance ───────────────────────────────────────────
export async function getSellerProducts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const sellerId = await ensureSellerProfile(userId);

    const [result, countResult] = await Promise.all([
      query(
        `SELECT
           p.*,
           i.available AS stock, i.reserved AS stock_reserved,
           COALESCE(p.rating_avg, 0) AS rating_avg,
           p.review_count,
           COUNT(o.order_id) AS total_orders,
           COALESCE(SUM(o.total_amount) FILTER (WHERE o.status IN ('PAID','COMPLETED','ONCHAIN_CONFIRMED','DELIVERING')), 0) AS total_revenue,
           (SELECT image_url FROM product_images WHERE product_id = p.product_id ORDER BY is_primary DESC LIMIT 1) AS primary_image
         FROM products p
         LEFT JOIN inventory i ON p.product_id = i.product_id
         LEFT JOIN orders o ON p.product_id = o.product_id
         WHERE p.seller_id = $1
         GROUP BY p.product_id, i.available, i.reserved
         ORDER BY total_revenue DESC
         LIMIT $2 OFFSET $3`,
        [sellerId, limit, offset]
      ),
      query('SELECT COUNT(*) AS total FROM products WHERE seller_id = $1', [sellerId]),
    ]);

    const total = parseInt(countResult.rows[0].total);
    res.json({
      success: true,
      products: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

// ─── Get Seller Orders ─────────────────────────────────────────────────────────
export async function getSellerOrders(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const sellerId = await ensureSellerProfile(userId);

    const params: any[] = [sellerId];
    let whereExtra = '';
    if (status) { params.push(status); whereExtra = `AND o.status = $${params.length}`; }

    params.push(limit, offset);

    const [result, countResult] = await Promise.all([
      query(
        `SELECT o.*, p.name AS product_name,
                buyer.username AS buyer_name, buyer.avatar_url AS buyer_avatar,
                COALESCE(pi.image_url, p.metadata->>'primaryImage') AS product_image
         FROM orders o
         JOIN products p ON o.product_id = p.product_id
         JOIN users buyer ON o.buyer_id = buyer.user_id
         LEFT JOIN LATERAL (
           SELECT image_url FROM product_images WHERE product_id = p.product_id
           ORDER BY is_primary DESC, sort_order ASC LIMIT 1
         ) pi ON true
         WHERE o.seller_id = $1 ${whereExtra}
         ORDER BY o.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      ),
      query(
        `SELECT COUNT(*) AS total FROM orders o WHERE o.seller_id = $1 ${whereExtra}`,
        status ? [sellerId, status] : [sellerId]
      ),
    ]);

    const total = parseInt(countResult.rows[0].total);
    res.json({
      success: true,
      orders: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

// ─── /api/seller/stats — alias of getSellerOverview ───────────────────────────
export const getSellerStats = getSellerOverview;
