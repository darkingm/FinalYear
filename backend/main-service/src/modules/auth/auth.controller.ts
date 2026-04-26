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
      logger.warn('Register attempt without captcha token', { email });
      return res.status(400).json({
        success: false,
        message: 'Vui lòng hoàn thành xác minh CAPTCHA',
        code: 'ERR_CAPTCHA_REQUIRED',
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
        const verifyData = await verifyRes.json() as { success: boolean; 'error-codes'?: string[] };
        if (!verifyData.success) {
          const errorCodes = verifyData['error-codes'] || [];
          logger.warn('hCaptcha verification failed', {
            email,
            errorCodes,
            tokenLen: captcha?.length,
          });

          // Provide user-friendly message based on error type
          let userMessage = 'Xác minh CAPTCHA thất bại. Vui lòng thử lại.';
          if (errorCodes.includes('invalid-or-already-seen-response')) {
            userMessage = 'CAPTCHA đã hết hạn hoặc đã sử dụng. Vui lòng làm mới và thử lại.';
          } else if (errorCodes.includes('invalid-input-response')) {
            userMessage = 'CAPTCHA không hợp lệ. Vui lòng thử lại.';
          } else if (errorCodes.includes('sitekey-secret-mismatch')) {
            userMessage = 'Lỗi cấu hình CAPTCHA. Vui lòng liên hệ hỗ trợ.';
            logger.error('CRITICAL: hCaptcha sitekey-secret mismatch — check HCAPTCHA_SECRET and NEXT_PUBLIC_HCAPTCHA_SITEKEY');
          }

          return res.status(400).json({
            success: false,
            message: userMessage,
            code: 'ERR_CAPTCHA_FAILED',
          });
        }
      } catch (err) {
        logger.error('hCaptcha API unreachable:', err);
        return res.status(503).json({
          success: false,
          message: 'Dịch vụ xác minh CAPTCHA tạm thời không khả dụng. Vui lòng thử lại sau.',
          code: 'ERR_CAPTCHA_SERVICE',
        });
      }
    } else {
      // hCaptcha secret not configured — block in production
      if (process.env.NODE_ENV === 'production') {
        logger.error('HCAPTCHA_SECRET not configured in production!');
        return res.status(500).json({
          success: false,
          message: 'Lỗi cấu hình server. Vui lòng liên hệ hỗ trợ.',
          code: 'ERR_CAPTCHA_CONFIG',
        });
      }
    }

    // Validate input fields
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Email không hợp lệ', code: 'ERR_INVALID_EMAIL' });
    }
    if (!password || password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải ít nhất 8 ký tự gồm chữ hoa, chữ thường và số', code: 'ERR_WEAK_PASSWORD' });
    }
    if (username && (username.length < 3 || username.length > 30)) {
      return res.status(400).json({ success: false, message: 'Tên người dùng phải từ 3-30 ký tự', code: 'ERR_INVALID_USERNAME' });
    }

    const result = await authService.register({
      email,
      password,
      username,
      wallet_address,
    });

    logger.info('User registered successfully', { email, username });

    res.cookie('refreshToken', result.refreshToken, cookieOptions);
    res.status(201).json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (error: any) {
    logger.error('Register error:', { message: error.message, code: error.statusCode, email: req.body?.email });
    // Don't expose internal errors — pass safe message
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: 'ERR_REGISTER',
      });
    }
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
      refreshToken: result.refreshToken, // also in body for server-side clients (e.g. NextAuth)
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
      refreshToken: result.refreshToken, // also in body for server-side clients (e.g. NextAuth)
    });
  } catch (error: any) {
    logger.error('Wallet login error:', error);
    next(error);
  }
}

export async function oauthLogin(req: Request, res: Response, next: NextFunction) {
  try {
    // SECURITY: Only accept from internal NextAuth server, not from browsers
    const internalKey = req.headers['x-internal-service-key'] as string | undefined;
    const expectedKey = process.env.INTERNAL_SERVICE_KEY;
    if (!expectedKey || internalKey !== expectedKey) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

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
      refreshToken: result.refreshToken, // also in body for server-side clients (e.g. NextAuth)
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
      refreshToken: result.refreshToken, // also in body for server-side clients (e.g. NextAuth)
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
    if (!password || password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters with uppercase, lowercase, and number' });
    }
    const result = await authService.resetPassword(token, password);
    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('Reset password error:', error);
    next(error);
  }
}
