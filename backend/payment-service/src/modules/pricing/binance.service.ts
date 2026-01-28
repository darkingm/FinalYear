import axios from 'axios';
import { setCache, getCache } from '../../config/redis';
import { logger } from '../../utils/logger';

export class BinanceService {
  private readonly baseUrl = 'https://api.binance.com/api/v3';

  async getPrice(symbol: string): Promise<number> {
    // Check cache first (1 second TTL)
    const cached = await this.getCachedPrice(symbol);
    if (cached) {
      return cached;
    }

    // Fetch from Binance API
    try {
      const response = await axios.get(`${this.baseUrl}/ticker/price`, {
        params: { symbol },
      });

      const price = parseFloat(response.data.price);
      
      // Cache for 1 second
      await setCache(`price:${symbol}`, price, 1);
      
      return price;
    } catch (error) {
      logger.error('Error fetching price from Binance:', error);
      throw error;
    }
  }

  async getPrices(symbols: string[]): Promise<Record<string, number>> {
    try {
      const response = await axios.get(`${this.baseUrl}/ticker/price`, {
        params: {
          symbols: JSON.stringify(symbols),
        },
      });

      const prices: Record<string, number> = {};
      
      for (const item of response.data) {
        const price = parseFloat(item.price);
        prices[item.symbol] = price;
        
        // Cache each price
        await setCache(`price:${item.symbol}`, price, 1);
      }

      return prices;
    } catch (error) {
      logger.error('Error fetching prices from Binance:', error);
      throw error;
    }
  }

  async getCachedPrice(symbol: string): Promise<number | null> {
    return await getCache<number>(`price:${symbol}`);
  }

  async get24hrTicker(symbol: string) {
    try {
      const response = await axios.get(`${this.baseUrl}/ticker/24hr`, {
        params: { symbol },
      });

      return {
        symbol: response.data.symbol,
        price: parseFloat(response.data.lastPrice),
        change24h: parseFloat(response.data.priceChangePercent),
        high24h: parseFloat(response.data.highPrice),
        low24h: parseFloat(response.data.lowPrice),
        volume24h: parseFloat(response.data.volume),
      };
    } catch (error) {
      logger.error('Error fetching 24hr ticker:', error);
      throw error;
    }
  }
}
