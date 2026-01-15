import axios from 'axios';
import { publishEvent } from '../utils/rabbitmq';
import logger from '../utils/logger';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3003';

export interface CoinBalance {
  coinId: string;
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
}

export class WalletService {
  // Get user coin balances
  static async getUserBalances(userId: string): Promise<CoinBalance[]> {
    try {
      // Get user profile with coin balances (now from auth-service)
      const response = await axios.get(`${AUTH_SERVICE_URL}/api/v1/users/${userId}/balances`, {
        headers: {
          'x-user-id': userId,
        },
      });

      if (response.data.success) {
        return response.data.data.balances || [];
      }
      return [];
    } catch (error: any) {
      logger.error('Get user balances error:', error.message);
      return [];
    }
  }

  // Get coin price from product-service (merged with coin-market-service)
  static async getCoinPrice(coinId: string): Promise<number> {
    try {
      const response = await axios.get(`${PRODUCT_SERVICE_URL}/api/coins/${coinId}`);
      if (response.data.success && response.data.data.currentPrice) {
        return response.data.data.currentPrice;
      }
      return 0;
    } catch (error: any) {
      logger.error('Get coin price error:', error.message);
      return 0;
    }
  }

  // Check if user has sufficient balance
  static async checkBalance(
    userId: string,
    coinId: string,
    requiredAmount: number
  ): Promise<boolean> {
    try {
      const balances = await this.getUserBalances(userId);
      const coinBalance = balances.find((b) => b.coinId === coinId);
      
      if (!coinBalance) {
        return false;
      }

      return coinBalance.balance >= requiredAmount;
    } catch (error: any) {
      logger.error('Check balance error:', error.message);
      return false;
    }
  }

  // Deduct balance (via auth-service)
  static async deductBalance(
    userId: string,
    coinId: string,
    amount: number,
    orderId?: string
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        `${AUTH_SERVICE_URL}/api/v1/users/${userId}/balances/deduct`,
        {
          coinId,
          amount,
          orderId,
        },
        {
          headers: {
            'x-user-id': userId,
          },
        }
      );

      if (response.data.success) {
        // Publish event
        await publishEvent('wallet.balance.deducted', {
          userId,
          coinId,
          amount,
          orderId,
        });

        return true;
      }
      return false;
    } catch (error: any) {
      logger.error('Deduct balance error:', error.message);
      return false;
    }
  }

  // Add balance (via auth-service) - for P2P deposits
  static async addBalance(
    userId: string,
    coinId: string,
    amount: number,
    source: string = 'P2P'
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        `${AUTH_SERVICE_URL}/api/v1/users/${userId}/balances/add`,
        {
          coinId,
          amount,
          source,
        },
        {
          headers: {
            'x-user-id': userId,
          },
        }
      );

      if (response.data.success) {
        // Publish event
        await publishEvent('wallet.balance.added', {
          userId,
          coinId,
          amount,
          source,
        });

        return true;
      }
      return false;
    } catch (error: any) {
      logger.error('Add balance error:', error.message);
      return false;
    }
  }
}

