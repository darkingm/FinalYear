import express from 'express';
import { body } from 'express-validator';
import { SellerController } from '../controllers/seller.controller';
import { validate } from '../middleware/validate.middleware';

const router = express.Router();

// Apply to become seller (requires auth)
router.post(
  '/apply',
  [
    body('shopName').trim().isLength({ min: 3, max: 100 }).withMessage('Shop name must be 3-100 characters'),
    body('shopDescription').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be 10-1000 characters'),
    body('businessType').notEmpty().withMessage('Business type is required'),
    body('businessAddress').notEmpty().withMessage('Business address is required'),
    body('phoneNumber').isMobilePhone('any').withMessage('Invalid phone number'),
    body('bankName').notEmpty().withMessage('Bank name is required'),
    body('bankAccountNumber').notEmpty().withMessage('Bank account number is required'),
    body('bankAccountName').notEmpty().withMessage('Bank account name is required'),
    validate,
  ],
  SellerController.applyForSeller
);

// Get application status (requires auth)
router.get('/application', SellerController.getApplicationStatus);

// Get seller profile (public)
router.get('/:id', SellerController.getSellerProfile);

// Update seller profile (requires auth)
router.put('/profile', SellerController.updateSellerProfile);

// List all verified sellers (public)
router.get('/', SellerController.listVerifiedSellers);

export default router;

