import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { redisClient } from '../utils/redis';
import logger from '../utils/logger';

// Extend Express Request để có user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    role: string;
  };
}

/**
 * Middleware xác thực bắt buộc
 */
export const authMiddleware: RequestHandler = async (req, res, next) => {
  const authReq = req as AuthRequest;

  try {
    const token = authReq.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No authentication token provided',
      });
    }

    // Kiểm tra token có bị blacklist không
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        error: 'Token has been revoked',
      });
    }

    // Xác thực token JWT
    const jwtSecret =
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    const decoded = jwt.verify(token, jwtSecret) as any;

    // Kiểm tra session trong Redis
    const userSession = await redisClient.get(`session:${decoded.id}`);
    if (!userSession) {
      return res.status(401).json({
        success: false,
        error: 'Session expired or invalid',
      });
    }

    // Gán thông tin user vào request
    authReq.user = {
      id: decoded.id,
      email: decoded.email,
      username: decoded.username,
      role: decoded.role,
    };

    next();
  } catch (error: any) {
    logger.error('Authentication error:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    return res.status(500).json({ success: false, error: 'Authentication failed' });
  }
};

/**
 * Middleware xác thực tùy chọn (token có thể không có)
 */
export const optionalAuthMiddleware: RequestHandler = async (req, res, next) => {
  const authReq = req as AuthRequest;

  try {
    const token = authReq.headers.authorization?.replace('Bearer ', '');
    if (!token) return next();

    const jwtSecret =
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    const decoded = jwt.verify(token, jwtSecret) as any;

    const userSession = await redisClient.get(`session:${decoded.id}`);
    if (userSession) {
      authReq.user = {
        id: decoded.id,
        email: decoded.email,
        username: decoded.username,
        role: decoded.role,
      };
    }

    next();
  } catch {
    // Nếu token không hợp lệ, tiếp tục mà không gán user
    next();
  }
};

/**
 * Middleware kiểm tra role
 * @param roles Danh sách role được phép
 */
export const requireRole = (...roles: string[]): RequestHandler => {
  return (req, res, next) => {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!roles.includes(authReq.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    next();
  };
};
