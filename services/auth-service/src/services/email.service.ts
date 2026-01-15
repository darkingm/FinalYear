import { enqueueEmail } from '../utils/rabbitmq';
import logger from '../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  priority?: number; // 0-10, higher = more priority
}

/**
 * Enqueue email to RabbitMQ queue
 * SMTP chỉ nhận và enqueue, không retry logic phức tạp
 * Retry logic sẽ được xử lý ở email worker
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    // Enqueue email to RabbitMQ
    await enqueueEmail({
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      priority: options.priority || 0,
    });

    logger.info('Email enqueued:', {
      to: options.to,
      subject: options.subject,
      priority: options.priority || 0,
    });
  } catch (error: any) {
    // Log error but don't throw - email is logged for manual retry if needed
    logger.error('Email enqueue error:', {
      error: error.message,
      to: options.to,
      subject: options.subject,
    });
    // Don't throw - allow app to continue
    // Email failure won't block the main flow
  }
};

export const sendSMS = async (to: string, message: string): Promise<void> => {
  try {
    // If Twilio is configured
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

      await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to,
      });

      logger.info('SMS sent:', { to });
    } else {
      logger.warn('Twilio not configured, SMS not sent:', { to, message });
    }
  } catch (error) {
    logger.error('SMS send error:', error);
    throw new Error('Failed to send SMS');
  }
};

