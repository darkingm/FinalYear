import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { ProductService } from './products.service';
import { logger } from '../../utils/logger';
import { query } from '../../config/database';
import { setCache, getCache } from '../../config/redis';

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

    // Cache default explore page
    const isDefault = filters.page === 1 && filters.limit === 20 && !filters.category && !filters.minPrice && !filters.maxPrice && !filters.search && !filters.acceptsCrypto && !filters.tokenSymbol;
    if (isDefault) {
      const cached: any = await getCache('explore_default');
      if (cached) return res.json({ success: true, data: cached.products, pagination: cached.pagination });
    }

    const result = await productService.getProducts(filters);

    if (isDefault) {
      await setCache('explore_default', result, 30);
    }

    res.json({ success: true, data: result.products, pagination: result.pagination });
  } catch (error: any) {
    next(error);
  }
}

export async function getTokens(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const cached = await getCache('token_whitelist');
    if (cached) return res.json({ success: true, data: cached });

    const result = await query(
      `SELECT tw.*, 0::int AS product_count
       FROM token_whitelist tw
       WHERE tw.is_active = TRUE
       ORDER BY tw.symbol`
    );

    await setCache('token_whitelist', result.rows, 3600); // Cache 1 giờ
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
    const coinsStr = (req.query.coins as string) || 'default';
    const cacheKey = `homepage_products:${coinsStr}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    const coins = (req.query.coins as string)?.split(',').map(c => c.trim().toUpperCase())
      || ['BTC', 'ETH', 'BNB', 'SOL', 'USDT', 'USDC', 'MATIC', 'DOGE'];
    const products = await productService.getHomepageProducts(coins);
    
    await setCache(cacheKey, products, 30); // 30s TTL
    res.json({ success: true, data: products });
  } catch (error: any) {
    next(error);
  }
}

export async function getSellerStore(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params;
    if (!slug) return res.status(400).json({ success: false, message: 'Seller slug is required' });

    // Fetch seller profile with user info
    const sellerRes = await query(
      `SELECT sp.seller_id, sp.display_name, sp.description, sp.logo_url, sp.slug,
              sp.payout_wallet, sp.rating_avg, sp.total_sales, sp.created_at AS seller_since,
              u.username, u.avatar_url, u.email
       FROM seller_profiles sp
       JOIN users u ON sp.user_id = u.user_id
       WHERE sp.slug = $1`,
      [slug]
    );

    if (sellerRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    const seller = sellerRes.rows[0];

    // Fetch seller's active products with images + stock + tokens
    const productsRes = await query(
      `SELECT p.product_id, p.name, p.description, p.base_price_usd, p.category,
              p.rating_avg, p.review_count, p.status, p.created_at,
              (SELECT image_url FROM product_images WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) AS primary_image,
              COALESCE(SUM(i.available), 0)::int AS stock,
              COALESCE(
                (SELECT json_agg(json_build_object(
                  'token_id', pat.token_id,
                  'symbol', tw.symbol,
                  'price_in_token', pat.price_in_token,
                  'is_primary', pat.is_primary,
                  'chain_id', tw.chain_id
                ))
                FROM product_accepted_tokens pat
                JOIN token_whitelist tw ON pat.token_id = tw.token_id
                WHERE pat.product_id = p.product_id), '[]'
              ) AS accepted_tokens
       FROM products p
       LEFT JOIN inventory i ON p.product_id = i.product_id
       WHERE p.seller_id = $1 AND p.status = 'active'
       GROUP BY p.product_id
       ORDER BY p.created_at DESC`,
      [seller.seller_id]
    );

    res.json({
      success: true,
      data: {
        seller: {
          seller_id: seller.seller_id,
          display_name: seller.display_name,
          description: seller.description,
          logo_url: seller.logo_url,
          slug: seller.slug,
          payout_wallet: seller.payout_wallet,
          rating_avg: seller.rating_avg,
          total_sales: seller.total_sales,
          seller_since: seller.seller_since,
          username: seller.username,
          avatar_url: seller.avatar_url,
        },
        products: productsRes.rows,
      },
    });
  } catch (error: any) {
    logger.error('Get seller store error:', error);
    next(error);
  }
}
