import { Request, Response } from 'express';
import blockchainService from '../services/blockchain.service';
import Transaction from '../models/Transaction.model';
import logger from '../utils/logger';

export class TransactionController {
  // Get transaction by hash
  static async getTransaction(req: Request, res: Response) {
    try {
      const { txHash } = req.params;

      const transaction = await Transaction.findOne({ txHash });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found',
        });
      }

      res.json({
        success: true,
        data: transaction,
      });
    } catch (error: any) {
      logger.error('Get transaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transaction',
      });
    }
  }

  // Get transaction history
  static async getHistory(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const { limit = 20, offset = 0 } = req.query;

      const transactions = await Transaction.find({
        $or: [{ from: address }, { to: address }],
      })
        .sort({ blockTimestamp: -1 })
        .skip(Number(offset))
        .limit(Number(limit));

      const total = await Transaction.countDocuments({
        $or: [{ from: address }, { to: address }],
      });

      res.json({
        success: true,
        data: transactions,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: total > Number(offset) + Number(limit),
        },
      });
    } catch (error: any) {
      logger.error('Get transaction history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transaction history',
      });
    }
  }

  // Verify transaction
  static async verifyTransaction(req: Request, res: Response) {
    try {
      const { txHash } = req.params;

      const isValid = await blockchainService.verifyTransaction(txHash);

      res.json({
        success: true,
        data: {
          txHash,
          isValid,
        },
      });
    } catch (error: any) {
      logger.error('Verify transaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify transaction',
      });
    }
  }

  // Get pending transactions
  static async getPendingTransactions(req: Request, res: Response) {
    try {
      const transactions = await Transaction.find({ status: 'PENDING' })
        .sort({ createdAt: -1 })
        .limit(50);

      res.json({
        success: true,
        data: transactions,
        count: transactions.length,
      });
    } catch (error: any) {
      logger.error('Get pending transactions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch pending transactions',
      });
    }
  }

  // Get transaction statistics
  static async getStatistics(req: Request, res: Response) {
    try {
      const [totalTxs, confirmedTxs, pendingTxs, failedTxs] = await Promise.all([
        Transaction.countDocuments(),
        Transaction.countDocuments({ status: 'CONFIRMED' }),
        Transaction.countDocuments({ status: 'PENDING' }),
        Transaction.countDocuments({ status: 'FAILED' }),
      ]);

      const typeStats = await Transaction.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
          },
        },
      ]);

      res.json({
        success: true,
        data: {
          total: totalTxs,
          confirmed: confirmedTxs,
          pending: pendingTxs,
          failed: failedTxs,
          byType: typeStats.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
        },
      });
    } catch (error: any) {
      logger.error('Get transaction statistics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
      });
    }
  }
}

