import { Request, Response } from 'express';
import MarketAnalysis from '../models/MarketAnalysis.model';
import { redisClient } from '../utils/redis';
import { updateMarketAnalysis } from '../services/analysis.service';
import logger from '../utils/logger';

const CACHE_TTL = 3600; // 1 hour

export class AnalysisController {
  // Get analysis for specific coin
  static async getCoinAnalysis(req: Request, res: Response) {
    try {
      const { coinId } = req.params;

      // Try cache
      const cacheKey = `analysis:${coinId}`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        return res.json({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
      }

      const analysis = await MarketAnalysis.findOne({ coinId })
        .sort({ lastUpdated: -1 });

      if (!analysis) {
        return res.status(404).json({
          success: false,
          error: 'Analysis not found',
        });
      }

      // Cache result
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(analysis));

      res.json({
        success: true,
        data: analysis,
      });
    } catch (error: any) {
      logger.error('Get coin analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch analysis',
      });
    }
  }

  // Get all analyses (top coins)
  static async getAllAnalyses(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10 } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Try cache
      const cacheKey = `analyses:${page}:${limit}`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        return res.json({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
      }

      const [analyses, total] = await Promise.all([
        MarketAnalysis.find()
          .sort({ marketCapRank: 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        MarketAnalysis.countDocuments(),
      ]);

      const result = {
        analyses,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };

      // Cache result
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Get all analyses error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch analyses',
      });
    }
  }

  // Get market summary
  static async getMarketSummary(req: Request, res: Response) {
    try {
      // Try cache
      const cacheKey = 'market:summary';
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        return res.json({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
      }

      const analyses = await MarketAnalysis.find()
        .sort({ marketCapRank: 1 })
        .limit(10);

      if (analyses.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No analysis data available',
        });
      }

      // Calculate market metrics
      const totalMarketCap = analyses.reduce((sum, a) => sum + a.marketCap, 0);
      const totalVolume = analyses.reduce((sum, a) => sum + a.totalVolume, 0);
      const averageChange24h = analyses.reduce((sum, a) => sum + a.priceChangePercentage24h, 0) / analyses.length;

      // Count sentiment
      const sentimentCounts = {
        VERY_BULLISH: 0,
        BULLISH: 0,
        NEUTRAL: 0,
        BEARISH: 0,
        VERY_BEARISH: 0,
      };

      analyses.forEach(a => {
        sentimentCounts[a.sentiment]++;
      });

      const overallSentiment = Object.entries(sentimentCounts)
        .sort((a, b) => b[1] - a[1])[0][0];

      const summary = {
        totalMarketCap,
        totalVolume,
        averageChange24h,
        topCoins: analyses.length,
        sentimentCounts,
        overallSentiment,
        lastUpdated: analyses[0].lastUpdated,
      };

      // Cache result
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(summary));

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      logger.error('Get market summary error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch market summary',
      });
    }
  }

  // Get trending analyses
  static async getTrendingAnalyses(req: Request, res: Response) {
    try {
      const { limit = 5 } = req.query;
      const limitNum = parseInt(limit as string);

      // Try cache
      const cacheKey = `trending:${limit}`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        return res.json({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
      }

      // Get coins with highest absolute price change
      const trending = await MarketAnalysis.find()
        .sort({ 'priceChangePercentage24h': -1 })
        .limit(limitNum)
        .lean();

      // Cache result
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(trending));

      res.json({
        success: true,
        data: trending,
      });
    } catch (error: any) {
      logger.error('Get trending analyses error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trending analyses',
      });
    }
  }

  // Manually trigger analysis update (admin only)
  static async triggerUpdate(req: Request, res: Response) {
    try {
      // Clear cache
      const keys = await redisClient.keys('analysis:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      await redisClient.del('market:summary');
      await redisClient.del('trending:*');

      // Trigger update
      await updateMarketAnalysis();

      res.json({
        success: true,
        message: 'Market analysis update triggered',
      });
    } catch (error: any) {
      logger.error('Trigger update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to trigger update',
      });
    }
  }
}

