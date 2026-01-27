import Wallet from '../models/Wallet.model';
import WalletTransaction, { TransactionType, TransactionStatus } from '../models/WalletTransaction.model';
import User, { UserRole } from '../models/User.model';
import { sequelize } from '../database';
import logger from '../utils/logger';

interface CreateWalletInput {
  userId: string;
  coinSymbol: string;
  initialBalance?: number;
  walletAddress?: string;
}

interface TransactionInput {
  userId: string;
  coinSymbol: string;
  amount: number;
  transactionType: TransactionType;
  fee?: number;
  description?: string;
  relatedOrderId?: string;
  relatedUserId?: string;
  txHash?: string;
}

class WalletService {
  /**
   * Create or get wallet for user
   */
  async createOrGetWallet(input: CreateWalletInput): Promise<Wallet> {
    try {
      const [wallet] = await Wallet.findOrCreate({
        where: {
          userId: input.userId,
          coinSymbol: input.coinSymbol,
        },
        defaults: {
          userId: input.userId,
          coinSymbol: input.coinSymbol,
          availableBalance: input.initialBalance || 0,
          lockedBalance: 0,
          walletAddress: input.walletAddress,
        },
      });

      return wallet;
    } catch (error: any) {
      logger.error('Error creating wallet:', error);
      throw new Error('Failed to create wallet');
    }
  }

  /**
   * Get user wallets (symbolic balances)
   */
  async getUserWallets(userId: string): Promise<Wallet[]> {
    try {
      const wallets = await Wallet.findAll({
        where: { userId },
        order: [['coin_symbol', 'ASC']],
      });

      return wallets;
    } catch (error: any) {
      logger.error('Error fetching user wallets:', error);
      throw new Error('Failed to fetch wallets');
    }
  }

  /**
   * Get specific wallet by coin
   */
  async getWalletByCoin(userId: string, coinSymbol: string): Promise<Wallet | null> {
    try {
      const wallet = await Wallet.findOne({
        where: { userId, coinSymbol },
      });

      return wallet;
    } catch (error: any) {
      logger.error('Error fetching wallet:', error);
      throw new Error('Failed to fetch wallet');
    }
  }

  /**
   * Add balance to wallet (with optimistic locking)
   */
  async addBalance(
    userId: string,
    coinSymbol: string,
    amount: number,
    transactionDetails: Partial<TransactionInput>
  ): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
    const transaction = await sequelize.transaction();

