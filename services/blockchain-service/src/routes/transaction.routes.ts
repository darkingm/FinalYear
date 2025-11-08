import express from 'express';
import { TransactionController } from '../controllers/transaction.controller';

const router = express.Router();

// Get transaction by hash
router.get('/:txHash', TransactionController.getTransaction);

// Get transaction history for address
router.get('/history/:address', TransactionController.getHistory);

// Verify transaction
router.get('/:txHash/verify', TransactionController.verifyTransaction);

// Get pending transactions
router.get('/status/pending', TransactionController.getPendingTransactions);

// Get transaction statistics
router.get('/stats/overview', TransactionController.getStatistics);

export default router;

