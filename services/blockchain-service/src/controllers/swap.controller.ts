import { Request, Response } from 'express';
import swapService from '../services/SwapService';
import logger from '../utils/logger';

export class SwapController {
  /**
   * Get swap quote
   */
  static async getQuote(req: Request, res: Response) {
    try {
      const { networkId, fromToken, toToken, amount } = req.query;

      if (!networkId || !fromToken || !toToken || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: networkId, fromToken, toToken, amount',
        });
      }

      const quote = await swapService.getQuote({
        networkId: networkId as string,
        fromToken: fromToken as string,
        toToken: toToken as string,
        amount: amount as string,
      });

      res.json({
        success: true,
        data: quote,
      });
    } catch (error: any) {
      logger.error('Get swap quote error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get swap quote',
      });
    }
  }

  /**
   * Execute swap
   */
  static async swap(req: Request, res: Response) {
    try {
      const { userId, networkId, fromAddress, fromToken, toToken, amount, slippage } = req.body;

      if (!userId || !networkId || !fromAddress || !fromToken || !toToken || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: userId, networkId, fromAddress, fromToken, toToken, amount',
        });
      }

      const result = await swapService.swap({
        userId,
        networkId,
        fromAddress,
        fromToken,
        toToken,
        amount,
        slippage,
      });

      res.json({
        success: true,
        data: result,
        message: 'Swap executed successfully',
      });
    } catch (error: any) {
      logger.error('Swap error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to execute swap',
      });
    }
  }
}



