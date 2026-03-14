import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import {
  createReview,
  getProductReviews,
  getOrderReview,
  updateReview,
  getSellerReviews,
  voteReviewHelpful,
} from './reviews.controller';

const router = Router();

// ── Public ──────────────────────────────────────────────
router.get('/product/:productId', getProductReviews);
router.get('/seller/:sellerId', getSellerReviews);

// ── Authenticated ────────────────────────────────────────
router.use(authenticate);
router.get('/order/:orderId', getOrderReview);
router.post('/', createReview);
router.patch('/:reviewId', updateReview);
router.post('/:reviewId/vote', voteReviewHelpful);

export { router as reviewsRouter };
