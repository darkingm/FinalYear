import axios from 'axios';
import Coin from '../models/Coin.model';
import PriceHistory from '../models/PriceHistory.model';
import { redisClient } from '../utils/redis';
import logger from '../utils/logger';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const CACHE_KEY_TOP10 = 'coins:top10';
const CACHE_TTL = 60; // 1 minute

export const fetchCoinData = async (): Promise<void> => {
  try {
    logger.info('Fetching coin data from CoinGecko...');

    let response;
    try {
      response = await axios.get(`${COINGECKO_API}/coins/markets`, {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: 10,
          page: 1,
          sparkline: false,
          price_change_percentage: '24h',
        },
        headers: {
          'Accept': 'application/json',
          ...(process.env.COINGECKO_API_KEY && {
            'x-cg-demo-api-key': process.env.COINGECKO_API_KEY,
          }),
        },
        timeout: 10000, // 10 second timeout
      });
    } catch (apiError: any) {
      if (apiError.response?.status === 429) {
        logger.warn('CoinGecko rate limited. Using cached data.');
        return;
      }
      if (apiError.code === 'ECONNABORTED' || apiError.code === 'ETIMEDOUT') {
        logger.warn('CoinGecko API timeout. Using cached data.');
        return;
      }
      if (apiError.code === 'ENOTFOUND' || apiError.code === 'ECONNREFUSED') {
        logger.warn('CoinGecko API unavailable. Using cached data.');
        return;
      }
      throw apiError;
    }

    if (!response || !response.data || !Array.isArray(response.data)) {
      logger.warn('Invalid response from CoinGecko API');
      return;
    }

    const coins = response.data;

    // Update or create coins in database
    const updatePromises = coins.map(async (coinData: any) => {
      try {
        if (!coinData.id || !coinData.symbol || !coinData.name) {
          logger.warn('Invalid coin data, skipping:', coinData.id || 'unknown');
          return null;
        }

        const coin = await Coin.findOneAndUpdate(
          { coinId: coinData.id },
          {
            coinId: coinData.id,
            symbol: coinData.symbol?.toUpperCase() || '',
            name: coinData.name || '',
            image: coinData.image || '',
            currentPrice: coinData.current_price || 0,
            marketCap: coinData.market_cap || 0,
            marketCapRank: coinData.market_cap_rank || 999,
            fullyDilutedValuation: coinData.fully_diluted_valuation || 0,
            totalVolume: coinData.total_volume || 0,
            high24h: coinData.high_24h || 0,
            low24h: coinData.low_24h || 0,
            priceChange24h: coinData.price_change_24h || 0,
            priceChangePercentage24h: coinData.price_change_percentage_24h || 0,
            marketCapChange24h: coinData.market_cap_change_24h || 0,
            marketCapChangePercentage24h: coinData.market_cap_change_percentage_24h || 0,
            circulatingSupply: coinData.circulating_supply || 0,
            totalSupply: coinData.total_supply || 0,
            maxSupply: coinData.max_supply || 0,
            ath: coinData.ath || 0,
            athChangePercentage: coinData.ath_change_percentage || 0,
            athDate: coinData.ath_date ? new Date(coinData.ath_date) : new Date(),
            atl: coinData.atl || 0,
            atlChangePercentage: coinData.atl_change_percentage || 0,
            atlDate: coinData.atl_date ? new Date(coinData.atl_date) : new Date(),
            lastUpdated: coinData.last_updated ? new Date(coinData.last_updated) : new Date(),
          },
          { upsert: true, new: true }
        );

        // Save price history
        try {
          await PriceHistory.create({
            coinId: coinData.id,
            timestamp: new Date(),
            price: coinData.current_price || 0,
            volume: coinData.total_volume || 0,
            marketCap: coinData.market_cap || 0,
          });
        } catch (historyError: any) {
          logger.warn(`Failed to save price history for ${coinData.id}:`, historyError.message);
        }

        return coin;
      } catch (coinError: any) {
        logger.error(`Error updating coin ${coinData.id}:`, coinError.message);
        return null;
      }
    });

    const updatedCoins = (await Promise.all(updatePromises)).filter((coin) => coin !== null);

    // Cache in Redis (if available)
    try {
      await redisClient.setEx(
        CACHE_KEY_TOP10,
        CACHE_TTL,
        JSON.stringify(updatedCoins)
      );
    } catch (redisError: any) {
      logger.warn('Failed to cache coins in Redis:', redisError.message);
    }

    logger.info(`Successfully updated ${updatedCoins.length} coins`);
  } catch (error: any) {
    logger.error('Error fetching coin data:', error.message);
    // Don't throw - allow service to continue with cached/old data
  }
};

export const getTop10Coins = async () => {
  try {
    // Try cache first (if Redis is available)
    try {
      const cached = await redisClient.get(CACHE_KEY_TOP10);
      if (cached) {
        logger.debug('Returning cached top 10 coins');
        return JSON.parse(cached);
      }
    } catch (redisError: any) {
      logger.warn('Redis cache unavailable, using database:', redisError.message);
    }

    // Fallback to database
    const coins = await Coin.find()
      .sort({ marketCapRank: 1 })
      .limit(10)
      .lean();

    if (!coins || coins.length === 0) {
      logger.warn('No coins found in database. Returning empty array.');
      return [];
    }

    // Try to cache result (if Redis is available)
    try {
      await redisClient.setEx(
        CACHE_KEY_TOP10,
        CACHE_TTL,
        JSON.stringify(coins)
      );
    } catch (redisError: any) {
      logger.warn('Failed to cache coins:', redisError.message);
    }

    return coins;
  } catch (error: any) {
    logger.error('Error getting top 10 coins:', error.message);
    // Return empty array instead of throwing - allows frontend to handle gracefully
    return [];
  }
};

export const getCoinById = async (coinId: string) => {
  try {
    const coin = await Coin.findOne({ coinId }).lean();
    return coin;
  } catch (error) {
    logger.error('Error getting coin by id:', error);
    throw error;
  }
};

export const getCoinPriceHistory = async (
  coinId: string,
  days: number = 7
) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const history = await PriceHistory.find({
      coinId,
      timestamp: { $gte: startDate },
    })
      .sort({ timestamp: 1 })
      .lean();

    return history;
  } catch (error) {
    logger.error('Error getting price history:', error);
    throw error;
  }
};

export const searchCoins = async (query: string) => {
  try {
    const coins = await Coin.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { symbol: { $regex: query, $options: 'i' } },
      ],
    })
      .sort({ marketCapRank: 1 })
      .limit(20)
      .lean();

    return coins;
  } catch (error) {
    logger.error('Error searching coins:', error);
    throw error;
  }
};

