import express from 'express';
import { body, query } from 'express-validator';
import { AdminWalletController } from '../controllers/adminWallet.controller';
import { validate } from '../middleware/validate.middleware';
import { rateLimitMiddleware } from '../middleware/rateLimit.middleware';

const router = express.Router();

/**
 * Admin Wallet Routes
 * ALL routes require ADMIN role
 * Manages REAL coin balances
 */

// Apply admin check to all routes
router.use(AdminWalletController.requireAdmin);

// Get all admin wallets (real balances)
router.get(
  '/',
  rateLimitMiddleware,
  AdminWalletController.getAdminWallets
);

// Get platform-wide statistics
router.get(
  '/platform/stats',
  rateLimitMiddleware,
  AdminWalletController.getPlatformStats
);

// Get liquidity health check
router.get(
  '/platform/health',
  rateLimitMiddleware,
  AdminWalletController.getLiquidityHealth
);

// Get statistics for a specific coin
router.get(
  '/platform/coins/:coinSymbol',
  rateLimitMiddleware,
  AdminWalletController.getCoinStats
);

// Get admin transaction history
router.get(
  '/transactions',
  rateLimitMiddleware,
  [
    query('coinSymbol').optional().isLength({ min: 2, max: 10 }),
    query('limit').optional().isInt({ min: 1, max: 500 }),
    query('offset').optional().isInt({ min: 0 }),
    validate,
  ],
  AdminWalletController.getAdminTransactions
);

// Set admin wallet address for a coin
router.post(
  '/address',
  rateLimitMiddleware,
  [
    body('coinSymbol')
      .notEmpty().withMessage('Coin symbol is required')
      .isLength({ min: 2, max: 10 }).withMessage('Invalid coin symbol'),
    body('walletAddress')
      .notEmpty().withMessage('Wallet address is required')
      .isLength({ min: 10, max: 255 }).withMessage('Invalid wallet address'),
    validate,
  ],
  AdminWalletController.setWalletAddress
);

// Sync admin real balance from blockchain
router.post(
  '/sync',
  rateLimitMiddleware,
  [
    body('coinSymbol')
      .notEmpty().withMessage('Coin symbol is required')
      .isLength({ min: 2, max: 10 }).withMessage('Invalid coin symbol'),
    body('realBalance')
      .notEmpty().withMessage('Real balance is required')
      .isFloat({ min: 0 }).withMessage('Balance must be non-negative'),
    body('source')
      .optional()
      .isLength({ max: 100 }).withMessage('Source too long'),
    validate,
  ],
  AdminWalletController.syncAdminBalance
);

// Process user deposit (Admin confirms blockchain transaction)
router.post(
  '/deposits/process',
  rateLimitMiddleware,
  [
    body('userId')
      .notEmpty().withMessage('User ID is required')
      .isUUID().withMessage('Invalid user ID format'),
    body('coinSymbol')
      .notEmpty().withMessage('Coin symbol is required')
      .isLength({ min: 2, max: 10 }).withMessage('Invalid coin symbol'),
    body('amount')
      .notEmpty().withMessage('Amount is required')
      .isFloat({ min: 0.00000001 }).withMessage('Amount must be greater than 0'),
    body('txHash')
      .notEmpty().withMessage('Transaction hash is required')
      .isLength({ min: 10, max: 255 }).withMessage('Invalid transaction hash'),
    body('blockchainConfirmed')
      .optional()
      .isBoolean().withMessage('blockchainConfirmed must be boolean'),
    validate,
  ],
  AdminWalletController.processDeposit
);

// Process user withdrawal (Admin sends real coin)
router.post(
  '/withdrawals/process',
  rateLimitMiddleware,
  [
    body('userId')
      .notEmpty().withMessage('User ID is required')
      .isUUID().withMessage('Invalid user ID format'),
    body('coinSymbol')
      .notEmpty().withMessage('Coin symbol is required')
      .isLength({ min: 2, max: 10 }).withMessage('Invalid coin symbol'),
    body('amount')
      .notEmpty().withMessage('Amount is required')
      .isFloat({ min: 0.00000001 }).withMessage('Amount must be greater than 0'),
    body('toAddress')
      .notEmpty().withMessage('Recipient address is required')
      .isLength({ min: 10, max: 255 }).withMessage('Invalid address'),
    body('txHash')
      .optional()
      .isLength({ min: 10, max: 255 }).withMessage('Invalid transaction hash'),
    validate,
  ],
  AdminWalletController.processWithdrawal
);

export default router;
