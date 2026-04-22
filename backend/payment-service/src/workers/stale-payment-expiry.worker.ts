import { CryptoPaymentService } from '../modules/crypto-payment/crypto-payment.service';
import { logger } from '../utils/logger';

export class StalePaymentExpiryWorker {
  private readonly cryptoPaymentService: CryptoPaymentService;
  private readonly intervalMs: number;
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;

  constructor({
    cryptoPaymentService = new CryptoPaymentService(),
    intervalMs = 5 * 60 * 1000,
  }: {
    cryptoPaymentService?: CryptoPaymentService;
    intervalMs?: number;
  } = {}) {
    this.cryptoPaymentService = cryptoPaymentService;
    this.intervalMs = intervalMs;
  }

  start() {
    logger.info('Starting stale payment expiry worker');
    void this.run();
    this.intervalId = setInterval(() => {
      void this.run();
    }, this.intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private async run() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const result = await this.cryptoPaymentService.expireStalePayments({
        source: 'worker',
      });

      if (result.expired_payment_count > 0) {
        logger.warn('Stale payment expiry worker marked payments as failed', result);
      }
    } catch (error: any) {
      logger.error('Stale payment expiry worker error', {
        error: error.message,
      });
    } finally {
      this.isRunning = false;
    }
  }
}
