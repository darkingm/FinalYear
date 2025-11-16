import express from 'express';
import passport from 'passport';
import { body } from 'express-validator';
import jwt from 'jsonwebtoken';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import OAuthProvider from '../models/OAuthProvider.model';
import User from '../models/User.model';
import RefreshToken from '../models/RefreshToken.model';
import { publishEvent } from '../utils/rabbitmq';
import { redisClient } from '../utils/redis';
import logger from '../utils/logger';

const router = express.Router();

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';

// Helper functions for OAuth (same logic as in controller)
const generateAccessToken = (user: User): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    },
    JWT_SECRET as string,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};

const generateRefreshToken = async (user: User, ipAddress: string): Promise<string> => {
  const token = jwt.sign(
    { id: user.id },
    JWT_REFRESH_SECRET as string,
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

// Middleware to check if OAuth is configured
const requireOAuth = (provider: 'google' | 'facebook') => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const isConfigured = provider === 'google'
      ? process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      : process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET;

    if (!isConfigured) {
      logger.warn(`${provider} OAuth not configured`);
      return res.status(503).json({
        success: false,
        error: `${provider} OAuth is not configured. Please use email/password login or contact administrator.`,
        code: 'OAUTH_NOT_CONFIGURED',
      });
    }
    next();
  };
};

// Register
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('username').isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('fullName').notEmpty().withMessage('Full name required'),
    validate,
  ],
  AuthController.register
);

// Verify email
router.post(
  '/verify-email',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    validate,
  ],
  AuthController.verifyEmail
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
    validate,
  ],
  AuthController.login
);

// Refresh token
router.post(
  '/refresh-token',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token required'),
    validate,
  ],
  AuthController.refreshToken
);

// Logout
router.post('/logout', AuthController.logout);

// Request password reset
router.post(
  '/request-password-reset',
  [
    body('email').isEmail().withMessage('Valid email required'),
    validate,
  ],
  AuthController.requestPasswordReset
);

// Reset password
router.post(
  '/reset-password',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    validate,
  ],
  AuthController.resetPassword
);

// Resend OTP
router.post(
  '/resend-otp',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('type').isIn(['EMAIL_VERIFICATION', 'PASSWORD_RESET']).withMessage('Invalid OTP type'),
    validate,
  ],
  AuthController.resendOTP
);

// Google OAuth
router.get(
  '/google',
  requireOAuth('google'),
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

router.get(
  '/google/callback',
  requireOAuth('google'),
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  async (req: any, res) => {
    try {
      // Strategy nên trả về { userId } (đã khuyến nghị sửa trong passport.ts)
      let userId = req.user?.userId as string | undefined;

      // Fallback rất hạn chế (không có providerId trong query). Dùng latest updated provider như phương án cuối.
      if (!userId) {
        const latestProvider = await OAuthProvider.findOne({ order: [['updatedAt', 'DESC']] });
        if (latestProvider) userId = latestProvider.userId;
      }

      if (!userId) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/auth/callback?error=user_not_found`);
      }

      const user = await User.findByPk(userId);
      if (!user) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/auth/callback?error=user_not_found`);
      }

      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const accessToken = generateAccessToken(user);
      const refreshToken = await generateRefreshToken(user, ipAddress);

      // Store session in Redis (best-effort)
      try {
        await redisClient.setEx(
          `session:${user.id}`,
          7 * 24 * 60 * 60,
          JSON.stringify({ userId: user.id, email: user.email, role: user.role })
        );
      } catch (redisError: any) {
        logger.warn('Failed to store session in Redis:', redisError.message);
      }

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      // Publish event (best-effort)
      try {
        await publishEvent('user.logged_in', {
          userId: user.id,
          email: user.email,
          timestamp: new Date(),
        });
      } catch (eventError: any) {
        logger.warn('Failed to publish user.logged_in event:', eventError.message);
      }

      // Redirect to frontend with both tokens
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}&refreshToken=${refreshToken}`);
    } catch (error: any) {
      logger.error('Google OAuth callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?error=auth_failed`);
    }
  }
);

// Facebook OAuth
router.get(
  '/facebook',
  requireOAuth('facebook'),
  passport.authenticate('facebook', {
    scope: ['email'],
    session: false,
  })
);

router.get(
  '/facebook/callback',
  requireOAuth('facebook'),
  passport.authenticate('facebook', { session: false, failureRedirect: '/login' }),
  async (req: any, res) => {
    try {
      let userId = req.user?.userId as string | undefined;

      if (!userId) {
        const latestProvider = await OAuthProvider.findOne({ order: [['updatedAt', 'DESC']] });
        if (latestProvider) userId = latestProvider.userId;
      }

      if (!userId) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/auth/callback?error=user_not_found`);
      }

      const user = await User.findByPk(userId);
      if (!user) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/auth/callback?error=user_not_found`);
      }

      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const accessToken = generateAccessToken(user);
      const refreshToken = await generateRefreshToken(user, ipAddress);

      try {
        await redisClient.setEx(
          `session:${user.id}`,
          7 * 24 * 60 * 60,
          JSON.stringify({ userId: user.id, email: user.email, role: user.role })
        );
      } catch (redisError: any) {
        logger.warn('Failed to store session in Redis:', redisError.message);
      }

      user.lastLoginAt = new Date();
      await user.save();

      try {
        await publishEvent('user.logged_in', {
          userId: user.id,
          email: user.email,
          timestamp: new Date(),
        });
      } catch (eventError: any) {
        logger.warn('Failed to publish user.logged_in event:', eventError.message);
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}&refreshToken=${refreshToken}`);
    } catch (error: any) {
      logger.error('Facebook OAuth callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?error=auth_failed`);
    }
  }
);

// Microsoft OAuth (placeholder)
router.get('/microsoft', (req, res) => {
  res.status(501).json({ message: 'Microsoft OAuth not yet implemented' });
});

export default router;