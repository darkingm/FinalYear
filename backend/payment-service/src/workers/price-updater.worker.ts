import { BinanceService } from '../modules/pricing/binance.service';
import { logger } from '../utils/logger';

const SUPPORTED_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'MATICUSDT',
  'USDCUSDT',
  'DAIUSDT',
  'ARBUSDT',
  'LINKUSDT',
  'UNIUSDT',
  'AAVEUSDT',
];

export class PriceUpdaterWorker {
  private binanceService: BinanceService;
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;

  constructor() {
    this.binanceService = new BinanceService();
  }

  start() {
    logger.info('Starting price updater worker');
    
    // Run immediately
    this.run();
    
    // Then run every 1 second
    this.intervalId = setInterval(() => this.run(), 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      logger.info('Price updater worker stopped');
    }
  }

  private async run() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      // Fetch all prices at once
      await this.binanceService.getPrices(SUPPORTED_SYMBOLS);
      
      logger.debug('Updated prices for all supported symbols');
    } catch (error) {
      logger.error('Price updater worker error:', error);
    } finally {
      this.isRunning = false;
    }
  }
}
