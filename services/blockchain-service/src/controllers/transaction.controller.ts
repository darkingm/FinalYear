import { Request, Response } from 'express';
import blockchainService from '../services/blockchain.service';
import multiChainService from '../services/MultiChainService';
import Transaction from '../models/Transaction.model';
import logger from '../utils/logger';

export class TransactionController {
  // Get transaction by hash
  static async getTransaction(req: Request, res: Response) {
    try {
      const { txHash, networkId } = req.params;

      let transaction;
      if (networkId) {
        transaction = await Transaction.findOne({ txHash, networkId });
      } else {
        transaction = await Transaction.findOne({ txHash });
      }

      if (!transaction) {
        // Try to fetch from blockchain if not in database
        if (networkId) {
          try {
            const provider = multiChainService.getProvider(networkId);
            const txDetails = await provider.getTransaction(txHash);
            if (txDetails) {
              return res.json({
                success: true,
                data: txDetails,
                source: 'blockchain',
              });
            }
          } catch (error) {
            // Ignore blockchain fetch error
          }
        }

        return res.status(404).json({
          success: false,
          error: 'Transaction not found',
        });
      }

      res.json({
        success: true,
        data: transaction,
        source: 'database',
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
      const { networkId, limit = 20, offset = 0 } = req.query;

      const query: any = {
        $or: [{ from: address }, { to: address }],
      };

      if (networkId) {
        query.networkId = networkId;
      }

      const transactions = await Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(Number(offset))
        .limit(Number(limit));

      const total = await Transaction.countDocuments(query);

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
      const { networkId } = req.query;

      const query: any = {
        status: { $in: ['PENDING', 'CONFIRMING'] },
      };

      if (networkId) {
        query.networkId = networkId;
      }

      const transactions = await Transaction.find(query)
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

