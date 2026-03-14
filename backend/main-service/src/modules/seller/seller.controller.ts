import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { query } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';

// ─── Get Seller Dashboard Overview ────────────────────────────────────────────
export async function getSellerOverview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const days   = parseInt(req.query.days as string) || 30;

    // Get seller_id from user
    const spResult = await query('SELECT seller_id FROM seller_profiles WHERE user_id = $1', [userId]);
    if (spResult.rows.length === 0) throw new AppError('Seller profile not found', 404);
    const sellerId = spResult.rows[0].seller_id;

    const since = `NOW() - INTERVAL '${days} days'`;

    const [
      revenueResult,
      ordersResult,
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
           COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled,
           COUNT(*) FILTER (WHERE status = 'DISPUTED') AS disputed,
           COUNT(*) FILTER (WHERE status = 'UNPAID') AS pending_payment
         FROM orders WHERE seller_id = $1`,
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
           COALESCE(ROUND(AVG(rating)::numeric, 2), 0) AS avg_rating,
           COUNT(*) AS total_reviews,
           COUNT(*) FILTER (WHERE rating = 5) AS star5,
           COUNT(*) FILTER (WHERE rating = 4) AS star4,
           COUNT(*) FILTER (WHERE rating = 3) AS star3,
           COUNT(*) FILTER (WHERE rating = 2) AS star2,
           COUNT(*) FILTER (WHERE rating = 1) AS star1
         FROM reviews
         WHERE seller_id = $1 AND status = 'published'`,
        [sellerId]
      ),
      // Conversion: views vs orders (product_views table if exists)
      query(
        `SELECT
           COUNT(DISTINCT o.order_id) AS total_orders,
           COUNT(DISTINCT o.buyer_id) AS unique_buyers
         FROM orders o WHERE o.seller_id = $1 AND o.created_at > ${since}`,
        [sellerId]
      ),
    ]);

    res.json({
      success: true,
      data: {
        revenue:      revenueResult.rows[0],
        orders:       ordersResult.rows[0],
        topProducts:  topProductsResult.rows,
        dailyRevenue: dailyRevenueResult.rows,
        reviews:      reviewStatsResult.rows[0],
        conversion:   conversionResult.rows[0],
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
    const page   = parseInt(req.query.page as string) || 1;
    const limit  = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const spResult = await query('SELECT seller_id FROM seller_profiles WHERE user_id = $1', [userId]);
    if (spResult.rows.length === 0) throw new AppError('Seller profile not found', 404);
    const sellerId = spResult.rows[0].seller_id;

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
    const page   = parseInt(req.query.page as string) || 1;
    const limit  = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    const spResult = await query('SELECT seller_id FROM seller_profiles WHERE user_id = $1', [userId]);
    if (spResult.rows.length === 0) throw new AppError('Seller profile not found', 404);
    const sellerId = spResult.rows[0].seller_id;

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
