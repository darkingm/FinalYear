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
      `SELECT p.*, i.available as stock, u.username as seller_name
       FROM products p
       LEFT JOIN inventory i ON p.product_id = i.product_id
       LEFT JOIN users u ON p.seller_id = u.user_id
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
      `SELECT p.*, i.available as stock, i.total_stock, u.username as seller_name, u.email as seller_email
       FROM products p
       LEFT JOIN inventory i ON p.product_id = i.product_id
       LEFT JOIN users u ON p.seller_id = u.user_id
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

  async createProduct(sellerId: number, data: any) {
    const result = await query(
      `INSERT INTO products (seller_id, name, description, base_price_usd, metadata, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING *`,
      [sellerId, data.name, data.description, data.price || data.base_price_usd, JSON.stringify(data.metadata)]
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
    // Check ownership
    const productResult = await query(
      'SELECT * FROM products WHERE product_id = $1',
      [productId]
    );

    if (productResult.rows.length === 0) {
      throw new AppError('Product not found', 404);
    }

    const product = productResult.rows[0];

    if (product.seller_id !== userId) {
      throw new AppError('Not authorized to update this product', 403);
    }

    // Update product
    const result = await query(
      `UPDATE products 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           base_price_usd = COALESCE($3, base_price_usd),
           metadata = COALESCE($4, metadata),
           updated_at = NOW()
       WHERE product_id = $5
       RETURNING *`,
      [
        updates.name,
        updates.description,
        updates.price || updates.base_price_usd,
        updates.metadata ? JSON.stringify(updates.metadata) : null,
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
      'SELECT * FROM products WHERE product_id = $1',
      [productId]
    );

    if (productResult.rows.length === 0) {
      throw new AppError('Product not found', 404);
    }

    const product = productResult.rows[0];

    if (product.seller_id !== userId) {
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
