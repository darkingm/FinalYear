import express from 'express';
import { body } from 'express-validator';
import { UserController } from '../controllers/user.controller';
import { validate } from '../middleware/validate.middleware';

const router = express.Router();

// Get own profile (requires auth)
router.get('/profile', UserController.getProfile);

// Get user by ID (public)
router.get('/:id', UserController.getUserById);

// Update profile (requires auth)
router.put(
  '/profile',
  [
    body('fullName').optional().trim().isLength({ min: 2 }).withMessage('Full name must be at least 2 characters'),
    body('bio').optional().trim().isLength({ max: 500 }).withMessage('Bio must not exceed 500 characters'),
    body('phone').optional().isMobilePhone('any').withMessage('Invalid phone number'),
    body('dateOfBirth').optional().isISO8601().withMessage('Invalid date format'),
    validate,
  ],
  UserController.updateProfile
);

// Update privacy settings (requires auth)
router.put(
  '/profile/privacy',
  [
    body('showCoinBalance').optional().isBoolean(),
    body('showJoinDate').optional().isBoolean(),
    body('showEmail').optional().isBoolean(),
    body('showPhone').optional().isBoolean(),
    validate,
  ],
  UserController.updatePrivacy
);

// Search users
router.get('/search', UserController.searchUsers);

export default router;

