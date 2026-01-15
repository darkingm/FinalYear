import crypto from 'crypto';
import querystring from 'querystring';
import logger from '../utils/logger';

interface VNPayConfig {
  tmnCode: string;
  hashSecret: string;
  url: string;
  returnUrl: string;
  ipnUrl: string;
}

class VNPayService {
  private config: VNPayConfig;

  constructor() {
    this.config = {
      tmnCode: process.env.VNPAY_TMN_CODE || 'U5CW5POH',
      hashSecret: process.env.VNPAY_HASH_SECRET || '84NWU0ONLFEQ7SQZYFUXSGRNA2PWZIJB',
      url: process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      returnUrl: process.env.VNPAY_RETURN_URL || 'http://localhost:3000/payment/vnpay/return',
      ipnUrl: process.env.VNPAY_IPN_URL || 'http://localhost:3003/api/v1/payments/vnpay/ipn',
    };
  }

  /**
   * Create payment URL
   */
  createPaymentUrl(params: {
    amount: number; // Amount in VND
    orderId: string;
    orderDescription: string;
    orderType?: string;
    locale?: string;
    userId: string;
  }): string {
    const date = new Date();
    const createDate = this.formatDate(date);
    const expireDate = this.formatDate(new Date(date.getTime() + 15 * 60 * 1000)); // 15 minutes

    const vnp_Params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.config.tmnCode,
      vnp_Amount: (params.amount * 100).toString(), // Convert to cents
      vnp_CurrCode: 'VND',
      vnp_TxnRef: params.orderId,
      vnp_OrderInfo: params.orderDescription,
      vnp_OrderType: params.orderType || 'other',
      vnp_Locale: params.locale || 'vn',
      vnp_ReturnUrl: this.config.returnUrl,
      vnp_IpAddr: '127.0.0.1', // Should get from request in production
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate,
    };

    // Add user ID to order info for tracking
    vnp_Params.vnp_OrderInfo = `${params.orderDescription} - User: ${params.userId}`;

    // Sort params
    const sortedParams = this.sortObject(vnp_Params);

    // Create query string
    const queryString = querystring.stringify(sortedParams, { encode: false });

    // Create secure hash
    const secureHash = this.createSecureHash(queryString);

    // Add secure hash to params
    const paymentUrl = `${this.config.url}?${queryString}&vnp_SecureHash=${secureHash}`;

    logger.info('VNPay payment URL created:', { orderId: params.orderId, amount: params.amount });

    return paymentUrl;
  }

  /**
   * Verify payment callback
   */
  verifyPaymentCallback(queryParams: Record<string, string>): {
    isValid: boolean;
    orderId: string;
    transactionId: string;
    amount: number;
    responseCode: string;
    message: string;
  } {
    const secureHash = queryParams.vnp_SecureHash;
    delete queryParams.vnp_SecureHash;

    // Sort params
    const sortedParams = this.sortObject(queryParams);

    // Create query string
    const queryString = querystring.stringify(sortedParams, { encode: false });

    // Verify hash
    const checkSum = this.createSecureHash(queryString);
    const isValid = secureHash === checkSum;

    const amount = parseFloat(queryParams.vnp_Amount || '0') / 100; // Convert from cents
    const responseCode = queryParams.vnp_ResponseCode || '';
    const transactionId = queryParams.vnp_TransactionNo || '';
    const orderId = queryParams.vnp_TxnRef || '';

    let message = '';
    switch (responseCode) {
      case '00':
        message = 'Giao dịch thành công';
        break;
      case '07':
        message = 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường)';
        break;
      case '09':
        message = 'Thẻ/Tài khoản chưa đăng ký dịch vụ InternetBanking';
        break;
      case '10':
        message = 'Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần';
        break;
      case '11':
        message = 'Đã hết hạn chờ thanh toán. Xin vui lòng vui lòng thực hiện lại giao dịch';
        break;
      case '12':
        message = 'Thẻ/Tài khoản bị khóa';
        break;
      case '13':
        message = 'Nhập sai mật khẩu xác thực giao dịch (OTP). Xin vui lòng thực hiện lại giao dịch';
        break;
      case '51':
        message = 'Tài khoản không đủ số dư để thực hiện giao dịch';
        break;
      case '65':
        message = 'Tài khoản đã vượt quá hạn mức giao dịch trong ngày';
        break;
      case '75':
        message = 'Ngân hàng thanh toán đang bảo trì';
        break;
      case '79':
        message = 'Nhập sai mật khẩu thanh toán quá số lần quy định';
        break;
      default:
        message = 'Giao dịch thất bại';
    }

    logger.info('VNPay callback verified:', {
      isValid,
      orderId,
      transactionId,
      amount,
      responseCode,
    });

    return {
      isValid,
      orderId,
      transactionId,
      amount,
      responseCode,
      message,
    };
  }

  /**
   * Create secure hash
   */
  private createSecureHash(queryString: string): string {
    const hmac = crypto.createHmac('sha512', this.config.hashSecret);
    return hmac.update(queryString, 'utf-8').digest('hex');
  }

  /**
   * Sort object by key
   */
  private sortObject(obj: Record<string, string>): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      sorted[key] = obj[key];
    }

    return sorted;
  }

  /**
   * Format date to VNPay format (yyyyMMddHHmmss)
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }
}

export default new VNPayService();

