import Wallet from '../models/Wallet.model';
import WalletTransaction, { TransactionType, TransactionStatus } from '../models/WalletTransaction.model';
import User, { UserRole } from '../models/User.model';
import { sequelize } from '../database';
import logger from '../utils/logger';
import { Op } from 'sequelize';

/**
 * AdminWalletService
 * 
 * QUAN TRỌNG: Quản lý coin THẬT của admin
 * 
 * Concept:
 * - User wallets: Số dư SYMBOLIC (chỉ là con số trên hệ thống)
 * - Admin wallet: Giữ coin THẬT trên blockchain
 * - Khi user deposit: Admin nhận coin thật → Tăng symbolic balance cho user
 * - Khi user withdraw: Giảm symbolic balance → Admin chuyển coin thật
 * 
 * Admin wallet phải:
 * - Có đủ coin thật để xử lý withdrawals
 * - Track balance thật vs symbolic
 * - Monitor liquidity
 */
class AdminWalletService {
  private static readonly ADMIN_WALLET_USER_ID = '00000000-0000-0000-0000-000000000001'; // Special admin ID

  /**
   * Get or create admin master wallet
   */
  async getOrCreateAdminWallet(coinSymbol: string): Promise<Wallet> {
    try {
      const [wallet] = await Wallet.findOrCreate({
        where: {
          userId: AdminWalletService.ADMIN_WALLET_USER_ID,
          coinSymbol: coinSymbol.toUpperCase(),
        },
        defaults: {
          userId: AdminWalletService.ADMIN_WALLET_USER_ID,
          coinSymbol: coinSymbol.toUpperCase(),
          availableBalance: 0, // Real balance from blockchain
          lockedBalance: 0,
          walletAddress: undefined, // Will be set when admin configures
        },
      });

      return wallet;
    } catch (error: any) {
      logger.error('Error creating admin wallet:', error);
      throw new Error('Failed to create admin wallet');
    }
  }

  /**
   * Get all admin wallets (real balances)
   */
  async getAdminWallets(): Promise<Wallet[]> {
    try {
      const wallets = await Wallet.findAll({
        where: { userId: AdminWalletService.ADMIN_WALLET_USER_ID },
        order: [['coin_symbol', 'ASC']],
      });

      return wallets;
    } catch (error: any) {
      logger.error('Error fetching admin wallets:', error);
      throw new Error('Failed to fetch admin wallets');
    }
  }

  /**
   * Get platform-wide statistics for a coin
   */
  async getPlatformCoinStats(coinSymbol: string): Promise<{
    totalUserBalance: number;
    totalLockedBalance: number;
    adminRealBalance: number;
    adminLockedBalance: number;
    deficit: number; // If admin has less than users need
    userCount: number;
  }> {
    try {
      // Get all user wallets for this coin (excluding admin)
      const userWallets = await Wallet.findAll({
        where: {
          coinSymbol: coinSymbol.toUpperCase(),
          userId: { [Op.ne]: AdminWalletService.ADMIN_WALLET_USER_ID },
        },
      });

      // Calculate totals
      const totalUserBalance = userWallets.reduce(
        (sum, w) => sum + parseFloat(w.availableBalance.toString()),
        0
      );

      const totalLockedBalance = userWallets.reduce(
        (sum, w) => sum + parseFloat(w.lockedBalance.toString()),
        0
      );

      // Get admin wallet
      const adminWallet = await this.getOrCreateAdminWallet(coinSymbol);
      const adminRealBalance = parseFloat(adminWallet.availableBalance.toString());
      const adminLockedBalance = parseFloat(adminWallet.lockedBalance.toString());

      // Calculate deficit (if admin has less than what users have symbolically)
      const totalUserNeeds = totalUserBalance + totalLockedBalance;
      const deficit = Math.max(0, totalUserNeeds - adminRealBalance);

      return {
        totalUserBalance,
        totalLockedBalance,
        adminRealBalance,
        adminLockedBalance,
        deficit,
        userCount: userWallets.length,
      };
    } catch (error: any) {
      logger.error('Error calculating platform stats:', error);
      throw new Error('Failed to calculate platform statistics');
    }
  }

