import { getCacheStats } from './utils/redisHotKey';
import logger from './logger';

// Monitoring configuration
const MONITORING_INTERVAL = parseInt(process.env.MONITORING_INTERVAL_MS || '60000'); // 1 minute

interface MonitoringMetrics {
  timestamp: string;
  cache: {
    localCacheSize: number;
    pendingRequests: number;
  };
}

let monitoringInterval: NodeJS.Timeout | null = null;

// Get current metrics
export async function getMetrics(): Promise<MonitoringMetrics> {
  try {
    const cacheStats = getCacheStats();

    return {
      timestamp: new Date().toISOString(),
      cache: {
        localCacheSize: cacheStats.localCache.size,
        pendingRequests: cacheStats.pendingRequests,
      },
    };
  } catch (error: any) {
    logger.error('Failed to get metrics:', error.message);
    throw error;
  }
}

// Start monitoring
export function startMonitoring(): void {
  if (monitoringInterval) {
    logger.warn('Monitoring already started');
    return;
  }

  logger.info('Starting monitoring service...');
  logger.info(`Monitoring interval: ${MONITORING_INTERVAL}ms`);

  // Set up periodic monitoring
  monitoringInterval = setInterval(() => {
    getMetrics().then((metrics) => {
      logger.debug('Monitoring metrics:', metrics);
    }).catch((error) => {
      logger.error('Monitoring check failed:', error.message);
    });
  }, MONITORING_INTERVAL);

  logger.info('✅ Monitoring service started');
}

// Stop monitoring
export function stopMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    logger.info('Monitoring service stopped');
  }
}

// Health check endpoint data
export async function getHealthCheck(): Promise<any> {
  try {
    const metrics = await getMetrics();
    
    return {
      status: 'healthy',
      timestamp: metrics.timestamp,
      metrics,
    };
  } catch (error: any) {
    logger.error('Health check failed:', error.message);
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }
}


