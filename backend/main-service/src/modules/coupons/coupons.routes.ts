import { Router } from 'express';
import {
  listMyCoupons,
  createCoupon,
  deleteCoupon,
  validateCoupon,
  listPublicCoupons,
} from './coupons.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// Public — used by checkout / discovery
router.get('/public', listPublicCoupons);

// Authenticated routes — listing/validate need a user context for per-user limits
router.use(authenticate);

router.get('/', listMyCoupons);              // GET /api/coupons         → seller-scoped (admin sees all)
router.post('/', createCoupon);              // POST /api/coupons        → seller or admin
router.delete('/:id', deleteCoupon);         // DELETE /api/coupons/:id  → soft-delete (status='inactive')
router.post('/validate', validateCoupon);    // POST /api/coupons/validate

export { router as couponsRouter };
