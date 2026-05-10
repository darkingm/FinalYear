import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error-handler';
import { query } from '../config/database';
import { setCache, getCache } from '../config/redis';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    user_id: number;
    email: string;
    role: string;
  };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = { user_id: decoded.user_id, email: decoded.email, role: decoded.role };

    // Check if access token has been revoked (logout). Best-effort: Redis
    // outage falls through to status check below. Keys expire automatically
    // when JWT exp is reached, so memory growth is bounded.
    try {
      const revoked = await getCache(`blacklist:access:${token}`);
      if (revoked) {
        throw new AppError('Token revoked', 401);
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Redis miss/error — fail-open; refresh token blacklist still protects.
    }

    // Check if user account is still active (cached for 60s to avoid DB spam)
    try {
      const statusKey = `user-status:${decoded.user_id}`;
      let status = await getCache(statusKey) as string | null;
      if (!status) {
        const result = await query('SELECT status FROM users WHERE user_id = $1', [decoded.user_id]);
        status = result.rows[0]?.status || 'unknown';
        await setCache(statusKey, status, 60); // cache 60s
      }
      if (status !== 'active') {
        throw new AppError('Account suspended', 403);
      }
    } catch (err) {
      // If it's our AppError (suspended), re-throw
      if (err instanceof AppError) throw err;
      // Redis/DB failure — fail-open in dev, fail-closed in production
      if (process.env.NODE_ENV === 'production') {
        logger.error('User status check failed in production:', err);
        // Continue anyway — JWT is valid, status check is defense-in-depth
      }
    }

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError('Invalid or expired token', 401));
  }
}

/**
 * Best-effort token decoder for endpoints that work for anonymous users
 * but want to know who's logged in (e.g. forum list returning per-row
 * `liked_by_me`). Never errors: missing / invalid / revoked tokens just
 * leave `req.user` undefined.
 */
export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = { user_id: decoded.user_id, email: decoded.email, role: decoded.role };
  } catch {
    // bad token → treat as anonymous; don't error.
  }
  next();
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
