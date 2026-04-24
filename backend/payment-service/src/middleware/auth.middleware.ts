import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error-handler';

export interface AuthRequest extends Request {
  user?: {
    user_id: number;
    email: string;
    role: string;
  };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }
    const token = authHeader.split(' ')[1];
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in environment variables');
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    req.user = { user_id: decoded.user_id, email: decoded.email, role: decoded.role };
    next();
  } catch (error: any) {
    // Diagnostic logging (redacted for security)
    if (error?.name === 'JsonWebTokenError') {
      console.error('[auth] JWT verify failed:', {
        secret_len: process.env.JWT_SECRET?.length ?? 0,
        error: error.message,
      });
    }
    // Provide specific error message for debugging
    if (error?.name === 'TokenExpiredError') {
      next(new AppError('Token expired — please re-login', 401));
    } else if (error?.name === 'JsonWebTokenError') {
      next(new AppError('Invalid token signature', 401));
    } else if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Authentication failed', 401));
    }
  }
}

/** Role-based authorization middleware factory */
export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    if (!roles.includes(req.user.role)) return next(new AppError('Forbidden - insufficient role', 403));
    next();
  };
}

/** Alias for authorize — preferred for named imports */
export const authorizeRoles = authorize;

/** Convenience: admin-only guard */
export const adminOnly = authorize('admin');
