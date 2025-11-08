import { Request, Response } from 'express';
import UserProfile, { UserRole } from '../models/UserProfile.model';
import SellerApplication, { ApplicationStatus } from '../models/SellerApplication.model';
import { publishEvent } from '../utils/rabbitmq';
import logger from '../utils/logger';

export class AdminController {
  // Get all users (admin only)
  static async getAllUsers(req: Request, res: Response) {
    try {
      const { page = 1, limit = 50, role, status } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const where: any = {};
      if (role) where.role = role;
      if (status === 'active') where.isActive = true;
      if (status === 'suspended') where.isSuspended = true;

      const { count, rows } = await UserProfile.findAndCountAll({
        where,
        limit: limitNum,
        offset,
        order: [['createdAt', 'DESC']],
      });

      res.json({
        success: true,
        data: {
          users: rows,
          pagination: {
            total: count,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(count / limitNum),
          },
        },
      });
    } catch (error: any) {
      logger.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch users',
      });
    }
  }

  // Review seller application
  static async reviewSellerApplication(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { action, rejectionReason } = req.body;
      const adminId = req.headers['x-user-id'] as string;

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid action',
        });
      }

      const application = await SellerApplication.findByPk(id);

      if (!application) {
        return res.status(404).json({
          success: false,
          error: 'Application not found',
        });
      }

      if (application.status !== ApplicationStatus.PENDING) {
        return res.status(400).json({
          success: false,
          error: 'Application already reviewed',
        });
      }

      const profile = await UserProfile.findOne({
        where: { userId: application.userId },
      });

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'User profile not found',
        });
      }

      if (action === 'approve') {
        // Approve application
        application.status = ApplicationStatus.APPROVED;
        application.reviewedBy = adminId;
        application.reviewedAt = new Date();
        await application.save();

        // Update user profile
        profile.isSeller = true;
        profile.sellerVerified = true;
        profile.sellerVerificationDate = new Date();
        profile.shopName = application.shopName;
        profile.shopDescription = application.shopDescription;
        profile.taxId = application.taxId;
        profile.bankName = application.bankName;
        profile.bankAccountNumber = application.bankAccountNumber;
        profile.bankAccountName = application.bankAccountName;
        profile.bankVerified = true;

        // Upgrade to seller role if still user
        if (profile.role === UserRole.USER) {
          profile.role = UserRole.SELLER;
        }

        await profile.save();

        // Publish event
        await publishEvent('seller.application.approved', {
          userId: application.userId,
          applicationId: application.id,
          shopName: application.shopName,
        });

        res.json({
          success: true,
          message: 'Seller application approved',
        });
      } else {
        // Reject application
        application.status = ApplicationStatus.REJECTED;
        application.reviewedBy = adminId;
        application.reviewedAt = new Date();
        application.rejectionReason = rejectionReason;
        await application.save();

        // Publish event
        await publishEvent('seller.application.rejected', {
          userId: application.userId,
          applicationId: application.id,
          reason: rejectionReason,
        });

        res.json({
          success: true,
          message: 'Seller application rejected',
        });
      }
    } catch (error: any) {
      logger.error('Review seller application error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to review application',
      });
    }
  }

  // Get all seller applications
  static async getSellerApplications(req: Request, res: Response) {
    try {
      const { page = 1, limit = 20, status } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const where: any = {};
      if (status) where.status = status;

      const { count, rows } = await SellerApplication.findAndCountAll({
        where,
        limit: limitNum,
        offset,
        order: [['createdAt', 'DESC']],
      });

      res.json({
        success: true,
        data: {
          applications: rows,
          pagination: {
            total: count,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(count / limitNum),
          },
        },
      });
    } catch (error: any) {
      logger.error('Get seller applications error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch applications',
      });
    }
  }

  // Suspend/Unsuspend user
  static async toggleUserSuspension(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { suspend, reason } = req.body;

      const profile = await UserProfile.findOne({ where: { userId: id } });

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      profile.isSuspended = suspend;
      profile.suspensionReason = suspend ? reason : null;
      await profile.save();

      await publishEvent(suspend ? 'user.suspended' : 'user.unsuspended', {
        userId: id,
        reason: suspend ? reason : undefined,
      });

      res.json({
        success: true,
        message: suspend ? 'User suspended' : 'User unsuspended',
      });
    } catch (error: any) {
      logger.error('Toggle suspension error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update suspension status',
      });
    }
  }

  // Update user role
  static async updateUserRole(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!Object.values(UserRole).includes(role)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid role',
        });
      }

      const profile = await UserProfile.findOne({ where: { userId: id } });

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      profile.role = role;
      await profile.save();

      await publishEvent('user.role.updated', {
        userId: id,
        role,
      });

      res.json({
        success: true,
        message: 'User role updated',
      });
    } catch (error: any) {
      logger.error('Update role error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update role',
      });
    }
  }

  // Get user statistics
  static async getUserStats(req: Request, res: Response) {
    try {
      const totalUsers = await UserProfile.count();
      const activeSellers = await UserProfile.count({
        where: { isSeller: true, isActive: true },
      });
      const verifiedSellers = await UserProfile.count({
        where: { sellerVerified: true },
      });
      const suspendedUsers = await UserProfile.count({
        where: { isSuspended: true },
      });
      const pendingApplications = await SellerApplication.count({
        where: { status: ApplicationStatus.PENDING },
      });

      res.json({
        success: true,
        data: {
          totalUsers,
          activeSellers,
          verifiedSellers,
          suspendedUsers,
          pendingApplications,
        },
      });
    } catch (error: any) {
      logger.error('Get user stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
      });
    }
  }
}

