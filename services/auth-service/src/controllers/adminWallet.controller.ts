import { Request, Response } from 'express';
import logger from '../utils/logger';
import adminWalletService from '../services/adminWallet.service';
import { UserRole } from '../models/User.model';

/**
 * AdminWalletController
 * Handles admin wallet operations (REAL coin management)
 * 
 * ADMIN ONLY endpoints
 */
export class AdminWalletController {
  /**
   * Middleware to check if user is admin
   */
  static requireAdmin(req: Request, res: Response, next: Function) {
    const userRole = req.headers['x-user-role'] as string;

    if (userRole !== UserRole.ADMIN) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Admin access required',
      });
    }

    next();
  }

  /**
   * Get all admin wallets (real balances)
   */
  static async getAdminWallets(req: Request, res: Response) {
    try {
      const wallets = await adminWalletService.getAdminWallets();

      res.json({
        success: true,
        data: {
          wallets: wallets.map(w => ({
            coinSymbol: w.coinSymbol,
            realBalance: parseFloat(w.availableBalance.toString()),
            lockedBalance: parseFloat(w.lockedBalance.toString()),
            totalBalance: parseFloat(w.availableBalance.toString()) + parseFloat(w.lockedBalance.toString()),
            walletAddress: w.walletAddress,
            lastUpdated: w.updatedAt,
          })),
        },
      });
    } catch (error: any) {
      logger.error('Get admin wallets error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to fetch admin wallets',
        message: error.message,
      });
    }
  }

  /**
   * Get platform statistics (all coins)
   */
  static async getPlatformStats(req: Request, res: Response) {
    try {
      const stats = await adminWalletService.getAllPlatformStats();

      res.json({
        success: true,
        data: { stats },
      });
    } catch (error: any) {
      logger.error('Get platform stats error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to fetch platform statistics',
        message: error.message,
      });
    }
  }

  /**
   * Get liquidity health check
   */
  static async getLiquidityHealth(req: Request, res: Response) {
    try {
      const health = await adminWalletService.getLiquidityHealth();

      res.json({
        success: true,
        data: health,
      });
    } catch (error: any) {
      logger.error('Get liquidity health error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to check liquidity health',
        message: error.message,
      });
    }
  }

  /**
   * Get coin statistics
   */
  static async getCoinStats(req: Request, res: Response) {
    try {
      const { coinSymbol } = req.params;

      if (!coinSymbol) {
        return res.status(400).json({
          success: false,
          error: 'Coin symbol is required',
        });
      }

      const stats = await adminWalletService.getPlatformCoinStats(coinSymbol.toUpperCase());

      res.json({
        success: true,
        data: { coinSymbol: coinSymbol.toUpperCase(), ...stats },
      });
    } catch (error: any) {
      logger.error('Get coin stats error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to fetch coin statistics',
        message: error.message,
      });
    }
  }

  /**
   * Update admin real balance (after blockchain sync)
   */
  static async syncAdminBalance(req: Request, res: Response) {
    try {
      const { coinSymbol, realBalance, source } = req.body;

      if (!coinSymbol || realBalance === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: coinSymbol, realBalance',
        });
      }

      if (realBalance < 0) {
        return res.status(400).json({
          success: false,
          error: 'Balance cannot be negative',
        });
      }

      const wallet = await adminWalletService.updateAdminRealBalance(
        coinSymbol.toUpperCase(),
        realBalance,
        source || 'MANUAL_SYNC'
      );

      res.json({
        success: true,
        data: {
          wallet: {
            coinSymbol: wallet.coinSymbol,
            realBalance: parseFloat(wallet.availableBalance.toString()),
            lockedBalance: parseFloat(wallet.lockedBalance.toString()),
          },
        },
        message: 'Admin balance synced successfully',
      });
    } catch (error: any) {
      logger.error('Sync admin balance error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to sync admin balance',
        message: error.message,
      });
    }
  }

  /**
   * Set admin wallet address
   */
  static async setWalletAddress(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { coinSymbol, walletAddress } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      if (!coinSymbol || !walletAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: coinSymbol, walletAddress',
        });
      }

      const wallet = await adminWalletService.setAdminWalletAddress(
        coinSymbol.toUpperCase(),
        walletAddress,
        userId
      );

      res.json({
        success: true,
        data: {
          coinSymbol: wallet.coinSymbol,
          walletAddress: wallet.walletAddress,
        },
        message: 'Wallet address set successfully',
      });
    } catch (error: any) {
      logger.error('Set wallet address error:', error.message);

      if (error.message.includes('Only admins')) {
        return res.status(403).json({
          success: false,
          error: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to set wallet address',
        message: error.message,
      });
    }
  }

  /**
   * Process user deposit (Admin confirms)
   */
  static async processDeposit(req: Request, res: Response) {
    try {
      const { userId, coinSymbol, amount, txHash, blockchainConfirmed } = req.body;

      if (!userId || !coinSymbol || !amount || !txHash) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: userId, coinSymbol, amount, txHash',
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be greater than 0',
        });
      }

      const result = await adminWalletService.processUserDeposit(
        userId,
        coinSymbol.toUpperCase(),
        amount,
        txHash,
        blockchainConfirmed || false
      );

      res.json({
        success: true,
        data: {
          userWallet: {
            coinSymbol: result.userWallet.coinSymbol,
            balance: parseFloat(result.userWallet.availableBalance.toString()),
          },
          adminWallet: {
            coinSymbol: result.adminWallet.coinSymbol,
            realBalance: parseFloat(result.adminWallet.availableBalance.toString()),
          },
          transactions: {
            user: result.userTransaction,
            admin: result.adminTransaction,
          },
        },
        message: 'Deposit processed successfully',
      });
    } catch (error: any) {
      logger.error('Process deposit error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to process deposit',
        message: error.message,
      });
    }
  }

  /**
   * Process user withdrawal (Admin executes)
   */
  static async processWithdrawal(req: Request, res: Response) {
    try {
      const { userId, coinSymbol, amount, toAddress, txHash } = req.body;

      if (!userId || !coinSymbol || !amount || !toAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: userId, coinSymbol, amount, toAddress',
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be greater than 0',
        });
      }

      const result = await adminWalletService.processUserWithdrawal(
        userId,
        coinSymbol.toUpperCase(),
        amount,
        toAddress,
        txHash
      );

      res.json({
        success: true,
        data: {
          userWallet: {
            coinSymbol: result.userWallet.coinSymbol,
            balance: parseFloat(result.userWallet.availableBalance.toString()),
          },
          adminWallet: {
            coinSymbol: result.adminWallet.coinSymbol,
            realBalance: parseFloat(result.adminWallet.availableBalance.toString()),
          },
          transactions: {
            user: result.userTransaction,
            admin: result.adminTransaction,
          },
        },
        message: 'Withdrawal processed successfully',
      });
    } catch (error: any) {
      logger.error('Process withdrawal error:', error.message);

      if (error.message.includes('Insufficient balance')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to process withdrawal',
        message: error.message,
      });
    }
  }

  /**
   * Get admin transaction history
   */
  static async getAdminTransactions(req: Request, res: Response) {
    try {
      const { coinSymbol, limit, offset } = req.query;

      const result = await adminWalletService.getAdminTransactionHistory(
        coinSymbol ? (coinSymbol as string).toUpperCase() : undefined,
        limit ? parseInt(limit as string) : 100,
        offset ? parseInt(offset as string) : 0
      );

      res.json({
        success: true,
        data: {
          transactions: result.transactions,
          total: result.total,
          pagination: {
            limit: limit ? parseInt(limit as string) : 100,
            offset: offset ? parseInt(offset as string) : 0,
            hasMore: result.total > (parseInt(offset as string) || 0) + result.transactions.length,
          },
        },
      });
    } catch (error: any) {
      logger.error('Get admin transactions error:', error.message);

      res.status(500).json({
        success: false,
        error: 'Failed to fetch admin transactions',
        message: error.message,
      });
    }
  }
}
