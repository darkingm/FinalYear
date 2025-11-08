export enum NotificationType {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  ORDER_SHIPPED = 'ORDER_SHIPPED',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  P2P_TRADE_MATCHED = 'P2P_TRADE_MATCHED',
  P2P_PAYMENT_RECEIVED = 'P2P_PAYMENT_RECEIVED',
  P2P_COINS_RELEASED = 'P2P_COINS_RELEASED',
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  COMMENT_ON_POST = 'COMMENT_ON_POST',
  LIKE_ON_POST = 'LIKE_ON_POST',
  NEW_FOLLOWER = 'NEW_FOLLOWER',
  SELLER_APPLICATION_APPROVED = 'SELLER_APPLICATION_APPROVED',
  SELLER_APPLICATION_REJECTED = 'SELLER_APPLICATION_REJECTED',
  PRODUCT_APPROVED = 'PRODUCT_APPROVED',
  PRODUCT_REJECTED = 'PRODUCT_REJECTED',
  MARKET_REPORT = 'MARKET_REPORT',
  PRICE_ALERT = 'PRICE_ALERT',
  SYSTEM_ANNOUNCEMENT = 'SYSTEM_ANNOUNCEMENT',
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
}

export interface INotification {
  id: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  imageUrl?: string;
  actionUrl?: string;
  actionText?: string;
  createdAt: Date;
  readAt?: Date;
  sentAt?: Date;
}

export interface ICreateNotificationRequest {
  userId: string;
  type: NotificationType;
  channels: NotificationChannel[];
  title: string;
  message: string;
  data?: Record<string, any>;
  imageUrl?: string;
  actionUrl?: string;
  actionText?: string;
}

export interface INotificationPreferences {
  userId: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  orderUpdates: boolean;
  paymentUpdates: boolean;
  p2pTradeUpdates: boolean;
  chatMessages: boolean;
  socialUpdates: boolean;
  marketingEmails: boolean;
  marketReports: boolean;
  priceAlerts: boolean;
}

export interface IEmailTemplate {
  type: NotificationType;
  subject: string;
  htmlTemplate: string;
  textTemplate: string;
  variables: string[];
}

