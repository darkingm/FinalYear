import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface RequestWithUser extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
    username?: string;
  };
}

/**
 * Middleware to check if user has required role(s)
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const userRole = req.user.role?.toUpperCase();
    
    if (!allowedRoles.includes(userRole)) {
      logger.warn(`Access denied for user ${req.user.id} with role ${userRole}`);
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: userRole,
      });
    }

    next();
  };
};

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Middleware to check if user is seller or admin
 */
export const requireSellerOrAdmin = requireRole('SELLER', 'ADMIN');

/**
 * Middleware to check if user is seller
 */
export const requireSeller = requireRole('SELLER');

/**
 * Middleware to check if user owns resource or is admin
 */
export const requireOwnershipOrAdmin = (getOwnerId: (req: Request) => string | null) => {
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const userRole = req.user.role?.toUpperCase();
    const ownerId = getOwnerId(req);
    const userId = req.user.id;

    // Admin can access anything
    if (userRole === 'ADMIN') {
      return next();
    }

    // Check ownership
    if (ownerId && ownerId === userId) {
      return next();
    }

    logger.warn(`Access denied: User ${userId} does not own resource ${ownerId}`);
    return res.status(403).json({
      success: false,
      error: 'Access denied. You do not own this resource.',
    });
  };
};

