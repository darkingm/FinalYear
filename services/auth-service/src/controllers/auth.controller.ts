import { Request, Response } from 'express';
import { redisClient } from '../utils/redis';
import logger from '../utils/logger';
import { validateEnvironmentVariables } from '../utils/envValidator';
import { AuthService } from '../services/auth.service';
import { AuthValidator } from '../validators/auth.validator';
import { TokenService } from '../services/token.service';

// Validate on module load
if (process.env.NODE_ENV !== 'test') {
  validateEnvironmentVariables();
}


export class AuthController {
  /**
   * Register new user
   * Input validation → Business logic (AuthService) → Response
   */
  static async register(req: Request, res: Response) {
    try {
      const { email, username, password, fullName } = req.body;

      // Validate input
      const validation = AuthValidator.validateRegistration({
        email,
        username,
        password,
        fullName,
      });

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          errors: validation.errors,
        });
      }

      // Call service
      const user = await AuthService.registerUser(email, username, password, fullName);

      // Send verification email
      try {
        await AuthService.sendVerificationEmail(email);
      } catch (emailError: any) {
        logger.warn(`Failed to send verification email: ${emailError.message}`);
      }

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
      logger.error('Register error:', error.message);
      
      if (error.message.includes('already exists') || error.message.includes('already taken')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Registration failed',
      });
    }
  }

  /**
   * Verify email with OTP
   */
  static async verifyEmail(req: Request, res: Response) {
    try {
      const { email, otp } = req.body;

      // Validate input
      const validation = AuthValidator.validateVerifyEmail({ email, otp });
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          errors: validation.errors,
        });
      }

      // Call service
      await AuthService.verifyEmailOTP(email, otp);

      res.json({
        success: true,
        message: 'Email verified successfully',
      });
    } catch (error: any) {
      logger.error('Verify email error:', error.message);

      res.status(400).json({
        success: false,
        error: error.message || 'Email verification failed',
      });
    }
  }

  /**
   * Login user
   */
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

      // Validate input
      const validation = AuthValidator.validateLogin({ email, password });
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          errors: validation.errors,
        });
      }

      // Track failed attempts (from middleware)
      if ((req as any).trackFailedLogin) {
        await (req as any).trackFailedLogin();
      }

      // Authenticate user
      const user = await AuthService.authenticateLogin(email, password);

      // Clear failed attempts
      if ((req as any).clearFailedLogin) {
        await (req as any).clearFailedLogin();
      }

      // Create session and generate tokens
      const { accessToken, refreshToken } = await AuthService.createSession(user, ipAddress);

      // Publish login events (async, non-blocking)
      AuthService.publishLoginEvent(user.id, user.email).catch((err: any) => {
        logger.warn(`Failed to publish login events: ${err.message}`);
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
      logger.error('Login error:', error.message);

      res.status(401).json({
        success: false,
        error: error.message || 'Login failed',
      });
    }
  }

  /**
   * Refresh token
   */
  static async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token is required',
        });
      }

      // Call service
      const tokens = await AuthService.refreshSession(refreshToken, ipAddress);

      res.json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      });
    } catch (error: any) {
      logger.error('Refresh token error:', error.message);

      res.status(401).json({
        success: false,
        error: error.message || 'Token refresh failed',
      });
    }
  }

  /**
   * Logout user
   */
  static async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      const token = req.headers.authorization?.replace('Bearer ', '');
      const ipAddress = req.ip || 'unknown';
      const userId = (req as any).user?.id;

      if (refreshToken && userId) {
        await AuthService.logout(refreshToken, userId, ipAddress);
      }

      // Blacklist access token in Redis
      if (token) {
        try {
          const decoded = TokenService.verifyAccessToken(token);
          const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
          if (expiresIn > 0) {
            await redisClient.setEx(`blacklist:${token}`, expiresIn, 'true');
          }
        } catch (error: any) {
          logger.warn(`Failed to blacklist token: ${error.message}`);
        }
      }

      res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error: any) {
      logger.error('Logout error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Logout failed',
      });
    }
  }

  /**
   * Request password reset
   */
  static async requestPasswordReset(req: Request, res: Response) {
    try {
      const { email } = req.body;

      // Validate email
      const emailValidation = AuthValidator.validateEmail(email);
      if (!emailValidation.valid) {
        // Don't reveal if email exists
        return res.json({
          success: true,
          message: 'If the email exists, a reset code will be sent',
        });
      }

      // Send reset email
      try {
        await AuthService.sendPasswordResetEmail(email);
      } catch (emailError: any) {
        logger.warn(`Failed to send password reset email: ${emailError.message}`);
      }

      // Always return success (don't reveal if email exists)
      res.json({
        success: true,
        message: 'If the email exists, a reset code will be sent',
      });
    } catch (error: any) {
      logger.error('Password reset request error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to process password reset request',
      });
    }
  }

  /**
   * Reset password
   */
  static async resetPassword(req: Request, res: Response) {
    try {
      const { email, otp, newPassword } = req.body;

      // Validate input
      const validation = AuthValidator.validatePasswordReset({
        email,
        otp,
        newPassword,
      });

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          errors: validation.errors,
        });
      }

      // Call service
      await AuthService.resetPassword(email, otp, newPassword);

      res.json({
        success: true,
        message: 'Password reset successful',
      });
    } catch (error: any) {
      logger.error('Password reset error:', error.message);

      res.status(400).json({
        success: false,
        error: error.message || 'Password reset failed',
      });
    }
  }

  /**
   * Resend OTP
   */
  static async resendOTP(req: Request, res: Response) {
    try {
      const { email, type } = req.body;

      // Validate email
      const emailValidation = AuthValidator.validateEmail(email);
      if (!emailValidation.valid) {
        return res.status(400).json({
          success: false,
          error: emailValidation.error,
        });
      }

      // Call service
      await AuthService.resendOTP(
        email,
        (type || 'EMAIL_VERIFICATION') as 'EMAIL_VERIFICATION' | 'PASSWORD_RESET'
      );

      res.json({
        success: true,
        message: 'OTP sent successfully',
      });
    } catch (error: any) {
      logger.error('Resend OTP error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to resend OTP',
      });
    }
  }
}

