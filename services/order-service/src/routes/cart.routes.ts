import express from 'express';
import { body } from 'express-validator';
import { CartController } from '../controllers/cart.controller';
import { validate } from '../middleware/validate.middleware';

const router = express.Router();

// All routes require authentication (checked by API Gateway)

// Get cart
router.get('/', CartController.getCart);

// Add to cart
router.post(
  '/',
  [
    body('productId').notEmpty().withMessage('Product ID is required'),
    body('productTitle').notEmpty().withMessage('Product title is required'),
    body('productImage').notEmpty().withMessage('Product image is required'),
    body('sellerId').notEmpty().withMessage('Seller ID is required'),
    body('sellerName').notEmpty().withMessage('Seller name is required'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('priceInCoins').isFloat({ min: 0 }).withMessage('Price in coins must be positive'),
    body('priceInUSD').isFloat({ min: 0 }).withMessage('Price in USD must be positive'),
    validate,
  ],
  CartController.addToCart
);

// Update cart item
router.put(
  '/:id',
  [
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be non-negative'),
    validate,
  ],
  CartController.updateCartItem
);

// Remove from cart
router.delete('/:id', CartController.removeFromCart);

// Clear cart
router.delete('/', CartController.clearCart);

export default router;

