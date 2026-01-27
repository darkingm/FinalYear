import { Request, Response } from 'express';
import Shop from '../models/Shop.model';
import Product from '../models/Product.model';
import logger from '../utils/logger';

export class ShopController {
  // Get shop by seller ID
  static async getShopBySellerId(req: Request, res: Response) {
    try {
      const { sellerId } = req.params;

      const shop = await Shop.findOne({ sellerId, status: 'ACTIVE' });

      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found',
        });
      }

      // Get shop statistics
      const totalProducts = await Product.countDocuments({
        sellerId,
        status: 'ACTIVE',
      });

      const totalSales = await Product.countDocuments({
        sellerId,
        status: 'SOLD',
      });

      res.json({
        success: true,
        data: {
          ...shop.toObject(),
          totalProducts,
          totalSales,
        },
      });
    } catch (error: any) {
      logger.error('Get shop by seller ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch shop',
        details: error.message,
      });
    }
  }

  // Get shop by shop ID
  static async getShopById(req: Request, res: Response) {
    try {
      const { shopId } = req.params;

      const shop = await Shop.findById(shopId);

      if (!shop || shop.status !== 'ACTIVE') {
        return res.status(404).json({
          success: false,
          error: 'Shop not found',
        });
      }

      // Get shop statistics
      const totalProducts = await Product.countDocuments({
        sellerId: shop.sellerId,
        status: 'ACTIVE',
      });

      const totalSales = await Product.countDocuments({
        sellerId: shop.sellerId,
        status: 'SOLD',
      });

      res.json({
        success: true,
        data: {
          ...shop.toObject(),
          totalProducts,
          totalSales,
        },
      });
    } catch (error: any) {
      logger.error('Get shop by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch shop',
        details: error.message,
      });
    }
  }

  // Create or update shop
  static async createOrUpdateShop(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User ID required',
        });
      }

      const {
        shopName,
        shopDescription,
        shopLogo,
        shopBanner,
        contactEmail,
        contactPhone,
        address,
        socialLinks,
        businessHours,
      } = req.body;

      if (!shopName) {
        return res.status(400).json({
          success: false,
          error: 'Shop name is required',
        });
      }

      // Check if shop already exists
      let shop = await Shop.findOne({ sellerId: userId });

      if (shop) {
        // Update existing shop
        shop.shopName = shopName;
        if (shopDescription) shop.shopDescription = shopDescription;
        if (shopLogo) shop.shopLogo = shopLogo;
        if (shopBanner) shop.shopBanner = shopBanner;
        if (contactEmail) shop.contactEmail = contactEmail;
        if (contactPhone) shop.contactPhone = contactPhone;
        if (address) shop.address = address;
        if (socialLinks) shop.socialLinks = socialLinks;
        if (businessHours) shop.businessHours = businessHours;

        await shop.save();

        res.json({
          success: true,
          data: shop,
          message: 'Shop updated successfully',
        });
      } else {
        // Create new shop
        shop = await Shop.create({
          sellerId: userId,
          shopName,
          shopDescription,
          shopLogo,
          shopBanner,
          contactEmail,
          contactPhone,
          address,
          socialLinks,
          businessHours,
          status: 'ACTIVE',
        });

        res.status(201).json({
          success: true,
          data: shop,
          message: 'Shop created successfully',
        });
      }
    } catch (error: any) {
      logger.error('Create/update shop error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create/update shop',
        details: error.message,
      });
    }
  }

  // Get shop products
  static async getShopProducts(req: Request, res: Response) {
    try {
      const { shopId } = req.params;
      const { page = 1, limit = 20, status = 'ACTIVE' } = req.query;

      const shop = await Shop.findById(shopId);

      if (!shop || shop.status !== 'ACTIVE') {
        return res.status(404).json({
          success: false,
          error: 'Shop not found',
        });
      }

      const skip = (Number(page) - 1) * Number(limit);

      const products = await Product.find({
        sellerId: shop.sellerId,
        status: status as string,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean();

      const total = await Product.countDocuments({
        sellerId: shop.sellerId,
        status: status as string,
      });

      res.json({
        success: true,
        data: {
          products,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error: any) {
      logger.error('Get shop products error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch shop products',
        details: error.message,
      });
    }
  }

  // Get top shops
  static async getTopShops(req: Request, res: Response) {
    try {
      const { limit = 10 } = req.query;

      const shops = await Shop.find({ status: 'ACTIVE', verified: true })
        .sort({ shopRating: -1, totalSales: -1 })
        .limit(Number(limit))
        .lean();

      res.json({
        success: true,
        data: { shops },
      });
    } catch (error: any) {
      logger.error('Get top shops error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch top shops',
        details: error.message,
      });
    }
  }
}

