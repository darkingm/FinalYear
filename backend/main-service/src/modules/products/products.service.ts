import { query } from '../../config/database';
import { setCache, getCache, deleteCache } from '../../config/redis';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';

export class ProductService {
  private hasAcceptedTokensTable: boolean | null = null;

  private async supportsProductAcceptedTokens(): Promise<boolean> {
    if (this.hasAcceptedTokensTable !== null) return this.hasAcceptedTokensTable;

    const result = await query(
      `SELECT to_regclass('public.product_accepted_tokens') IS NOT NULL AS exists`
    );
    this.hasAcceptedTokensTable = Boolean(result.rows[0]?.exists);
    return this.hasAcceptedTokensTable;
  }

  async getProducts(filters: any) {
    const { page, limit, category, minPrice, maxPrice, search, acceptsCrypto, tokenSymbol } = filters;
    const pageNum = Math.max(1, page || 1);
    const limitNum = Math.min(100, Math.max(1, limit || 20));
    const offset = (pageNum - 1) * limitNum;

    const whereConditions: string[] = ["p.status = 'active'"];
    const params: any[] = [];
    let paramIndex = 1;

    if (category) {
      whereConditions.push(`p.category = $${paramIndex++}`);
      params.push(category);
    }
    if (minPrice && !isNaN(minPrice)) {
      whereConditions.push(`p.base_price_usd >= $${paramIndex++}`);
      params.push(minPrice);
    }
    if (maxPrice && !isNaN(maxPrice)) {
      whereConditions.push(`p.base_price_usd <= $${paramIndex++}`);
      params.push(maxPrice);
    }
    if (search) {
      whereConditions.push(`(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    const hasAcceptedTokensTable = await this.supportsProductAcceptedTokens();

    if (acceptsCrypto) {
      if (hasAcceptedTokensTable) {
        whereConditions.push(`EXISTS (SELECT 1 FROM product_accepted_tokens pat WHERE pat.product_id = p.product_id)`);
      }
    }
    if (tokenSymbol) {
      if (hasAcceptedTokensTable) {
        whereConditions.push(`EXISTS (
          SELECT 1 FROM product_accepted_tokens pat
          JOIN token_whitelist tw ON pat.token_id = tw.token_id
          WHERE pat.product_id = p.product_id AND tw.symbol ILIKE $${paramIndex++}
        )`);
      } else {
        // Legacy schema without product_accepted_tokens cannot filter by token symbol.
        // Keep API stable by ignoring this filter instead of throwing SQL errors.
      }
      if (hasAcceptedTokensTable) params.push(tokenSymbol);
    }

    const whereClause = whereConditions.join(' AND ');

    // Count total — use same params (no limit/offset yet)
    const countResult = await query(
      `SELECT COUNT(*) FROM products p WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // ⚠️  FIX: capture index values BEFORE pushing to params array
    const limitIdx = paramIndex++;   // e.g. $5
    const offsetIdx = paramIndex;     // e.g. $6
    params.push(limitNum, offset);

    const acceptedTokensSelect = hasAcceptedTokensTable
      ? `(SELECT json_agg(json_build_object(
            'token_id', pat.token_id,
            'symbol', tw.symbol,
            'price_in_token', pat.price_in_token,
            'is_primary', pat.is_primary,
            'chain_id', tw.chain_id,
            'decimals', tw.decimals
         ))
         FROM product_accepted_tokens pat
         JOIN token_whitelist tw ON pat.token_id = tw.token_id
         WHERE pat.product_id = p.product_id)`
      : 'NULL';

    const result = await query(
      `SELECT
         p.*,
         COALESCE(SUM(i.available), 0)        AS stock,
         sp.display_name                       AS seller_name,
         sp.logo_url                           AS seller_avatar,
         sp.slug                               AS seller_slug,
         sp.rating_avg                         AS seller_rating,
         u.avatar_url                          AS seller_user_avatar,
         u.username                            AS seller_username,
         p.created_at                          AS listed_at,
         (SELECT image_url FROM product_images
          WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) AS primary_image,
         (SELECT json_agg(image_url ORDER BY sort_order)
          FROM product_images WHERE product_id = p.product_id)           AS images,
         ${acceptedTokensSelect}                                         AS accepted_tokens
       FROM products p
       LEFT JOIN seller_profiles sp ON p.seller_id = sp.seller_id
       LEFT JOIN users u            ON sp.user_id = u.user_id
       LEFT JOIN inventory i        ON p.product_id = i.product_id
       WHERE ${whereClause}
       GROUP BY p.product_id, sp.display_name, sp.logo_url, sp.slug, sp.rating_avg,
                u.avatar_url, u.username
       ORDER BY p.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return {
      products: result.rows,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    };
  }

  async getProductById(productId: number) {
    const cacheKey = `product:${productId}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const hasAcceptedTokensTable = await this.supportsProductAcceptedTokens();
    const acceptedTokensSelect = hasAcceptedTokensTable
      ? `(SELECT json_agg(json_build_object(
            'token_id', pat.token_id,
            'symbol', tw.symbol,
            'name', tw.metadata->>'name',
            'price_in_token', pat.price_in_token,
            'is_primary', pat.is_primary,
            'chain_id', tw.chain_id,
            'chain_name', tw.metadata->>'chain',
            'token_address', tw.token_address,
            'decimals', tw.decimals
         ))
         FROM product_accepted_tokens pat
         JOIN token_whitelist tw ON pat.token_id = tw.token_id
         WHERE pat.product_id = p.product_id)`
      : 'NULL';

    const result = await query(
      `SELECT
         p.*,
         COALESCE(SUM(i.available), 0)        AS stock,
         COALESCE(SUM(i.total_stock), 0)      AS total_stock,
         sp.display_name                       AS seller_name,
         sp.logo_url                           AS seller_avatar,
         sp.slug                               AS seller_slug,
         sp.rating_avg                         AS seller_rating,
         sp.description                        AS seller_description,
         sp.payout_wallet                      AS seller_wallet,
         sp.total_sales                        AS seller_total_sales,
         u.avatar_url                          AS seller_user_avatar,
         u.username                            AS seller_username,
         u.created_at                          AS seller_joined_at,
         p.created_at                          AS listed_at,
         (SELECT image_url FROM product_images
          WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) AS primary_image,
         (SELECT json_agg(json_build_object(
            'url', image_url, 'sort_order', sort_order, 'is_primary', is_primary
          ) ORDER BY sort_order)
          FROM product_images WHERE product_id = p.product_id)           AS images,
         ${acceptedTokensSelect}                                         AS accepted_tokens
       FROM products p
       LEFT JOIN seller_profiles sp ON p.seller_id = sp.seller_id
       LEFT JOIN users u            ON sp.user_id = u.user_id
       LEFT JOIN inventory i        ON p.product_id = i.product_id
       WHERE p.product_id = $1
       GROUP BY p.product_id, sp.display_name, sp.logo_url, sp.slug, sp.rating_avg,
                sp.description, sp.payout_wallet, sp.total_sales,
                u.avatar_url, u.username, u.created_at`,
      [productId]
    );

    if (result.rows.length === 0) throw new AppError('Product not found', 404);
    const product = result.rows[0];
    await setCache(cacheKey, product, 300);
    return product;
  }

  async createProduct(sellerId: number, data: any) {
    const { getClient } = await import('../../config/database');
    const client = await getClient();
    await client.query('BEGIN');
    try {
      const productResult = await client.query(
        `INSERT INTO products
           (seller_id, name, description, category, base_price_usd,
            token_id, price_in_token, metadata, status, product_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9)
         RETURNING *`,
        [
          sellerId,
          data.name,
          data.description || data.name,
          data.category || 'other',
          data.price || data.base_price_usd || 0,
          data.token_id || null,
          data.price_in_token || null,
          JSON.stringify(data.metadata || {}),
          data.product_type || 'physical',
        ]
      );
      const product = productResult.rows[0];

      // Multi-coin: save accepted_tokens
      const acceptedTokens: Array<{ token_id: number; price_in_token: number; is_primary?: boolean }> =
        data.accepted_tokens || [];
      if (acceptedTokens.length === 0 && data.token_id && data.price_in_token) {
        acceptedTokens.push({ token_id: data.token_id, price_in_token: data.price_in_token, is_primary: true });
      }
      if (acceptedTokens.length > 0 && (await this.supportsProductAcceptedTokens())) {
        for (const [idx, at] of acceptedTokens.entries()) {
          await client.query(
            `INSERT INTO product_accepted_tokens (product_id, token_id, price_in_token, is_primary)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (product_id, token_id) DO UPDATE
             SET price_in_token = EXCLUDED.price_in_token, is_primary = EXCLUDED.is_primary`,
            [product.product_id, at.token_id, at.price_in_token, at.is_primary ?? idx === 0]
          );
        }
      }

      // Save images from metadata.images[] (already uploaded to Cloudinary)
      const imageUrls: string[] = data.metadata?.images || [];
      for (const [idx, url] of imageUrls.entries()) {
        await client.query(
          `INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
           VALUES ($1,$2,$3,$4)`,
          [product.product_id, url, idx, idx === 0]
        );
      }

      // Create inventory
      const whResult = await client.query(
        `SELECT warehouse_id FROM warehouses WHERE status = 'active' ORDER BY warehouse_id LIMIT 1`
      );
      const warehouseId = whResult.rows[0]?.warehouse_id;
      if (warehouseId) {
        const stockQty = Math.max(0, parseInt(data.stock) || 0);
        await client.query(
          `INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved)
           VALUES ($1,$2,$3,$3,0)
           ON CONFLICT (product_id, warehouse_id) DO UPDATE
           SET total_stock = EXCLUDED.total_stock, available = EXCLUDED.available`,
          [product.product_id, warehouseId, stockQty]
        );
      }

      await client.query('COMMIT');
      logger.info('Product created', { product_id: product.product_id, seller_id: sellerId });
      return product;
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Create product error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateProduct(productId: number, userId: number, updates: any) {
    const sellerRes = await query('SELECT seller_id FROM seller_profiles WHERE user_id = $1', [userId]);
    if (sellerRes.rows.length === 0) throw new AppError('Seller profile not found', 403);
    const sellerId = sellerRes.rows[0].seller_id;

    const productResult = await query('SELECT * FROM products WHERE product_id = $1', [productId]);
    if (productResult.rows.length === 0) throw new AppError('Product not found', 404);
    if (productResult.rows[0].seller_id !== sellerId) throw new AppError('Not authorized', 403);

    const result = await query(
      `UPDATE products
       SET name           = COALESCE($1, name),
           description    = COALESCE($2, description),
           base_price_usd = COALESCE($3, base_price_usd),
           category       = COALESCE($4, category),
           metadata       = COALESCE($5::jsonb, metadata),
           updated_at     = NOW()
       WHERE product_id = $6 RETURNING *`,
      [
        updates.name || null,
        updates.description || null,
        updates.price || updates.base_price_usd || null,
        updates.category || null,
        updates.metadata ? JSON.stringify(updates.metadata) : null,
        productId,
      ]
    );

    if (Array.isArray(updates.accepted_tokens) && updates.accepted_tokens.length > 0) {
      if (await this.supportsProductAcceptedTokens()) {
        await query('DELETE FROM product_accepted_tokens WHERE product_id = $1', [productId]);
        for (const [idx, at] of updates.accepted_tokens.entries()) {
          await query(
            `INSERT INTO product_accepted_tokens (product_id, token_id, price_in_token, is_primary)
             VALUES ($1,$2,$3,$4)`,
            [productId, at.token_id, at.price_in_token, at.is_primary ?? idx === 0]
          );
        }
      } else {
        logger.warn('Skipping accepted_tokens update because product_accepted_tokens table is missing', { productId });
      }
    }

    await deleteCache(`product:${productId}`);
    return result.rows[0];
  }

  async deleteProduct(productId: number, userId: number) {
    const sellerRes = await query('SELECT seller_id FROM seller_profiles WHERE user_id = $1', [userId]);
    if (sellerRes.rows.length === 0) throw new AppError('Seller profile not found', 403);
    const sellerId = sellerRes.rows[0].seller_id;

    const productResult = await query('SELECT * FROM products WHERE product_id = $1', [productId]);
    if (productResult.rows.length === 0) throw new AppError('Product not found', 404);
    if (productResult.rows[0].seller_id !== sellerId) throw new AppError('Not authorized', 403);

    await query(`UPDATE products SET status = 'deleted', updated_at = NOW() WHERE product_id = $1`, [productId]);
    await deleteCache(`product:${productId}`);
    logger.info('Product deleted', { product_id: productId });
  }
}
