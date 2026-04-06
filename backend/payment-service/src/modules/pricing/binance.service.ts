import axios from 'axios';
import { setCache, getCache } from '../../config/redis';
import { logger } from '../../utils/logger';

export class BinanceService {
  private readonly baseUrl = 'https://api.binance.com/api/v3';

  // Stablecoins pegged ~1:1 with USD – no valid Binance *USDT pair
  private readonly stablecoins = new Set(['USDTUSDT', 'USDCUSDT', 'DAIUSDT', 'BUSDUSDT']);

  async getPrice(symbol: string): Promise<number> {
    // Stablecoin shortcut: 1 USDT ≈ 1 USD
    if (this.stablecoins.has(symbol)) {
      return 1.0;
    }

    // Check cache first (1 second TTL)
    const cached = await this.getCachedPrice(symbol);
    if (cached) {
      if (cached === -1) throw new Error(`Cả Binance và CoinGecko đều đang rớt mạng cho ${symbol} (Đã chặn bởi Circuit Breaker)`);
      return cached;
    }

    // Fetch from Binance API
    try {
      const response = await axios.get(`${this.baseUrl}/ticker/price`, {
        params: { symbol },
        timeout: 3000, // Thêm timeout tránh bị treo
      });

      const price = parseFloat(response.data.price);

      // Cache for 1 second
      await setCache(`price:${symbol}`, price, 1);

      return price;
    } catch (error) {
      logger.error(`Error fetching price from Binance for ${symbol}, attempting fallback...`, error);

      // CoinGecko Fallback Map
      const cgMap: Record<string, string> = {
        'ETHUSDT': 'ethereum',
        'MATICUSDT': 'matic-network',
        'BNBUSDT': 'binancecoin',
        'BTCUSDT': 'bitcoin',
        'ARBUSDT': 'arbitrum'
      };
      
      const cgId = cgMap[symbol];
      if (cgId) {
        try {
          const cgResp = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`, {
            timeout: 3000
          });
          if (cgResp.data[cgId]?.usd) {
            const price = parseFloat(cgResp.data[cgId].usd);
            logger.info(`CoinGecko fallback successful for ${symbol}: $${price}`);
            await setCache(`price:${symbol}`, price, 1);
            return price;
          }
        } catch(fallbackErr) {
          logger.error(`CoinGecko fallback also failed for ${symbol}:`, fallbackErr);
        }
      }

      // Negative Cache cho Circuit Breaker (10s)
      await setCache(`price:${symbol}`, -1, 10);
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
