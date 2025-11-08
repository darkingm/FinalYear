import nodemailer from 'nodemailer';
import logger from '../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

let transporter: nodemailer.Transporter | null = null;

// Initialize transporter
const initTransporter = () => {
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
    });
  } else {
    // For development - use ethereal email
    logger.warn('SMTP not configured, emails will be logged only');
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

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    const emailTransporter = initTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@tokenasset.com',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    const info = await emailTransporter.sendMail(mailOptions);
    
    logger.info('Email sent:', {
      messageId: info.messageId,
      to: options.to,
      subject: options.subject,
    });

    // Log preview URL for development
    if (process.env.NODE_ENV === 'development') {
      logger.info('Preview URL:', nodemailer.getTestMessageUrl(info));
    }
  } catch (error) {
    logger.error('Email send error:', error);
    throw new Error('Failed to send email');
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

