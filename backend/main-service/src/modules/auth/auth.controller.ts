import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { AuthRequest } from '../../middleware/auth.middleware';
import { logger } from '../../utils/logger';

const authService = new AuthService();

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, username, wallet_address, captcha } = req.body;

    // Validate captcha
    if (!captcha) {
      return res.status(400).json({
        success: false,
        message: 'CAPTCHA is required',
      });
    }

    // Verify captcha with hCaptcha API
    const hcaptchaSecret = process.env.HCAPTCHA_SECRET;
    if (hcaptchaSecret && hcaptchaSecret !== 'your_hcaptcha_secret') {
      try {
        const verifyRes = await fetch('https://api.hcaptcha.com/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `secret=${hcaptchaSecret}&response=${captcha}`,
        });
        const verifyData = await verifyRes.json() as { success: boolean };
        if (!verifyData.success) {
          return res.status(400).json({
            success: false,
            message: 'CAPTCHA verification failed',
          });
        }
      } catch (err) {
        logger.error('hCaptcha verification error:', err);
        // Allow registration if hCaptcha service is down
      }
    }

    const result = await authService.register({
      email,
      password,
      username,
      wallet_address,
    });

    res.cookie('refreshToken', result.refreshToken, cookieOptions);
    res.status(201).json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (error: any) {
    logger.error('Register error:', error);
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    const result = await authService.login(email, password);

    res.cookie('refreshToken', result.refreshToken, cookieOptions);
    res.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (error: any) {
    logger.error('Login error:', error);
    next(error);
  }
}

export async function walletLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet_address, message, signature } = req.body;

    const result = await authService.walletLogin(wallet_address, message, signature);

    res.cookie('refreshToken', result.refreshToken, cookieOptions);
    res.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (error: any) {
    logger.error('Wallet login error:', error);
    next(error);
  }
}

export async function oauthLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid request body. Expected JSON object.' });
    }
    const { provider, providerId, email, name, image } = body;
    if (!provider || !providerId || typeof email === 'undefined') {
      return res.status(400).json({ success: false, message: 'Missing required fields: provider, providerId, email.' });
    }
    const result = await authService.oauthLogin({
      provider,
      providerId,
      email,
      name,
      image,
    });

    res.cookie('refreshToken', result.refreshToken, cookieOptions);
    res.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (error: any) {
    logger.error('OAuth login error:', error);
    next(error);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token not found' });
    }

    const result = await authService.refreshToken(refreshToken);

    res.cookie('refreshToken', result.refreshToken, cookieOptions);
    res.json({
      success: true,
      accessToken: result.accessToken,
    });
  } catch (error: any) {
    logger.error('Refresh token error:', error);
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    res.clearCookie('refreshToken', cookieOptions);
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    logger.error('Logout error:', error);
    next(error);
  }
}

export async function linkWallet(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const { wallet_address, message, signature } = req.body;
    if (!wallet_address || !message || !signature) {
      return res.status(400).json({ success: false, message: 'wallet_address, message, and signature are required' });
    }
    const user = await authService.linkWallet(userId, wallet_address, message, signature);
    res.json({ success: true, user });
  } catch (error: any) {
    logger.error('Link wallet error:', error);
    next(error);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const result = await authService.forgotPassword(email);
    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('Forgot password error:', error);
    next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    const result = await authService.resetPassword(token, password);
    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('Reset password error:', error);
    next(error);
  }
}
