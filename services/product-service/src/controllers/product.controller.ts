import { Request, Response } from 'express';
import Product from '../models/Product.model';
import { redisClient } from '../utils/redis';
import { publishEvent } from '../utils/rabbitmq';
import logger from '../utils/logger';

const CACHE_TTL = 300; // 5 minutes

export class ProductController {
  // Get all products with filters
  static async getProducts(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        coinSymbol,
        minPrice,
        maxPrice,
        condition,
        status = 'ACTIVE',
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search,
        semanticSearch,
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Build filter
      const filter: any = { status };

      if (category) filter.category = category;
      if (coinSymbol) filter.coinSymbol = coinSymbol;
      if (condition) filter.condition = condition;
      
      if (minPrice || maxPrice) {
        filter.priceInCoins = {};
        if (minPrice) filter.priceInCoins.$gte = parseFloat(minPrice as string);
        if (maxPrice) filter.priceInCoins.$lte = parseFloat(maxPrice as string);
      }

      // Search
      if (search) {
        if (semanticSearch === 'true') {
          // Semantic search using search vector
          const searchTerms = (search as string).toLowerCase();
          filter.searchVector = { $regex: searchTerms, $options: 'i' };
        } else {
          // Text search
          filter.$text = { $search: search as string };
        }
      }

      // Try cache
      const cacheKey = `products:${JSON.stringify(req.query)}`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        return res.json({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
      }

      // Query
      const [products, total] = await Promise.all([
        Product.find(filter)
          .sort({ [sortBy as string]: sortOrder === 'desc' ? -1 : 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Product.countDocuments(filter),
      ]);

      const result = {
        products,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasMore: pageNum * limitNum < total,
        },
      };

      // Cache result
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Get products error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch products',
      });
    }
  }

  // Get featured products
  static async getFeaturedProducts(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 8;

      // Try cache first
      const cacheKey = `featured_products_${limit}`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        return res.json({
          success: true,
          data: JSON.parse(cached),
        });
      }

      // Get featured products (most views, likes, or recent)
      const products = await Product.find({ status: 'ACTIVE' })
        .sort({ views: -1, likes: -1, createdAt: -1 })
        .limit(limit)
        .select('-__v');

      const result = {
        products,
        total: products.length,
      };

      // Cache for 10 minutes
      await redisClient.setEx(cacheKey, 600, JSON.stringify(result));

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Get featured products error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch featured products',
      });
    }
  }

  // Get product by ID
  static async getProductById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const product = await Product.findById(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found',
        });
      }

      // Increment views
      product.views += 1;
      await product.save();

      res.json({
        success: true,
        data: product,
      });
    } catch (error: any) {
      logger.error('Get product error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch product',
      });
    }
  }

  // Create product
  static async createProduct(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const userName = req.headers['x-user-name'] as string || 'Anonymous';

      const productData = {
        ...req.body,
        sellerId: userId,
        sellerName: userName,
      };

      const product = await Product.create(productData);

      // Publish event
      await publishEvent('product.created', {
        productId: product.id,
        sellerId: userId,
        title: product.title,
        price: product.priceInCoins,
      });

      // Clear cache
      await redisClient.del('products:*');

      res.status(201).json({
        success: true,
        data: product,
      });
    } catch (error: any) {
      logger.error('Create product error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create product',
        details: error.message,
      });
    }
  }

  // Update product
  static async updateProduct(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.headers['x-user-id'] as string;

      const product = await Product.findById(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found',
        });
      }

      // Check ownership
      if (product.sellerId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to update this product',
        });
      }

      Object.assign(product, req.body);
      await product.save();

      // Clear cache
      await redisClient.del('products:*');

      res.json({
        success: true,
        data: product,
      });
    } catch (error: any) {
      logger.error('Update product error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update product',
      });
    }
  }

  // Delete product
  static async deleteProduct(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.headers['x-user-id'] as string;

      const product = await Product.findById(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found',
        });
      }

      // Check ownership
      if (product.sellerId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to delete this product',
        });
      }

      product.status = 'DELETED';
      await product.save();

      // Clear cache
      await redisClient.del('products:*');

      res.json({
        success: true,
        message: 'Product deleted successfully',
      });
    } catch (error: any) {
      logger.error('Delete product error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete product',
      });
    }
  }

  // Like/Unlike product
  static async toggleLike(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.headers['x-user-id'] as string;

      const product = await Product.findById(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found',
        });
      }

      const likeIndex = product.likes.indexOf(userId);

      if (likeIndex > -1) {
        // Unlike
        product.likes.splice(likeIndex, 1);
      } else {
        // Like
        product.likes.push(userId);
      }

      await product.save();

      res.json({
        success: true,
        data: {
          liked: likeIndex === -1,
          likesCount: product.likes.length,
        },
      });
    } catch (error: any) {
      logger.error('Toggle like error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle like',
      });
    }
  }

  // Get seller products
  static async getSellerProducts(req: Request, res: Response) {
    try {
      const { sellerId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const [products, total] = await Promise.all([
        Product.find({ sellerId, status: { $ne: 'DELETED' } })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Product.countDocuments({ sellerId, status: { $ne: 'DELETED' } }),
      ]);

      res.json({
        success: true,
        data: {
          products,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error: any) {
      logger.error('Get seller products error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch seller products',
      });
    }
  }

  // Search suggestions
  static async searchSuggestions(req: Request, res: Response) {
    try {
      const { q } = req.query;

      if (!q) {
        return res.json({ success: true, data: [] });
      }

      const suggestions = await Product.find({
        $text: { $search: q as string },
        status: 'ACTIVE',
      })
        .select('title')
        .limit(5)
        .lean();

      res.json({
        success: true,
        data: suggestions.map((p) => p.title),
      });
    } catch (error: any) {
      logger.error('Search suggestions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get suggestions',
      });
    }
  }
}

