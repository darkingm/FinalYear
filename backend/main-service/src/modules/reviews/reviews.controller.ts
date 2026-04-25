import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { query } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';

// ─── Create Review ─────────────────────────────────────────────────────────────
export async function createReview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const { order_id, rating, title, content, images } = req.body;

    if (!order_id || !rating) throw new AppError('order_id and rating are required', 400);
    if (rating < 1 || rating > 5) throw new AppError('Rating must be 1–5', 400);

    // Verify order exists, belongs to buyer, is COMPLETED
    const orderResult = await query(
      `SELECT o.order_id, o.product_id, o.seller_id, o.buyer_id, o.status
       FROM orders o WHERE o.order_id = $1 AND o.buyer_id = $2`,
      [order_id, userId]
    );
    if (orderResult.rows.length === 0) throw new AppError('Order not found or not yours', 404);

    const order = orderResult.rows[0];
    if (order.status !== 'COMPLETED') throw new AppError('You can only review completed orders', 400);

    // Check for existing review
    const existing = await query('SELECT review_id FROM reviews WHERE order_id = $1', [order_id]);
    if (existing.rows.length > 0) throw new AppError('You have already reviewed this order', 409);

    const result = await query(
      `INSERT INTO reviews (order_id, product_id, buyer_id, seller_id, rating, title, content, images, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published')
       RETURNING *`,
      [order_id, order.product_id, userId, order.seller_id, rating, title || null, content || null, JSON.stringify(images || [])]
    );

    // Update product rating_avg and review_count (denormalized for performance)
    await query(
      `UPDATE products
       SET rating_avg = (
         SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE product_id = $1 AND status = 'published'
       ),
       review_count = (
         SELECT COUNT(*) FROM reviews WHERE product_id = $1 AND status = 'published'
       )
       WHERE product_id = $1`,
      [order.product_id]
    );

    // Record credit score point (+3 for 5-star review) — fire and forget
    if (rating === 5) {
      query(
        `INSERT INTO credit_score_events (user_id, event_type, score_delta, reference_id, reference_type)
         VALUES ($1, 'five_star_review', 3, $2, 'review')
         ON CONFLICT DO NOTHING`,
        [userId, result.rows[0].review_id]
      ).catch(() => { /* best-effort */ });
    }

    logger.info('Review created', { review_id: result.rows[0].review_id, product_id: order.product_id });
    res.status(201).json({ success: true, review: result.rows[0] });
  } catch (error) {
    next(error);
  }
}

