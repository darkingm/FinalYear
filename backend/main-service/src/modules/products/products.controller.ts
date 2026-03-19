import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { ProductService } from './products.service';
import { logger } from '../../utils/logger';
import { query } from '../../config/database';

const productService = new ProductService();

/** Ensure a seller_profile exists for the authenticated user.
 *  Any active user can sell — no KYC required (auto-create profile).
 *  Returns { seller_id } */
async function ensureSellerProfile(userId: number, displayName?: string): Promise<number> {
  const existing = await query('SELECT seller_id FROM seller_profiles WHERE user_id = $1', [userId]);
  if (existing.rows.length > 0) return existing.rows[0].seller_id;

  // Auto-create seller profile
  const userRes = await query('SELECT username, email FROM users WHERE user_id = $1', [userId]);
  const user = userRes.rows[0];
  const name = displayName || user?.username || user?.email?.split('@')[0] || `seller_${userId}`;
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${userId}`;

  const res = await query(
    `INSERT INTO seller_profiles (user_id, display_name, slug, kyc_status)
     VALUES ($1, $2, $3, 'pending')
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING seller_id`,
    [userId, name, slug]
  );

  // Update user role to seller
  await query(`UPDATE users SET role = 'seller', updated_at = NOW() WHERE user_id = $1 AND role = 'buyer'`, [userId]);

  logger.info('Auto-created seller profile', { user_id: userId, seller_id: res.rows[0].seller_id });
  return res.rows[0].seller_id;
}

export async function getProducts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      category: req.query.category as string | undefined,
      minPrice: parseFloat(req.query.minPrice as string),
      maxPrice: parseFloat(req.query.maxPrice as string),
      search: req.query.search as string | undefined,
      acceptsCrypto: req.query.acceptsCrypto === 'true',
      tokenSymbol: (req.query.token || req.query.token_symbol) as string | undefined,
    };
    const result = await productService.getProducts(filters);
    res.json({ success: true, data: result.products, pagination: result.pagination });
  } catch (error: any) {
    next(error);
  }
}

export async function getTokens(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await query(
      `SELECT tw.*, 0::int AS product_count
       FROM token_whitelist tw
       WHERE tw.is_active = TRUE
       ORDER BY tw.symbol`
    );

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    next(error);
  }
}

export async function getProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) return res.status(400).json({ success: false, message: 'Invalid product ID' });
    const product = await productService.getProductById(productId);
    res.json({ success: true, data: product });
  } catch (error: any) {
    next(error);
  }
}

export async function createProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const productData = req.body;

    // Any active user can sell — auto-create seller profile if not exists
    const sellerId = await ensureSellerProfile(userId, productData.seller_display_name);

    const product = await productService.createProduct(sellerId, productData);
    res.status(201).json({ success: true, data: product });
  } catch (error: any) {
    logger.error('Create product error:', error);
    next(error);
  }
}

export async function updateProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const productId = parseInt(req.params.id);
    const userId = req.user!.user_id;
    const product = await productService.updateProduct(productId, userId, req.body);
    res.json({ success: true, data: product });
  } catch (error: any) {
    next(error);
  }
}

export async function deleteProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const productId = parseInt(req.params.id);
    const userId = req.user!.user_id;
    await productService.deleteProduct(productId, userId);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error: any) {
    next(error);
  }
}

export async function uploadImages(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const files = (req as any).files as Array<{ buffer: Buffer; originalname: string; mimetype: string }>;
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }
    const { uploadToCloudinary } = await import('../../config/cloudinary');
    const urls: string[] = [];
    for (const file of files) {
      const url = await uploadToCloudinary(file.buffer, 'products');
      urls.push(url);
    }
    res.json({ success: true, urls });
  } catch (error: any) {
    logger.error('Upload images error:', error);
    next(error);
  }
}

export async function getMyProducts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const sellerRes = await query('SELECT seller_id FROM seller_profiles WHERE user_id = $1', [userId]);
    if (sellerRes.rows.length === 0) return res.json({ success: true, data: [] });

    const sellerId = sellerRes.rows[0].seller_id;
    const result = await query(
      `SELECT p.*,
              (SELECT image_url FROM product_images WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) AS primary_image,
              COALESCE(SUM(i.available), 0) AS stock
       FROM products p
       LEFT JOIN inventory i ON p.product_id = i.product_id
       WHERE p.seller_id = $1 AND p.status != 'deleted'
       GROUP BY p.product_id
       ORDER BY p.created_at DESC`,
      [sellerId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    next(error);
  }
}

export async function getHomepageProducts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const coins = (req.query.coins as string)?.split(',').map(c => c.trim().toUpperCase())
      || ['BTC', 'ETH', 'BNB', 'SOL', 'USDT', 'USDC', 'MATIC', 'DOGE'];
    const products = await productService.getHomepageProducts(coins);
    res.json({ success: true, data: products });
  } catch (error: any) {
    next(error);
  }
}
