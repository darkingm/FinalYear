import { getEmailQueueLength, getRabbitMQState } from '../utils/rabbitmq';
import { getCacheStats } from '../utils/redisHotKey';
import { getEmailWorkerStatus } from '../workers/email.worker';
import logger from './logger';

// Monitoring configuration
const EMAIL_QUEUE_BACKLOG_THRESHOLD = parseInt(process.env.EMAIL_QUEUE_BACKLOG_THRESHOLD || '1000');
const MONITORING_INTERVAL = parseInt(process.env.MONITORING_INTERVAL_MS || '60000'); // 1 minute

interface MonitoringMetrics {
  timestamp: string;
  emailQueue: {
    length: number;
    threshold: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  rabbitMQ: {
    isConnected: boolean;
    hasConnection: boolean;
    hasChannel: boolean;
  };
  emailWorker: {
    isRunning: boolean;
    isProcessing: boolean;
  };
  cache: {
    localCacheSize: number;
    pendingRequests: number;
  };
}

let monitoringInterval: NodeJS.Timeout | null = null;
let lastAlertTime: number = 0;
const ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes between alerts

// Get current metrics
export async function getMetrics(): Promise<MonitoringMetrics> {
  try {
    const queueLength = await getEmailQueueLength();
    const rabbitMQState = getRabbitMQState();
    const emailWorkerStatus = getEmailWorkerStatus();
    const cacheStats = getCacheStats();

    let queueStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (queueLength > EMAIL_QUEUE_BACKLOG_THRESHOLD * 2) {
      queueStatus = 'critical';
    } else if (queueLength > EMAIL_QUEUE_BACKLOG_THRESHOLD) {
      queueStatus = 'warning';
    }

    return {
      timestamp: new Date().toISOString(),
      emailQueue: {
        length: queueLength,
        threshold: EMAIL_QUEUE_BACKLOG_THRESHOLD,
        status: queueStatus,
      },
      rabbitMQ: rabbitMQState,
      emailWorker: emailWorkerStatus,
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

// Alert when backlog exceeds threshold
async function checkAndAlert(): Promise<void> {
  try {
    const metrics = await getMetrics();
    const now = Date.now();

    // Check email queue backlog
    if (metrics.emailQueue.status === 'critical') {
      if (now - lastAlertTime > ALERT_COOLDOWN) {
        logger.error('🚨 CRITICAL: Email queue backlog exceeded threshold!', {
          queueLength: metrics.emailQueue.length,
          threshold: metrics.emailQueue.threshold,
          status: metrics.emailQueue.status,
        });
        lastAlertTime = now;
        // Here you can integrate with alerting systems like:
        // - Send to Slack/Discord webhook
        // - Send to PagerDuty
        // - Send email to admin
        // - Write to monitoring system (Prometheus, Datadog, etc.)
      }
    } else if (metrics.emailQueue.status === 'warning') {
      if (now - lastAlertTime > ALERT_COOLDOWN) {
        logger.warn('⚠️  WARNING: Email queue backlog approaching threshold', {
          queueLength: metrics.emailQueue.length,
          threshold: metrics.emailQueue.threshold,
          status: metrics.emailQueue.status,
        });
        lastAlertTime = now;
      }
    }

    // Check RabbitMQ connection
    if (!metrics.rabbitMQ.isConnected) {
      logger.error('🚨 CRITICAL: RabbitMQ connection lost!', {
        rabbitMQ: metrics.rabbitMQ,
      });
    }

    // Check email worker
    if (!metrics.emailWorker.isRunning) {
      logger.error('🚨 CRITICAL: Email worker is not running!', {
        emailWorker: metrics.emailWorker,
      });
    }

  } catch (error: any) {
    logger.error('Monitoring check failed:', error.message);
  }
}

// Start monitoring
export function startMonitoring(): void {
  if (monitoringInterval) {
    logger.warn('Monitoring already started');
    return;
  }

  logger.info('Starting monitoring service...');
  logger.info(`Email queue backlog threshold: ${EMAIL_QUEUE_BACKLOG_THRESHOLD}`);
  logger.info(`Monitoring interval: ${MONITORING_INTERVAL}ms`);

  // Run initial check
  checkAndAlert();

  // Set up periodic monitoring
  monitoringInterval = setInterval(() => {
    checkAndAlert();
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
    
    const isHealthy = 
      metrics.emailQueue.status !== 'critical' &&
      metrics.rabbitMQ.isConnected &&
      metrics.emailWorker.isRunning;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
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

