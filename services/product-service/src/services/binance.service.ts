import axios from 'axios';
import Coin from '../models/Coin.model';
import PriceHistory from '../models/PriceHistory.model';
import { redisClient } from '../utils/redis';
import realtimePriceService from './realtimePrice.service';
import logger from '../utils/logger';

const BINANCE_API = 'https://api.binance.com/api/v3';
const COINBASE_API = 'https://api.coinbase.com/v2';

// Mapping of common coin symbols to Binance trading pairs
const BINANCE_SYMBOL_MAP: Record<string, string> = {
  'BTC': 'BTCUSDT',
  'ETH': 'ETHUSDT',
  'USDT': 'USDT',
  'BNB': 'BNBUSDT',
  'SOL': 'SOLUSDT',
  'XRP': 'XRPUSDT',
  'ADA': 'ADAUSDT',
  'DOGE': 'DOGEUSDT',
  'DOT': 'DOTUSDT',
  'MATIC': 'MATICUSDT',
  'AVAX': 'AVAXUSDT',
  'LINK': 'LINKUSDT',
  'UNI': 'UNIUSDT',
  'LTC': 'LTCUSDT',
  'BCH': 'BCHUSDT',
  'ATOM': 'ATOMUSDT',
  'ETC': 'ETCUSDT',
  'XLM': 'XLMUSDT',
  'ALGO': 'ALGOUSDT',
  'VET': 'VETUSDT',
  'FIL': 'FILUSDT',
  'TRX': 'TRXUSDT',
  'EOS': 'EOSUSDT',
  'AAVE': 'AAVEUSDT',
  'MKR': 'MKRUSDT',
  'COMP': 'COMPUSDT',
  'SUSHI': 'SUSHIUSDT',
  'YFI': 'YFIUSDT',
};

// Coinbase symbol mapping
const COINBASE_SYMBOL_MAP: Record<string, string> = {
  'BTC': 'BTC-USD',
  'ETH': 'ETH-USD',
  'USDT': 'USDT-USD',
  'BNB': 'BNB-USD',
  'SOL': 'SOL-USD',
  'XRP': 'XRP-USD',
  'ADA': 'ADA-USD',
  'DOGE': 'DOGE-USD',
  'DOT': 'DOT-USD',
  'MATIC': 'MATIC-USD',
  'AVAX': 'AVAX-USD',
  'LINK': 'LINK-USD',
  'UNI': 'UNI-USD',
  'LTC': 'LTC-USD',
  'BCH': 'BCH-USD',
};

interface BinanceTicker {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  bidPrice: string;
  askPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

interface CoinbasePrice {
  data: {
    base: string;
    currency: string;
    amount: string;
  };
}

/**
 * Fetch real-time price from Binance
 */
export const fetchPriceFromBinance = async (symbol: string): Promise<number | null> => {
  try {
    const tradingPair = BINANCE_SYMBOL_MAP[symbol.toUpperCase()] || `${symbol.toUpperCase()}USDT`;
    
    const response = await axios.get<BinanceTicker>(`${BINANCE_API}/ticker/24hr`, {
      params: { symbol: tradingPair },
      timeout: 5000,
    });

    if (response.data && response.data.price) {
      return parseFloat(response.data.price);
    }
    return null;
  } catch (error: any) {
    logger.warn(`Failed to fetch ${symbol} price from Binance:`, error.message);
    return null;
  }
};

/**
 * Fetch real-time price from Coinbase
 */
export const fetchPriceFromCoinbase = async (symbol: string): Promise<number | null> => {
  try {
    const tradingPair = COINBASE_SYMBOL_MAP[symbol.toUpperCase()] || `${symbol.toUpperCase()}-USD`;
    
    const response = await axios.get<CoinbasePrice>(`${COINBASE_API}/prices/${tradingPair}/spot`, {
      timeout: 5000,
    });

    if (response.data && response.data.data && response.data.data.amount) {
      return parseFloat(response.data.data.amount);
    }
    return null;
  } catch (error: any) {
    logger.warn(`Failed to fetch ${symbol} price from Coinbase:`, error.message);
    return null;
  }
};

/**
 * Fetch price with fallback: Binance -> Coinbase -> Cache
 */
export const fetchPriceWithFallback = async (symbol: string): Promise<number | null> => {
  // Try Binance first
  let price = await fetchPriceFromBinance(symbol);
  if (price !== null) {
    return price;
  }

  // Fallback to Coinbase
  price = await fetchPriceFromCoinbase(symbol);
  if (price !== null) {
    return price;
  }

  // Fallback to cache/DB
  try {
    const cacheKey = `coin:price:${symbol.toLowerCase()}`;
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const cachedData = JSON.parse(cached);
        return cachedData.currentPrice || null;
      }
    }