    try {
      // Get wallet with lock
      const wallet = await Wallet.findOne({
        where: { userId, coinSymbol },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const oldBalance = wallet.availableBalance;
      wallet.availableBalance = parseFloat(wallet.availableBalance.toString()) + amount;

      // Save with version check (optimistic locking)
      await wallet.save({ transaction });

      // Create transaction record
      const walletTx = await WalletTransaction.create(
        {
          userId,
          coinSymbol,
          amount,
          fee: transactionDetails.fee || 0,
          balanceAfter: wallet.availableBalance,
          transactionType: transactionDetails.transactionType || TransactionType.DEPOSIT,
          description: transactionDetails.description,
          relatedOrderId: transactionDetails.relatedOrderId,
          relatedUserId: transactionDetails.relatedUserId,
          txHash: transactionDetails.txHash,
          status: TransactionStatus.COMPLETED,
        },
        { transaction }
      );

      await transaction.commit();

      logger.info(`Balance added: User ${userId}, ${coinSymbol} +${amount}`);

      return { wallet, transaction: walletTx };
    } catch (error: any) {
      await transaction.rollback();
      logger.error('Error adding balance:', error);
      throw new Error('Failed to add balance: ' + error.message);
    }
  }

  /**
   * Deduct balance from wallet (with optimistic locking)
   */
  async deductBalance(
    userId: string,
    coinSymbol: string,
    amount: number,
    transactionDetails: Partial<TransactionInput>
  ): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
    const transaction = await sequelize.transaction();

    try {
      // Get wallet with lock
      const wallet = await Wallet.findOne({
        where: { userId, coinSymbol },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (!wallet.canDeduct(amount)) {
        throw new Error('Insufficient balance');
      }

      const oldBalance = wallet.availableBalance;
      wallet.availableBalance = parseFloat(wallet.availableBalance.toString()) - amount;

      // Save with version check
      await wallet.save({ transaction });

      // Create transaction record
      const walletTx = await WalletTransaction.create(
        {
          userId,
          coinSymbol,
          amount: -amount, // Negative for deduction
          fee: transactionDetails.fee || 0,
          balanceAfter: wallet.availableBalance,
          transactionType: transactionDetails.transactionType || TransactionType.WITHDRAWAL,
          description: transactionDetails.description,
          relatedOrderId: transactionDetails.relatedOrderId,
          relatedUserId: transactionDetails.relatedUserId,
          txHash: transactionDetails.txHash,
          status: TransactionStatus.COMPLETED,
        },
        { transaction }
      );

      await transaction.commit();

      logger.info(`Balance deducted: User ${userId}, ${coinSymbol} -${amount}`);

      return { wallet, transaction: walletTx };
    } catch (error: any) {
      await transaction.rollback();
      logger.error('Error deducting balance:', error);
      throw new Error('Failed to deduct balance: ' + error.message);
    }
  }

  /**
   * Transfer between users (symbolic)
   */
  async transfer(
    fromUserId: string,
    toUserId: string,
    coinSymbol: string,
    amount: number,
    description?: string
  ): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      // Deduct from sender
      await this.deductBalance(fromUserId, coinSymbol, amount, {
        userId: fromUserId,
        coinSymbol,
        amount,
        transactionType: TransactionType.TRANSFER,
        description: `Transfer to user ${toUserId}`,
        relatedUserId: toUserId,
      });

      // Add to receiver
      await this.addBalance(toUserId, coinSymbol, amount, {
        userId: toUserId,
        coinSymbol,
        amount,
        transactionType: TransactionType.TRANSFER,
        description: `Transfer from user ${fromUserId}`,
        relatedUserId: fromUserId,
      });

      await transaction.commit();

      logger.info(`Transfer completed: ${fromUserId} -> ${toUserId}, ${amount} ${coinSymbol}`);
    } catch (error: any) {
      await transaction.rollback();
      logger.error('Error transferring:', error);
      throw new Error('Failed to transfer: ' + error.message);
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    userId: string,
    options?: {
      coinSymbol?: string;
      transactionType?: TransactionType;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ transactions: WalletTransaction[]; total: number }> {
    try {
      const where: any = { userId };

      if (options?.coinSymbol) {
        where.coinSymbol = options.coinSymbol;
      }

      if (options?.transactionType) {
        where.transactionType = options.transactionType;
      }

      const { rows, count } = await WalletTransaction.findAndCountAll({
        where,
        limit: options?.limit || 50,
        offset: options?.offset || 0,
        order: [['created_at', 'DESC']],
      });

      return {
        transactions: rows,
        total: count,
      };
    } catch (error: any) {
      logger.error('Error fetching transaction history:', error);
      throw new Error('Failed to fetch transaction history');
    }
  }

  /**
   * Lock balance (for pending orders)
   */
  async lockBalance(userId: string, coinSymbol: string, amount: number): Promise<Wallet> {
    const transaction = await sequelize.transaction();

    try {
      const wallet = await Wallet.findOne({
        where: { userId, coinSymbol },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (!wallet.canDeduct(amount)) {
        throw new Error('Insufficient balance to lock');
      }

      wallet.availableBalance = parseFloat(wallet.availableBalance.toString()) - amount;
      wallet.lockedBalance = parseFloat(wallet.lockedBalance.toString()) + amount;

      await wallet.save({ transaction });
      await transaction.commit();

      logger.info(`Balance locked: User ${userId}, ${amount} ${coinSymbol}`);

      return wallet;
    } catch (error: any) {
      await transaction.rollback();
      logger.error('Error locking balance:', error);
      throw new Error('Failed to lock balance: ' + error.message);
    }
  }

  /**
   * Unlock balance (cancel order)
   */
  async unlockBalance(userId: string, coinSymbol: string, amount: number): Promise<Wallet> {
    const transaction = await sequelize.transaction();

    try {
      const wallet = await Wallet.findOne({
        where: { userId, coinSymbol },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      wallet.availableBalance = parseFloat(wallet.availableBalance.toString()) + amount;
      wallet.lockedBalance = Math.max(0, parseFloat(wallet.lockedBalance.toString()) - amount);

      await wallet.save({ transaction });
      await transaction.commit();

      logger.info(`Balance unlocked: User ${userId}, ${amount} ${coinSymbol}`);

      return wallet;
    } catch (error: any) {
      await transaction.rollback();
      logger.error('Error unlocking balance:', error);
      throw new Error('Failed to unlock balance: ' + error.message);
    }
  }

  /**
   * Deduct locked balance (complete order)
   */
  async deductLockedBalance(
    userId: string,
    coinSymbol: string,
    amount: number,
    orderId: string
  ): Promise<WalletTransaction> {
    const transaction = await sequelize.transaction();

    try {
      const wallet = await Wallet.findOne({
        where: { userId, coinSymbol },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      wallet.lockedBalance = Math.max(0, parseFloat(wallet.lockedBalance.toString()) - amount);

      await wallet.save({ transaction });

      // Create transaction record
      const walletTx = await WalletTransaction.create(
        {
          userId,
          coinSymbol,
          amount: -amount,
          fee: 0,
          balanceAfter: wallet.availableBalance,
          transactionType: TransactionType.ORDER_PURCHASE,
          description: `Order payment: ${orderId}`,
          relatedOrderId: orderId,
          status: TransactionStatus.COMPLETED,
        },
        { transaction }
      );

      await transaction.commit();

      logger.info(`Locked balance deducted: User ${userId}, ${amount} ${coinSymbol} for order ${orderId}`);

      return walletTx;
    } catch (error: any) {
      await transaction.rollback();
      logger.error('Error deducting locked balance:', error);
      throw new Error('Failed to deduct locked balance: ' + error.message);
    }
  }
}

export default new WalletService();
