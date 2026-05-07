import { Router, Request, Response, NextFunction } from 'express';
import { mintNFT, getNFTInfo, getCreditInfo, recordCompletedOrder } from './nft.controller';
import { authenticate, adminOnly } from '../../middleware/auth.middleware';

const router = Router();

// Public
router.get('/product/:productId', getNFTInfo);
router.get('/credit/:wallet', getCreditInfo);

/**
 * Internal-only guard: accepts requests from internal services (with the
 * shared X-Internal-Service-Key header) OR admins authenticated via JWT.
 * Used for relayer-style endpoints that mutate on-chain credit score.
 */
function requireInternalOrAdmin(req: Request, res: Response, next: NextFunction) {
  const internalKey = req.headers['x-internal-service-key'] as string | undefined;
  const expected = process.env.INTERNAL_SERVICE_KEY;
  if (expected && internalKey && internalKey === expected) {
    return next();
  }
  return authenticate(req as any, res, (err?: any) => {
    if (err) return next(err);
    if ((req as any).user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden — admin or internal service only' });
    }
    next();
  });
}

router.post('/mint/:productId', authenticate, adminOnly, mintNFT);
// Previously authed-only — any authenticated user could call this and mint
// score points for arbitrary wallets, lowering their platform fee. Now
// requires either the internal service key or an admin JWT.
router.post('/credit/record-order', requireInternalOrAdmin, recordCompletedOrder);

export { router as nftRouter };
