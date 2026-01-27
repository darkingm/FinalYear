import UserProfile from '../models/UserProfile.model';
import User from '../models/User.model';
import { publishEvent } from '../utils/rabbitmq';
import { getUserByEmail, updateCachedUserProfile, invalidateUserProfileCache } from './cache.service';
import logger from '../utils/logger';
import { redisClient } from '../utils/redis';

/**
 * UserService - Handles user profile business logic
 * Responsibilities:
 * - Profile creation and retrieval
 * - Profile updates
 * - User search
 * - Balance management
 * - Withdrawal processing
 * - Privacy settings
 */
export class UserService {
  /**
   * Create user profile
   */
  static async createUserProfile(
    userId: string,
    email: string,
    username: string,
    fullName?: string,
    role?: string
  ): Promise<UserProfile> {
    const profile = await UserProfile.create({
      userId,
      email,
      username,
      fullName: fullName || '',
      role: role || 'USER',
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

    logger.info(`Profile created for user: ${userId}`);

    return profile;
  }

  /**
   * Get user profile with cache-first strategy
   */
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    // Check cache first
    try {
      const cachedProfile = await redisClient.get(`user:profile:${userId}`);
      if (cachedProfile) {
        logger.debug(`Profile cache hit for user: ${userId}`);
        return JSON.parse(cachedProfile);
      }
    } catch (error: any) {
      logger.warn(`Cache lookup failed: ${error.message}`);
    }

    // Query database
    const profile = await UserProfile.findOne({ where: { userId } });

    // Update cache
    if (profile) {
      try {
        await redisClient.setEx(
          `user:profile:${userId}`,
          3600, // 1 hour TTL
          JSON.stringify(profile)
        );
      } catch (error: any) {
        logger.warn(`Failed to cache profile: ${error.message}`);
      }
    }

    return profile;
  }

  /**
   * Get user by ID (public view)
   */
  static async getPublicUserProfile(userId: string): Promise<any | null> {
    const profile = await UserProfile.findOne({ where: { userId } });

    if (!profile) {
      return null;
    }

    // Filter based on privacy settings
    const publicData: any = {
      id: profile.userId,
      username: profile.username,
      fullName: profile.fullName,
      avatar: profile.avatar,
      bio: profile.bio,
      isSeller: profile.isSeller,
      sellerVerified: profile.sellerVerified,
      shopName: profile.shopName,
      shopDescription: profile.shopDescription,
      rating: profile.rating,
      reviewCount: profile.reviewCount,
    };

    if (profile.showJoinDate) {
      publicData.createdAt = profile.createdAt;
    }

    if (profile.showEmail) {
      publicData.email = profile.email;
    }

    if (profile.showPhone) {
      publicData.phone = profile.phone;
    }

    return publicData;
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<UserProfile> {
    const profile = await UserProfile.findOne({ where: { userId } });

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Only allow specific fields to be updated
    const allowedFields = [
      'fullName', 'bio', 'phone', 'dateOfBirth',
      'country', 'city', 'address', 'avatar',
    ];

    for (const field of allowedFields) {
      if (updates[field as keyof UserProfile] !== undefined) {
        (profile as any)[field] = updates[field as keyof UserProfile];
      }
    }

    await profile.save();

    // Update cache
    await updateCachedUserProfile(userId, profile);

    // Publish event
    try {
      await publishEvent('user.profile.updated', {
        userId,
        username: profile.username,
      });
    } catch (error: any) {
      logger.warn(`Failed to publish event: ${error.message}`);
    }

    logger.info(`Profile updated for user: ${userId}`);

    return profile;
  }

  /**
   * Update privacy settings
   */
  static async updatePrivacySettings(
    userId: string,
    settings: {
      showCoinBalance?: boolean;
      showJoinDate?: boolean;
      showEmail?: boolean;
      showPhone?: boolean;
    }
  ): Promise<UserProfile> {
    const profile = await UserProfile.findOne({ where: { userId } });

    if (!profile) {
      throw new Error('Profile not found');
    }

    if (settings.showCoinBalance !== undefined) profile.showCoinBalance = settings.showCoinBalance;
    if (settings.showJoinDate !== undefined) profile.showJoinDate = settings.showJoinDate;
    if (settings.showEmail !== undefined) profile.showEmail = settings.showEmail;
    if (settings.showPhone !== undefined) profile.showPhone = settings.showPhone;

    await profile.save();

    // Update cache
    await updateCachedUserProfile(userId, profile);

    logger.info(`Privacy settings updated for user: ${userId}`);

    return profile;
  }

  /**
   * Search users by username or full name
   */
  static async searchUsers(
    query: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ users: UserProfile[]; total: number; totalPages: number }> {
    if (!query || query.trim() === '') {
      return { users: [], total: 0, totalPages: 0 };
    }

    const { Op } = require('sequelize');
    const offset = (page - 1) * limit;

    const { count, rows } = await UserProfile.findAndCountAll({
      where: {
        [Op.or]: [
          { username: { [Op.iLike]: `%${query}%` } },
          { fullName: { [Op.iLike]: `%${query}%` } },
        ],
      },
      attributes: ['userId', 'username', 'fullName', 'avatar', 'isSeller', 'rating'],
      limit,
      offset,
    });

    logger.info(`User search for query: "${query}" returned ${count} results`);

    return {
      users: rows,
      total: count,
      totalPages: Math.ceil(count / limit),
    };
  }

  /**
   * Get user balances
   */
  static async getUserBalances(userId: string): Promise<any[]> {
    const profile = await this.getUserProfile(userId);

    if (!profile) {
      throw new Error('User not found');
    }

    // Get balances from profile metadata or return empty
    return (profile as any).coinBalances || [];
  }

  /**
   * Add balance for user
   */
  static async addBalance(
    userId: string,
    coinId: string,
    amount: number,
    source: string = 'MANUAL'
  ): Promise<any> {
    const profile = await UserProfile.findOne({ where: { userId } });

    if (!profile) {
      throw new Error('User not found');
    }

    const coinBalances = (profile as any).coinBalances || [];
    const existingBalance = coinBalances.find((b: any) => b.coinId === coinId);

    if (existingBalance) {
      existingBalance.balance = parseFloat(existingBalance.balance.toString()) + amount;
    } else {
      coinBalances.push({
        coinId,
        balance: amount,
      });
    }

    (profile as any).coinBalances = coinBalances;
    await profile.save();

    // Publish event
    try {
      await publishEvent('wallet.balance.added', {
        userId,
        coinId,
        amount,
        source,
      });
    } catch (error: any) {
      logger.warn(`Failed to publish event: ${error.message}`);
    }

    logger.info(`Balance added for user: ${userId}, coin: ${coinId}, amount: ${amount}`);

    return {
      coinId,
      balance: existingBalance ? existingBalance.balance : amount,
    };
  }

  /**
   * Deduct balance from user
   */
  static async deductBalance(
    userId: string,
    coinId: string,
    amount: number,
    orderId?: string
  ): Promise<any> {
    const profile = await UserProfile.findOne({ where: { userId } });

    if (!profile) {
      throw new Error('User not found');
    }

    const coinBalances = (profile as any).coinBalances || [];
    const existingBalance = coinBalances.find((b: any) => b.coinId === coinId);

    if (!existingBalance || parseFloat(existingBalance.balance.toString()) < amount) {
      throw new Error('Insufficient balance');
    }

    existingBalance.balance = parseFloat(existingBalance.balance.toString()) - amount;
    (profile as any).coinBalances = coinBalances;
    await profile.save();

    // Publish event
    try {
      await publishEvent('wallet.balance.deducted', {
        userId,
        coinId,
        amount,
        orderId,
      });
    } catch (error: any) {
      logger.warn(`Failed to publish event: ${error.message}`);
    }

    logger.info(`Balance deducted for user: ${userId}, coin: ${coinId}, amount: ${amount}`);

    return {
      coinId,
      balance: existingBalance.balance,
    };
  }

  /**
   * Process withdrawal request
   */
  static async processWithdrawal(
    userId: string,
    coinId: string,
    coinSymbol: string,
    amount: number,
    walletAddress: string,
    network: string,
    walletType: string = 'manual'
  ): Promise<any> {
    const profile = await UserProfile.findOne({ where: { userId } });

    if (!profile) {
      throw new Error('User not found');
    }

    const coinBalances = (profile as any).coinBalances || [];
    const existingBalance = coinBalances.find((b: any) => b.coinId === coinId);
    const withdrawalFee = 0.001; // Configurable

    if (!existingBalance || parseFloat(existingBalance.balance.toString()) < amount + withdrawalFee) {
      throw new Error('Insufficient balance (including withdrawal fee)');
    }

    // Deduct balance and fee
    const totalDeduct = amount + withdrawalFee;
    existingBalance.balance = parseFloat(existingBalance.balance.toString()) - totalDeduct;
    (profile as any).coinBalances = coinBalances;
    await profile.save();

    // Publish event for blockchain service
    try {
      await publishEvent('wallet.withdrawal.requested', {
        userId,
        coinId,
        coinSymbol,
        amount,
        fee: withdrawalFee,
        walletAddress,
        network,
        walletType,
      });
    } catch (error: any) {
      logger.warn(`Failed to publish withdrawal event: ${error.message}`);
    }

    logger.info(`Withdrawal requested for user: ${userId}, coin: ${coinSymbol}, amount: ${amount}`);

    return {
      transactionId: `WTH-${Date.now()}-${userId}`,
      coinId,
      coinSymbol,
      amount,
      fee: withdrawalFee,
      totalDeducted: totalDeduct,
      walletAddress,
      network,
      status: 'pending',
      balance: existingBalance.balance,
    };
  }

  /**
   * Get dashboard stats
   */
  static async getDashboardStats(userId: string): Promise<any> {
    const profile = await this.getUserProfile(userId);

    if (!profile) {
      throw new Error('Profile not found');
    }

    return {
      totalOrders: 0, // Will be populated from order-service
      activeOrders: 0,
      completedOrders: 0,
      totalSpent: 0,
      totalEarned: profile.totalSales || 0,
      totalPurchases: profile.totalPurchases || 0,
      rating: profile.rating || 0,
      reviewCount: profile.reviewCount || 0,
    };
  }

  /**
   * Auto-create profile if not exists
   */
  static async autoCreateProfileIfNeeded(
    userId: string,
    email?: string,
    username?: string,
    role?: string
  ): Promise<UserProfile> {
    const existing = await UserProfile.findOne({ where: { userId } });

    if (existing) {
      return existing;
    }

    // Try to get email from User table if not provided
    let finalEmail = email;
    let finalUsername = username;

    if (!finalEmail) {
      const user = await User.findByPk(userId);
      if (user) {
        finalEmail = user.email;
        finalUsername = finalUsername || user.username;
      }
    }

    if (!finalEmail) {
      throw new Error('Cannot create profile: email is required');
    }

    const profile = await this.createUserProfile(
      userId,
      finalEmail,
      finalUsername || `user_${userId.substring(0, 8)}`,
      '',
      role || 'USER'
    );

    return profile;
  }
}
