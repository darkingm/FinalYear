import multiChainService from './MultiChainService';
import balanceService from './BalanceService';
import Wallet from '../models/Wallet.model';
import Transaction from '../models/Transaction.model';
import { validateAddress, validateAmount, toSmallestUnit } from '../utils/validation';
import { getNetworkConfig } from '../utils/networkUtils';
import { publishEvent } from '../utils/rabbitmq';
import logger from '../utils/logger';
import { ethers } from 'ethers';

interface TransferNativeParams {
  userId: string;
  networkId: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  gasPrice?: string;
  gasLimit?: number;
}

interface TransferTokenParams extends TransferNativeParams {
  tokenAddress: string;
  tokenDecimals: number;
}

class TransferService {
  /**
   * Decrypt private key from wallet
   */
  private async decryptPrivateKey(userId: string, networkId: string, address: string): Promise<string> {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Find address in wallet
    const walletAddress = wallet.addresses?.find(
      (addr) => addr.address === address && addr.networkId === networkId
    );

    if (!walletAddress) {
      throw new Error('Address not found in wallet');
    }

    // Decrypt private key
    const password = process.env.WALLET_ENCRYPTION_KEY || 'default_password_change_in_prod';
    try {
      const walletInstance = await ethers.Wallet.fromEncryptedJson(
        walletAddress.encryptedPrivateKey,
        password
      );
      return walletInstance.privateKey;
    } catch (error: any) {
      logger.error('Decrypt private key error:', error);
      throw new Error('Failed to decrypt private key');
    }
  }

  /**
   * Transfer native coin
   */
  async transferNative(params: TransferNativeParams): Promise<{
    txHash: string;
    networkId: string;
    status: string;
  }> {
    try {
      // Validate inputs
      if (!validateAddress(params.fromAddress, params.networkId)) {
        throw new Error('Invalid from address');
      }
      if (!validateAddress(params.toAddress, params.networkId)) {
        throw new Error('Invalid to address');
      }
      if (!validateAmount(params.amount)) {
        throw new Error('Invalid amount');
      }

      // Get network config
      const network = getNetworkConfig(params.networkId);
      if (!network) {
        throw new Error('Network not found');
      }

      // Check balance
      const balance = await balanceService.getNativeBalance(
        params.fromAddress,
        params.networkId,
        false
      );
      const balanceBN = parseFloat(balance.balance);
      const amountBN = parseFloat(params.amount);

      if (balanceBN < amountBN) {
        throw new Error('Insufficient balance');
      }

      // Decrypt private key
      const privateKey = await this.decryptPrivateKey(
        params.userId,
        params.networkId,
        params.fromAddress
      );

      // Get provider
      const provider = multiChainService.getProvider(params.networkId);

      // Transfer
      const result = await provider.transfer({
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        amount: params.amount,
        privateKey: privateKey,
        gasPrice: params.gasPrice,
        gasLimit: params.gasLimit,
      });

      // Save transaction to database
      const transaction = await Transaction.create({
        txHash: result.txHash,
        networkId: params.networkId,
        blockNumber: result.blockNumber,
        blockHash: result.blockHash,
        blockTimestamp: new Date(),
        from: params.fromAddress,
        to: params.toAddress,
        value: toSmallestUnit(params.amount, network.nativeCurrency.decimals),
        gasUsed: result.gasUsed ? parseInt(result.gasUsed) : undefined,
        gasPrice: result.gasPrice,
        confirmations: result.confirmations,
        type: 'TRANSFER_NATIVE',
        status: result.status === 'confirmed' ? 'CONFIRMED' : 'PENDING',
      });

      // Publish event
      await publishEvent('transaction.created', {
        txHash: result.txHash,
        networkId: params.networkId,
        type: 'TRANSFER_NATIVE',
        userId: params.userId,
      });

      // Update wallet balance cache
      await balanceService.updateWalletBalance(
        params.userId,
        params.networkId,
        params.fromAddress
      );

      logger.info('Native transfer completed:', {
        txHash: result.txHash,
        networkId: params.networkId,
      });

      return {
        txHash: result.txHash,
        networkId: params.networkId,
        status: result.status,
      };
    } catch (error: any) {
      logger.error('Transfer native error:', error);
      throw new Error(`Failed to transfer native coin: ${error.message}`);
    }
  }

