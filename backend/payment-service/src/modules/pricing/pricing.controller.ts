import { Request, Response, NextFunction } from 'express';
import { BinanceService } from './binance.service';
import { logger } from '../../utils/logger';

const binanceService = new BinanceService();

export async function getCurrentPrices(req: Request, res: Response, next: NextFunction) {
  try {
    const symbols = req.query.symbols as string;
    
    if (!symbols) {
      return res.status(400).json({
        success: false,
        message: 'symbols parameter is required',
      });
    }

    const symbolArray = symbols.split(',');
    const prices = await binanceService.getPrices(symbolArray);
    
    res.json({
      success: true,
      prices,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    logger.error('Get current prices error:', error);
    next(error);
  }
}

export async function getCachedPrices(req: Request, res: Response, next: NextFunction) {
  try {
    const symbols = req.query.symbols as string;
    
    if (!symbols) {
      return res.status(400).json({
        success: false,
        message: 'symbols parameter is required',
      });
    }

    const symbolArray = symbols.split(',');
    const prices: any = {};
    
    for (const symbol of symbolArray) {
      const price = await binanceService.getCachedPrice(symbol);
      if (price) {
        prices[symbol] = price;
      }
    }
    
    res.json({
      success: true,
      prices,
      cached: true,
    });
  } catch (error: any) {
    logger.error('Get cached prices error:', error);
    next(error);
  }
}
