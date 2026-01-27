import User from '../models/User.model';
import OTP from '../models/OTP.model';
import { sendEmail } from './email.service';
import { publishEvent } from '../utils/rabbitmq';
import { cacheSession, invalidateUserCache, getUserByEmail } from './cache.service';
import logger from '../utils/logger';
import { TokenService } from './token.service';

/**
 * AuthService - Handles authentication business logic
 * Responsibilities:
 * - User registration
 * - Email verification
 * - Login/logout
 * - Password reset
 * - OTP management
 * - Cache synchronization
 * - Event publishing
 */
export class AuthService {
  private static readonly OTP_EXPIRY_MINUTES = 10;
  private static readonly MAX_OTP_ATTEMPTS = 5;

  /**
   * Register new user
   */
  static async registerUser(
    email: string,
    username: string,
    password: string,
    fullName: string
  ): Promise<User> {
    // Check if user already exists (cache-first)
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Check username uniqueness
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      throw new Error('Username already taken');
    }

    // Create user
    const user = await User.create({
      email,
      username,
      password,
      fullName,
      role: 'USER',
      isEmailVerified: false,
    });

    // Invalidate cache for consistency
    await invalidateUserCache(user.id, email, username);

    logger.info(`User registered: ${user.id} (${email})`);

    return user;
  }

  /**
   * Send verification email with OTP
   */
  static async sendVerificationEmail(email: string): Promise<void> {
    const otp = this.generateOTP();
    const expiresAt = this.calculateExpiryTime(this.OTP_EXPIRY_MINUTES);

    await OTP.create({
      email,
      otp,
      type: 'EMAIL_VERIFICATION',
      expiresAt,
      verified: false,
      attempts: 0,
    });

    await sendEmail({
      to: email,
      subject: 'Verify Your Email - TokenAsset',
      html: `
        <h1>Welcome to TokenAsset!</h1>
        <p>Your verification code is: <strong>${otp}</strong></p>
        <p>This code will expire in ${this.OTP_EXPIRY_MINUTES} minutes.</p>
      `,
    });

    logger.info(`Verification email sent to: ${email}`);
  }

  /**
   * Verify email OTP and update user
   */
  static async verifyEmailOTP(email: string, otp: string): Promise<User> {
    const otpRecord = await OTP.findOne({
      where: {
        email,
        otp,
        type: 'EMAIL_VERIFICATION',
        verified: false,
      },
      order: [['createdAt', 'DESC']],
    });

    if (!otpRecord) {
      throw new Error('Invalid OTP');
    }

    if (otpRecord.isExpired()) {
      throw new Error('OTP expired');
    }

    if (!otpRecord.canRetry()) {
      throw new Error('Too many attempts. Please request a new OTP.');
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new Error('User not found');
    }

    // Update user verification status
    user.isEmailVerified = true;
    await user.save();

    // Mark OTP as verified
    otpRecord.verified = true;
    await otpRecord.save();

    logger.info(`Email verified for user: ${user.id}`);

    return user;
  }

  /**
   * Authenticate user login
   */
  static async authenticateLogin(
    email: string,
    password: string
  ): Promise<User> {
    // Cache-first lookup
    const user = await getUserByEmail(email);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.password) {
      throw new Error('Please use OAuth login (Google/Facebook)');
    }

    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new Error('Please verify your email first');
    }

    logger.info(`User logged in: ${user.id}`);

    return user;
  }

  /**
   * Create session after login
   */
  static async createSession(user: User, ipAddress: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    // Generate tokens
    const accessToken = TokenService.generateAccessToken(user);
    const refreshToken = await TokenService.generateRefreshToken(user, ipAddress);

    // Store session in cache
    await cacheSession(user.id, {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    logger.info(`Session created for user: ${user.id}`);

    return { accessToken, refreshToken };
  }

  /**
   * Update last login (async event)
   */
  static async publishLoginEvent(userId: string, email: string): Promise<void> {
    try {
      await publishEvent('user.logged_in', {
        userId,
        email,
        timestamp: new Date().toISOString(),
      });
      await publishEvent('user.login.update', {
        userId,
        lastLoginAt: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.warn(`Failed to publish login events: ${error.message}`);
    }
  }

  /**
   * Refresh user session with new tokens
   */
  static async refreshSession(
    refreshToken: string,
    ipAddress: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Verify JWT token
    const decoded = TokenService.verifyRefreshToken(refreshToken);

    // Get token record from DB
    const tokenRecord = await TokenService.getRefreshTokenRecord(refreshToken);

    if (!tokenRecord) {
      throw new Error('Invalid refresh token');
    }

    // Check if token is still active
    if (!TokenService.isRefreshTokenActive(tokenRecord)) {
      throw new Error('Refresh token is revoked or expired');
    }

    // Get user
    const user = await User.findByPk(decoded.id);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate new tokens
    const newAccessToken = TokenService.generateAccessToken(user);
    const newRefreshToken = await TokenService.generateRefreshToken(user, ipAddress);

    // Revoke old refresh token
    const hashedNewRefreshToken = this.hashToken(newRefreshToken);
    await TokenService.revokeRefreshToken(tokenRecord, ipAddress, hashedNewRefreshToken);

    logger.info(`Session refreshed for user: ${user.id}`);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  /**
   * Logout user
   */
  static async logout(
    refreshToken: string,
    userId: string,
    ipAddress: string
  ): Promise<void> {
    if (refreshToken) {
      const tokenRecord = await TokenService.getRefreshTokenRecord(refreshToken);
      if (tokenRecord) {
        await TokenService.revokeRefreshToken(tokenRecord, ipAddress);
      }
    }

    logger.info(`User logged out: ${userId}`);
  }

  /**
   * Send password reset OTP
   */
  static async sendPasswordResetEmail(email: string): Promise<void> {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      // Don't reveal if user exists
      logger.info(`Password reset requested for non-existent email: ${email}`);
      return;
    }

    const otp = this.generateOTP();
    const expiresAt = this.calculateExpiryTime(this.OTP_EXPIRY_MINUTES);

    await OTP.create({
      email,
      otp,
      type: 'PASSWORD_RESET',
      expiresAt,
      verified: false,
      attempts: 0,
    });

    await sendEmail({
      to: email,
      subject: 'Password Reset - TokenAsset',
      html: `
        <h1>Password Reset Request</h1>
        <p>Your reset code is: <strong>${otp}</strong></p>
        <p>This code will expire in ${this.OTP_EXPIRY_MINUTES} minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });

    logger.info(`Password reset email sent to: ${email}`);
  }

  /**
   * Reset password after OTP verification
   */
  static async resetPassword(
    email: string,
    otp: string,
    newPassword: string
  ): Promise<User> {
    const otpRecord = await OTP.findOne({
      where: {
        email,
        otp,
        type: 'PASSWORD_RESET',
        verified: false,
      },
      order: [['createdAt', 'DESC']],
    });

    if (!otpRecord || otpRecord.isExpired()) {
      throw new Error('Invalid or expired OTP');
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new Error('User not found');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Mark OTP as verified
    otpRecord.verified = true;
    await otpRecord.save();

    // Revoke all refresh tokens for security
    await TokenService.revokeAllUserTokens(user.id);

    logger.info(`Password reset for user: ${user.id}`);

    return user;
  }

  /**
   * Resend OTP
   */
  static async resendOTP(email: string, type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET'): Promise<void> {
    const otp = this.generateOTP();
    const expiresAt = this.calculateExpiryTime(this.OTP_EXPIRY_MINUTES);

    await OTP.create({
      email,
      otp,
      type,
      expiresAt,
      verified: false,
      attempts: 0,
    });

    const subject = type === 'PASSWORD_RESET' ? 'Password Reset' : 'Email Verification';

    await sendEmail({
      to: email,
      subject: `${subject} - TokenAsset`,
      html: `
        <h1>${subject}</h1>
        <p>Your code is: <strong>${otp}</strong></p>
        <p>This code will expire in ${this.OTP_EXPIRY_MINUTES} minutes.</p>
      `,
    });

    logger.info(`OTP resent to: ${email} (type: ${type})`);
  }

  // ============ Private Helper Methods ============

  private static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private static calculateExpiryTime(minutes: number): Date {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + minutes);
    return expiresAt;
  }

  private static hashToken(token: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