  /**
   * Transfer token
   */
  async transferToken(params: TransferTokenParams): Promise<{
    txHash: string;
    networkId: string;
    status: string;
  }> {
    try {
      // Validate inputs
      if (!validateAddress(params.fromAddress, params.networkId)) {
        throw new Error('Invalid from address');
      }
      if (!validateAddress(params.toAddress, params.networkId)) {
        throw new Error('Invalid to address');
      }
      if (!validateAddress(params.tokenAddress, params.networkId)) {
        throw new Error('Invalid token address');
      }
      if (!validateAmount(params.amount)) {
        throw new Error('Invalid amount');
      }

      // Check token balance
      const balance = await balanceService.getTokenBalance(
        params.fromAddress,
        params.networkId,
        params.tokenAddress,
        false
      );
      const balanceBN = parseFloat(balance.balance);
      const amountBN = parseFloat(params.amount);

      if (balanceBN < amountBN) {
        throw new Error('Insufficient token balance');
      }

      // Check native balance for gas
      const network = getNetworkConfig(params.networkId);
      if (!network) {
        throw new Error('Network not found');
      }

      const nativeBalance = await balanceService.getNativeBalance(
        params.fromAddress,
        params.networkId,
        false
      );
      if (parseFloat(nativeBalance.balance) < 0.001) {
        throw new Error('Insufficient native balance for gas');
      }

      // Decrypt private key
      const privateKey = await this.decryptPrivateKey(
        params.userId,
        params.networkId,
        params.fromAddress
      );

      // Get provider
      const provider = multiChainService.getProvider(params.networkId);

      // Transfer token
      const result = await provider.transferToken({
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        amount: params.amount,
        privateKey: privateKey,
        tokenAddress: params.tokenAddress,
        decimals: params.tokenDecimals,
        gasPrice: params.gasPrice,
        gasLimit: params.gasLimit,
      });

      // Save transaction to database
      const transaction = await Transaction.create({
        txHash: result.txHash,
        networkId: params.networkId,
        blockNumber: result.blockNumber,
        blockHash: result.blockHash,
        blockTimestamp: new Date(),
        from: params.fromAddress,
        to: params.toAddress,
        value: toSmallestUnit(params.amount, params.tokenDecimals),
        contractAddress: params.tokenAddress,
        tokenDecimals: params.tokenDecimals,
        gasUsed: result.gasUsed ? parseInt(result.gasUsed) : undefined,
        gasPrice: result.gasPrice,
        confirmations: result.confirmations,
        type: 'TRANSFER_TOKEN',
        status: result.status === 'confirmed' ? 'CONFIRMED' : 'PENDING',
      });

      // Publish event
      await publishEvent('transaction.created', {
        txHash: result.txHash,
        networkId: params.networkId,
        type: 'TRANSFER_TOKEN',
        userId: params.userId,
        tokenAddress: params.tokenAddress,
      });

      // Update wallet balance cache
      await balanceService.updateWalletBalance(
        params.userId,
        params.networkId,
        params.fromAddress
      );

      logger.info('Token transfer completed:', {
        txHash: result.txHash,
        networkId: params.networkId,
        tokenAddress: params.tokenAddress,
      });

      return {
        txHash: result.txHash,
        networkId: params.networkId,
        status: result.status,
      };
    } catch (error: any) {
      logger.error('Transfer token error:', error);
      throw new Error(`Failed to transfer token: ${error.message}`);
    }
  }
}

export default new TransferService();



