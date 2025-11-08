import { Request, Response } from 'express';
import {
  getTop10Coins,
  getCoinById,
  getCoinPriceHistory,
  searchCoins,
} from '../services/coinmarket.service';
import logger from '../utils/logger';

export class CoinController {
  // Get top 10 coins
  static async getTop10(req: Request, res: Response) {
    try {
      const coins = await getTop10Coins();

      if (!coins || coins.length === 0) {
        logger.warn('No coins available. Returning empty array.');
        return res.json({
          success: true,
          data: {
            coins: [],
            lastUpdated: new Date(),
            message: 'No coin data available. Please try again later.',
          },
        });
      }

      res.json({
        success: true,
        data: {
          coins,
          lastUpdated: new Date(),
          count: coins.length,
        },
      });
    } catch (error: any) {
      logger.error('Get top 10 coins error:', error.message || error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch coin data',
        message: error.message || 'An unexpected error occurred',
      });
    }
  }

  // Get coin by ID
  static async getCoin(req: Request, res: Response) {
    try {
      const { coinId } = req.params;

      const coin = await getCoinById(coinId);

      if (!coin) {
        return res.status(404).json({
          success: false,
          error: 'Coin not found',
        });
      }

      res.json({
        success: true,
        data: coin,
      });
    } catch (error: any) {
      logger.error('Get coin error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch coin data',
      });
    }
  }

  // Get coin price history
  static async getPriceHistory(req: Request, res: Response) {
    try {
      const { coinId } = req.params;
      const days = parseInt(req.query.days as string) || 7;

      const history = await getCoinPriceHistory(coinId, days);

      res.json({
        success: true,
        data: {
          coinId,
          days,
          history,
        },
      });
    } catch (error: any) {
      logger.error('Get price history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch price history',
      });
    }
  }

  // Search coins
  static async search(req: Request, res: Response) {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Search query required',
        });
      }

      const coins = await searchCoins(q);

      res.json({
        success: true,
        data: {
          query: q,
          results: coins,
          count: coins.length,
        },
      });
    } catch (error: any) {
      logger.error('Search coins error:', error);
      res.status(500).json({
        success: false,
        error: 'Search failed',
      });
    }
  }
}