    // Try database
    const coin = await Coin.findOne({
      $or: [
        { symbol: symbol.toUpperCase() },
        { coinId: symbol.toLowerCase() },
      ],
    });

    if (coin && coin.currentPrice) {
      return coin.currentPrice;
    }
  } catch (error: any) {
    logger.warn(`Failed to get cached price for ${symbol}:`, error.message);
  }

  return null;
};

/**
 * Fetch multiple coin prices from Binance
 */
export const fetchMultiplePricesFromBinance = async (symbols: string[]): Promise<Record<string, number>> => {
  const prices: Record<string, number> = {};
  
  try {
    // Fetch all tickers at once
    const response = await axios.get<BinanceTicker[]>(`${BINANCE_API}/ticker/24hr`, {
      timeout: 10000,
    });

    if (response.data && Array.isArray(response.data)) {
      response.data.forEach((ticker) => {
        // Extract base symbol from trading pair (e.g., BTCUSDT -> BTC)
        const baseSymbol = ticker.symbol.replace('USDT', '').replace('USD', '');
        if (symbols.includes(baseSymbol)) {
          prices[baseSymbol] = parseFloat(ticker.price);
        }
      });
    }
  } catch (error: any) {
    logger.warn('Failed to fetch multiple prices from Binance:', error.message);
  }

  // Fill missing prices with individual requests
  for (const symbol of symbols) {
    if (!prices[symbol]) {
      const price = await fetchPriceFromBinance(symbol);
      if (price !== null) {
        prices[symbol] = price;
      }
    }
  }

  return prices;
};

/**
 * Update coin prices from Binance/Coinbase
 */
export const updateCoinPricesFromExchanges = async (): Promise<void> => {
  try {
    logger.info('Fetching coin prices from Binance/Coinbase...');

    // Get all active coins from database
    const coins = await Coin.find({}).limit(50).lean();
    
    if (!coins || coins.length === 0) {
      logger.warn('No coins found in database');
      return;
    }

    const symbols = coins.map(coin => coin.symbol);
    
    // Fetch prices from Binance (batch)
    const prices = await fetchMultiplePricesFromBinance(symbols);

    // Update coins in database
    const updatePromises = coins.map(async (coin) => {
      try {
        const symbol = coin.symbol;
        let newPrice = prices[symbol];

        // If not found in batch, try individual fetch
        if (!newPrice) {
          newPrice = await fetchPriceWithFallback(symbol);
        }

        if (newPrice !== null && newPrice > 0) {
          // Calculate price change percentage
          const oldPrice = coin.currentPrice || 0;
          const priceChange = newPrice - oldPrice;
          const priceChangePercent = oldPrice > 0 ? (priceChange / oldPrice) * 100 : 0;

          // Update coin
          await Coin.findOneAndUpdate(
            { _id: coin._id },
            {
              currentPrice: newPrice,
              priceChange24h: priceChange,
              priceChangePercentage24h: priceChangePercent,
              lastUpdated: new Date(),
            },
            { new: true }
          );

          // Save price history
          try {
            await PriceHistory.create({
              coinId: coin.coinId || coin.symbol.toLowerCase(),
              timestamp: new Date(),
              price: newPrice,
              volume: coin.totalVolume || 0,
              marketCap: coin.marketCap || 0,
            });
          } catch (historyError: any) {
            logger.warn(`Failed to save price history for ${symbol}:`, historyError.message);
          }

          // Update realtime price service
          try {
            await realtimePriceService.updateCoinPrice(
              coin.coinId || coin.symbol.toLowerCase(),
              newPrice,
              priceChangePercent
            );
          } catch (realtimeError: any) {
            logger.warn(`Failed to update realtime price for ${symbol}:`, realtimeError.message);
          }

          // Cache in Redis
          try {
            if (redisClient.isOpen) {
              const cacheKey = `coin:price:${symbol.toLowerCase()}`;
              await redisClient.setEx(
                cacheKey,
                30, // 30 seconds TTL
                JSON.stringify({
                  currentPrice: newPrice,
                  priceChangePercentage24h: priceChangePercent,
                  lastUpdate: new Date().toISOString(),
                })
              );
            }
          } catch (redisError: any) {
            logger.warn(`Failed to cache price for ${symbol}:`, redisError.message);
          }
        }
      } catch (coinError: any) {
        logger.error(`Error updating coin ${coin.symbol}:`, coinError.message);
      }
    });

    await Promise.all(updatePromises);
    logger.info(`Successfully updated prices for ${Object.keys(prices).length} coins`);
  } catch (error: any) {
    logger.error('Error updating coin prices from exchanges:', error.message);
  }
};

/**
 * Get real-time price for a specific coin
 */
export const getRealtimePrice = async (symbol: string): Promise<number | null> => {
  return await fetchPriceWithFallback(symbol);
};

