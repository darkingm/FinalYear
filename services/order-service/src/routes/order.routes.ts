import express from 'express';
import { body } from 'express-validator';
import { OrderController } from '../controllers/order.controller';
import { validate } from '../middleware/validate.middleware';

const router = express.Router();

// User routes (require authentication)
router.post(
  '/',
  [
    body('shippingName').notEmpty().withMessage('Shipping name is required'),
    body('shippingEmail').isEmail().withMessage('Invalid email'),
    body('shippingPhone').notEmpty().withMessage('Phone is required'),
    body('shippingAddress').notEmpty().withMessage('Address is required'),
    body('shippingCity').notEmpty().withMessage('City is required'),
    body('shippingCountry').notEmpty().withMessage('Country is required'),
    body('shippingPostalCode').notEmpty().withMessage('Postal code is required'),
    body('paymentMethod').isIn(['COIN', 'CREDIT_CARD', 'P2P']).withMessage('Invalid payment method'),
    validate,
  ],
  OrderController.createOrder
);

router.get('/', OrderController.getOrders);
router.get('/:id', OrderController.getOrderById);

router.post(
  '/:id/cancel',
  [
    body('reason').notEmpty().withMessage('Cancellation reason is required'),
    validate,
  ],
  OrderController.cancelOrder
);

// Admin routes (require admin role, checked by API Gateway)
router.get('/admin/all', OrderController.getAllOrders);
router.get('/admin/stats', OrderController.getOrderStats);

router.put(
  '/admin/:id/status',
  [
    body('status').isIn(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']).withMessage('Invalid status'),
    body('trackingNumber').optional().isString(),
    validate,
  ],
  OrderController.updateOrderStatus
);

export default router;

