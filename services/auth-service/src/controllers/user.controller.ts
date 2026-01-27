import { Request, Response } from 'express';
import logger from '../utils/logger';
import { UserService } from '../services/user.service';
import { UserValidator } from '../validators/user.validator';


export class UserController {
  /**
   * Create user profile
   * Validate input → Business logic (UserService) → Response
   */
  static async createProfile(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const userEmail = req.headers['x-user-email'] as string;
      const userUsername = req.headers['x-user-username'] as string;
      const userRole = req.headers['x-user-role'] as string;
      const { fullName } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User ID required',
        });
      }

      // Call service
      const profile = await UserService.autoCreateProfileIfNeeded(
        userId,
        userEmail,
        userUsername,
        userRole
      );

      res.status(201).json({
        success: true,
        data: profile,
        message: 'Profile created successfully',
      });
    } catch (error: any) {
      logger.error('Create profile error:', error.message);

      res.status(400).json({
        success: false,
        error: error.message || 'Failed to create profile',
      });
    }
  }

  /**
   * Get user profile
   */
  static async getProfile(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const userEmail = req.headers['x-user-email'] as string;
      const userUsername = req.headers['x-user-username'] as string;
      const userRole = req.headers['x-user-role'] as string;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      // Call service (cache-first)
      let profile = await UserService.getUserProfile(userId);

      // Auto-create if not found
      if (!profile) {
        profile = await UserService.autoCreateProfileIfNeeded(
          userId,
          userEmail,
          userUsername,
          userRole
        );
      }

      res.json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      logger.error('Get profile error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to fetch profile',
      });
    }
  }

  /**
   * Get user by ID (public view)
   */
  static async getUserById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const user = await UserService.getPublicUserProfile(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      logger.error('Get user error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to fetch user',
      });
    }
  }

  /**
   * Update profile
   */
  static async updateProfile(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      // Validate input
      const validation = UserValidator.validateProfileUpdate(req.body);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          errors: validation.errors,
        });
      }

      // Call service
      const profile = await UserService.updateUserProfile(userId, req.body);

      res.json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      logger.error('Update profile error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to update profile',
      });
    }
  }

  /**
   * Update privacy settings
   */
  static async updatePrivacy(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      // Validate input
      const validation = UserValidator.validatePrivacySettings(req.body);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          errors: validation.errors,
        });
      }

      // Call service
      await UserService.updatePrivacySettings(userId, req.body);

      res.json({
        success: true,
        message: 'Privacy settings updated',
      });
    } catch (error: any) {
      logger.error('Update privacy error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to update privacy settings',
      });
    }
  }

  /**
   * Upload avatar
   */
  static async uploadAvatar(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const file = req.file as Express.Multer.File;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      // In production, upload to S3/Cloudinary
      const avatarUrl = `/uploads/avatars/${file.filename}`;

      await UserService.updateUserProfile(userId, { avatar: avatarUrl } as any);

      res.json({
        success: true,
        data: { avatar: avatarUrl },
      });
    } catch (error: any) {
      logger.error('Upload avatar error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to upload avatar',
      });
    }
  }

  /**
   * Get dashboard stats
   */
  static async getDashboardStats(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      // Call service
      const stats = await UserService.getDashboardStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Get dashboard stats error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard statistics',
      });
    }
  }

  /**
   * Search users
   */
  static async searchUsers(req: Request, res: Response) {
    try {
      const { q, page = '1', limit = '20' } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      // Call service
      const result = await UserService.searchUsers(q as string, pageNum, limitNum);

      res.json({
        success: true,
        data: {
          users: result.users,
          pagination: {
            total: result.total,
            page: pageNum,
            limit: limitNum,
            totalPages: result.totalPages,
          },
        },
      });
    } catch (error: any) {
      logger.error('Search users error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to search users',
      });
    }
  }

  /**
   * Get user balances
   */
  static async getBalances(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const requestUserId = req.headers['x-user-id'] as string;

      // User can only view their own balances
      if (userId !== requestUserId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You can only view your own balances',
        });
      }

      // Call service
      const balances = await UserService.getUserBalances(userId);

      res.json({
        success: true,
        data: { balances, userId },
      });
    } catch (error: any) {
      logger.error('Get balances error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to fetch balances',
      });
    }
  }

  /**
   * Add balance
   */
  static async addBalance(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const requestUserId = req.headers['x-user-id'] as string;
      const { coinId, amount, source } = req.body;

      // User can only modify their own balances
      if (userId !== requestUserId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You can only modify your own balances',
        });
      }

      // Validate input
      const coinIdValidation = UserValidator.validateCoinId(coinId);
      if (!coinIdValidation.valid) {
        return res.status(400).json({
          success: false,
          error: coinIdValidation.error,
        });
      }

      const amountValidation = UserValidator.validateBalance(amount);
      if (!amountValidation.valid) {
        return res.status(400).json({
          success: false,
          error: amountValidation.error,
        });
      }

      // Call service
      const result = await UserService.addBalance(userId, coinId, amount, source);

      res.json({
        success: true,
        data: result,
        message: 'Balance added successfully',
      });
    } catch (error: any) {
      logger.error('Add balance error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to add balance',
      });
    }
  }

  /**
   * Deduct balance
   */
  static async deductBalance(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const requestUserId = req.headers['x-user-id'] as string;
      const { coinId, amount, orderId } = req.body;

      // User can only modify their own balances
      if (userId !== requestUserId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You can only modify your own balances',
        });
      }

      // Validate input
      const coinIdValidation = UserValidator.validateCoinId(coinId);
      if (!coinIdValidation.valid) {
        return res.status(400).json({
          success: false,
          error: coinIdValidation.error,
        });
      }

      const amountValidation = UserValidator.validateBalance(amount);
      if (!amountValidation.valid) {
        return res.status(400).json({
          success: false,
          error: amountValidation.error,
        });
      }

      // Call service
      const result = await UserService.deductBalance(userId, coinId, amount, orderId);

      res.json({
        success: true,
        data: result,
        message: 'Balance deducted successfully',
      });
    } catch (error: any) {
      logger.error('Deduct balance error:', error.message);

      if (error.message.includes('Insufficient balance')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to deduct balance',
      });
    }
  }

  /**
   * Withdraw funds to external wallet
   */
  static async withdraw(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const requestUserId = req.headers['x-user-id'] as string;
      const { coinId, coinSymbol, amount, walletAddress, network, walletType } = req.body;

      // User can only withdraw their own funds
      if (userId !== requestUserId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You can only withdraw your own funds',
        });
      }

      // Validate input
      const validation = UserValidator.validateWithdrawal({
        coinId,
        coinSymbol,
        amount,
        walletAddress,
        network,
      });

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          errors: validation.errors,
        });
      }

      // Call service
      const result = await UserService.processWithdrawal(
        userId,
        coinId,
        coinSymbol,
        amount,
        walletAddress,
        network,
        walletType
      );

      res.json({
        success: true,
        data: result,
        message: 'Withdrawal request submitted successfully',
      });
    } catch (error: any) {
      logger.error('Withdrawal error:', error.message);

      if (error.message.includes('Insufficient balance')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Withdrawal failed',
      });
    }
  }
}

