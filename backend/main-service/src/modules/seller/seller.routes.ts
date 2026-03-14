import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { getSellerOverview, getSellerProducts, getSellerOrders } from './seller.controller';

const router = Router();
router.use(authenticate);

router.get('/overview', getSellerOverview);
router.get('/products', getSellerProducts);
router.get('/orders', getSellerOrders);

export { router as sellerRouter };
