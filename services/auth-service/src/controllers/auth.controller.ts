import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.model';
import OTP from '../models/OTP.model';
import RefreshToken from '../models/RefreshToken.model';
import OAuthProvider from '../models/OAuthProvider.model';
import { sendEmail } from '../services/email.service';
import { publishEvent } from '../utils/rabbitmq';
import { redisClient } from '../utils/redis';
import logger from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';

// Helper functions
const generateAccessToken = (user: User) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};

const generateRefreshToken = async (user: User, ipAddress: string) => {
  const token = jwt.sign(
    { id: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({
    userId: user.id,
    token,
    expiresAt,
    createdByIp: ipAddress,
  });

  return token;
};

const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export class AuthController {
  // Register
  static async register(req: Request, res: Response) {
    try {
      const { email, username, password, fullName, phoneNumber } = req.body;

      // Check if user exists
      const existingUser = await User.findOne({
        where: {
          email,
        },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'User with this email already exists',
        });
      }

      const existingUsername = await User.findOne({
        where: {
          username,
        },
      });

      if (existingUsername) {
        return res.status(400).json({
          success: false,
          error: 'Username already taken',
        });
      }

      // Create user
      const user = await User.create({
        email,
        username,
        password,
        fullName,
        phoneNumber,
        role: 'USER',
      });

      // Generate OTP
      const otp = generateOTP();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      await OTP.create({
        email,
        otp,
        type: 'EMAIL_VERIFICATION',
        expiresAt,
        verified: false,
        attempts: 0,
      });

      // Send verification email
      await sendEmail({
        to: email,
        subject: 'Verify Your Email - TokenAsset',
        html: `
          <h1>Welcome to TokenAsset!</h1>
          <p>Your verification code is: <strong>${otp}</strong></p>
          <p>This code will expire in 10 minutes.</p>
        `,
      });

      // Publish event
      await publishEvent('user.registered', {
        userId: user.id,
        email: user.email,
        username: user.username,
      });

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please verify your email.',
        data: {
          userId: user.id,
          email: user.email,
          username: user.username,
        },
      });
    } catch (error: any) {
      logger.error('Register error:', error);
      res.status(500).json({
        success: false,
        error: 'Registration failed',
        details: error.message,
      });
    }
  }

  // Verify email OTP
  static async verifyEmail(req: Request, res: Response) {
    try {
      const { email, otp } = req.body;

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
        return res.status(400).json({
          success: false,
          error: 'Invalid OTP',
        });
      }

      if (otpRecord.isExpired()) {
        return res.status(400).json({
          success: false,
          error: 'OTP expired',
        });
      }

      if (!otpRecord.canRetry()) {
        return res.status(400).json({
          success: false,
          error: 'Too many attempts',
        });
      }

      // Update user
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      user.isEmailVerified = true;
      await user.save();

      otpRecord.verified = true;
      await otpRecord.save();

      // Publish event
      await publishEvent('user.email_verified', {
        userId: user.id,
        email: user.email,
      });

      res.json({
        success: true,
        message: 'Email verified successfully',
      });
    } catch (error: any) {
      logger.error('Verify email error:', error);
      res.status(500).json({
        success: false,
        error: 'Verification failed',
      });
    }
  }

  // Login
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
        });
      }

      if (!user.password) {
        return res.status(401).json({
          success: false,
          error: 'Please use OAuth login (Google/Facebook)',
        });
      }

      const isValidPassword = await user.validatePassword(password);

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
        });
      }

      if (!user.isEmailVerified) {
        return res.status(403).json({
          success: false,
          error: 'Please verify your email first',
        });
      }

      // Generate tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = await generateRefreshToken(user, ipAddress);

      // Store session in Redis
      await redisClient.setEx(
        `session:${user.id}`,
        7 * 24 * 60 * 60, // 7 days
        JSON.stringify({
          userId: user.id,
          email: user.email,
          role: user.role,
        })
      );

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      // Publish event
      await publishEvent('user.logged_in', {
        userId: user.id,
        email: user.email,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            fullName: user.fullName,
            role: user.role,
          },
          accessToken,
          refreshToken,
        },
      });
    } catch (error: any) {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed',
      });
    }
  }

  // Refresh token
  static async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token required',
        });
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;

      const tokenRecord = await RefreshToken.findOne({
        where: { token: refreshToken },
      });

      if (!tokenRecord || !tokenRecord.isActive()) {
        return res.status(401).json({
          success: false,
          error: 'Invalid refresh token',
        });
      }

      const user = await User.findByPk(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }

      // Generate new tokens
      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = await generateRefreshToken(user, ipAddress);

      // Revoke old refresh token
      tokenRecord.revokedAt = new Date();
      tokenRecord.revokedByIp = ipAddress;
      tokenRecord.replacedByToken = newRefreshToken;
      await tokenRecord.save();

      res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      });
    } catch (error: any) {
      logger.error('Refresh token error:', error);
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
      });
    }
  }

  // Logout
  static async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (refreshToken) {
        const tokenRecord = await RefreshToken.findOne({
          where: { token: refreshToken },
        });

        if (tokenRecord) {
          tokenRecord.revokedAt = new Date();
          tokenRecord.revokedByIp = req.ip || 'unknown';
          await tokenRecord.save();
        }
      }

      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        
        // Remove session from Redis
        await redisClient.del(`session:${decoded.id}`);

        // Blacklist token
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiresIn > 0) {
          await redisClient.setEx(`blacklist:${token}`, expiresIn, 'true');
        }
      }

      res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error: any) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed',
      });
    }
  }

  // Request password reset
  static async requestPasswordReset(req: Request, res: Response) {
    try {
      const { email } = req.body;

      const user = await User.findOne({ where: { email } });

      if (!user) {
        // Don't reveal if user exists
        return res.json({
          success: true,
          message: 'If the email exists, a reset code will be sent',
        });
      }

      const otp = generateOTP();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

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
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `,
      });

      res.json({
        success: true,
        message: 'If the email exists, a reset code will be sent',
      });
    } catch (error: any) {
      logger.error('Password reset request error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send reset code',
      });
    }
  }

  // Reset password
  static async resetPassword(req: Request, res: Response) {
    try {
      const { email, otp, newPassword } = req.body;

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
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired OTP',
        });
      }

      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      user.password = newPassword;
      await user.save();

      otpRecord.verified = true;
      await otpRecord.save();

      // Revoke all refresh tokens
      await RefreshToken.update(
        { revokedAt: new Date() },
        { where: { userId: user.id, revokedAt: null } }
      );

      res.json({
        success: true,
        message: 'Password reset successful',
      });
    } catch (error: any) {
      logger.error('Password reset error:', error);
      res.status(500).json({
        success: false,
        error: 'Password reset failed',
      });
    }
  }

  // Resend OTP
  static async resendOTP(req: Request, res: Response) {
    try {
      const { email, type } = req.body;

      const otp = generateOTP();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      await OTP.create({
        email,
        otp,
        type: type || 'EMAIL_VERIFICATION',
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
          <p>This code will expire in 10 minutes.</p>
        `,
      });

      res.json({
        success: true,
        message: 'OTP sent successfully',
      });
    } catch (error: any) {
      logger.error('Resend OTP error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resend OTP',
      });
    }
  }
}

