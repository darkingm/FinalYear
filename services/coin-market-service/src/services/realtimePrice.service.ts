import { Server } from 'socket.io';
import Coin from '../models/Coin.model';
import { redisClient } from '../utils/redis';
import logger from '../utils/logger';

// Realtime price update service via WebSocket
class RealtimePriceService {
  private io: Server | null = null;
  private priceUpdateInterval: NodeJS.Timeout | null = null;
  private subscribers = new Map<string, Set<string>>(); // coinId -> Set of socketIds

  // Initialize with Socket.IO server
  initialize(io: Server) {
    this.io = io;
    this.setupSocketHandlers();
    this.startPriceUpdates();
    logger.info('Realtime Price Service initialized');
  }

  // Setup Socket.IO handlers
  private setupSocketHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      logger.info('Client connected to price service:', socket.id);

      // Subscribe to coin prices
      socket.on('price:subscribe', (coinIds: string | string[]) => {
        const ids = Array.isArray(coinIds) ? coinIds : [coinIds];
        
        ids.forEach((coinId) => {
          if (!this.subscribers.has(coinId)) {
            this.subscribers.set(coinId, new Set());
          }
          this.subscribers.get(coinId)!.add(socket.id);
          logger.debug(`Socket ${socket.id} subscribed to ${coinId}`);
        });

        // Send initial prices
        this.sendPricesToSocket(socket, ids);
      });

      // Unsubscribe from coin prices
      socket.on('price:unsubscribe', (coinIds: string | string[]) => {
        const ids = Array.isArray(coinIds) ? coinIds : [coinIds];
        
        ids.forEach((coinId) => {
          this.subscribers.get(coinId)?.delete(socket.id);
          if (this.subscribers.get(coinId)?.size === 0) {
            this.subscribers.delete(coinId);
          }
        });
      });

      // Disconnect cleanup
      socket.on('disconnect', () => {
        this.subscribers.forEach((socketIds, coinId) => {
          socketIds.delete(socket.id);
          if (socketIds.size === 0) {
            this.subscribers.delete(coinId);
          }
        });
        logger.debug(`Socket ${socket.id} disconnected from price service`);
      });
    });
  }

  // Start periodic price updates
  private startPriceUpdates() {
    // Update prices every 5 seconds
    this.priceUpdateInterval = setInterval(() => {
      this.broadcastPriceUpdates();
    }, 5000);

    logger.info('Price update interval started (5 seconds)');
  }

  // Broadcast price updates to all subscribers
  private async broadcastPriceUpdates() {
    if (!this.io || this.subscribers.size === 0) return;

    try {
      // Get all subscribed coin IDs
      const coinIds = Array.from(this.subscribers.keys());

      // Fetch prices from Redis cache or DB
      const prices = await this.getCoinPrices(coinIds);

      // Broadcast to each coin's subscribers
      this.subscribers.forEach((socketIds, coinId) => {
        const price = prices[coinId];
        if (price) {
          socketIds.forEach((socketId) => {
            this.io!.to(socketId).emit('price:update', {
              coinId,
              price: price.currentPrice,
              priceUSD: price.currentPrice,
              priceChange24h: price.priceChangePercentage24h,
              timestamp: new Date().toISOString(),
            });
          });
        }
      });
    } catch (error: any) {
      logger.error('Error broadcasting price updates:', error.message);
    }
  }

  // Get coin prices (from Redis cache or DB)
  private async getCoinPrices(coinIds: string[]): Promise<Record<string, any>> {
    const prices: Record<string, any> = {};

    try {
      // Try to get from Redis cache first
      for (const coinId of coinIds) {
        const cacheKey = `coin:price:${coinId}`;
        const cached = await redisClient.get(cacheKey);
        
        if (cached) {
          try {
            prices[coinId] = JSON.parse(cached);
            continue;
          } catch (parseError) {
            // Invalid cache, continue to DB
          }
        }

        // Fallback to DB
        const coin = await Coin.findOne({ 
          $or: [
            { id: coinId },
            { symbol: coinId.toUpperCase() }
          ]
        });

        if (coin) {
          prices[coinId] = {
            currentPrice: coin.currentPrice,
            priceChangePercentage24h: coin.priceChangePercentage24h,
          };

          // Cache for 30 seconds
          await redisClient.setEx(
            cacheKey,
            30,
            JSON.stringify(prices[coinId])
          );
        }
      }
    } catch (error: any) {
      logger.error('Error fetching coin prices:', error.message);
    }

    return prices;
  }

  // Send initial prices to a socket
  private async sendPricesToSocket(socket: any, coinIds: string[]) {
    const prices = await this.getCoinPrices(coinIds);
    
    coinIds.forEach((coinId) => {
      const price = prices[coinId];
      if (price) {
        socket.emit('price:update', {
          coinId,
          price: price.currentPrice,
          priceUSD: price.currentPrice,
          priceChange24h: price.priceChangePercentage24h,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  // Manually trigger price update for a specific coin
  async updateCoinPrice(coinId: string, price: number, priceChange24h: number) {
    if (!this.io) return;

    const cacheKey = `coin:price:${coinId}`;
    const priceData = {
      currentPrice: price,
      priceChangePercentage24h: priceChange24h,
    };

    // Update cache
    await redisClient.setEx(cacheKey, 30, JSON.stringify(priceData));

    // Broadcast to subscribers
    const socketIds = this.subscribers.get(coinId);
    if (socketIds && socketIds.size > 0) {
      socketIds.forEach((socketId) => {
        this.io!.to(socketId).emit('price:update', {
          coinId,
          price,
          priceUSD: price,
          priceChange24h,
          timestamp: new Date().toISOString(),
        });
      });
    }
  }

  // Get number of subscribers for a coin
  getSubscriberCount(coinId: string): number {
    return this.subscribers.get(coinId)?.size || 0;
  }

  // Stop service
  stop() {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
    }
    logger.info('Realtime Price Service stopped');
  }
}

export default new RealtimePriceService();


