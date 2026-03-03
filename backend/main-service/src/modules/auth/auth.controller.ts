import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { AuthRequest } from '../../middleware/auth.middleware';
import { logger } from '../../utils/logger';

const authService = new AuthService();

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

    const result = await authService.register({
      email,
      password,
      username,
      wallet_address,
    });

    res.status(201).json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
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

    res.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
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

    res.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
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

    res.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error: any) {
    logger.error('OAuth login error:', error);
    next(error);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    
    const result = await authService.refreshToken(refreshToken);

    res.json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error: any) {
    logger.error('Refresh token error:', error);
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    
    await authService.logout(refreshToken);

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
