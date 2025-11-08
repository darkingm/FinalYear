import express from 'express';
import passport from 'passport';
import { body } from 'express-validator';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import jwt from 'jsonwebtoken';
import OAuthProvider from '../models/OAuthProvider.model';
import User from '../models/User.model';

const router = express.Router();

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
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  async (req: any, res) => {
    try {
      const oauthProvider = req.user as OAuthProvider;
      const user = await User.findByPk(oauthProvider.userId);

      if (!user) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=user_not_found`);
      }

      const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
      const accessToken = jwt.sign(
        {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
        },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}`);
    } catch (error) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/?error=auth_failed`);
    }
  }
);

// Facebook OAuth
router.get(
  '/facebook',
  passport.authenticate('facebook', {
    scope: ['email'],
    session: false,
  })
);

router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: '/login' }),
  async (req: any, res) => {
    try {
      const oauthProvider = req.user as OAuthProvider;
      const user = await User.findByPk(oauthProvider.userId);

      if (!user) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/?error=user_not_found`);
      }

      const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
      const accessToken = jwt.sign(
        {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
        },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}`);
    } catch (error) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/?error=auth_failed`);
    }
  }
);

// Microsoft OAuth (similar to Google/Facebook)
router.get('/microsoft', (req, res) => {
  res.status(501).json({ message: 'Microsoft OAuth not yet implemented' });
});

export default router;