// ─── Get Product Reviews ───────────────────────────────────────────────────────
export async function getProductReviews(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const productId = parseInt(req.params.productId);
    const page  = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const sort  = (req.query.sort as string) || 'recent'; // recent | helpful | highest | lowest
    const filterRating = req.query.rating ? parseInt(req.query.rating as string) : null;

    const offset = (page - 1) * limit;

    let orderClause = 'r.created_at DESC';
    if (sort === 'helpful') orderClause = 'r.helpful_count DESC, r.created_at DESC';
    if (sort === 'highest') orderClause = 'r.rating DESC, r.created_at DESC';
    if (sort === 'lowest')  orderClause = 'r.rating ASC, r.created_at DESC';

    const whereExtra = filterRating ? `AND r.rating = ${filterRating}` : '';

    const [reviewsResult, countResult, statsResult] = await Promise.all([
      query(
        `SELECT r.*,
                u.username AS buyer_name,
                u.avatar_url AS buyer_avatar
         FROM reviews r
         JOIN users u ON r.buyer_id = u.user_id
         WHERE r.product_id = $1 AND r.status = 'published' ${whereExtra}
         ORDER BY ${orderClause}
         LIMIT $2 OFFSET $3`,
        [productId, limit, offset]
      ),
      query(
        `SELECT COUNT(*) AS total FROM reviews WHERE product_id = $1 AND status = 'published' ${whereExtra}`,
        [productId]
      ),
      query(
        `SELECT
           ROUND(AVG(rating)::numeric, 2) AS avg_rating,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE rating = 5) AS star5,
           COUNT(*) FILTER (WHERE rating = 4) AS star4,
           COUNT(*) FILTER (WHERE rating = 3) AS star3,
           COUNT(*) FILTER (WHERE rating = 2) AS star2,
           COUNT(*) FILTER (WHERE rating = 1) AS star1
         FROM reviews WHERE product_id = $1 AND status = 'published'`,
        [productId]
      ),
    ]);

    const total = parseInt(countResult.rows[0].total);
    res.json({
      success: true,
      reviews: reviewsResult.rows,
      stats: statsResult.rows[0],
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

// ─── Get Seller Reviews ────────────────────────────────────────────────────────
export async function getSellerReviews(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const sellerId = parseInt(req.params.sellerId);
    const page  = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const offset = (page - 1) * limit;

    const [result, countResult] = await Promise.all([
      query(
        `SELECT r.*, p.name AS product_name, u.username AS buyer_name, u.avatar_url AS buyer_avatar
         FROM reviews r
         JOIN products p ON r.product_id = p.product_id
         JOIN users u ON r.buyer_id = u.user_id
         WHERE p.seller_id = $1 AND r.status = 'published'
         ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
        [sellerId, limit, offset]
      ),
      query(
        `SELECT COUNT(*) AS total
         FROM reviews r
         JOIN products p ON r.product_id = p.product_id
         WHERE p.seller_id = $1 AND r.status = 'published'`,
        [sellerId]
      ),
    ]);

    const total = parseInt(countResult.rows[0].total);
    res.json({
      success: true,
      reviews: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

// ─── Get Order Review ──────────────────────────────────────────────────────────
export async function getOrderReview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId  = req.user!.user_id;
    const orderId = parseInt(req.params.orderId);

    const result = await query(
      `SELECT r.* FROM reviews r
       JOIN orders o ON r.order_id = o.order_id
       LEFT JOIN seller_profiles sp ON o.seller_id = sp.seller_id
       WHERE r.order_id = $1 AND (o.buyer_id = $2 OR sp.user_id = $2)`,
      [orderId, userId]
    );

    res.json({ success: true, review: result.rows[0] || null });
  } catch (error) {
    next(error);
  }
}

// ─── Update Review ─────────────────────────────────────────────────────────────
export async function updateReview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId   = req.user!.user_id;
    const reviewId = parseInt(req.params.reviewId);
    const { rating, title, content, images } = req.body;

    const existing = await query('SELECT * FROM reviews WHERE review_id = $1 AND buyer_id = $2', [reviewId, userId]);
    if (existing.rows.length === 0) throw new AppError('Review not found', 404);

    // Only allow edit within 7 days
    const createdAt = new Date(existing.rows[0].created_at);
    const daysDiff  = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 7) throw new AppError('Reviews can only be edited within 7 days', 403);

    const result = await query(
      `UPDATE reviews
       SET rating = COALESCE($1, rating),
           title  = COALESCE($2, title),
           content = COALESCE($3, content),
           images = COALESCE($4, images),
           updated_at = NOW()
       WHERE review_id = $5
       RETURNING *`,
      [rating, title, content, images ? JSON.stringify(images) : null, reviewId]
    );

    res.json({ success: true, review: result.rows[0] });
  } catch (error) {
    next(error);
  }
}

// ─── Vote Review Helpful ────────────────────────────────────────────────────────
export async function voteReviewHelpful(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId   = req.user!.user_id;
    const reviewId = parseInt(req.params.reviewId);

    // Upsert vote (user can only vote once)
    const voteResult = await query(
      `INSERT INTO review_votes (review_id, user_id, is_helpful)
       VALUES ($1, $2, true)
       ON CONFLICT (review_id, user_id) DO UPDATE SET is_helpful = NOT review_votes.is_helpful
       RETURNING is_helpful`,
      [reviewId, userId]
    );

    // Recount helpful votes
    await query(
      `UPDATE reviews SET helpful_count = (
         SELECT COUNT(*) FROM review_votes WHERE review_id = $1 AND is_helpful = true
       ) WHERE review_id = $1`,
      [reviewId]
    );

    res.json({ success: true, voted: voteResult.rows[0].is_helpful });
  } catch (error) {
    next(error);
  }
}
