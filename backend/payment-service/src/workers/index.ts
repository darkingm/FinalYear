import { TxMonitorWorker } from './tx-monitor.worker';
import { PriceUpdaterWorker } from './price-updater.worker';
import { InventoryCleanerWorker } from './inventory-cleaner.worker';
import { PaymentOutboxWorker } from './payment-outbox.worker';
import { logger } from '../utils/logger';

export function startWorkers() {
  logger.info('Starting background workers...');

  const txMonitor = new TxMonitorWorker();
  txMonitor.start();

  const paymentOutbox = new PaymentOutboxWorker();
  paymentOutbox.start();

  const priceUpdater = new PriceUpdaterWorker();
  priceUpdater.start();

  const inventoryCleaner = new InventoryCleanerWorker();
  inventoryCleaner.start();

  logger.info('All workers started successfully');
}
