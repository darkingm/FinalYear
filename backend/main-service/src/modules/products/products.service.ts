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
      `SELECT p.*, i.available as stock, sp.display_name as seller_name, u.user_id as owner_user_id, tw.symbol as token_symbol
       FROM products p
       LEFT JOIN inventory i ON p.product_id = i.product_id
       LEFT JOIN seller_profiles sp ON p.seller_id = sp.seller_id
       LEFT JOIN users u ON sp.user_id = u.user_id
       LEFT JOIN token_whitelist tw ON p.token_id = tw.token_id
       WHERE ${whereClause}
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
      `SELECT p.*, i.available as stock, i.total_stock, sp.display_name as seller_name, u.email as seller_email, u.user_id as owner_user_id, tw.symbol as token_symbol
       FROM products p
       LEFT JOIN inventory i ON p.product_id = i.product_id
       LEFT JOIN seller_profiles sp ON p.seller_id = sp.seller_id
       LEFT JOIN users u ON sp.user_id = u.user_id
       LEFT JOIN token_whitelist tw ON p.token_id = tw.token_id
       WHERE p.product_id = $1`,
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

  async createProduct(userId: number, data: any) {
    // Get seller_id from user_id
    const sellerResult = await query('SELECT seller_id FROM seller_profiles WHERE user_id = $1', [userId]);
    if (sellerResult.rows.length === 0) {
      throw new AppError('Seller profile not found', 404);
    }
    const realSellerId = sellerResult.rows[0].seller_id;

    const result = await query(
      `INSERT INTO products (seller_id, name, description, base_price_usd, metadata, status, pricing_mode, token_id, price_token)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8)
       RETURNING *`,
      [
        realSellerId,
        data.name,
        data.description,
        data.price || data.base_price_usd,
        JSON.stringify(data.metadata),
        data.pricing_mode || 'usd',
        data.token_id || null,
        data.price_token || null
      ]
    );

    const product = result.rows[0];

    // Initialize inventory
    await query(
      `INSERT INTO inventory (product_id, total_stock, available)
       VALUES ($1, $2, $2)`,
      [product.product_id, data.stock || 0]
    );

    logger.info('Product created', { product_id: product.product_id });

    return product;
  }

  async updateProduct(productId: number, userId: number, updates: any) {
    const productResult = await query(
      'SELECT p.*, sp.user_id as owner_user_id FROM products p JOIN seller_profiles sp ON p.seller_id = sp.seller_id WHERE p.product_id = $1',
      [productId]
    );

    if (productResult.rows.length === 0) {
      throw new AppError('Product not found', 404);
    }

    const product = productResult.rows[0];

    if (product.owner_user_id !== userId) {
      throw new AppError('Not authorized to update this product', 403);
    }

    // Update product
    const result = await query(
      `UPDATE products 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           base_price_usd = COALESCE($3, base_price_usd),
           metadata = COALESCE($4, metadata),
           pricing_mode = COALESCE($5, pricing_mode),
           token_id = COALESCE($6, token_id),
           price_token = COALESCE($7, price_token),
           updated_at = NOW()
       WHERE product_id = $8
       RETURNING *`,
      [
        updates.name,
        updates.description,
        updates.price || updates.base_price_usd,
        updates.metadata ? JSON.stringify(updates.metadata) : null,
        updates.pricing_mode,
        updates.token_id,
        updates.price_token,
        productId,
      ]
    );

    // Invalidate cache
    await deleteCache(`product:${productId}`);

    return result.rows[0];
  }

  async deleteProduct(productId: number, userId: number) {
    // Check ownership
    const productResult = await query(
      'SELECT p.*, sp.user_id as owner_user_id FROM products p JOIN seller_profiles sp ON p.seller_id = sp.seller_id WHERE p.product_id = $1',
      [productId]
    );

    if (productResult.rows.length === 0) {
      throw new AppError('Product not found', 404);
    }

    const product = productResult.rows[0];

    if (product.owner_user_id !== userId) {
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
