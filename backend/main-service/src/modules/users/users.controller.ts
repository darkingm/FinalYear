import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { usersService } from './users.service';
import { logger } from '../../utils/logger';

export async function getProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await usersService.getProfile(req.user!.user_id);
    res.json({ success: true, user });
  } catch (error: any) {
    logger.error('Get profile error:', error);
    next(error);
  }
}

export async function updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const { username, avatar_url, paypal_email } = req.body;
    const user = await usersService.updateProfile(userId, {
      username,
      avatar_url,
      paypal_email,
    });
    res.json({ success: true, user });
  } catch (error: any) {
    logger.error('Update profile error:', error);
    next(error);
  }
}
