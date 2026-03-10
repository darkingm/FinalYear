import { query } from '../config/database';
import { CryptoPaymentService } from '../modules/crypto-payment/crypto-payment.service';
import { logger } from '../utils/logger';

export class TxMonitorWorker {
  private cryptoPaymentService: CryptoPaymentService;
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;

  constructor() {
    this.cryptoPaymentService = new CryptoPaymentService();
  }

  start() {
    logger.info('Starting transaction monitor worker');
    
    // Run immediately
    this.run();
    
    // Then run every 10 seconds
    this.intervalId = setInterval(() => this.run(), 10000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      logger.info('Transaction monitor worker stopped');
    }
  }

  private async run() {
    if (this.isRunning) {
      return; // Skip if previous run is still ongoing
    }

    this.isRunning = true;

    try {
      // Get all pending payments
      const result = await query(
        `SELECT p.* 
         FROM payments p
         WHERE p.status IN ('pending', 'confirming') 
         AND p.tx_hash IS NOT NULL
         AND p.tx_hash NOT LIKE 'paypal-%'
         LIMIT 50`
      );

      logger.debug(`Monitoring ${result.rows.length} transactions`);

      // Verify each transaction
      for (const payment of result.rows) {
        try {
          await this.cryptoPaymentService.verifyTransaction(payment.tx_hash);
        } catch (error) {
          logger.error('Error verifying transaction', {
            tx_hash: payment.tx_hash,
            error,
          });
        }
      }
    } catch (error) {
      logger.error('Transaction monitor worker error:', error);
    } finally {
      this.isRunning = false;
    }
  }
}
