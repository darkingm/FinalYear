import { Request, Response } from 'express';
import UserProfile from '../models/UserProfile.model';
import { redisClient } from '../utils/redis';
import { publishEvent } from '../utils/rabbitmq';
import logger from '../utils/logger';

const CACHE_TTL = 300; // 5 minutes

export class UserController {
  // Get user profile
  static async getProfile(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;

      // Try cache
      const cacheKey = `user:profile:${userId}`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        return res.json({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
      }

      const profile = await UserProfile.findOne({ where: { userId } });

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Profile not found',
        });
      }

      // Cache result
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(profile));

      res.json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      logger.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch profile',
      });
    }
  }

  // Get user by ID (public view)
  static async getUserById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const user = await UserProfile.findOne({
        where: { userId: id, isActive: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      // Filter based on privacy settings
      const publicData: any = {
        id: user.userId,
        username: user.username,
        fullName: user.fullName,
        avatar: user.avatar,
        bio: user.bio,
        isSeller: user.isSeller,
        sellerVerified: user.sellerVerified,
        shopName: user.shopName,
        shopDescription: user.shopDescription,
        rating: user.rating,
        reviewCount: user.reviewCount,
      };

      if (user.showJoinDate) {
        publicData.createdAt = user.createdAt;
      }

      if (user.showEmail) {
        publicData.email = user.email;
      }

      if (user.showPhone) {
        publicData.phone = user.phone;
      }

      res.json({
        success: true,
        data: publicData,
      });
    } catch (error: any) {
      logger.error('Get user error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user',
      });
    }
  }

  // Update profile
  static async updateProfile(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;

      const profile = await UserProfile.findOne({ where: { userId } });

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Profile not found',
        });
      }

      // Update allowed fields
      const allowedFields = [
        'fullName', 'bio', 'phone', 'dateOfBirth',
        'country', 'city', 'address', 'avatar',
        'showCoinBalance', 'showJoinDate', 'showEmail', 'showPhone',
      ];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          (profile as any)[field] = req.body[field];
        }
      }

      await profile.save();

      // Clear cache
      await redisClient.del(`user:profile:${userId}`);

      // Publish event
      await publishEvent('user.profile.updated', {
        userId,
        username: profile.username,
      });

      res.json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      logger.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile',
      });
    }
  }

  // Update privacy settings
  static async updatePrivacy(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { showCoinBalance, showJoinDate, showEmail, showPhone } = req.body;

      const profile = await UserProfile.findOne({ where: { userId } });

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Profile not found',
        });
      }

      if (showCoinBalance !== undefined) profile.showCoinBalance = showCoinBalance;
      if (showJoinDate !== undefined) profile.showJoinDate = showJoinDate;
      if (showEmail !== undefined) profile.showEmail = showEmail;
      if (showPhone !== undefined) profile.showPhone = showPhone;

      await profile.save();

      // Clear cache
      await redisClient.del(`user:profile:${userId}`);

      res.json({
        success: true,
        message: 'Privacy settings updated',
      });
    } catch (error: any) {
      logger.error('Update privacy error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update privacy settings',
      });
    }
  }

  // Search users
  static async searchUsers(req: Request, res: Response) {
    try {
      const { q, page = 1, limit = 20 } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      if (!q) {
        return res.json({
          success: true,
          data: { users: [], pagination: { total: 0, page: pageNum, limit: limitNum } },
        });
      }

      const { count, rows } = await UserProfile.findAndCountAll({
        where: {
          [sequelize.Sequelize.Op.or]: [
            { username: { [sequelize.Sequelize.Op.iLike]: `%${q}%` } },
            { fullName: { [sequelize.Sequelize.Op.iLike]: `%${q}%` } },
          ],
          isActive: true,
        },
        limit: limitNum,
        offset,
        attributes: ['userId', 'username', 'fullName', 'avatar', 'isSeller', 'rating'],
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
      logger.error('Search users error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search users',
      });
    }
  }
}

