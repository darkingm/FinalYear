import { Request, Response } from 'express';
import UserProfile, { UserRole } from '../models/UserProfile.model';
import SellerApplication, { ApplicationStatus } from '../models/SellerApplication.model';
import { publishEvent } from '../utils/rabbitmq';
import logger from '../utils/logger';

export class SellerController {
  // Apply to become seller
  static async applyForSeller(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;

      const profile = await UserProfile.findOne({ where: { userId } });

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Profile not found',
        });
      }

      if (profile.isSeller) {
        return res.status(400).json({
          success: false,
          error: 'Already a seller',
        });
      }

      // Check for existing application
      const existingApp = await SellerApplication.findOne({
        where: {
          userId,
          status: ApplicationStatus.PENDING,
        },
      });

      if (existingApp) {
        return res.status(400).json({
          success: false,
          error: 'Application already pending',
        });
      }

      // Create application
      const application = await SellerApplication.create({
        userId,
        ...req.body,
      });

      // Publish event
      await publishEvent('seller.application.created', {
        userId,
        applicationId: application.id,
      });

      res.status(201).json({
        success: true,
        data: application,
        message: 'Seller application submitted successfully',
      });
    } catch (error: any) {
      logger.error('Apply for seller error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit seller application',
        details: error.message,
      });
    }
  }

  // Get seller application status
  static async getApplicationStatus(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;

      const application = await SellerApplication.findOne({
        where: { userId },
        order: [['createdAt', 'DESC']],
      });

      if (!application) {
        return res.status(404).json({
          success: false,
          error: 'No application found',
        });
      }

      res.json({
        success: true,
        data: application,
      });
    } catch (error: any) {
      logger.error('Get application status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch application status',
      });
    }
  }

  // Get seller profile (public)
  static async getSellerProfile(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const seller = await UserProfile.findOne({
        where: {
          userId: id,
          isSeller: true,
          isActive: true,
        },
      });

      if (!seller) {
        return res.status(404).json({
          success: false,
          error: 'Seller not found',
        });
      }

      const sellerData = {
        id: seller.userId,
        username: seller.username,
        fullName: seller.fullName,
        avatar: seller.avatar,
        bio: seller.bio,
        shopName: seller.shopName,
        shopDescription: seller.shopDescription,
        sellerVerified: seller.sellerVerified,
        rating: seller.rating,
        reviewCount: seller.reviewCount,
        totalSales: seller.totalSales,
        joinedAt: seller.createdAt,
      };

      res.json({
        success: true,
        data: sellerData,
      });
    } catch (error: any) {
      logger.error('Get seller profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch seller profile',
      });
    }
  }

  // Update seller profile
  static async updateSellerProfile(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;

      const profile = await UserProfile.findOne({ where: { userId } });

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Profile not found',
        });
      }

      if (!profile.isSeller) {
        return res.status(403).json({
          success: false,
          error: 'Not a seller',
        });
      }

      // Update seller specific fields
      const allowedFields = ['shopName', 'shopDescription'];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          (profile as any)[field] = req.body[field];
        }
      }

      await profile.save();

      res.json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      logger.error('Update seller profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update seller profile',
      });
    }
  }

  // List all verified sellers
  static async listVerifiedSellers(req: Request, res: Response) {
    try {
      const { page = 1, limit = 20 } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const { count, rows } = await UserProfile.findAndCountAll({
        where: {
          isSeller: true,
          sellerVerified: true,
          isActive: true,
        },
        attributes: [
          'userId',
          'username',
          'fullName',
          'avatar',
          'shopName',
          'shopDescription',
          'rating',
          'reviewCount',
          'totalSales',
        ],
        limit: limitNum,
        offset,
        order: [['rating', 'DESC']],
      });

      res.json({
        success: true,
        data: {
          sellers: rows,
          pagination: {
            total: count,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(count / limitNum),
          },
        },
      });
    } catch (error: any) {
      logger.error('List sellers error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sellers',
      });
    }
  }
}

