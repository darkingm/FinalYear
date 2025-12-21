import { Request, Response } from 'express';
import blockchainService from '../services/blockchain.service';
import balanceService from '../services/BalanceService';
import multiChainService from '../services/MultiChainService';
import Wallet from '../models/Wallet.model';
import { ethers } from 'ethers';
import { getNetworkConfig } from '../utils/networkUtils';
import logger from '../utils/logger';

export class WalletController {
  // Create wallet for user
  static async createWallet(req: Request, res: Response) {
    try {
      const { userId } = req.body;

      // Check if wallet already exists
      const existingWallet = await Wallet.findOne({ userId });
      if (existingWallet) {
        return res.status(400).json({
          success: false,
          error: 'Wallet already exists for this user',
        });
      }

      const wallet = await blockchainService.createWallet(userId);

      res.status(201).json({
        success: true,
        data: wallet,
        message: 'Wallet created successfully',
      });
    } catch (error: any) {
      logger.error('Create wallet error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create wallet',
      });
    }
  }

  // Get wallet by user ID
  static async getWalletByUserId(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const wallet = await Wallet.findOne({ userId }).select('-encryptedPrivateKey');

      if (!wallet) {
        return res.status(404).json({
          success: false,
          error: 'Wallet not found',
        });
      }

      res.json({
        success: true,
        data: wallet,
      });
    } catch (error: any) {
      logger.error('Get wallet error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch wallet',
      });
    }
  }

  // Get wallet by address
  static async getWalletByAddress(req: Request, res: Response) {
    try {
      const { address } = req.params;

      const wallet = await Wallet.findOne({ address }).select('-encryptedPrivateKey');

      if (!wallet) {
        return res.status(404).json({
          success: false,
          error: 'Wallet not found',
        });
      }

      res.json({
        success: true,
        data: wallet,
      });
    } catch (error: any) {
      logger.error('Get wallet by address error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch wallet',
      });
    }
  }

  // Get wallet balance
  static async getBalance(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const { networkId } = req.query;

      if (networkId) {
        // Multi-chain balance
        const balance = await balanceService.getNativeBalance(
          address as string,
          networkId as string
        );
        res.json({
          success: true,
          data: {
            address,
            networkId,
            balance,
          },
        });
      } else {
        // Legacy balance
        const balance = await blockchainService.getWalletBalance(address);
        res.json({
          success: true,
          data: {
            address,
            balance,
          },
        });
      }
    } catch (error: any) {
      logger.error('Get balance error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch balance',
      });
    }
  }

  // Create wallet for specific network
  static async createNetworkWallet(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { networkId } = req.body;

      if (!networkId) {
        return res.status(400).json({
          success: false,
          error: 'Network ID is required',
        });
      }

      // Get or create wallet
      let wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        // Create new wallet
        const newWallet = await blockchainService.createWallet(userId);
        wallet = await Wallet.findOne({ userId });
      }

      if (!wallet) {
        throw new Error('Failed to create wallet');
      }

      // Check if address already exists for this network
      const existingAddress = wallet.addresses?.find(
        (addr) => addr.networkId === networkId
      );

      if (existingAddress) {
        return res.json({
          success: true,
          data: {
            address: existingAddress.address,
            networkId,
          },
          message: 'Wallet address already exists for this network',
        });
      }

      // Get network config
      const network = getNetworkConfig(networkId);
      if (!network) {
        return res.status(400).json({
          success: false,
          error: 'Network not found',
        });
      }

      // Generate new wallet address for network
      let newWalletInstance;
      let address: string;
      let privateKey: string;

      if (network.type === 'EVM') {
        newWalletInstance = ethers.Wallet.createRandom();
        address = newWalletInstance.address;
        privateKey = newWalletInstance.privateKey;
      } else if (network.type === 'BITCOIN') {
        // For Bitcoin, we'll use a simple approach
        // In production, use proper Bitcoin wallet generation
        newWalletInstance = ethers.Wallet.createRandom();
        address = newWalletInstance.address; // This is a placeholder
        privateKey = newWalletInstance.privateKey;
      } else {
        throw new Error('Unsupported network type');
      }

      // Encrypt private key
      const password = process.env.WALLET_ENCRYPTION_KEY || 'default_password_change_in_prod';
      const encryptedPrivateKey = await newWalletInstance.encrypt(password);

      // Add address to wallet
      if (!wallet.addresses) {
        wallet.addresses = [];
      }

      wallet.addresses.push({
        networkId,
        address,
        encryptedPrivateKey,
        balance: '0',
        tokenBalances: [],
        isActive: true,
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await wallet.save();

      res.status(201).json({
        success: true,
        data: {
          address,
          networkId,
        },
        message: 'Network wallet created successfully',
      });
    } catch (error: any) {
      logger.error('Create network wallet error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create network wallet',
      });
    }
  }

  // Get all balances for wallet
  static async getAllBalances(req: Request, res: Response) {
    try {
      const { address, networkId } = req.params;

      if (!networkId) {
        return res.status(400).json({
          success: false,
          error: 'Network ID is required',
        });
      }

      const balances = await balanceService.getAllBalances(address, networkId);

      res.json({
        success: true,
        data: balances,
      });
    } catch (error: any) {
      logger.error('Get all balances error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch balances',
      });
    }
  }

  // Verify wallet
  static async verifyWallet(req: Request, res: Response) {
    try {
      const { address } = req.params;

      const wallet = await Wallet.findOne({ address });

      if (!wallet) {
        return res.status(404).json({
          success: false,
          error: 'Wallet not found',
        });
      }

      wallet.isVerified = true;
      await wallet.save();

      res.json({
        success: true,
        message: 'Wallet verified successfully',
      });
    } catch (error: any) {
      logger.error('Verify wallet error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify wallet',
      });
    }
  }
}

