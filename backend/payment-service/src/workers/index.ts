import { TxMonitorWorker } from './tx-monitor.worker';
import { PriceUpdaterWorker } from './price-updater.worker';
import { logger } from '../utils/logger';

export function startWorkers() {
  logger.info('Starting background workers...');

  // Start transaction monitor worker
  const txMonitor = new TxMonitorWorker();
  txMonitor.start();

  // Start price updater worker
  const priceUpdater = new PriceUpdaterWorker();
  priceUpdater.start();

  logger.info('All workers started successfully');
}
