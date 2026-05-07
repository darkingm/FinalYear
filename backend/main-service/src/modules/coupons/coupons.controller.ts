import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { query } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';

/**
 * Resolve (or auto-create) the seller_profile for the current user.
 * Mirrors the pattern in seller.controller.ts so any seller can manage
 * coupons without an explicit onboarding step.
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

/**
 * Frontend uses richer field names than the DB columns. This helper
 * normalises an incoming row into the canonical shape returned by every
 * endpoint, so callers don't have to remember which column came from where.
 */
function shapeCouponRow(row: any) {
  if (!row) return null;
  return {
    coupon_id: Number(row.coupon_id),
    seller_id: row.seller_id != null ? Number(row.seller_id) : null,
    code: row.code,
    description: row.description ?? null,
    discount_type: row.discount_type,
    discount_value: Number(row.discount_value),
    min_order_usd: row.min_purchase != null ? Number(row.min_purchase) : null,
    max_discount_usd: row.max_discount_usd != null ? Number(row.max_discount_usd) : null,
    usage_limit: row.max_uses != null ? Number(row.max_uses) : null,
    used_count: Number(row.used_count ?? 0),
    per_user_limit: row.per_user_limit != null ? Number(row.per_user_limit) : null,
    starts_at: row.valid_from,
    expires_at: row.valid_until,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Allowed discount types. 'fixed_amount' is treated as an alias for 'fixed'
 * (the FE uses both); 'free_shipping' is persisted as-is and treated as
 * "ignore discount_value, just zero out shipping at checkout time" by future
 * checkout integration.
 */
const ALLOWED_TYPES = new Set(['percentage', 'fixed', 'fixed_amount', 'free_shipping']);

function parseDate(value: unknown, fieldName: string): Date {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(`${fieldName} is required`, 400);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new AppError(`${fieldName} is not a valid date`, 400);
  }
  return d;
}

// ─── List coupons (seller-scoped) ────────────────────────────────────────
export async function listMyCoupons(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const role = req.user!.role;

    let rows: any[];
    if (role === 'admin') {
      // Admin sees all coupons across the platform
      const result = await query(
        `SELECT * FROM coupons ORDER BY created_at DESC LIMIT 500`
      );
      rows = result.rows;
    } else {
      const sellerId = await ensureSellerProfile(userId);
      const result = await query(
        `SELECT * FROM coupons WHERE seller_id = $1 ORDER BY created_at DESC`,
        [sellerId]
      );
      rows = result.rows;
    }

    res.json({ success: true, coupons: rows.map(shapeCouponRow) });
  } catch (err) {
    next(err);
  }
}

// ─── Create a coupon (seller or admin) ───────────────────────────────────
export async function createCoupon(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const role = req.user!.role;
    const body = req.body || {};

    const code = String(body.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,50}$/.test(code)) {
      throw new AppError('Coupon code must be 3-50 chars (A-Z, 0-9, _ or -)', 400);
    }

    const discount_type = String(body.discount_type || '').trim();
    if (!ALLOWED_TYPES.has(discount_type)) {
      throw new AppError(`discount_type must be one of: ${Array.from(ALLOWED_TYPES).join(', ')}`, 400);
    }

    const discount_value = Number(body.discount_value);
    if (!Number.isFinite(discount_value) || discount_value <= 0) {
      throw new AppError('discount_value must be a positive number', 400);
    }
    if (discount_type === 'percentage' && discount_value > 100) {
      throw new AppError('Percentage discount cannot exceed 100', 400);
    }

    const startsAt = parseDate(body.starts_at, 'starts_at');
    const expiresAt = parseDate(body.expires_at, 'expires_at');
    if (expiresAt <= startsAt) {
      throw new AppError('expires_at must be after starts_at', 400);
    }

    // Map FE field names → DB columns
    const min_order_usd = body.min_order_usd ?? body.min_order_amount;
    const usage_limit = body.usage_limit ?? body.max_uses;
    const max_discount_usd = body.max_discount_usd ?? null;
    const per_user_limit = body.per_user_limit ?? null;
    const description = body.description ?? null;

    // Resolve seller_id — admins may pass an explicit seller_id (for support
    // operations); otherwise the caller's own seller profile is used.
    let sellerId: number | null = null;
    if (role === 'admin' && body.seller_id != null) {
      sellerId = Number(body.seller_id);
      if (!Number.isFinite(sellerId)) throw new AppError('seller_id must be numeric', 400);
    } else {
      sellerId = await ensureSellerProfile(userId);
    }

    const result = await query(
      `INSERT INTO coupons
         (seller_id, code, description, discount_type, discount_value,
          min_purchase, max_discount_usd, max_uses, per_user_limit,
          valid_from, valid_until, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active')
       RETURNING *`,
      [
        sellerId,
        code,
        description,
        discount_type,
        discount_value,
        min_order_usd ?? null,
        max_discount_usd,
        usage_limit ?? null,
        per_user_limit,
        startsAt,
        expiresAt,
      ]
    );

    res.status(201).json({ success: true, coupon: shapeCouponRow(result.rows[0]) });
  } catch (err: any) {
    // Surface PG unique violation as a clean 409 instead of generic 500
    if (err?.code === '23505') {
      return next(new AppError('Coupon code already exists', 409));
    }
    next(err);
  }
}

