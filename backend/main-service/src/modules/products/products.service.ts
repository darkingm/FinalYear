import { query } from '../../config/database';
import { setCache, getCache, deleteCache } from '../../config/redis';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';

export class ProductService {
  async getProducts(filters: any) {
    const { page, limit, category, minPrice, maxPrice, search, acceptsCrypto, acceptsPayPal, tokenSymbol } = filters;
    const offset = ((page || 1) - 1) * (limit || 20);

    let whereConditions = ["p.status = 'active'"];
    let params: any[] = [];
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

    if (acceptsCrypto) {
      whereConditions.push(`p.token_id IS NOT NULL`);
    }

    if (acceptsPayPal) {
      whereConditions.push(`p.metadata->'accepted_tokens'->'fiat' @> '"paypal"'`);
    }

    if (tokenSymbol) {
      whereConditions.push(`tw.symbol ILIKE $${paramIndex++}`);
      params.push(tokenSymbol);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*)
       FROM products p
       LEFT JOIN token_whitelist tw ON p.token_id = tw.token_id
       WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get products with full seller + token info
    params.push(limit || 20, offset);
    const result = await query(
      `SELECT p.*,
              COALESCE(SUM(i.available), 0)        AS stock,
              sp.display_name                       AS seller_name,
              sp.logo_url                           AS seller_avatar,
              sp.slug                               AS seller_slug,
              sp.rating_avg                         AS seller_rating,
              u.avatar_url                          AS seller_user_avatar,
              tw.symbol                             AS token_symbol,
              tw.chain_id                           AS token_chain_id,
              tw.decimals                           AS token_decimals,
              p.created_at                          AS listed_at,
              (SELECT image_url FROM product_images
               WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) AS primary_image,
              (SELECT json_agg(image_url ORDER BY sort_order)
               FROM product_images WHERE product_id = p.product_id) AS images
       FROM products p
       LEFT JOIN seller_profiles sp ON p.seller_id = sp.seller_id
       LEFT JOIN users u            ON sp.user_id = u.user_id
       LEFT JOIN token_whitelist tw ON p.token_id = tw.token_id
       LEFT JOIN inventory i        ON p.product_id = i.product_id
       WHERE ${whereClause}
       GROUP BY p.product_id, sp.display_name, sp.logo_url, sp.slug, sp.rating_avg,
                u.avatar_url, tw.symbol, tw.chain_id, tw.decimals
       ORDER BY p.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return {
      products: result.rows,
      pagination: {
        total,
        page: page || 1,
        limit: limit || 20,
        pages: Math.ceil(total / (limit || 20)),
      },
    };
  }

  async getProductById(productId: number) {
    const cacheKey = `product:${productId}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const result = await query(
      `SELECT p.*,
              COALESCE(SUM(i.available), 0)        AS stock,
              COALESCE(SUM(i.total_stock), 0)      AS total_stock,
              sp.display_name                       AS seller_name,
              sp.logo_url                           AS seller_avatar,
              sp.slug                               AS seller_slug,
              sp.rating_avg                         AS seller_rating,
              sp.description                        AS seller_description,
              sp.payout_wallet                      AS seller_wallet,
              u.avatar_url                          AS seller_user_avatar,
              tw.symbol                             AS token_symbol,
              tw.chain_id                           AS token_chain_id,
              tw.decimals                           AS token_decimals,
              p.created_at                          AS listed_at,
              (SELECT image_url FROM product_images
               WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) AS primary_image,
              (SELECT json_agg(image_url ORDER BY sort_order)
               FROM product_images WHERE product_id = p.product_id) AS images
       FROM products p
       LEFT JOIN seller_profiles sp ON p.seller_id = sp.seller_id
       LEFT JOIN users u            ON sp.user_id = u.user_id
       LEFT JOIN token_whitelist tw ON p.token_id = tw.token_id
       LEFT JOIN inventory i        ON p.product_id = i.product_id
       WHERE p.product_id = $1
       GROUP BY p.product_id, sp.display_name, sp.logo_url, sp.slug, sp.rating_avg,
                sp.description, sp.payout_wallet, u.avatar_url,
                tw.symbol, tw.chain_id, tw.decimals`,
      [productId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Product not found', 404);
    }

    const product = result.rows[0];
    await setCache(cacheKey, product, 300);
    return product;
  }

  async createProduct(sellerId: number, data: any) {
    const result = await query(
      `INSERT INTO products
         (seller_id, name, description, category, base_price_usd,
          token_id, price_in_token, metadata, status, product_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9)
       RETURNING *`,
      [
        sellerId,
        data.name,
        data.description,
        data.category || 'general',
        data.price || data.base_price_usd,
        data.token_id || null,
        data.price_in_token || null,
        JSON.stringify(data.metadata || {}),
        data.product_type || 'physical',
      ]
    );

    const product = result.rows[0];

    // Get default warehouse
    const whResult = await query(
      `SELECT warehouse_id FROM warehouses WHERE status = 'active' ORDER BY warehouse_id LIMIT 1`
    );
    const warehouseId = whResult.rows[0]?.warehouse_id;

    if (warehouseId) {
      const stockQty = data.stock || 0;
      await query(
        `INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved)
         VALUES ($1, $2, $3, $3, 0)
         ON CONFLICT (product_id, warehouse_id) DO UPDATE
         SET total_stock = EXCLUDED.total_stock, available = EXCLUDED.available`,
        [product.product_id, warehouseId, stockQty]
      );
    }

    logger.info('Product created', { product_id: product.product_id });
    return product;
  }

  async updateProduct(productId: number, userId: number, updates: any) {
    const sellerRes = await query('SELECT seller_id FROM seller_profiles WHERE user_id = $1', [userId]);
    if (sellerRes.rows.length === 0) throw new AppError('Seller profile not found', 403);
    const sellerId = sellerRes.rows[0].seller_id;

    const productResult = await query('SELECT * FROM products WHERE product_id = $1', [productId]);
    if (productResult.rows.length === 0) throw new AppError('Product not found', 404);

    if (productResult.rows[0].seller_id !== sellerId) {
      throw new AppError('Not authorized to update this product', 403);
    }

    const result = await query(
      `UPDATE products
       SET name           = COALESCE($1, name),
           description    = COALESCE($2, description),
           base_price_usd = COALESCE($3, base_price_usd),
           category       = COALESCE($4, category),
           token_id       = COALESCE($5, token_id),
           price_in_token = COALESCE($6, price_in_token),
           metadata       = COALESCE($7, metadata),
           updated_at     = NOW()
       WHERE product_id = $8
       RETURNING *`,
      [
        updates.name,
        updates.description,
        updates.price || updates.base_price_usd,
        updates.category,
        updates.token_id || null,
        updates.price_in_token || null,
        updates.metadata ? JSON.stringify(updates.metadata) : null,
        productId,
      ]
    );

    await deleteCache(`product:${productId}`);
    return result.rows[0];
  }

  async deleteProduct(productId: number, userId: number) {
    const sellerRes = await query('SELECT seller_id FROM seller_profiles WHERE user_id = $1', [userId]);
    if (sellerRes.rows.length === 0) throw new AppError('Seller profile not found', 403);
    const sellerId = sellerRes.rows[0].seller_id;

    const productResult = await query('SELECT * FROM products WHERE product_id = $1', [productId]);
    if (productResult.rows.length === 0) throw new AppError('Product not found', 404);

    if (productResult.rows[0].seller_id !== sellerId) {
      throw new AppError('Not authorized to delete this product', 403);
    }

    await query(`UPDATE products SET status = 'deleted', updated_at = NOW() WHERE product_id = $1`, [productId]);
    await deleteCache(`product:${productId}`);
    logger.info('Product deleted', { product_id: productId });
  }
}
