import amqp, { Channel, Connection } from 'amqplib';
import nodemailer from 'nodemailer';
import logger from '../utils/logger';

// Email worker configuration
const MAX_RETRY_ATTEMPTS = parseInt(process.env.EMAIL_MAX_RETRIES || '3');
const RETRY_DELAY_BASE = parseInt(process.env.EMAIL_RETRY_DELAY_MS || '5000'); // 5 seconds base delay

let connection: Connection | null = null;
let channel: Channel | null = null;
let transporter: nodemailer.Transporter | null = null;
let isProcessing = false;

// Initialize SMTP transporter
const initTransporter = (): nodemailer.Transporter => {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      // Connection pool for better performance
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  } else {
    logger.warn('SMTP not configured, emails will be logged only');
    // For development - use ethereal email
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'ethereal.user@ethereal.email',
        pass: 'ethereal.password',
      },
    });
  }

  return transporter;
};

// Send email via SMTP
const sendEmailViaSMTP = async (emailData: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}): Promise<void> => {
  const emailTransporter = initTransporter();

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@tokenasset.com',
    to: emailData.to,
    subject: emailData.subject,
    text: emailData.text,
    html: emailData.html,
  };

  const info = await emailTransporter.sendMail(mailOptions);

  logger.info('Email sent successfully:', {
    messageId: info.messageId,
    to: emailData.to,
    subject: emailData.subject,
  });

  // Log preview URL for development
  if (process.env.NODE_ENV === 'development') {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      logger.info('Email preview URL:', previewUrl);
    }
  }
};

// Process email message with retry logic
const processEmailMessage = async (message: amqp.ConsumeMessage | null): Promise<void> => {
  if (!message || !channel) return;

  try {
    const emailData = JSON.parse(message.content.toString());
    const { to, subject, text, html, attempts = 0 } = emailData;

    logger.info('Processing email:', {
      to,
      subject,
      attempts,
    });

    // Send email via SMTP
    await sendEmailViaSMTP({ to, subject, text, html });

    // Acknowledge message on success
    channel.ack(message);
    logger.info('Email processed successfully:', { to, subject });

  } catch (error: any) {
    logger.error('Email processing error:', {
      error: error.message,
      stack: error.stack,
    });

    // Parse message to get retry count
    try {
      const emailData = JSON.parse(message.content.toString());
      const attempts = (emailData.attempts || 0) + 1;

      if (attempts < MAX_RETRY_ATTEMPTS) {
        // Retry with exponential backoff
        const delay = RETRY_DELAY_BASE * Math.pow(2, attempts - 1);
        
        logger.warn('Retrying email:', {
          to: emailData.to,
          subject: emailData.subject,
          attempts,
          delay,
        });

        // Reject and requeue with delay
        // Note: RabbitMQ doesn't support delayed messages natively,
        // so we'll use a simple approach: reject and let it be requeued
        channel.nack(message, false, true); // requeue = true

        // In production, you might want to use a delayed exchange plugin
        // or a separate retry queue with TTL
      } else {
        // Max retries reached - send to dead letter queue
        logger.error('Max retries reached, sending to DLQ:', {
          to: emailData.to,
          subject: emailData.subject,
          attempts,
        });

        // Send to dead letter queue
        if (channel) {
          channel.sendToQueue(
            'email_queue_dlq',
            Buffer.from(JSON.stringify({
              ...emailData,
              attempts,
              failedAt: new Date().toISOString(),
              error: error.message,
            })),
            { persistent: true }
          );
        }

        // Acknowledge original message (remove from queue)
        channel.ack(message);
      }
    } catch (parseError: any) {
      logger.error('Failed to parse email message:', parseError.message);
      // Reject message without requeue (malformed message)
      channel.nack(message, false, false);
    }
  }
};

// Start email worker
export const startEmailWorker = async (): Promise<void> => {
  try {
    const RABBITMQ_HOST = process.env.RABBITMQ_HOST || 'localhost';
    const RABBITMQ_PORT = process.env.RABBITMQ_PORT || '5672';
    const RABBITMQ_USER = process.env.RABBITMQ_USER || 'guest';
    const RABBITMQ_PASS = process.env.RABBITMQ_PASS || 'guest';
    
    const RABBITMQ_URL = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@${RABBITMQ_HOST}:${RABBITMQ_PORT}`;
    
    logger.info(`Starting email worker, connecting to RabbitMQ at ${RABBITMQ_HOST}:${RABBITMQ_PORT}`);

    // Connect to RabbitMQ
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // Ensure queue exists
    await channel.assertQueue('email_queue', {
      durable: true,
      arguments: {
        'x-message-ttl': 86400000, // 24 hours
        'x-max-priority': 10,
      },
    });

    // Ensure DLQ exists
    await channel.assertQueue('email_queue_dlq', {
      durable: true,
    });

    // Set prefetch to process multiple emails concurrently
    await channel.prefetch(10); // Process up to 10 emails concurrently

    // Initialize transporter
    initTransporter();

    // Consume messages from email queue
    await channel.consume('email_queue', async (message) => {
      if (message) {
        isProcessing = true;
        await processEmailMessage(message);
        isProcessing = false;
      }
    }, {
      noAck: false, // Manual acknowledgment
    });

    logger.info('✅ Email worker started successfully');
    logger.info(`✅ Consuming from email_queue (prefetch: 10)`);

    // Handle connection errors
    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error in email worker:', err);
      connection = null;
      channel = null;
      // Attempt to reconnect
      setTimeout(() => {
        if (!connection || !channel) {
          logger.info('Attempting to reconnect email worker...');
          startEmailWorker().catch((err) => {
            logger.error('Failed to reconnect email worker:', err.message);
          });
        }
      }, 5000);
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed in email worker');
      connection = null;
      channel = null;
      // Attempt to reconnect
      setTimeout(() => {
        if (!connection || !channel) {
          logger.info('Attempting to reconnect email worker...');
          startEmailWorker().catch((err) => {
            logger.error('Failed to reconnect email worker:', err.message);
          });
        }
      }, 5000);
    });

  } catch (error: any) {
    logger.error('Failed to start email worker:', error.message);
    logger.warn('Email worker will not process emails until RabbitMQ is available');
    // Don't throw - allow app to continue
  }
};

// Stop email worker
export const stopEmailWorker = async (): Promise<void> => {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    if (connection) {
      await connection.close();
      connection = null;
    }
    logger.info('Email worker stopped');
  } catch (error: any) {
    logger.error('Error stopping email worker:', error.message);
  }
};

// Get worker status
export const getEmailWorkerStatus = () => ({
  isRunning: connection !== null && channel !== null,
  isProcessing,
  hasConnection: connection !== null,
  hasChannel: channel !== null,
});


