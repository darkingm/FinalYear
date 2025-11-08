import { Request, Response } from 'express';
import blockchainService from '../services/blockchain.service';
import Wallet from '../models/Wallet.model';
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

      const balance = await blockchainService.getWalletBalance(address);

      res.json({
        success: true,
        data: {
          address,
          balance,
        },
      });
    } catch (error: any) {
      logger.error('Get balance error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch balance',
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

