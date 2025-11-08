import express from 'express';
import { body } from 'express-validator';
import { AdminController } from '../controllers/admin.controller';
import { validate } from '../middleware/validate.middleware';

const router = express.Router();

// All routes require admin role (checked by API Gateway)

// Get all users
router.get('/', AdminController.getAllUsers);

// Get user statistics
router.get('/stats', AdminController.getUserStats);

// Get seller applications
router.get('/seller-applications', AdminController.getSellerApplications);

// Review seller application
router.post(
  '/seller-applications/:id/review',
  [
    body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
    body('rejectionReason').if(body('action').equals('reject')).notEmpty().withMessage('Rejection reason is required'),
    validate,
  ],
  AdminController.reviewSellerApplication
);

// Suspend/Unsuspend user
router.post(
  '/:id/suspension',
  [
    body('suspend').isBoolean().withMessage('Suspend must be boolean'),
    body('reason').if(body('suspend').equals(true)).notEmpty().withMessage('Reason is required for suspension'),
    validate,
  ],
  AdminController.toggleUserSuspension
);

// Update user role
router.put(
  '/:id/role',
  [
    body('role').isIn(['USER', 'SELLER', 'SUPPORT', 'ADMIN']).withMessage('Invalid role'),
    validate,
  ],
  AdminController.updateUserRole
);

export default router;

