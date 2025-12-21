import multiChainService from './MultiChainService';
import Wallet from '../models/Wallet.model';
import { redisClient } from '../utils/redis';
import { CACHE_TTL } from '../config/constants';
import { validateAddress } from '../utils/validation';
import logger from '../utils/logger';
import { ethers } from 'ethers';

class BalanceService {
  /**
   * Get native coin balance for an address on a network
   */
  async getNativeBalance(address: string, networkId: string, useCache: boolean = true): Promise<{
    balance: string;
    decimals: number;
    symbol: string;
  }> {
    // Validate address
    if (!validateAddress(address, networkId)) {
      throw new Error('Invalid address for network');
    }

    // Check cache
    const cacheKey = `balance:${networkId}:${address}:native`;
    if (useCache) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    try {
      // Get provider
      const provider = multiChainService.getProvider(networkId);
      
      // Get balance from blockchain
      const balanceResult = await provider.getBalance(address);

      // Cache result
      if (useCache) {
        await redisClient.setEx(cacheKey, CACHE_TTL.BALANCE, JSON.stringify(balanceResult));
      }

      return balanceResult;
    } catch (error: any) {
      logger.error('Get native balance error:', error);
      throw new Error(`Failed to get native balance: ${error.message}`);
    }
  }

  /**
   * Get token balance for an address on a network
   */
  async getTokenBalance(
    address: string,
    networkId: string,
    tokenAddress: string,
    useCache: boolean = true
  ): Promise<{
    balance: string;
    decimals: number;
    symbol: string;
  }> {
    // Validate addresses
    if (!validateAddress(address, networkId)) {
      throw new Error('Invalid address for network');
    }
    if (!validateAddress(tokenAddress, networkId)) {
      throw new Error('Invalid token address for network');
    }

    // Check cache
    const cacheKey = `balance:${networkId}:${address}:token:${tokenAddress}`;
    if (useCache) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    try {
      // Get provider
      const provider = multiChainService.getProvider(networkId);
      
      // Get token balance from blockchain
      const balanceResult = await provider.getTokenBalance(address, tokenAddress);

      // Cache result
      if (useCache) {
        await redisClient.setEx(cacheKey, CACHE_TTL.BALANCE, JSON.stringify(balanceResult));
      }

      return balanceResult;
    } catch (error: any) {
      logger.error('Get token balance error:', error);
      throw new Error(`Failed to get token balance: ${error.message}`);
    }
  }

  /**
   * Get all balances for a wallet address on a network
   */
  async getAllBalances(address: string, networkId: string): Promise<{
    native: {
      balance: string;
      decimals: number;
      symbol: string;
    };
    tokens: Array<{
      contractAddress: string;
      balance: string;
      decimals: number;
      symbol: string;
    }>;
  }> {
    try {
      // Get native balance
      const nativeBalance = await this.getNativeBalance(address, networkId);

      // Get token balances from database (if stored)
      const wallet = await Wallet.findOne({
        $or: [
          { 'addresses.address': address, 'addresses.networkId': networkId },
          { address: address }, // Legacy support
        ],
      });

      const tokens: Array<{
        contractAddress: string;
        balance: string;
        decimals: number;
        symbol: string;
      }> = [];

      if (wallet) {
        const walletAddress = wallet.addresses?.find(
          (addr) => addr.address === address && addr.networkId === networkId
        );

        if (walletAddress?.tokenBalances) {
          for (const tokenBalance of walletAddress.tokenBalances) {
            try {
              // Refresh token balance from blockchain
              const balance = await this.getTokenBalance(
                address,
                networkId,
                tokenBalance.contractAddress,
                false
              );
              tokens.push({
                contractAddress: tokenBalance.contractAddress,
                balance: balance.balance,
                decimals: balance.decimals,
                symbol: balance.symbol,
              });
            } catch (error) {
              // Skip if token balance fetch fails
              logger.warn(`Failed to get token balance for ${tokenBalance.contractAddress}:`, error);
            }
          }
        }
      }

      return {
        native: nativeBalance,
        tokens,
      };
    } catch (error: any) {
      logger.error('Get all balances error:', error);
      throw new Error(`Failed to get all balances: ${error.message}`);
    }
  }

  /**
   * Update wallet balance in database
   */
  async updateWalletBalance(
    userId: string,
    networkId: string,
    address: string
  ): Promise<void> {
    try {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Get balances from blockchain
      const balances = await this.getAllBalances(address, networkId);

      // Update wallet address balance
      const walletAddressIndex = wallet.addresses?.findIndex(
        (addr) => addr.address === address && addr.networkId === networkId
      );

      if (walletAddressIndex !== undefined && walletAddressIndex >= 0) {
        wallet.addresses[walletAddressIndex].balance = balances.native.balance;
        wallet.addresses[walletAddressIndex].tokenBalances = balances.tokens.map((token) => ({
          contractAddress: token.contractAddress,
          symbol: token.symbol,
          balance: token.balance,
          decimals: token.decimals,
        }));
        await wallet.save();
      } else {
        // Create new address entry if not exists
        if (!wallet.addresses) {
          wallet.addresses = [];
        }
        wallet.addresses.push({
          networkId,
          address,
          encryptedPrivateKey: '', // Should be set when creating wallet
          balance: balances.native.balance,
          tokenBalances: balances.tokens.map((token) => ({
            contractAddress: token.contractAddress,
            symbol: token.symbol,
            balance: token.balance,
            decimals: token.decimals,
          })),
          isActive: true,
          isVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        await wallet.save();
      }

      // Clear cache
      const cacheKey = `balance:${networkId}:${address}:native`;
      await redisClient.del(cacheKey);
    } catch (error: any) {
      logger.error('Update wallet balance error:', error);
      throw new Error(`Failed to update wallet balance: ${error.message}`);
    }
  }
}

export default new BalanceService();



