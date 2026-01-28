import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { query } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';

export async function getProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;

    const result = await query(
      `SELECT user_id, email, username, wallet_address, avatar_url, role, status, created_at
       FROM users 
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Get profile error:', error);
    next(error);
  }
}

export async function updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const { username, avatar_url, paypal_email } = req.body;

    const result = await query(
      `UPDATE users 
       SET username = COALESCE($1, username),
           avatar_url = COALESCE($2, avatar_url),
           paypal_email = COALESCE($3, paypal_email),
           updated_at = NOW()
       WHERE user_id = $4
       RETURNING user_id, email, username, wallet_address, avatar_url, role, status, created_at`,
      [username, avatar_url, paypal_email, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Update profile error:', error);
    next(error);
  }
}
