import { usersRepository } from './users.repository';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';

export const usersService = {
  getProfile: async (userId: number) => {
    const user = await usersRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  },

  updateProfile: async (
    userId: number,
    data: { username?: string; avatar_url?: string; paypal_email?: string }
  ) => {
    const user = await usersRepository.updateProfile(userId, data);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    logger.info('Profile updated', { userId });
    return user;
  },
};
