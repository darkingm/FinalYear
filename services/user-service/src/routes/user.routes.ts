import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { body } from 'express-validator';
import { UserController } from '../controllers/user.controller';
import { validate } from '../middleware/validate.middleware';

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for avatar uploads
const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Create profile (auto-create)
router.post(
  '/profile',
  [
    body('fullName').optional().trim().isLength({ min: 2 }),
    body('email').optional().isEmail(),
    body('username').optional().trim().isLength({ min: 3 }),
    validate,
  ],
  UserController.createProfile
);

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

// Upload avatar (requires auth)
router.put(
  '/profile/avatar',
  upload.single('avatar'),
  UserController.uploadAvatar
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