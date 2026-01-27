import express from 'express';
import { body, query } from 'express-validator';
import { WalletController } from '../controllers/wallet.controller';
import { validate } from '../middleware/validate.middleware';
import { rateLimitMiddleware } from '../middleware/rateLimit.middleware';

const router = express.Router();

/**
 * Wallet Routes
 * All routes require authentication (x-user-id header)
 */

// Get all user wallets
router.get(
  '/',
  rateLimitMiddleware,
  WalletController.getWallets
);

// Get wallet summary (totals)
router.get(
  '/summary',
  rateLimitMiddleware,
  WalletController.getWalletSummary
);

// Get wallet by coin symbol
router.get(
  '/:coinSymbol',
  rateLimitMiddleware,
  WalletController.getWalletByCoin
);

// Create wallet for a coin
router.post(
  '/',
  rateLimitMiddleware,
  [
    body('coinSymbol')
      .notEmpty().withMessage('Coin symbol is required')
      .isLength({ min: 2, max: 10 }).withMessage('Invalid coin symbol')
      .toUpperCase(),
    body('initialBalance')
      .optional()
      .isFloat({ min: 0 }).withMessage('Initial balance must be non-negative'),
    validate,
  ],
  WalletController.createWallet
);

// Get transaction history
router.get(
  '/transactions/history',
  rateLimitMiddleware,
  [
    query('coinSymbol').optional().isLength({ min: 2, max: 10 }),
    query('transactionType').optional().isIn([
      'DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 
      'ORDER_PURCHASE', 'ORDER_RECEIVED', 'ORDER_REFUND',
      'ADMIN_ADJUSTMENT'
    ]),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    validate,
  ],
  WalletController.getTransactionHistory
);

// Transfer between users
router.post(
  '/transfer',
  rateLimitMiddleware,
  [
    body('toUserId')
      .notEmpty().withMessage('Recipient user ID is required')
      .isUUID().withMessage('Invalid user ID format'),
    body('coinSymbol')
      .notEmpty().withMessage('Coin symbol is required')
      .isLength({ min: 2, max: 10 }).withMessage('Invalid coin symbol')
      .toUpperCase(),
    body('amount')
      .notEmpty().withMessage('Amount is required')
      .isFloat({ min: 0.00000001 }).withMessage('Amount must be greater than 0'),
    body('description')
      .optional()
      .isLength({ max: 500 }).withMessage('Description too long'),
    validate,
  ],
  WalletController.transfer
);

// Deposit (Admin or system)
router.post(
  '/deposit',
  rateLimitMiddleware,
  [
    body('targetUserId')
      .optional()
      .isUUID().withMessage('Invalid user ID format'),
    body('coinSymbol')
      .notEmpty().withMessage('Coin symbol is required')
      .isLength({ min: 2, max: 10 }).withMessage('Invalid coin symbol')
      .toUpperCase(),
    body('amount')
      .notEmpty().withMessage('Amount is required')
      .isFloat({ min: 0.00000001 }).withMessage('Amount must be greater than 0'),
    body('txHash')
      .optional()
      .isLength({ max: 255 }).withMessage('Transaction hash too long'),
    body('description')
      .optional()
      .isLength({ max: 500 }).withMessage('Description too long'),
    validate,
  ],
  WalletController.deposit
);

// Withdraw (Request)
router.post(
  '/withdraw',
  rateLimitMiddleware,
  [
    body('coinSymbol')
      .notEmpty().withMessage('Coin symbol is required')
      .isLength({ min: 2, max: 10 }).withMessage('Invalid coin symbol')
      .toUpperCase(),
    body('amount')
      .notEmpty().withMessage('Amount is required')
      .isFloat({ min: 0.00000001 }).withMessage('Amount must be greater than 0'),
    body('toAddress')
      .notEmpty().withMessage('Withdrawal address is required')
      .isLength({ min: 10, max: 255 }).withMessage('Invalid address'),
    body('description')
      .optional()
      .isLength({ max: 500 }).withMessage('Description too long'),
    validate,
  ],
  WalletController.withdraw
);

export default router;