// ─── Soft-delete (deactivate) a coupon ───────────────────────────────────
export async function deleteCoupon(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const role = req.user!.role;
    const couponId = Number(req.params.id);
    if (!Number.isFinite(couponId)) throw new AppError('Invalid coupon id', 400);

    let result;
    if (role === 'admin') {
      result = await query(
        `UPDATE coupons SET status = 'inactive', updated_at = NOW()
         WHERE coupon_id = $1
         RETURNING *`,
        [couponId]
      );
    } else {
      const sellerId = await ensureSellerProfile(userId);
      result = await query(
        `UPDATE coupons SET status = 'inactive', updated_at = NOW()
         WHERE coupon_id = $1 AND seller_id = $2
         RETURNING *`,
        [couponId, sellerId]
      );
    }

    if (result.rows.length === 0) {
      throw new AppError('Coupon not found or not owned by you', 404);
    }

    res.json({ success: true, coupon: shapeCouponRow(result.rows[0]) });
  } catch (err) {
    next(err);
  }
}

/**
 * Validate a coupon code against an optional order context.
 *
 * Body: { code, seller_id?, subtotal_usd? }
 * Returns: { valid, coupon, discount_amount_usd, reason? }
 *
 * Why subtotal_usd is optional: the seller `/coupons` page only checks
 * "does this code exist and is it currently active" — checkout will pass
 * subtotal_usd to compute the actual discount.
 */
export async function validateCoupon(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!code) throw new AppError('code is required', 400);

    const subtotal = req.body?.subtotal_usd != null ? Number(req.body.subtotal_usd) : null;
    const sellerIdHint = req.body?.seller_id != null ? Number(req.body.seller_id) : null;

    let row;
    if (sellerIdHint != null && Number.isFinite(sellerIdHint)) {
      const r = await query(
        `SELECT * FROM coupons WHERE code = $1 AND (seller_id = $2 OR seller_id IS NULL) LIMIT 1`,
        [code, sellerIdHint]
      );
      row = r.rows[0];
    } else {
      const r = await query(`SELECT * FROM coupons WHERE code = $1 LIMIT 1`, [code]);
      row = r.rows[0];
    }

    if (!row) {
      return res.status(404).json({ success: false, valid: false, reason: 'NOT_FOUND' });
    }

    const now = new Date();
    if (row.status !== 'active') {
      return res.json({ success: true, valid: false, reason: 'INACTIVE', coupon: shapeCouponRow(row) });
    }
    if (row.valid_from && new Date(row.valid_from) > now) {
      return res.json({ success: true, valid: false, reason: 'NOT_STARTED', coupon: shapeCouponRow(row) });
    }
    if (row.valid_until && new Date(row.valid_until) < now) {
      return res.json({ success: true, valid: false, reason: 'EXPIRED', coupon: shapeCouponRow(row) });
    }
    if (row.max_uses != null && Number(row.used_count) >= Number(row.max_uses)) {
      return res.json({ success: true, valid: false, reason: 'MAX_USES_REACHED', coupon: shapeCouponRow(row) });
    }

    // Per-user limit check (only when authenticated and limit is set)
    if (req.user && row.per_user_limit) {
      const used = await query(
        `SELECT COUNT(*)::int AS cnt FROM coupon_redemptions WHERE coupon_id = $1 AND user_id = $2`,
        [row.coupon_id, req.user.user_id]
      );
      if (used.rows[0]?.cnt >= Number(row.per_user_limit)) {
        return res.json({ success: true, valid: false, reason: 'PER_USER_LIMIT', coupon: shapeCouponRow(row) });
      }
    }

    if (subtotal != null && Number.isFinite(subtotal)) {
      if (row.min_purchase != null && subtotal < Number(row.min_purchase)) {
        return res.json({
          success: true,
          valid: false,
          reason: 'MIN_ORDER_NOT_MET',
          coupon: shapeCouponRow(row),
          min_order_usd: Number(row.min_purchase),
        });
      }
    }

    let discountAmount: number | null = null;
    if (subtotal != null && Number.isFinite(subtotal)) {
      if (row.discount_type === 'percentage') {
        discountAmount = (subtotal * Number(row.discount_value)) / 100;
      } else if (row.discount_type === 'fixed' || row.discount_type === 'fixed_amount') {
        discountAmount = Number(row.discount_value);
      } else if (row.discount_type === 'free_shipping') {
        // Caller computes shipping waiver separately; we just signal eligibility.
        discountAmount = 0;
      }
      if (discountAmount != null && row.max_discount_usd != null) {
        discountAmount = Math.min(discountAmount, Number(row.max_discount_usd));
      }
      if (discountAmount != null) {
        discountAmount = Math.min(discountAmount, subtotal);
        discountAmount = Math.round(discountAmount * 100) / 100;
      }
    }

    res.json({
      success: true,
      valid: true,
      coupon: shapeCouponRow(row),
      discount_amount_usd: discountAmount,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Public list (active coupons of a specific seller) ──────────────────
export async function listPublicCoupons(req: Request, res: Response, next: NextFunction) {
  try {
    const sellerId = Number(req.query.seller_id);
    if (!Number.isFinite(sellerId)) {
      // Default: only platform-wide coupons (seller_id IS NULL).
      const r = await query(
        `SELECT * FROM coupons
         WHERE seller_id IS NULL AND status = 'active'
           AND (valid_from IS NULL OR valid_from <= NOW())
           AND (valid_until IS NULL OR valid_until > NOW())
         ORDER BY created_at DESC LIMIT 50`
      );
      return res.json({ success: true, coupons: r.rows.map(shapeCouponRow) });
    }
    const r = await query(
      `SELECT * FROM coupons
       WHERE seller_id = $1 AND status = 'active'
         AND (valid_from IS NULL OR valid_from <= NOW())
         AND (valid_until IS NULL OR valid_until > NOW())
       ORDER BY created_at DESC LIMIT 50`,
      [sellerId]
    );
    res.json({ success: true, coupons: r.rows.map(shapeCouponRow) });
  } catch (err) {
    logger.error('listPublicCoupons error', err);
    next(err);
  }
}
