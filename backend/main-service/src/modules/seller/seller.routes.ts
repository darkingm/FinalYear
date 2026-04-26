import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import {
  getSellerOverview, getSellerProducts, getSellerOrders, getSellerStats,
  getSellerPayoutWallet, updateSellerPayoutWallet,
} from './seller.controller';

const router = Router();
router.use(authenticate);

router.get('/overview', getSellerOverview);
router.get('/stats', getSellerStats);       // alias — some clients call /stats
router.get('/products', getSellerProducts);
router.get('/orders', getSellerOrders);
router.get('/payout-wallet', getSellerPayoutWallet);
router.patch('/payout-wallet', updateSellerPayoutWallet);

export { router as sellerRouter };
