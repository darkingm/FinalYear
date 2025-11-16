import express from 'express';
import { body, query } from 'express-validator';
import { ProductController } from '../controllers/product.controller';
import { validate } from '../middleware/validate.middleware';
import { uploadMiddleware } from '../middleware/upload.middleware';

const router = express.Router();

// Public routes
router.get('/', ProductController.getProducts);
router.get('/featured', ProductController.getFeaturedProducts);
router.get('/suggestions', ProductController.searchSuggestions);
router.get('/seller/:sellerId', ProductController.getSellerProducts);
router.get('/:id', ProductController.getProductById);

// Protected routes (require authentication via API Gateway)
router.post(
  '/',
  uploadMiddleware.array('images', 10),
  [
    body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
    body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
    body('category').notEmpty().withMessage('Category is required'),
    body('priceInCoins').isFloat({ min: 0 }).withMessage('Price in coins must be positive'),
    body('priceInUSD').isFloat({ min: 0 }).withMessage('Price in USD must be positive'),
    body('condition').isIn(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR']).withMessage('Invalid condition'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('location').notEmpty().withMessage('Location is required'),
    validate,
  ],
  ProductController.createProduct
);

router.put('/:id', ProductController.updateProduct);
router.delete('/:id', ProductController.deleteProduct);
router.post('/:id/like', ProductController.toggleLike);

export default router;

