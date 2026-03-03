import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { ProductService } from './products.service';
import { logger } from '../../utils/logger';

const productService = new ProductService();

export async function getProducts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      category: req.query.category as string,
      minPrice: parseFloat(req.query.minPrice as string),
      maxPrice: parseFloat(req.query.maxPrice as string),
      search: req.query.search as string,
      acceptsCrypto: req.query.acceptsCrypto === 'true',
      acceptsPayPal: req.query.acceptsPayPal === 'true',
    };

    const result = await productService.getProducts(filters);

    res.json({
      success: true,
      data: result.products,
      pagination: result.pagination,
    });
  } catch (error: any) {
    logger.error('Get products error:', error);
    next(error);
  }
}

export async function getProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const productId = parseInt(req.params.id);
    const product = await productService.getProductById(productId);

    res.json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    logger.error('Get product error:', error);
    next(error);
  }
}

export async function createProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const sellerId = req.user!.user_id;
    const productData = req.body;

    const product = await productService.createProduct(sellerId, productData);

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    logger.error('Create product error:', error);
    next(error);
  }
}

export async function updateProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const productId = parseInt(req.params.id);
    const userId = req.user!.user_id;
    const updates = req.body;

    const product = await productService.updateProduct(productId, userId, updates);

    res.json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    logger.error('Update product error:', error);
    next(error);
  }
}

export async function deleteProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const productId = parseInt(req.params.id);
    const userId = req.user!.user_id;

    await productService.deleteProduct(productId, userId);

    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete product error:', error);
    next(error);
  }
}

export async function uploadImages(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // This would integrate with multer and S3/Cloudinary
    // For now, return mock URLs
    const urls = [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ];

    res.json({
      success: true,
      urls,
    });
  } catch (error: any) {
    logger.error('Upload images error:', error);
    next(error);
  }
}