  /**
   * Get all platform statistics (all coins)
   */
  async getAllPlatformStats(): Promise<any[]> {
    try {
      // Get all unique coin symbols
      const coins = await sequelize.query(
        `SELECT DISTINCT coin_symbol FROM wallets ORDER BY coin_symbol`,
        { type: sequelize.QueryTypes.SELECT }
      ) as Array<{ coin_symbol: string }>;

      const stats = await Promise.all(
        coins.map(async (coin) => {
          const coinStats = await this.getPlatformCoinStats(coin.coin_symbol);
          return {
            coinSymbol: coin.coin_symbol,
            ...coinStats,
          };
        })
      );

      return stats;
    } catch (error: any) {
      logger.error('Error fetching platform stats:', error);
      throw new Error('Failed to fetch platform statistics');
    }
  }

  /**
   * Update admin real balance (after blockchain sync)
   * IMPORTANT: This should be called after checking blockchain
   */
  async updateAdminRealBalance(
    coinSymbol: string,
    realBalance: number,
    source: string = 'BLOCKCHAIN_SYNC'
  ): Promise<Wallet> {
    const transaction = await sequelize.transaction();

    try {
      const wallet = await Wallet.findOne({
        where: {
          userId: AdminWalletService.ADMIN_WALLET_USER_ID,
          coinSymbol: coinSymbol.toUpperCase(),
        },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!wallet) {
        throw new Error('Admin wallet not found');
      }

      const oldBalance = parseFloat(wallet.availableBalance.toString());
      const difference = realBalance - oldBalance;

      wallet.availableBalance = realBalance;
      await wallet.save({ transaction });

      // Log the sync
      await WalletTransaction.create(
        {
          userId: AdminWalletService.ADMIN_WALLET_USER_ID,
          coinSymbol: coinSymbol.toUpperCase(),
          amount: difference,
          fee: 0,
          balanceAfter: realBalance,
          transactionType: TransactionType.ADMIN_ADJUSTMENT,
          description: `Balance sync from ${source}. Old: ${oldBalance}, New: ${realBalance}`,
          status: TransactionStatus.COMPLETED,
        },
        { transaction }
      );

      await transaction.commit();

      logger.info(`Admin wallet synced: ${coinSymbol}, Old: ${oldBalance}, New: ${realBalance}, Diff: ${difference}`);

      return wallet;
    } catch (error: any) {
      await transaction.rollback();
      logger.error('Error updating admin balance:', error);
      throw new Error('Failed to update admin balance');
    }
  }

  /**
   * Process user deposit (Admin receives real coin)
   * Flow: User sends coin to admin address → Admin confirms → Update user symbolic balance
   */
  async processUserDeposit(
    userId: string,
    coinSymbol: string,
    amount: number,
    txHash: string,
    blockchainConfirmed: boolean = false
  ): Promise<{
    userWallet: Wallet;
    adminWallet: Wallet;
    userTransaction: WalletTransaction;
    adminTransaction: WalletTransaction;
  }> {
    const transaction = await sequelize.transaction();

    try {
      // 1. Increase admin real balance
      const adminWallet = await Wallet.findOne({
        where: {
          userId: AdminWalletService.ADMIN_WALLET_USER_ID,
          coinSymbol: coinSymbol.toUpperCase(),
        },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!adminWallet) {
        throw new Error('Admin wallet not found');
      }

      adminWallet.availableBalance = parseFloat(adminWallet.availableBalance.toString()) + amount;
      await adminWallet.save({ transaction });

      // Log admin receipt
      const adminTx = await WalletTransaction.create(
        {
          userId: AdminWalletService.ADMIN_WALLET_USER_ID,
          coinSymbol: coinSymbol.toUpperCase(),
          amount,
          fee: 0,
          balanceAfter: adminWallet.availableBalance,
          transactionType: TransactionType.DEPOSIT,
          description: `Received deposit from user ${userId}`,
          relatedUserId: userId,
          txHash,
          status: blockchainConfirmed ? TransactionStatus.COMPLETED : TransactionStatus.PENDING,
        },
        { transaction }
      );

      // 2. Increase user symbolic balance
      const userWallet = await Wallet.findOne({
        where: {
          userId,
          coinSymbol: coinSymbol.toUpperCase(),
        },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!userWallet) {
        throw new Error('User wallet not found');
      }

      userWallet.availableBalance = parseFloat(userWallet.availableBalance.toString()) + amount;
      await userWallet.save({ transaction });

      // Log user deposit
      const userTx = await WalletTransaction.create(
        {
          userId,
          coinSymbol: coinSymbol.toUpperCase(),
          amount,
          fee: 0,
          balanceAfter: userWallet.availableBalance,
          transactionType: TransactionType.DEPOSIT,
          description: `Deposit confirmed`,
          txHash,
          status: blockchainConfirmed ? TransactionStatus.COMPLETED : TransactionStatus.PENDING,
        },
        { transaction }
      );

      await transaction.commit();

      logger.info(`Deposit processed: User ${userId} deposited ${amount} ${coinSymbol} (TxHash: ${txHash})`);

      return {
        userWallet,
        adminWallet,
        userTransaction: userTx,
        adminTransaction: adminTx,
      };
    } catch (error: any) {
      await transaction.rollback();
      logger.error('Error processing deposit:', error);
      throw new Error('Failed to process deposit: ' + error.message);
    }
  }

  /**
   * Process user withdrawal (Admin sends real coin)
   * Flow: User requests → Deduct symbolic balance → Admin sends real coin
   */
  async processUserWithdrawal(
    userId: string,
    coinSymbol: string,
    amount: number,
    toAddress: string,
    txHash?: string // After blockchain transaction
  ): Promise<{
    userWallet: Wallet;
    adminWallet: Wallet;
    userTransaction: WalletTransaction;
    adminTransaction: WalletTransaction;
  }> {
    const transaction = await sequelize.transaction();

    try {
      // 1. Deduct user symbolic balance
      const userWallet = await Wallet.findOne({
        where: {
          userId,
          coinSymbol: coinSymbol.toUpperCase(),
        },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!userWallet) {
        throw new Error('User wallet not found');
      }

      if (!userWallet.canDeduct(amount)) {
        throw new Error('Insufficient balance');
      }

      userWallet.availableBalance = parseFloat(userWallet.availableBalance.toString()) - amount;
      await userWallet.save({ transaction });

      // Log user withdrawal
      const userTx = await WalletTransaction.create(
        {
          userId,
          coinSymbol: coinSymbol.toUpperCase(),
          amount: -amount,
          fee: 0,
          balanceAfter: userWallet.availableBalance,
          transactionType: TransactionType.WITHDRAWAL,
          description: `Withdrawal to ${toAddress}`,
          toAddress,
          txHash,
          status: txHash ? TransactionStatus.COMPLETED : TransactionStatus.PENDING,
        },
        { transaction }
      );

      // 2. Deduct admin real balance
      const adminWallet = await Wallet.findOne({
        where: {
          userId: AdminWalletService.ADMIN_WALLET_USER_ID,
          coinSymbol: coinSymbol.toUpperCase(),
        },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!adminWallet) {
        throw new Error('Admin wallet not found');
      }

      if (!adminWallet.canDeduct(amount)) {
        throw new Error('Admin wallet has insufficient real balance for withdrawal');
      }

      adminWallet.availableBalance = parseFloat(adminWallet.availableBalance.toString()) - amount;
      await adminWallet.save({ transaction });

      // Log admin withdrawal
      const adminTx = await WalletTransaction.create(
        {
          userId: AdminWalletService.ADMIN_WALLET_USER_ID,
          coinSymbol: coinSymbol.toUpperCase(),
          amount: -amount,
          fee: 0,
          balanceAfter: adminWallet.availableBalance,
          transactionType: TransactionType.WITHDRAWAL,
          description: `Withdrawal for user ${userId}`,
          relatedUserId: userId,
          toAddress,
          txHash,
          status: txHash ? TransactionStatus.COMPLETED : TransactionStatus.PENDING,
        },
        { transaction }
      );

      await transaction.commit();

      logger.info(`Withdrawal processed: User ${userId} withdrew ${amount} ${coinSymbol} to ${toAddress}`);

      return {
        userWallet,
        adminWallet,
        userTransaction: userTx,
        adminTransaction: adminTx,
      };
    } catch (error: any) {
      await transaction.rollback();
      logger.error('Error processing withdrawal:', error);
      throw new Error('Failed to process withdrawal: ' + error.message);
    }
  }

  /**
   * Get platform liquidity health
   * Check if admin has enough real balance to cover user symbolic balances
   */
  async getLiquidityHealth(): Promise<{
    healthy: boolean;
    coins: Array<{
      coinSymbol: string;
      totalUserSymbolic: number;
      totalUserLocked: number;
      adminRealBalance: number;
      coverage: number; // Percentage
      deficit: number;
      status: 'healthy' | 'warning' | 'critical';
    }>;
  }> {
    try {
      // Get all unique coins
      const coins = await sequelize.query(
        `SELECT DISTINCT coin_symbol FROM wallets ORDER BY coin_symbol`,
        { type: sequelize.QueryTypes.SELECT }
      ) as Array<{ coin_symbol: string }>;

      const coinHealths = await Promise.all(
        coins.map(async (coin) => {
          const stats = await this.getPlatformCoinStats(coin.coin_symbol);

          const totalUserNeeds = stats.totalUserBalance + stats.totalLockedBalance;
          const coverage = totalUserNeeds > 0 
            ? (stats.adminRealBalance / totalUserNeeds) * 100 
            : 100;

          let status: 'healthy' | 'warning' | 'critical' = 'healthy';
          if (coverage < 50) {
            status = 'critical';
          } else if (coverage < 80) {
            status = 'warning';
          }

          return {
            coinSymbol: coin.coin_symbol,
            totalUserSymbolic: stats.totalUserBalance,
            totalUserLocked: stats.totalLockedBalance,
            adminRealBalance: stats.adminRealBalance,
            coverage: Math.round(coverage * 100) / 100,
            deficit: stats.deficit,
            status,
          };
        })
      );

      // Platform is healthy if all coins are healthy or warning
      const healthy = coinHealths.every((c) => c.status !== 'critical');

      return {
        healthy,
        coins: coinHealths,
      };
    } catch (error: any) {
      logger.error('Error checking liquidity health:', error);
      throw new Error('Failed to check liquidity health');
    }
  }

  /**
   * Get platform stats for a specific coin (reuse from WalletService concept)
   */
  private async getPlatformCoinStats(coinSymbol: string): Promise<{
    totalUserBalance: number;
    totalLockedBalance: number;
    adminRealBalance: number;
    adminLockedBalance: number;
    deficit: number;
    userCount: number;
  }> {
    const userWallets = await Wallet.findAll({
      where: {
        coinSymbol: coinSymbol.toUpperCase(),
        userId: { [Op.ne]: AdminWalletService.ADMIN_WALLET_USER_ID },
      },
    });

    const totalUserBalance = userWallets.reduce(
      (sum, w) => sum + parseFloat(w.availableBalance.toString()),
      0
    );

    const totalLockedBalance = userWallets.reduce(
      (sum, w) => sum + parseFloat(w.lockedBalance.toString()),
      0
    );

    const adminWallet = await this.getOrCreateAdminWallet(coinSymbol);
    const adminRealBalance = parseFloat(adminWallet.availableBalance.toString());
    const adminLockedBalance = parseFloat(adminWallet.lockedBalance.toString());

    const totalUserNeeds = totalUserBalance + totalLockedBalance;
    const deficit = Math.max(0, totalUserNeeds - adminRealBalance);

    return {
      totalUserBalance,
      totalLockedBalance,
      adminRealBalance,
      adminLockedBalance,
      deficit,
      userCount: userWallets.length,
    };
  }

  /**
   * Set admin wallet address (for a coin)
   */
  async setAdminWalletAddress(
    coinSymbol: string,
    walletAddress: string,
    adminUserId: string
  ): Promise<Wallet> {
    try {
      // Verify admin user
      const admin = await User.findByPk(adminUserId);
      if (!admin || admin.role !== UserRole.ADMIN) {
        throw new Error('Only admins can set wallet addresses');
      }

      const wallet = await this.getOrCreateAdminWallet(coinSymbol);
      wallet.walletAddress = walletAddress;
      await wallet.save();

      logger.info(`Admin wallet address set: ${coinSymbol} -> ${walletAddress}`);

      return wallet;
    } catch (error: any) {
      logger.error('Error setting admin wallet address:', error);
      throw new Error('Failed to set admin wallet address');
    }
  }

  /**
   * Get admin transaction history
   */
  async getAdminTransactionHistory(
    coinSymbol?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ transactions: WalletTransaction[]; total: number }> {
    try {
      const where: any = { userId: AdminWalletService.ADMIN_WALLET_USER_ID };

      if (coinSymbol) {
        where.coinSymbol = coinSymbol.toUpperCase();
      }

      const { rows, count } = await WalletTransaction.findAndCountAll({
        where,
        limit,
        offset,
        order: [['created_at', 'DESC']],
      });

      return {
        transactions: rows,
        total: count,
      };
    } catch (error: any) {
      logger.error('Error fetching admin transactions:', error);
      throw new Error('Failed to fetch admin transactions');
    }
  }
}

export default new AdminWalletService();
