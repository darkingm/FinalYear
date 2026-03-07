import { query } from '../../config/database';
import { setCache, getCache, deleteCache } from '../../config/redis';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';

export class ProductService {
  async getProducts(filters: any) {
    const { page, limit, category, minPrice, maxPrice, search, acceptsCrypto, acceptsPayPal } = filters;
    const offset = (page - 1) * limit;

    let whereConditions = ["p.status = 'active'"];
    let params: any[] = [];
    let paramIndex = 1;

    if (category) {
      whereConditions.push(`p.metadata->>'category' = $${paramIndex++}`);
      params.push(category);
    }

    if (minPrice) {
      whereConditions.push(`p.base_price_usd >= $${paramIndex++}`);
      params.push(minPrice);
    }

    if (maxPrice) {
      whereConditions.push(`p.base_price_usd <= $${paramIndex++}`);
      params.push(maxPrice);
    }

    if (search) {
      whereConditions.push(`(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (acceptsCrypto) {
      whereConditions.push(`jsonb_array_length(p.metadata->'accepted_tokens'->'crypto') > 0`);
    }

    if (acceptsPayPal) {
      whereConditions.push(`p.metadata->'accepted_tokens'->'fiat' @> '["paypal"]'`);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM products p WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get products
    params.push(limit, offset);
    const result = await query(
      `SELECT p.*,
              COALESCE(SUM(i.available), 0) AS stock,
              sp.display_name AS seller_name,
              (SELECT image_url FROM product_images
               WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) AS primary_image
       FROM products p
       LEFT JOIN seller_profiles sp ON p.seller_id = sp.seller_id
       LEFT JOIN inventory i ON p.product_id = i.product_id
       WHERE ${whereClause}
       GROUP BY p.product_id, sp.display_name
       ORDER BY p.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return {
      products: result.rows,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getProductById(productId: number) {
    // Try cache first
    const cacheKey = `product:${productId}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await query(
      `SELECT p.*,
              COALESCE(SUM(i.available), 0) AS stock,
              COALESCE(SUM(i.total_stock), 0) AS total_stock,
              sp.display_name AS seller_name,
              sp.payout_wallet AS seller_wallet,
              (SELECT image_url FROM product_images
               WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) AS primary_image
       FROM products p
       LEFT JOIN seller_profiles sp ON p.seller_id = sp.seller_id
       LEFT JOIN inventory i ON p.product_id = i.product_id
       WHERE p.product_id = $1
       GROUP BY p.product_id, sp.display_name, sp.payout_wallet`,
      [productId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Product not found', 404);
    }

    const product = result.rows[0];

    // Cache for 5 minutes
    await setCache(cacheKey, product, 300);

    return product;
  }

  async createProduct(sellerId: number, data: any) {
    // sellerId here is seller_profiles.seller_id (not user_id)
    const result = await query(
      `INSERT INTO products (seller_id, name, description, category, base_price_usd, metadata, status, product_type)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
       RETURNING *`,
      [
        sellerId,
        data.name,
        data.description,
        data.category || 'general',
        data.price || data.base_price_usd,
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
    // Resolve seller_id from user_id
    const sellerRes = await query(
      'SELECT seller_id FROM seller_profiles WHERE user_id = $1',
      [userId]
    );
    if (sellerRes.rows.length === 0) {
      throw new AppError('Seller profile not found', 403);
    }
    const sellerId = sellerRes.rows[0].seller_id;

    // Check ownership
    const productResult = await query(
      'SELECT * FROM products WHERE product_id = $1',
      [productId]
    );

    if (productResult.rows.length === 0) {
      throw new AppError('Product not found', 404);
    }

    const product = productResult.rows[0];

    if (product.seller_id !== sellerId) {
      throw new AppError('Not authorized to update this product', 403);
    }

    // Update product
    const result = await query(
      `UPDATE products 
       SET name           = COALESCE($1, name),
           description    = COALESCE($2, description),
           base_price_usd = COALESCE($3, base_price_usd),
           category       = COALESCE($4, category),
           metadata       = COALESCE($5, metadata),
           updated_at     = NOW()
       WHERE product_id = $6
       RETURNING *`,
      [
        updates.name,
        updates.description,
        updates.price || updates.base_price_usd,
        updates.category,
        updates.metadata ? JSON.stringify(updates.metadata) : null,
        productId,
      ]
    );

    // Invalidate cache
    await deleteCache(`product:${productId}`);

    return result.rows[0];
  }

  async deleteProduct(productId: number, userId: number) {
    // Resolve seller_id from user_id
    const sellerRes = await query(
      'SELECT seller_id FROM seller_profiles WHERE user_id = $1',
      [userId]
    );
    if (sellerRes.rows.length === 0) {
      throw new AppError('Seller profile not found', 403);
    }
    const sellerId = sellerRes.rows[0].seller_id;

    // Check ownership
    const productResult = await query(
      'SELECT * FROM products WHERE product_id = $1',
      [productId]
    );

    if (productResult.rows.length === 0) {
      throw new AppError('Product not found', 404);
    }

    const product = productResult.rows[0];

    if (product.seller_id !== sellerId) {
      throw new AppError('Not authorized to delete this product', 403);
    }

    // Soft delete
    await query(
      `UPDATE products SET status = 'deleted', updated_at = NOW() WHERE product_id = $1`,
      [productId]
    );

    // Invalidate cache
    await deleteCache(`product:${productId}`);

    logger.info('Product deleted', { product_id: productId });
  }
}
