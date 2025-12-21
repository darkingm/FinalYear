import { Request, Response } from 'express';
import transferService from '../services/TransferService';
import logger from '../utils/logger';

export class TransferController {
  /**
   * Transfer native coin
   */
  static async transferNative(req: Request, res: Response) {
    try {
      const { userId, networkId, fromAddress, toAddress, amount, gasPrice, gasLimit } = req.body;

      if (!userId || !networkId || !fromAddress || !toAddress || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: userId, networkId, fromAddress, toAddress, amount',
        });
      }

      const result = await transferService.transferNative({
        userId,
        networkId,
        fromAddress,
        toAddress,
        amount,
        gasPrice,
        gasLimit,
      });

      res.json({
        success: true,
        data: result,
        message: 'Transfer initiated successfully',
      });
    } catch (error: any) {
      logger.error('Transfer native error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to transfer native coin',
      });
    }
  }

  /**
   * Transfer token
   */
  static async transferToken(req: Request, res: Response) {
    try {
      const {
        userId,
        networkId,
        fromAddress,
        toAddress,
        tokenAddress,
        amount,
        tokenDecimals,
        gasPrice,
        gasLimit,
      } = req.body;

      if (!userId || !networkId || !fromAddress || !toAddress || !tokenAddress || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: userId, networkId, fromAddress, toAddress, tokenAddress, amount',
        });
      }

      const result = await transferService.transferToken({
        userId,
        networkId,
        fromAddress,
        toAddress,
        tokenAddress,
        amount,
        tokenDecimals: tokenDecimals || 18,
        gasPrice,
        gasLimit,
      });

      res.json({
        success: true,
        data: result,
        message: 'Token transfer initiated successfully',
      });
    } catch (error: any) {
      logger.error('Transfer token error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to transfer token',
      });
    }
  }
}



