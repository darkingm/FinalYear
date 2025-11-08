import { Request, Response } from 'express';
import blockchainService from '../services/blockchain.service';
import logger from '../utils/logger';

export class TokenController {
  // Mint new token (tokenize asset)
  static async mintToken(req: Request, res: Response) {
    try {
      const {
        productId,
        ownerId,
        ownerAddress,
        name,
        symbol,
        assetDescription,
        assetValue,
        assetImages,
      } = req.body;

      const result = await blockchainService.mintToken({
        productId,
        ownerId,
        ownerAddress,
        name,
        symbol,
        assetDescription,
        assetValue,
        assetImages: assetImages || [],
      });

      res.status(201).json({
        success: true,
        data: result,
        message: 'Token minted successfully',
      });
    } catch (error: any) {
      logger.error('Mint token error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to mint token',
      });
    }
  }

  // Transfer token
  static async transferToken(req: Request, res: Response) {
    try {
      const { tokenId, fromAddress, toAddress, fromUserId, toUserId } = req.body;

      const result = await blockchainService.transferToken({
        tokenId,
        fromAddress,
        toAddress,
        fromUserId,
        toUserId,
      });

      res.json({
        success: true,
        data: result,
        message: 'Token transferred successfully',
      });
    } catch (error: any) {
      logger.error('Transfer token error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to transfer token',
      });
    }
  }

  // Get token details
  static async getTokenDetails(req: Request, res: Response) {
    try {
      const { tokenId } = req.params;

      const token = await blockchainService.getTokenDetails(tokenId);

      res.json({
        success: true,
        data: token,
      });
    } catch (error: any) {
      logger.error('Get token details error:', error);
      res.status(404).json({
        success: false,
        error: error.message || 'Token not found',
      });
    }
  }

  // Get user's tokens
  static async getUserTokens(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const tokens = await blockchainService.getUserTokens(userId);

      res.json({
        success: true,
        data: tokens,
        count: tokens.length,
      });
    } catch (error: any) {
      logger.error('Get user tokens error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user tokens',
      });
    }
  }

  // Get tokens by product
  static async getTokensByProduct(req: Request, res: Response) {
    try {
      const { productId } = req.params;

      // Import Token model here to avoid circular dependency
      const Token = (await import('../models/Token.model')).default;
      const tokens = await Token.find({ productId, status: { $ne: 'BURNED' } });

      res.json({
        success: true,
        data: tokens,
        count: tokens.length,
      });
    } catch (error: any) {
      logger.error('Get tokens by product error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch product tokens',
      });
    }
  }

  // Verify token ownership
  static async verifyOwnership(req: Request, res: Response) {
    try {
      const { tokenId } = req.params;
      const { userId, address } = req.query;

      const token = await blockchainService.getTokenDetails(tokenId);

      const isOwner =
        token.ownerId === userId || token.ownerAddress === address;

      res.json({
        success: true,
        data: {
          isOwner,
          currentOwner: token.ownerId,
          currentAddress: token.ownerAddress,
        },
      });
    } catch (error: any) {
      logger.error('Verify ownership error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify ownership',
      });
    }
  }
}

