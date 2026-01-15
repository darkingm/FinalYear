import express from 'express';
import { body, query } from 'express-validator';
import { VoucherController } from '../controllers/voucher.controller';
import { validate } from '../middleware/validate.middleware';

const router = express.Router();

// Public routes
router.get('/', VoucherController.getVouchers);
router.get('/:code', VoucherController.getVoucherByCode);

// Validation and application (requires auth)
router.post(
  '/validate',
  [
    body('code').notEmpty().withMessage('Voucher code is required'),
    body('totalAmount').isFloat({ min: 0 }).withMessage('Total amount must be positive'),
    body('productIds').optional().isArray(),
    body('categories').optional().isArray(),
    validate,
  ],
  VoucherController.validateVoucher
);

router.post(
  '/apply',
  [
    body('code').notEmpty().withMessage('Voucher code is required'),
    body('subtotal').isFloat({ min: 0 }).withMessage('Subtotal must be positive'),
    body('shippingFee').optional().isFloat({ min: 0 }),
    body('productIds').optional().isArray(),
    body('categories').optional().isArray(),
    validate,
  ],
  VoucherController.applyVoucher
);

// Seller routes (require seller role, checked by API Gateway)
router.post(
  '/',
  [
    body('code').notEmpty().isLength({ min: 3, max: 50 }).withMessage('Code must be 3-50 characters'),
    body('title').notEmpty().withMessage('Title is required'),
    body('type').isIn(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']).withMessage('Invalid voucher type'),
    body('discountValue').isFloat({ min: 0 }).withMessage('Discount value must be positive'),
    body('minPurchaseAmount').optional().isFloat({ min: 0 }),
    body('maxDiscountAmount').optional().isFloat({ min: 0 }),
    body('maxUses').optional().isInt({ min: 1 }),
    body('maxUsesPerUser').optional().isInt({ min: 1 }),
    body('startDate').isISO8601().withMessage('Invalid start date'),
    body('endDate').isISO8601().withMessage('Invalid end date'),
    body('applicableCategories').optional().isArray(),
    body('applicableProducts').optional().isArray(),
    validate,
  ],
  VoucherController.createVoucher
);

router.put(
  '/:id',
  [
    body('title').optional().notEmpty(),
    body('description').optional().isString(),
    body('type').optional().isIn(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']),
    body('discountValue').optional().isFloat({ min: 0 }),
    body('minPurchaseAmount').optional().isFloat({ min: 0 }),
    body('maxDiscountAmount').optional().isFloat({ min: 0 }),
    body('maxUses').optional().isInt({ min: 1 }),
    body('maxUsesPerUser').optional().isInt({ min: 1 }),
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601(),
    body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'EXPIRED']),
    body('applicableCategories').optional().isArray(),
    body('applicableProducts').optional().isArray(),
    validate,
  ],
  VoucherController.updateVoucher
);

router.delete('/:id', VoucherController.deleteVoucher);
router.get('/:id/stats', VoucherController.getVoucherStats);

export default router;


