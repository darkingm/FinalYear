import { Request, Response } from 'express';
import { Op } from 'sequelize';
import UserProfile from '../models/UserProfile.model';
import { redisClient } from '../utils/redis';
import { publishEvent } from '../utils/rabbitmq';
import logger from '../utils/logger';
import axios from 'axios';
import jwt from 'jsonwebtoken';

const CACHE_TTL = 300; // 5 minutes

export class UserController {
  // Create profile (auto-create if not exists)
  static async createProfile(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { fullName, email, username } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User ID required',
        });
      }

      // Check if profile already exists
      const existing = await UserProfile.findOne({ where: { userId } });
      if (existing) {
        return res.json({
          success: true,
          data: existing,
          message: 'Profile already exists',
        });
      }

      // Create new profile
      const profile = await UserProfile.create({
        userId,
        email: email || '',
        username: username || '',
        fullName: fullName || '',
        role: 'USER',
        isSeller: false,
        sellerVerified: false,
        bankVerified: false,
        bankVerificationStatus: 'PENDING',
        showCoinBalance: true,
        showJoinDate: true,
        showEmail: false,
        showPhone: false,
        totalSales: 0,
        totalPurchases: 0,
        rating: 0,
        reviewCount: 0,
        isActive: true,
        isSuspended: false,
      });

      // Publish event
      await publishEvent('user.profile.created', {
        userId,
        username: profile.username,
      });

      res.status(201).json({
        success: true,
        data: profile,
        message: 'Profile created successfully',
      });
    } catch (error: any) {
      logger.error('Create profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create profile',
        details: error.message,
      });
    }
  }

  // Get user profile
  static async getProfile(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      // ✅ Lấy email và username từ headers
      const userEmail = req.headers['x-user-email'] as string;
      const userUsername = req.headers['x-user-username'] as string;

      // ✅ Debug logging
      logger.info('Get profile request:', {
        userId,
        userEmail,
        userUsername,
        headers: {
          'x-user-id': req.headers['x-user-id'],
          'x-user-email': req.headers['x-user-email'],
          'x-user-username': req.headers['x-user-username'],
        },
      });

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User ID required',
        });
      }

      // Try cache
      const cacheKey = `user:profile:${userId}`;
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return res.json({
            success: true,
            data: JSON.parse(cached),
            cached: true,
          });
        }
      } catch (redisError) {
        // Redis not available, continue without cache
        logger.warn('Redis cache miss, continuing without cache');
      }

      let profile = await UserProfile.findOne({ where: { userId } });

      // ✅ Auto-create profile if not found
      if (!profile) {
        // ✅ Fallback: Nếu không có email từ headers, query từ auth service
        let finalEmail = userEmail;
        let finalUsername = userUsername;

        if (!finalEmail || !finalEmail.includes('@')) {
          // Try to get from auth service
          try {
            const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
            const authResponse = await axios.get(`${authServiceUrl}/api/users/${userId}`, {
              headers: {
                'X-Service-Key': process.env.SERVICE_SECRET_KEY || 'service-secret-key',
              },
            });

            if (authResponse.data?.data?.email) {
              finalEmail = authResponse.data.data.email;
              finalUsername = authResponse.data.data.username || finalUsername;
              logger.info(`Fetched email from auth service: ${finalEmail}`);
            }
          } catch (authError: any) {
            logger.warn('Failed to fetch user from auth service:', authError.message);
          }
        }

        // ✅ Validate email exists
        if (!finalEmail || !finalEmail.includes('@')) {
          logger.error('Cannot create profile: email is missing or invalid', {
            userId,
            userEmail,
            finalEmail,
          });
          return res.status(400).json({
            success: false,
            error: 'User email is required to create profile. Please ensure you are authenticated and API Gateway is properly configured.',
          });
        }

        // ✅ Create profile with email from JWT token or auth service
        profile = await UserProfile.create({
          userId,
          email: finalEmail, // ✅ Dùng email từ JWT token hoặc auth service
          username: finalUsername || `user_${userId.substring(0, 8)}`, // ✅ Dùng username từ JWT token
          fullName: '', // User sẽ update sau
          role: (req.headers['x-user-role'] as string) || 'USER',
          isSeller: false,
          sellerVerified: false,
          bankVerified: false,
          bankVerificationStatus: 'PENDING',
          showCoinBalance: true,
          showJoinDate: true,
          showEmail: false,
          showPhone: false,
          totalSales: 0,
          totalPurchases: 0,
          rating: 0,
          reviewCount: 0,
          isActive: true,
          isSuspended: false,
        });

        logger.info(`Auto-created profile for user ${userId} with email ${finalEmail}`);
      }

      // Cache result
      try {
        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(profile));
      } catch (redisError) {
        // Continue without cache
      }

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
        where: { 
          userId: id,
          // Only show active users, but don't require isActive if field doesn't exist
        },
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

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User ID required',
        });
      }

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
      try {
        await redisClient.del(`user:profile:${userId}`);
      } catch (redisError) {
        // Continue without cache
      }

      // Publish event
      try {
        await publishEvent('user.profile.updated', {
          userId,
          username: profile.username,
        });
      } catch (eventError) {
        // Continue without event
        logger.warn('Failed to publish event:', eventError);
      }

      res.json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      logger.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile',
        details: error.message,
      });
    }
  }

  // Update privacy settings
  static async updatePrivacy(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User ID required',
        });
      }

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
      try {
        await redisClient.del(`user:profile:${userId}`);
      } catch (redisError) {
        // Continue without cache
      }

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

  // Upload avatar
  static async uploadAvatar(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const file = req.file as Express.Multer.File;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User ID required',
        });
      }

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      // In production, upload to S3/Cloudinary/etc
      // For now, save file path or URL
      const avatarUrl = `/uploads/avatars/${file.filename}`;

      const profile = await UserProfile.findOne({ where: { userId } });
      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Profile not found',
        });
      }

      profile.avatar = avatarUrl;
      await profile.save();

      // Clear cache
      try {
        await redisClient.del(`user:profile:${userId}`);
      } catch (redisError) {
        // Continue without cache
      }

      res.json({
        success: true,
        data: { avatar: avatarUrl },
      });
    } catch (error: any) {
      logger.error('Upload avatar error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload avatar',
        details: error.message,
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

      if (!q || !q.toString().trim()) {
        return res.json({
          success: true,
          data: { 
            users: [], 
            pagination: { 
              total: 0, 
              page: pageNum, 
              limit: limitNum,
              totalPages: 0,
            } 
          },
        });
      }

      const searchQuery = q.toString().trim();

      const { count, rows } = await UserProfile.findAndCountAll({
        where: {
          [Op.or]: [
            { username: { [Op.iLike]: `%${searchQuery}%` } },
            { fullName: { [Op.iLike]: `%${searchQuery}%` } },
          ],
          // Only show active users if field exists
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
        details: error.message,
      });
    }
  }
}