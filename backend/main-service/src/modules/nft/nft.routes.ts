import { Router } from 'express';
import { mintNFT, getNFTInfo, getCreditInfo, recordCompletedOrder } from './nft.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// Public
router.get('/product/:productId', getNFTInfo);
router.get('/credit/:wallet', getCreditInfo);

// Authenticated
router.use(authenticate);
router.post('/mint/:productId', mintNFT);             // Admin only (enforced in service)
router.post('/credit/record-order', recordCompletedOrder); // Internal/relayer

export { router as nftRouter };
