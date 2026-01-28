import { Router } from 'express';
import { getCurrentPrices, getCachedPrices } from './pricing.controller';

const router = Router();

router.get('/current', getCurrentPrices);
router.get('/cached', getCachedPrices);

export default router;
