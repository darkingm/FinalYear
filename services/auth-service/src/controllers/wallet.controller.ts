import { Request, Response } from 'express';
import logger from '../utils/logger';
import walletService from '../services/wallet.service';
import { TransactionType } from '../models/WalletTransaction.model';

export class WalletController {
  /**
   * Get user wallets (all coins)
   */
  static async getWallets(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const wallets = await walletService.getUserWallets(userId);

      res.json({
        success: true,
        data: { wallets },
      });
    } catch (error: any) {
      logger.error('Get wallets error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to fetch wallets',
        message: error.message,
      });
    }
  }

  /**
   * Get specific wallet by coin
   */
  static async getWalletByCoin(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { coinSymbol } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      if (!coinSymbol) {
        return res.status(400).json({
          success: false,
          error: 'Coin symbol is required',
        });
      }

      const wallet = await walletService.getWalletByCoin(userId, coinSymbol.toUpperCase());

      if (!wallet) {
        return res.status(404).json({
          success: false,
          error: 'Wallet not found',
        });
      }

      res.json({
        success: true,
        data: { wallet },
      });
    } catch (error: any) {
      logger.error('Get wallet error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to fetch wallet',
        message: error.message,
      });
    }
  }

  /**
   * Create or get wallet for a coin
   */
  static async createWallet(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { coinSymbol, initialBalance } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      if (!coinSymbol) {
        return res.status(400).json({
          success: false,
          error: 'Coin symbol is required',
        });
      }

      const wallet = await walletService.createOrGetWallet({
        userId,
        coinSymbol: coinSymbol.toUpperCase(),
        initialBalance: initialBalance || 0,
      });

      res.status(201).json({
        success: true,
        data: { wallet },
        message: 'Wallet created successfully',
      });
    } catch (error: any) {
      logger.error('Create wallet error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to create wallet',
        message: error.message,
      });
    }
  }

  /**
   * Get transaction history
   */
  static async getTransactionHistory(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { coinSymbol, transactionType, limit, offset } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const result = await walletService.getTransactionHistory(userId, {
        coinSymbol: coinSymbol ? (coinSymbol as string).toUpperCase() : undefined,
        transactionType: transactionType as TransactionType | undefined,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });

      res.json({
        success: true,
        data: {
          transactions: result.transactions,
          total: result.total,
          pagination: {
            limit: limit ? parseInt(limit as string) : 50,
            offset: offset ? parseInt(offset as string) : 0,
            hasMore: result.total > (parseInt(offset as string) || 0) + result.transactions.length,
          },
        },
      });
    } catch (error: any) {
      logger.error('Get transaction history error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to fetch transaction history',
        message: error.message,
      });
    }
  }

  /**
   * Transfer between users
   */
  static async transfer(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { toUserId, coinSymbol, amount, description } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      // Validation
      if (!toUserId || !coinSymbol || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: toUserId, coinSymbol, amount',
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be greater than 0',
        });
      }

      if (userId === toUserId) {
        return res.status(400).json({
          success: false,
          error: 'Cannot transfer to yourself',
        });
      }

      await walletService.transfer(
        userId,
        toUserId,
        coinSymbol.toUpperCase(),
        amount,
        description
      );

      res.json({
        success: true,
        message: 'Transfer completed successfully',
      });
    } catch (error: any) {
      logger.error('Transfer error:', error.message);

      if (error.message.includes('Insufficient balance')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      if (error.message.includes('Wallet not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Transfer failed',
        message: error.message,
      });
    }
  }

  /**
   * Deposit (Admin only or external deposit confirmation)
   */
  static async deposit(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const userRole = req.headers['x-user-role'] as string;
      const { targetUserId, coinSymbol, amount, txHash, description } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      // Only admin can deposit for other users
      if (targetUserId && targetUserId !== userId && userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          error: 'Only admins can deposit for other users',
        });
      }

      const finalUserId = targetUserId || userId;

      // Validation
      if (!coinSymbol || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: coinSymbol, amount',
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be greater than 0',
        });
      }

      const result = await walletService.addBalance(
        finalUserId,
        coinSymbol.toUpperCase(),
        amount,
        {
          userId: finalUserId,
          coinSymbol: coinSymbol.toUpperCase(),
          amount,
          transactionType: TransactionType.DEPOSIT,
          txHash,
          description: description || 'Deposit',
        }
      );

      res.json({
        success: true,
        data: {
          wallet: result.wallet,
          transaction: result.transaction,
        },
        message: 'Deposit completed successfully',
      });
    } catch (error: any) {
      logger.error('Deposit error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Deposit failed',
        message: error.message,
      });
    }
  }

  /**
   * Withdraw (Request withdrawal)
   */
  static async withdraw(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { coinSymbol, amount, toAddress, description } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      // Validation
      if (!coinSymbol || !amount || !toAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: coinSymbol, amount, toAddress',
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be greater than 0',
        });
      }

      // Deduct balance
      const result = await walletService.deductBalance(
        userId,
        coinSymbol.toUpperCase(),
        amount,
        {
          userId,
          coinSymbol: coinSymbol.toUpperCase(),
          amount,
          transactionType: TransactionType.WITHDRAWAL,
          toAddress,
          description: description || `Withdrawal to ${toAddress}`,
        }
      );

      res.json({
        success: true,
        data: {
          wallet: result.wallet,
          transaction: result.transaction,
        },
        message: 'Withdrawal request submitted successfully',
      });
    } catch (error: any) {
      logger.error('Withdraw error:', error.message);

      if (error.message.includes('Insufficient balance')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Withdrawal failed',
        message: error.message,
      });
    }
  }

  /**
   * Get wallet summary (total balance in USD)
   */
  static async getWalletSummary(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const wallets = await walletService.getUserWallets(userId);

      // Calculate totals
      const totalWallets = wallets.length;
      const totalBalance = wallets.reduce((sum, w) => sum + parseFloat(w.availableBalance.toString()), 0);
      const totalLocked = wallets.reduce((sum, w) => sum + parseFloat(w.lockedBalance.toString()), 0);

      res.json({
        success: true,
        data: {
          totalWallets,
          totalBalance,
          totalLocked,
          wallets: wallets.map(w => ({
            coinSymbol: w.coinSymbol,
            availableBalance: parseFloat(w.availableBalance.toString()),
            lockedBalance: parseFloat(w.lockedBalance.toString()),
            totalBalance: parseFloat(w.availableBalance.toString()) + parseFloat(w.lockedBalance.toString()),
          })),
        },
      });
    } catch (error: any) {
      logger.error('Get wallet summary error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to fetch wallet summary',
        message: error.message,
      });
    }
  }
}
