import express from 'express';
import { body } from 'express-validator';
import { P2PController } from '../controllers/p2p.controller';
import { validate } from '../middleware/validate.middleware';

const router = express.Router();

// User routes (require authentication)
router.post(
  '/',
  [
    body('tradeType').isIn(['BUY', 'SELL']).withMessage('Trade type must be BUY or SELL'),
    body('coinAmount').isFloat({ min: 0 }).withMessage('Coin amount must be positive'),
    body('coinType').notEmpty().withMessage('Coin type is required'),
    body('fiatAmount').isFloat({ min: 0 }).withMessage('Fiat amount must be positive'),
    body('fiatCurrency').notEmpty().withMessage('Fiat currency is required'),
    body('exchangeRate').isFloat({ min: 0 }).withMessage('Exchange rate must be positive'),
    body('bankName').notEmpty().withMessage('Bank name is required'),
    body('bankAccountNumber').notEmpty().withMessage('Bank account number is required'),
    body('bankAccountName').notEmpty().withMessage('Bank account name is required'),
    validate,
  ],
  P2PController.createTrade
);

router.get('/', P2PController.getUserTrades);
router.get('/:id', P2PController.getTradeById);

router.post(
  '/:id/proof',
  [
    body('paymentProofImage').notEmpty().withMessage('Payment proof image is required'),
    validate,
  ],
  P2PController.submitPaymentProof
);

router.post('/:id/cancel', P2PController.cancelTrade);

// Admin routes (require admin role)
router.get('/admin/all', P2PController.getAllTrades);
router.get('/admin/stats', P2PController.getP2PStats);

router.post(
  '/admin/:id/verify',
  [
    body('approved').isBoolean().withMessage('Approved must be boolean'),
    body('notes').optional().isString(),
    validate,
  ],
  P2PController.verifyTrade
);

export default router;

